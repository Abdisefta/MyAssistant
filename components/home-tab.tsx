import { Ionicons } from '@expo/vector-icons';
import { Image } from 'expo-image';
import * as ImagePicker from 'expo-image-picker';
import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Modal,
  Pressable,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';

import { APP_COLORS as COLORS } from '@/constants/app-theme';
import { APP_VERSION } from '@/constants/app-version';
import { getSpeechLocale } from '@/constants/i18n/resolve-locale';
import { useLocale } from '@/contexts/locale-context';
import {
  buildBriefingLines,
  buildMeetingPrepLines,
  getBriefingKind,
  getNextUpcomingMeeting,
  minutesUntil,
} from '@/services/briefing';
import {
  categorizeCalendar,
  groupEventsByCategory,
  type CalendarGroup,
} from '@/services/calendar-groups';
import {
  fetchEventsForDay,
  fetchLocalEventsForDay,
  formatEventTime,
  type CalendarEventItem,
} from '@/services/device-calendar';
import {
  formatUsageMinutes,
  getUsageStats,
  type UsageStats,
} from '@/services/usage-stats';
import { fetchWeather, type WeatherSnapshot } from '@/services/weather';
import { persistProfilePhoto } from '@/services/profile-photo';
import type { AgentTask } from '@/types/memory';
import type { Translations } from '@/constants/i18n/types';

const AVATAR_OPTIONS = [
  { id: 'purple', color: '#8B7CF7', icon: 'person' as const },
  { id: 'sky', color: '#38BDF8', icon: 'briefcase' as const },
  { id: 'mint', color: '#34D399', icon: 'heart' as const },
  { id: 'amber', color: '#FBBF24', icon: 'star' as const },
  { id: 'rose', color: '#FB7185', icon: 'flower' as const },
  { id: 'indigo', color: '#818CF8', icon: 'sparkles' as const },
];

type Props = {
  userId: string;
  userName?: string;
  userJob?: string;
  profilePhotoUri?: string;
  onProfilePhotoChange?: (uri: string | undefined) => void;
  tasks: AgentTask[];
  googleAccessToken?: string;
  onOpenAssistant: () => void;
  onOpenAssistantWithPrompt?: (prompt: string) => void;
  onOpenCalendar: () => void;
  onOpenEmail?: () => void;
  onOpenTasks: () => void;
  onSickDay?: () => void;
  isSickDayBusy?: boolean;
};

function getTimeGreeting(
  hour: number,
  strings: {
    greetingMorning: string;
    greetingAfternoon: string;
    greetingEvening: string;
    greetingNight: string;
  },
): string {
  if (hour >= 5 && hour < 11) return strings.greetingMorning;
  if (hour >= 11 && hour < 17) return strings.greetingAfternoon;
  if (hour >= 17 && hour < 22) return strings.greetingEvening;
  return strings.greetingNight;
}

async function fetchUnreadCount(accessToken: string): Promise<number | null> {
  try {
    const res = await fetch('https://gmail.googleapis.com/gmail/v1/users/me/labels/INBOX', {
      headers: { Authorization: `Bearer ${accessToken}` },
    });
    if (!res.ok) return null;
    const data = await res.json();
    return typeof data.messagesUnread === 'number' ? data.messagesUnread : null;
  } catch {
    return null;
  }
}

const GROUP_META: Record<
  CalendarGroup,
  { icon: React.ComponentProps<typeof Ionicons>['name']; color: string }
> = {
  family: { icon: 'people-outline', color: '#7DD3FC' },
  work: { icon: 'briefcase-outline', color: COLORS.purple },
  colleagues: { icon: 'people-circle-outline', color: '#A5B4FC' },
  other: { icon: 'calendar-outline', color: COLORS.textMuted },
};

function groupLabel(group: CalendarGroup, home: Translations['home']): string {
  switch (group) {
    case 'family':
      return home.calendarFamily;
    case 'work':
      return home.calendarWork;
    case 'colleagues':
      return home.calendarColleagues;
    default:
      return home.calendarOther;
  }
}

export function HomeTab({
  userId,
  userName,
  userJob,
  profilePhotoUri,
  onProfilePhotoChange,
  tasks,
  googleAccessToken,
  onOpenAssistant,
  onOpenAssistantWithPrompt,
  onOpenCalendar,
  onOpenEmail,
  onOpenTasks,
  onSickDay,
  isSickDayBusy,
}: Props) {
  const { locale, strings, t } = useLocale();
  const speechTag = getSpeechLocale(locale);

  const [now, setNow] = useState(() => new Date());
  const [weather, setWeather] = useState<WeatherSnapshot | null>(null);
  const [meetings, setMeetings] = useState<CalendarEventItem[]>([]);
  const [tomorrowMeetings, setTomorrowMeetings] = useState<CalendarEventItem[]>([]);
  const [unread, setUnread] = useState<number | null>(null);
  const [usage, setUsage] = useState<UsageStats | null>(null);
  const [meetingsLoading, setMeetingsLoading] = useState(true);
  const [weatherLoading, setWeatherLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [avatarPickerOpen, setAvatarPickerOpen] = useState(false);
  const [pickingPhoto, setPickingPhoto] = useState(false);

  const openTasks = tasks.filter((task) => !task.done);
  const firstName = userName?.trim().split(/\s+/)[0];
  const avatarInitials = (firstName?.[0] ?? userName?.[0] ?? '?').toUpperCase();

  const selectedAvatar = useMemo(() => {
    if (!profilePhotoUri?.startsWith('avatar:')) return null;
    const id = profilePhotoUri.slice('avatar:'.length);
    return AVATAR_OPTIONS.find((option) => option.id === id) ?? null;
  }, [profilePhotoUri]);

  const openAvatarPicker = useCallback(() => {
    if (!onProfilePhotoChange) return;
    setAvatarPickerOpen(true);
  }, [onProfilePhotoChange]);

  const chooseAvatar = useCallback(
    (avatarId: string) => {
      onProfilePhotoChange?.(`avatar:${avatarId}`);
      setAvatarPickerOpen(false);
    },
    [onProfilePhotoChange],
  );

  const pickFromGallery = useCallback(async () => {
    if (!onProfilePhotoChange || pickingPhoto) return;

    setPickingPhoto(true);
    try {
      const permission = await ImagePicker.requestMediaLibraryPermissionsAsync();
      if (!permission.granted) {
        Alert.alert(
          'Behörighet behövs',
          'Ge My Assistant tillgång till bilder i telefonens inställningar, sedan kan du välja profilbild.',
        );
        return;
      }

      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ['images'],
        allowsEditing: true,
        aspect: [1, 1],
        quality: 0.85,
      });

      if (result.canceled || !result.assets[0]?.uri) return;

      const savedUri = await persistProfilePhoto(result.assets[0].uri);
      onProfilePhotoChange(savedUri);
      setAvatarPickerOpen(false);
    } catch {
      Alert.alert('Kunde inte spara bilden', 'Prova en annan bild.');
    } finally {
      setPickingPhoto(false);
    }
  }, [onProfilePhotoChange, pickingPhoto]);
  const greeting = getTimeGreeting(now.getHours(), strings.home);
  const briefingKind = getBriefingKind(now.getHours());

  const nextMeeting = useMemo(
    () => getNextUpcomingMeeting(meetings, now),
    [meetings, now],
  );

  const groupedMeetings = useMemo(() => groupEventsByCategory(meetings), [meetings]);

  const briefingLines = useMemo(() => {
    if (!briefingKind) return [];
    return buildBriefingLines({
      kind: briefingKind,
      firstName,
      weather,
      todayMeetings: meetings,
      tomorrowMeetings,
      openTasks,
      unreadMail: unread,
    });
  }, [briefingKind, firstName, weather, meetings, tomorrowMeetings, openTasks, unread]);

  const meetingPrepLines = useMemo(
    () => (nextMeeting ? buildMeetingPrepLines(nextMeeting, now) : []),
    [nextMeeting, now],
  );

  const loadDashboard = useCallback(async () => {
    const today = new Date();
    const tomorrow = new Date(today);
    tomorrow.setDate(tomorrow.getDate() + 1);

    void (async () => {
      try {
        const localMeetings = await fetchLocalEventsForDay(today, userId);
        setMeetings(localMeetings.sort((a, b) => a.start.getTime() - b.start.getTime()));
      } finally {
        setMeetingsLoading(false);
      }

      try {
        const fullMeetings = await fetchEventsForDay(today, userId);
        setMeetings(fullMeetings.sort((a, b) => a.start.getTime() - b.start.getTime()));
      } catch {
        // lokala möten visas redan
      }

      try {
        const tomorrowEvents = await fetchEventsForDay(tomorrow, userId);
        setTomorrowMeetings(
          tomorrowEvents.sort((a, b) => a.start.getTime() - b.start.getTime()),
        );
      } catch {
        setTomorrowMeetings([]);
      }
    })();

    void fetchWeather(locale)
      .then((weatherData) => setWeather(weatherData))
      .finally(() => setWeatherLoading(false));

    if (googleAccessToken) {
      setUnread(await fetchUnreadCount(googleAccessToken));
    } else {
      setUnread(null);
    }

    setUsage(await getUsageStats(userId));
  }, [googleAccessToken, locale, userId]);

  useEffect(() => {
    setMeetingsLoading(true);
    setWeatherLoading(true);
    void loadDashboard();
  }, [loadDashboard]);

  useEffect(() => {
    const timer = setInterval(() => setNow(new Date()), 30_000);
    return () => clearInterval(timer);
  }, []);

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    setMeetingsLoading(true);
    setWeatherLoading(true);
    await loadDashboard();
    setRefreshing(false);
  }, [loadDashboard]);

  const dateLine = now.toLocaleDateString(speechTag, {
    weekday: 'long',
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  });
  const timeLine = now.toLocaleTimeString(speechTag, {
    hour: '2-digit',
    minute: '2-digit',
  });

  const visibleGroups: CalendarGroup[] = ['family', 'colleagues', 'work', 'other'];

  return (
    <>
    <ScrollView
      style={styles.container}
      contentContainerStyle={styles.content}
      showsVerticalScrollIndicator={false}
      refreshControl={
        <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={COLORS.purple} />
      }
    >
      <View style={styles.hero}>
        <View style={styles.heroRow}>
          <Pressable
            style={styles.avatarButton}
            onPress={openAvatarPicker}
            accessibilityLabel="Byt profilbild"
          >
            {profilePhotoUri && !profilePhotoUri.startsWith('avatar:') ? (
              <Image source={{ uri: profilePhotoUri }} style={styles.avatarImage} contentFit="cover" />
            ) : (
              <View
                style={[
                  styles.avatarFallback,
                  selectedAvatar && { backgroundColor: `${selectedAvatar.color}33`, borderColor: selectedAvatar.color },
                ]}
              >
                {selectedAvatar ? (
                  <Ionicons name={selectedAvatar.icon} size={32} color={selectedAvatar.color} />
                ) : (
                  <Text style={styles.avatarInitials}>{avatarInitials}</Text>
                )}
              </View>
            )}
            <View style={styles.avatarBadge}>
              <Ionicons name="camera" size={14} color={COLORS.text} />
            </View>
          </Pressable>
          <View style={styles.heroText}>
            <Text style={styles.greeting}>
              {firstName
                ? t('home.greetingName', { greeting, name: firstName })
                : greeting}
            </Text>
            <Text style={styles.dateLine}>{dateLine}</Text>
            <Text style={styles.timeLine}>{timeLine}</Text>
          </View>
        </View>
        {userJob ? <Text style={styles.jobLine}>{userJob}</Text> : null}
        <Text style={styles.versionLine}>Version {APP_VERSION}</Text>
      </View>

      {briefingKind && briefingLines.length > 0 ? (
        <View style={styles.briefingCard}>
          <View style={styles.cardHeader}>
            <Ionicons
              name={briefingKind === 'morning' ? 'sunny-outline' : 'moon-outline'}
              size={20}
              color={COLORS.purple}
            />
            <Text style={styles.sectionTitle}>
              {briefingKind === 'morning'
                ? strings.home.briefingMorning
                : strings.home.briefingEvening}
            </Text>
          </View>
          {briefingLines.map((line) => (
            <Text key={line} style={styles.briefingLine}>
              {line}
            </Text>
          ))}
        </View>
      ) : null}

      <Pressable
        style={styles.prepCard}
        onPress={() => {
          if (nextMeeting) {
            onOpenAssistantWithPrompt?.(
              `Förbered mig inför mötet "${nextMeeting.title}"${nextMeeting.location ? ` på ${nextMeeting.location}` : ''}.`,
            );
          } else {
            onOpenAssistant();
          }
        }}
      >
        <View style={styles.cardHeader}>
          <Ionicons name="document-text-outline" size={20} color={COLORS.purple} />
          <Text style={styles.sectionTitle}>{strings.home.meetingPrep}</Text>
        </View>
        {nextMeeting ? (
          <>
            <Text style={styles.prepTitle}>{strings.home.meetingPrepNext}</Text>
            {meetingPrepLines.map((line, index) => (
              <Text
                key={`${line}-${index}`}
                style={index === 0 ? styles.prepHeadline : styles.prepLine}
              >
                {line}
              </Text>
            ))}
          </>
        ) : (
          <Text style={styles.muted}>{strings.home.meetingPrepNone}</Text>
        )}
        <Text style={styles.prepHint}>{strings.home.meetingPrepAsk}</Text>
      </Pressable>

      <View style={styles.weatherCard}>
        <View style={styles.cardHeader}>
          <Ionicons name="partly-sunny-outline" size={20} color={COLORS.purple} />
          <Text style={styles.sectionTitle}>{strings.home.weather}</Text>
        </View>
        {weatherLoading && !weather ? (
          <ActivityIndicator color={COLORS.purple} style={styles.inlineLoader} />
        ) : weather ? (
          <View style={styles.weatherRow}>
            <Text style={styles.weatherEmoji}>{weather.emoji}</Text>
            <View style={styles.weatherBody}>
              <Text style={styles.weatherTemp}>{weather.temperature}°</Text>
              <Text style={styles.weatherMeta}>
                {weather.description} · {weather.city}
              </Text>
            </View>
          </View>
        ) : (
          <Text style={styles.muted}>{strings.home.weatherUnavailable}</Text>
        )}
      </View>

      {usage ? (
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>{strings.home.usageTitle}</Text>
          <View style={styles.statsRow}>
            <View style={styles.statCard}>
              <Ionicons name="phone-portrait-outline" size={18} color={COLORS.purple} />
              <Text style={styles.statValue}>{usage.appOpens}</Text>
              <Text style={styles.statLabel}>{strings.home.usageOpens}</Text>
            </View>
            <View style={styles.statCard}>
              <Ionicons name="time-outline" size={18} color={COLORS.purple} />
              <Text style={styles.statValue}>{formatUsageMinutes(usage.totalMinutes)}</Text>
              <Text style={styles.statLabel}>{strings.home.usageMinutes}</Text>
            </View>
            <View style={styles.statCard}>
              <Ionicons name="today-outline" size={18} color={COLORS.purple} />
              <Text style={styles.statValue}>{usage.sessionsToday}</Text>
              <Text style={styles.statLabel}>{strings.home.usageSessionsToday}</Text>
            </View>
            <View style={styles.statCard}>
              <Ionicons name="chatbubble-outline" size={18} color={COLORS.purple} />
              <Text style={styles.statValue}>{usage.assistantMessages}</Text>
              <Text style={styles.statLabel}>{strings.home.usageChats}</Text>
            </View>
          </View>
        </View>
      ) : null}

      <View style={styles.statsRow}>
        <Pressable style={styles.statCard} onPress={() => onOpenEmail?.()}>
          <Ionicons name="mail-outline" size={18} color={COLORS.purple} />
          <Text style={styles.statValue}>{unread ?? '—'}</Text>
          <Text style={styles.statLabel}>{strings.home.unreadMail}</Text>
        </Pressable>

        <Pressable style={styles.statCard} onPress={onOpenCalendar}>
          <Ionicons name="calendar-outline" size={18} color={COLORS.purple} />
          <Text style={styles.statValue}>{meetings.length}</Text>
          <Text style={styles.statLabel}>{strings.home.meetingsToday}</Text>
        </Pressable>

        <Pressable style={styles.statCard} onPress={onOpenTasks}>
          <Ionicons name="checkbox-outline" size={18} color={COLORS.purple} />
          <Text style={styles.statValue}>{openTasks.length}</Text>
          <Text style={styles.statLabel}>{strings.home.openTasks}</Text>
        </Pressable>
      </View>

      <View style={styles.section}>
        <Text style={styles.sectionTitle}>{strings.home.calendarGrouped}</Text>
        {meetingsLoading && meetings.length === 0 ? (
          <ActivityIndicator color={COLORS.purple} style={styles.inlineLoader} />
        ) : (
          visibleGroups.map((group) => {
            const events = groupedMeetings[group];
            if (!events.length) return null;
            const meta = GROUP_META[group];
            return (
              <View key={group} style={styles.groupCard}>
                <View style={styles.groupHeader}>
                  <Ionicons name={meta.icon} size={18} color={meta.color} />
                  <Text style={styles.groupTitle}>{groupLabel(group, strings.home)}</Text>
                  <Text style={styles.groupCount}>{events.length}</Text>
                </View>
                {events.slice(0, 3).map((event) => (
                  <Pressable key={event.id} style={styles.groupEventRow} onPress={onOpenCalendar}>
                    <Text style={styles.groupEventTime}>
                      {event.allDay
                        ? strings.home.allDay
                        : event.start.toLocaleTimeString(speechTag, {
                            hour: '2-digit',
                            minute: '2-digit',
                          })}
                    </Text>
                    <View style={styles.groupEventBody}>
                      <Text style={styles.groupEventTitle}>{event.title}</Text>
                      <Text style={styles.groupEventMeta}>
                        {event.calendarName || categorizeCalendar(event.title)}
                        {event.location ? ` · ${event.location}` : ''}
                      </Text>
                    </View>
                  </Pressable>
                ))}
              </View>
            );
          })
        )}
        {!meetingsLoading && meetings.length === 0 ? (
          <Text style={styles.muted}>{strings.home.noMeetings}</Text>
        ) : null}
      </View>

      <View style={styles.section}>
        <Text style={styles.sectionTitle}>{strings.home.meetingsToday}</Text>
        {meetingsLoading && meetings.length === 0 ? (
          <ActivityIndicator color={COLORS.purple} style={styles.inlineLoader} />
        ) : meetings.length === 0 ? (
          <Text style={styles.muted}>{strings.home.noMeetings}</Text>
        ) : (
          meetings.map((event) => (
            <Pressable
              key={event.id}
              style={styles.meetingRow}
              onPress={onOpenCalendar}
            >
              <View style={styles.meetingTimeCol}>
                <Text style={styles.meetingTime}>
                  {event.allDay
                    ? strings.home.allDay
                    : event.start.toLocaleTimeString(speechTag, {
                        hour: '2-digit',
                        minute: '2-digit',
                      })}
                </Text>
                {nextMeeting?.id === event.id && !event.allDay ? (
                  <Text style={styles.meetingSoon}>
                    {minutesUntil(event.start, now)} min
                  </Text>
                ) : null}
              </View>
              <View style={styles.meetingBody}>
                <Text style={styles.meetingTitle}>{event.title}</Text>
                {!event.allDay ? (
                  <Text style={styles.meetingMeta}>{formatEventTime(event)}</Text>
                ) : null}
                {event.location ? (
                  <Text style={styles.meetingMeta}>{event.location}</Text>
                ) : null}
                {event.calendarName ? (
                  <Text style={styles.meetingMeta}>{event.calendarName}</Text>
                ) : null}
              </View>
            </Pressable>
          ))
        )}
      </View>

      {openTasks.length > 0 ? (
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>{strings.home.openTasks}</Text>
          {openTasks.slice(0, 3).map((task) => (
            <Pressable key={task.id} style={styles.taskRow} onPress={onOpenTasks}>
              <Ionicons name="ellipse-outline" size={14} color={COLORS.purple} />
              <Text style={styles.taskText} numberOfLines={2}>{task.text}</Text>
            </Pressable>
          ))}
        </View>
      ) : null}

      <Pressable style={styles.assistantButton} onPress={onOpenAssistant}>
        <Ionicons name="mic-outline" size={22} color={COLORS.text} />
        <Text style={styles.assistantButtonText}>{strings.home.talkToAssistant}</Text>
      </Pressable>

      {onSickDay ? (
        <Pressable
          style={[styles.sickButton, isSickDayBusy && styles.sickButtonDisabled]}
          onPress={onSickDay}
          disabled={isSickDayBusy}
        >
          {isSickDayBusy ? (
            <ActivityIndicator color="#FFB4B4" size="small" />
          ) : (
            <Ionicons name="medkit-outline" size={20} color="#FFB4B4" />
          )}
          <Text style={styles.sickButtonText}>Jag är sjuk</Text>
          <Text style={styles.sickButtonHint}>Avbokar dagens möten och mailar</Text>
        </Pressable>
      ) : null}

      <View style={styles.adaptCard}>
        <Ionicons name="sparkles" size={16} color={COLORS.purple} />
        <Text style={styles.adaptText}>{strings.home.adaptHint}</Text>
      </View>
    </ScrollView>

    <Modal visible={avatarPickerOpen} transparent animationType="fade" onRequestClose={() => setAvatarPickerOpen(false)}>
      <Pressable style={styles.avatarModalBackdrop} onPress={() => setAvatarPickerOpen(false)}>
        <Pressable style={styles.avatarModalCard} onPress={(event) => event.stopPropagation()}>
          <Text style={styles.avatarModalTitle}>Välj profilbild</Text>

          <Pressable
            style={[styles.galleryButton, pickingPhoto && styles.galleryButtonDisabled]}
            onPress={() => void pickFromGallery()}
            disabled={pickingPhoto}
          >
            {pickingPhoto ? (
              <ActivityIndicator color={COLORS.text} />
            ) : (
              <>
                <Ionicons name="images-outline" size={22} color={COLORS.purple} />
                <Text style={styles.galleryButtonText}>Välj bild från telefonen</Text>
              </>
            )}
          </Pressable>

          <Text style={styles.avatarModalDivider}>eller välj ikon</Text>

          <View style={styles.avatarGrid}>
            {AVATAR_OPTIONS.map((option) => {
              const active = profilePhotoUri === `avatar:${option.id}`;
              return (
                <Pressable
                  key={option.id}
                  style={[styles.avatarChoice, active && styles.avatarChoiceActive]}
                  onPress={() => chooseAvatar(option.id)}
                >
                  <View style={[styles.avatarChoiceCircle, { backgroundColor: `${option.color}33`, borderColor: option.color }]}>
                    <Ionicons name={option.icon} size={28} color={option.color} />
                  </View>
                </Pressable>
              );
            })}
          </View>
          <Text style={styles.avatarModalHint}>Din bild sparas bara på telefonen.</Text>
        </Pressable>
      </Pressable>
    </Modal>
  </>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: COLORS.background,
  },
  content: {
    padding: 20,
    paddingTop: 12,
    paddingBottom: 28,
    gap: 16,
  },
  hero: {
    gap: 8,
  },
  heroRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14,
  },
  heroText: {
    flex: 1,
    gap: 4,
  },
  avatarButton: {
    width: 72,
    height: 72,
    borderRadius: 36,
    position: 'relative',
  },
  avatarImage: {
    width: 72,
    height: 72,
    borderRadius: 36,
    borderWidth: 2,
    borderColor: COLORS.purple,
  },
  avatarFallback: {
    width: 72,
    height: 72,
    borderRadius: 36,
    backgroundColor: COLORS.purpleMuted,
    borderWidth: 2,
    borderColor: 'rgba(139, 124, 247, 0.45)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarInitials: {
    fontSize: 28,
    fontWeight: '700',
    color: COLORS.purple,
  },
  avatarBadge: {
    position: 'absolute',
    right: -2,
    bottom: -2,
    width: 26,
    height: 26,
    borderRadius: 13,
    backgroundColor: COLORS.purpleDark,
    borderWidth: 2,
    borderColor: COLORS.background,
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarModalBackdrop: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.65)',
    justifyContent: 'center',
    padding: 24,
  },
  avatarModalCard: {
    backgroundColor: COLORS.surface,
    borderRadius: 18,
    borderWidth: 1,
    borderColor: COLORS.border,
    padding: 20,
    gap: 14,
  },
  avatarModalTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: COLORS.text,
    textAlign: 'center',
  },
  galleryButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 10,
    backgroundColor: COLORS.purpleMuted,
    borderWidth: 1,
    borderColor: 'rgba(139, 124, 247, 0.45)',
    borderRadius: 14,
    paddingVertical: 14,
    paddingHorizontal: 16,
  },
  galleryButtonDisabled: {
    opacity: 0.7,
  },
  galleryButtonText: {
    fontSize: 16,
    fontWeight: '600',
    color: COLORS.text,
  },
  avatarModalDivider: {
    fontSize: 12,
    color: COLORS.textMuted,
    textAlign: 'center',
    textTransform: 'uppercase',
    letterSpacing: 0.4,
  },
  avatarGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'center',
    gap: 12,
  },
  avatarChoice: {
    padding: 4,
    borderRadius: 999,
  },
  avatarChoiceActive: {
    backgroundColor: COLORS.purpleMuted,
  },
  avatarChoiceCircle: {
    width: 64,
    height: 64,
    borderRadius: 32,
    borderWidth: 2,
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarModalHint: {
    fontSize: 12,
    color: COLORS.textMuted,
    textAlign: 'center',
    lineHeight: 18,
  },
  greeting: {
    fontSize: 22,
    fontWeight: '700',
    color: COLORS.text,
  },
  dateLine: {
    fontSize: 15,
    color: COLORS.purple,
    textTransform: 'capitalize',
  },
  timeLine: {
    fontSize: 32,
    fontWeight: '600',
    color: COLORS.text,
    letterSpacing: -0.5,
  },
  jobLine: {
    fontSize: 14,
    color: COLORS.textMuted,
    marginTop: 4,
  },
  versionLine: {
    fontSize: 12,
    color: COLORS.purple,
    marginTop: 6,
    fontWeight: '600',
  },
  cardHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  briefingCard: {
    backgroundColor: COLORS.surface,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: COLORS.border,
    padding: 16,
    gap: 8,
  },
  briefingLine: {
    fontSize: 14,
    color: COLORS.text,
    lineHeight: 20,
  },
  prepCard: {
    backgroundColor: COLORS.surface,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: COLORS.border,
    padding: 16,
    gap: 6,
  },
  prepTitle: {
    fontSize: 12,
    fontWeight: '600',
    color: COLORS.purple,
    textTransform: 'uppercase',
    letterSpacing: 0.4,
    marginTop: 4,
  },
  prepHeadline: {
    fontSize: 16,
    fontWeight: '700',
    color: COLORS.text,
  },
  prepLine: {
    fontSize: 13,
    color: COLORS.textMuted,
    lineHeight: 18,
  },
  prepHint: {
    fontSize: 12,
    color: COLORS.purple,
    marginTop: 6,
  },
  weatherCard: {
    backgroundColor: COLORS.surface,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: COLORS.border,
    padding: 16,
    gap: 10,
  },
  weatherRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  weatherEmoji: {
    fontSize: 36,
  },
  weatherBody: {
    gap: 2,
  },
  weatherTemp: {
    fontSize: 28,
    fontWeight: '700',
    color: COLORS.text,
  },
  weatherMeta: {
    fontSize: 14,
    color: COLORS.textMuted,
  },
  statsRow: {
    flexDirection: 'row',
    gap: 8,
  },
  statCard: {
    flex: 1,
    backgroundColor: COLORS.surface,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: COLORS.border,
    paddingVertical: 12,
    paddingHorizontal: 6,
    alignItems: 'center',
    gap: 4,
  },
  statValue: {
    fontSize: 16,
    fontWeight: '700',
    color: COLORS.text,
    textAlign: 'center',
  },
  statLabel: {
    fontSize: 9,
    color: COLORS.textMuted,
    textAlign: 'center',
  },
  section: {
    gap: 10,
  },
  sectionTitle: {
    fontSize: 13,
    fontWeight: '600',
    color: COLORS.purple,
    textTransform: 'uppercase',
    letterSpacing: 0.4,
  },
  muted: {
    fontSize: 14,
    color: COLORS.textMuted,
  },
  inlineLoader: {
    alignSelf: 'flex-start',
  },
  groupCard: {
    backgroundColor: COLORS.surface,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: COLORS.border,
    padding: 12,
    gap: 8,
  },
  groupHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  groupTitle: {
    flex: 1,
    fontSize: 14,
    fontWeight: '700',
    color: COLORS.text,
  },
  groupCount: {
    fontSize: 12,
    fontWeight: '600',
    color: COLORS.purple,
  },
  groupEventRow: {
    flexDirection: 'row',
    gap: 10,
    paddingTop: 4,
  },
  groupEventTime: {
    minWidth: 48,
    fontSize: 12,
    fontWeight: '600',
    color: COLORS.purple,
  },
  groupEventBody: {
    flex: 1,
    gap: 2,
  },
  groupEventTitle: {
    fontSize: 14,
    fontWeight: '600',
    color: COLORS.text,
  },
  groupEventMeta: {
    fontSize: 11,
    color: COLORS.textMuted,
  },
  meetingRow: {
    flexDirection: 'row',
    gap: 12,
    backgroundColor: COLORS.surface,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: COLORS.border,
    padding: 14,
  },
  meetingTimeCol: {
    minWidth: 52,
  },
  meetingTime: {
    fontSize: 14,
    fontWeight: '600',
    color: COLORS.purple,
  },
  meetingSoon: {
    fontSize: 11,
    color: '#7DD3FC',
    marginTop: 2,
    fontWeight: '600',
  },
  meetingBody: {
    flex: 1,
    gap: 2,
  },
  meetingTitle: {
    fontSize: 15,
    fontWeight: '600',
    color: COLORS.text,
  },
  meetingMeta: {
    fontSize: 12,
    color: COLORS.textMuted,
  },
  taskRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    backgroundColor: COLORS.surface,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: COLORS.border,
    padding: 12,
  },
  taskText: {
    flex: 1,
    fontSize: 14,
    color: COLORS.text,
  },
  assistantButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 10,
    backgroundColor: COLORS.purple,
    borderRadius: 14,
    paddingVertical: 16,
    marginTop: 4,
  },
  assistantButtonText: {
    fontSize: 16,
    fontWeight: '600',
    color: COLORS.text,
  },
  sickButton: {
    alignItems: 'center',
    justifyContent: 'center',
    gap: 4,
    marginTop: 20,
    backgroundColor: 'rgba(255, 138, 138, 0.1)',
    borderRadius: 14,
    borderWidth: 1,
    borderColor: 'rgba(255, 138, 138, 0.35)',
    paddingVertical: 14,
    paddingHorizontal: 16,
  },
  sickButtonDisabled: {
    opacity: 0.6,
  },
  sickButtonText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#FFB4B4',
  },
  sickButtonHint: {
    fontSize: 12,
    color: COLORS.textMuted,
  },
  adaptCard: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 10,
    backgroundColor: COLORS.purpleMuted,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: 'rgba(139, 124, 247, 0.25)',
    padding: 14,
  },
  adaptText: {
    flex: 1,
    fontSize: 13,
    color: COLORS.textMuted,
    lineHeight: 19,
  },
});
