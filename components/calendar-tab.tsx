import { Ionicons } from '@expo/vector-icons';
import { useCallback, useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Platform,
  Pressable,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';

import { BookEventModal } from '@/components/book-event-modal';
import { APP_COLORS as COLORS } from '@/constants/app-theme';
import { getSpeechLocale } from '@/constants/i18n/resolve-locale';
import { useLocale } from '@/contexts/locale-context';
import { migrateLegacyCalendarEvents } from '@/services/local-calendar-store';
import {
  type CalendarAccessState,
  type CalendarEventItem,
  cancelAllEventsForDay,
  deleteCalendarEventCompletely,
  fetchEventsForDay,
  formatDayLabel,
  formatEventTime,
  getCalendarAccessState,
  getEmptyDayMessage,
  getNativeRebuildCommand,
  getPlatformCalendarHint,
  listConnectedCalendars,
  openAppSettings,
  requestCalendarAccess,
} from '@/services/device-calendar';

function shiftDay(date: Date, delta: number): Date {
  const next = new Date(date);
  next.setDate(next.getDate() + delta);
  return next;
}

function isSameDay(a: Date, b: Date): boolean {
  return (
    a.getFullYear() === b.getFullYear() &&
    a.getMonth() === b.getMonth() &&
    a.getDate() === b.getDate()
  );
}

export function CalendarTab({ userId }: { userId: string }) {
  const { locale, strings, t } = useLocale();
  const speechTag = getSpeechLocale(locale);
  const [selectedDate, setSelectedDate] = useState(() => new Date());
  const [access, setAccess] = useState<CalendarAccessState>('undetermined');
  const [events, setEvents] = useState<CalendarEventItem[]>([]);
  const [calendarNames, setCalendarNames] = useState<string[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [bookModalVisible, setBookModalVisible] = useState(false);
  const [bookSuccess, setBookSuccess] = useState<string | null>(null);
  const [refreshing, setRefreshing] = useState(false);

  const loadEvents = useCallback(async (date: Date, silent = false) => {
    if (!silent) {
      setIsLoading(true);
    }
    setError(null);
    try {
      const state = await getCalendarAccessState();
      setAccess(state);

      const calendars = await listConnectedCalendars();
      setCalendarNames(calendars.map((c) => c.title));

      const dayEvents = await fetchEventsForDay(date, userId);
      setEvents(dayEvents);
    } catch {
      setError(strings.calendar.loadError);
      setEvents([]);
    } finally {
      if (!silent) {
        setIsLoading(false);
      }
    }
  }, [userId, strings.calendar.loadError]);

  useEffect(() => {
    void migrateLegacyCalendarEvents(userId);
  }, [userId]);

  useEffect(() => {
    loadEvents(selectedDate);
  }, [selectedDate, loadEvents]);

  const handleRefresh = async () => {
    setRefreshing(true);
    await loadEvents(selectedDate);
    setRefreshing(false);
  };

  const handleRequestAccess = async () => {
    const granted = await requestCalendarAccess();
    setAccess(granted ? 'granted' : 'denied');
    if (granted) {
      await loadEvents(selectedDate);
    }
  };

  const goToday = () => setSelectedDate(new Date());

  const handleBooked = () => {
    setBookSuccess(
      t('calendar.bookedSuccess', { day: formatDayLabel(selectedDate).toLowerCase() }),
    );
    void loadEvents(selectedDate, true);
    setTimeout(() => setBookSuccess(null), 5000);
  };

  const confirmDeleteEvent = (event: CalendarEventItem) => {
    Alert.alert(
      'Ta bort möte',
      `Vill du ta bort "${event.title}" (${formatEventTime(event)})?`,
      [
        { text: 'Avbryt', style: 'cancel' },
        {
          text: 'Ta bort',
          style: 'destructive',
          onPress: async () => {
            const { ok, remaining } = await deleteCalendarEventCompletely(event, userId);
            setExpandedId(null);
            await loadEvents(selectedDate, true);
            if (!ok && remaining > 0) {
              Alert.alert(
                'Delvis borttaget',
                `${remaining} kopia${remaining > 1 ? 'or' : ''} finns kvar. Försök trycka Ta bort igen.`,
              );
            }
          },
        },
      ],
    );
  };

  const confirmDeleteAllEvents = () => {
    const dayLabel = formatDayLabel(selectedDate).toLowerCase();
    Alert.alert(
      'Ta bort alla möten',
      `Vill du ta bort alla ${events.length} möten ${dayLabel}?`,
      [
        { text: 'Avbryt', style: 'cancel' },
        {
          text: 'Ta bort alla',
          style: 'destructive',
          onPress: async () => {
            const { remaining } = await cancelAllEventsForDay(selectedDate, userId);
            setExpandedId(null);
            await loadEvents(selectedDate, true);
            if (remaining > 0) {
              Alert.alert(
                'Delvis borttaget',
                `${remaining} möte${remaining > 1 ? 'n' : ''} finns kvar. Tryck Ta bort igen på de som syns.`,
              );
            }
          },
        },
      ],
    );
  };

  if (access === 'unavailable' && !isLoading) {
    return (
      <View style={styles.container}>
        <View style={styles.header}>
          <Text style={styles.title}>Kalender</Text>
          <Text style={styles.sub}>Uppdatering behövs</Text>
        </View>

        <View style={styles.permissionCard}>
          <View style={styles.permissionIcon}>
            <Ionicons name="build-outline" size={32} color={COLORS.purple} />
          </View>
          <Text style={styles.permissionTitle}>Uppdatera appen en gång</Text>
          <Text style={styles.permissionText}>
            Kalendern kräver den senaste versionen av appen. Bygg och installera en ny APK — tar ca
            10–15 minuter i molnet.
          </Text>

          <View style={styles.codeBox}>
            <Text style={styles.codeLabel}>Alternativ 1 — EAS (ingen USB, rekommenderas)</Text>
            <Text style={styles.codeText}>
              cd C:\Users\user\My-assistent\MyAssistant\MyAssistantFinal
            </Text>
            <Text style={styles.codeText}>npx eas-cli build --platform android --profile preview</Text>
          </View>

          <View style={styles.codeBox}>
            <Text style={styles.codeLabel}>Alternativ 2 — USB till telefon</Text>
            <Text style={styles.codeText}>{getNativeRebuildCommand()}</Text>
          </View>

          <Text style={styles.permissionDenied}>
            Om du redan installerat: du har troligen en gammal version. Kör bygget igen i
            PowerShell, vänta tills det är klart, och installera den nya APK (ny länk).
          </Text>
        </View>
      </View>
    );
  }

  if (access !== 'granted' && !isLoading) {
    return (
      <View style={styles.container}>
        <ScrollView
          contentContainerStyle={styles.scrollContent}
          refreshControl={
            <RefreshControl refreshing={refreshing} onRefresh={handleRefresh} tintColor={COLORS.purple} />
          }
        >
          <View style={styles.header}>
            <Text style={styles.title}>{strings.tabs.calendar}</Text>
            <Text style={styles.sub}>{getPlatformCalendarHint()}</Text>
          </View>

          <View style={styles.permissionCard}>
            <View style={styles.permissionIcon}>
              <Ionicons name="calendar-outline" size={32} color={COLORS.purple} />
            </View>
            <Text style={styles.permissionTitle}>{strings.calendar.permissionTitle}</Text>
            <Text style={styles.permissionText}>{strings.calendar.permissionText}</Text>

            <Pressable style={styles.primaryButton} onPress={handleRequestAccess}>
              <Text style={styles.primaryButtonText}>{strings.calendar.allowAccess}</Text>
            </Pressable>

            {access === 'denied' ? (
              <Pressable style={styles.secondaryButton} onPress={openAppSettings}>
                <Text style={styles.secondaryButtonText}>{strings.calendar.openSettings}</Text>
              </Pressable>
            ) : null}

            <Pressable style={styles.primaryButton} onPress={() => setBookModalVisible(true)}>
              <Text style={styles.primaryButtonText}>+ {strings.tabs.calendar}</Text>
            </Pressable>
          </View>

          {events.length > 0 ? (
            <View style={styles.eventsSection}>
              <Text style={styles.sectionLabel}>{strings.tabs.calendar}</Text>
              {events.map((event) => (
                <View key={event.id} style={styles.eventCard}>
                  <Text style={styles.eventTitle}>{event.title}</Text>
                  <Text style={styles.eventMeta}>{formatEventTime(event)}</Text>
                </View>
              ))}
            </View>
          ) : null}
        </ScrollView>

        <BookEventModal
          visible={bookModalVisible}
          selectedDate={selectedDate}
          userId={userId}
          onClose={() => setBookModalVisible(false)}
          onBooked={handleBooked}
        />
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <View style={styles.headerRow}>
          <View>
            <Text style={styles.title}>{strings.tabs.calendar}</Text>
            <Text style={styles.sub}>{formatDayLabel(selectedDate)}</Text>
          </View>
          <View style={styles.headerActions}>
            {events.length > 0 ? (
              <Pressable style={styles.deleteAllButton} onPress={confirmDeleteAllEvents}>
                <Ionicons name="trash-outline" size={16} color="#FF8A8A" />
                <Text style={styles.deleteAllButtonText}>Ta bort alla</Text>
              </Pressable>
            ) : null}
            <Pressable style={styles.bookButton} onPress={() => setBookModalVisible(true)}>
              <Ionicons name="add" size={18} color={COLORS.text} />
              <Text style={styles.bookButtonText}>Lägg till</Text>
            </Pressable>
          </View>
        </View>
        {bookSuccess ? <Text style={styles.successBanner}>{bookSuccess}</Text> : null}
      </View>

      <View style={styles.dayNav}>
        <Pressable style={styles.quickDayChip} onPress={goToday}>
          <Text style={styles.quickDayText}>{strings.calendar.today}</Text>
        </Pressable>
        <Pressable
          style={styles.quickDayChip}
          onPress={() => {
            const tomorrow = new Date();
            tomorrow.setDate(tomorrow.getDate() + 1);
            setSelectedDate(tomorrow);
          }}
        >
          <Text style={styles.quickDayText}>{strings.calendar.tomorrow}</Text>
        </Pressable>

        <Pressable
          style={styles.dayNavButton}
          onPress={() => setSelectedDate((d) => shiftDay(d, -1))}
        >
          <Ionicons name="chevron-back" size={20} color={COLORS.purple} />
        </Pressable>

        <Pressable style={styles.dayNavCenter} onPress={goToday}>
          <Text style={styles.dayNavDate}>
            {selectedDate.toLocaleDateString(speechTag, {
              day: 'numeric',
              month: 'short',
              year: 'numeric',
            })}
          </Text>
          {!isSameDay(selectedDate, new Date()) && (
            <Text style={styles.dayNavToday}>Gå till idag</Text>
          )}
        </Pressable>

        <Pressable
          style={styles.dayNavButton}
          onPress={() => setSelectedDate((d) => shiftDay(d, 1))}
        >
          <Ionicons name="chevron-forward" size={20} color={COLORS.purple} />
        </Pressable>
      </View>

      {calendarNames.length > 0 && (
        <View style={styles.sourcesRow}>
          <Ionicons name="link-outline" size={14} color={COLORS.textMuted} />
          <Text style={styles.sourcesText} numberOfLines={2}>
            {calendarNames.slice(0, 4).join(' · ')}
            {calendarNames.length > 4 ? ` · +${calendarNames.length - 4}` : ''}
          </Text>
        </View>
      )}

      {isLoading ? (
        <View style={styles.loadingWrap}>
          <ActivityIndicator size="large" color={COLORS.purple} />
          <Text style={styles.loadingText}>Hämtar möten...</Text>
        </View>
      ) : error ? (
        <View style={styles.emptyWrap}>
          <Text style={styles.emptyText}>{error}</Text>
          <Pressable style={styles.secondaryButton} onPress={() => loadEvents(selectedDate)}>
            <Text style={styles.secondaryButtonText}>Försök igen</Text>
          </Pressable>
        </View>
      ) : events.length === 0 ? (
        <View style={styles.emptyWrap}>
          <Ionicons name="calendar-outline" size={40} color={COLORS.textMuted} />
          <Text style={styles.emptyTitle}>Inga möten</Text>
          <Text style={styles.emptyText}>{getEmptyDayMessage()}</Text>
          <Pressable style={styles.primaryButton} onPress={() => setBookModalVisible(true)}>
            <Text style={styles.primaryButtonText}>Lägg till</Text>
          </Pressable>
        </View>
      ) : (
        <ScrollView
          style={styles.list}
          showsVerticalScrollIndicator={false}
          refreshControl={
            <RefreshControl
              refreshing={refreshing}
              onRefresh={handleRefresh}
              tintColor={COLORS.purple}
            />
          }
        >
          {events.map((event) => {
            const isExpanded = expandedId === event.id;
            return (
              <Pressable
                key={event.id}
                style={styles.eventCard}
                onPress={() => setExpandedId(isExpanded ? null : event.id)}
              >
                <View
                  style={[
                    styles.eventColorBar,
                    { backgroundColor: event.calendarColor ?? COLORS.purple },
                  ]}
                />
                <Text style={styles.eventTime}>{formatEventTime(event)}</Text>
                <View style={styles.eventBody}>
                  <Text style={styles.eventTitle}>{event.title}</Text>
                  {event.location ? (
                    <Text style={styles.eventPlace} numberOfLines={isExpanded ? undefined : 1}>
                      {event.location}
                    </Text>
                  ) : null}
                  <Text style={styles.eventCalendar}>{event.calendarName}</Text>
                  {isExpanded && event.notes ? (
                    <Text style={styles.eventNotes}>{event.notes}</Text>
                  ) : null}
                  {isExpanded ? (
                    <Pressable
                      style={styles.deleteEventButton}
                      onPress={(e) => {
                        e.stopPropagation?.();
                        confirmDeleteEvent(event);
                      }}
                    >
                      <Ionicons name="trash-outline" size={16} color="#FF8A8A" />
                      <Text style={styles.deleteEventText}>Ta bort möte</Text>
                    </Pressable>
                  ) : null}
                </View>
                <Pressable
                  style={styles.deleteIconButton}
                  onPress={(e) => {
                    e.stopPropagation?.();
                    confirmDeleteEvent(event);
                  }}
                  hitSlop={8}
                  accessibilityLabel="Ta bort möte"
                  accessibilityRole="button"
                >
                  <Ionicons name="trash-outline" size={20} color="#FF8A8A" />
                </Pressable>
                <Ionicons
                  name={isExpanded ? 'chevron-up' : 'chevron-down'}
                  size={16}
                  color={COLORS.textMuted}
                />
              </Pressable>
            );
          })}
          <Text style={styles.footerHint}>{getPlatformCalendarHint()}</Text>
        </ScrollView>
      )}

      {bookModalVisible ? (
        <BookEventModal
          visible={bookModalVisible}
          selectedDate={selectedDate}
          userId={userId}
          onClose={() => setBookModalVisible(false)}
          onBooked={handleBooked}
        />
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: COLORS.background },
  header: { paddingHorizontal: 20, paddingTop: 8, paddingBottom: 8 },
  headerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 12,
  },
  headerActions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  deleteAllButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 10,
    paddingVertical: 10,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: 'rgba(255, 138, 138, 0.45)',
    backgroundColor: 'rgba(255, 138, 138, 0.08)',
  },
  deleteAllButtonText: {
    color: '#FF8A8A',
    fontSize: 13,
    fontWeight: '600',
  },
  bookButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: COLORS.purple,
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderRadius: 12,
  },
  bookButtonText: {
    color: COLORS.text,
    fontSize: 14,
    fontWeight: '600',
  },
  successBanner: {
    marginTop: 8,
    fontSize: 13,
    color: '#8AE6A0',
    fontWeight: '500',
  },
  title: { fontSize: 22, fontWeight: '600', color: COLORS.text },
  sub: { fontSize: 13, color: COLORS.purple, marginTop: 2 },
  dayNav: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    marginBottom: 8,
    gap: 6,
  },
  quickDayChip: {
    paddingHorizontal: 10,
    paddingVertical: 8,
    borderRadius: 10,
    backgroundColor: COLORS.purpleMuted,
    borderWidth: 1,
    borderColor: 'rgba(139, 124, 247, 0.35)',
  },
  quickDayText: {
    fontSize: 12,
    fontWeight: '600',
    color: COLORS.purple,
  },
  dayNavButton: {
    width: 40,
    height: 40,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: COLORS.border,
    backgroundColor: COLORS.surface,
    alignItems: 'center',
    justifyContent: 'center',
  },
  dayNavCenter: {
    flex: 1,
    alignItems: 'center',
    paddingVertical: 8,
  },
  dayNavDate: {
    fontSize: 15,
    fontWeight: '600',
    color: COLORS.text,
  },
  dayNavToday: {
    fontSize: 12,
    color: COLORS.purple,
    marginTop: 2,
  },
  sourcesRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 20,
    marginBottom: 8,
  },
  sourcesText: {
    flex: 1,
    fontSize: 11,
    color: COLORS.textMuted,
  },
  list: { flex: 1, paddingHorizontal: 16 },
  scrollContent: { paddingBottom: 24 },
  eventsSection: { paddingHorizontal: 16, marginTop: 8, width: '100%' },
  sectionLabel: {
    fontSize: 13,
    fontWeight: '600',
    color: COLORS.purple,
    marginBottom: 8,
    textTransform: 'uppercase',
  },
  eventMeta: { fontSize: 12, color: COLORS.textMuted, marginTop: 4 },
  eventCard: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 10,
    backgroundColor: COLORS.surface,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: COLORS.border,
    padding: 14,
    marginBottom: 10,
  },
  eventColorBar: {
    width: 4,
    borderRadius: 2,
    alignSelf: 'stretch',
    minHeight: 40,
  },
  eventTime: {
    fontSize: 12,
    fontWeight: '600',
    color: COLORS.purple,
    width: 72,
    lineHeight: 18,
  },
  eventBody: { flex: 1 },
  eventTitle: { fontSize: 15, color: COLORS.text, fontWeight: '500' },
  eventPlace: { fontSize: 13, color: COLORS.textMuted, marginTop: 4 },
  eventCalendar: { fontSize: 11, color: COLORS.purple, marginTop: 6, opacity: 0.85 },
  eventNotes: {
    fontSize: 13,
    color: COLORS.text,
    marginTop: 8,
    lineHeight: 20,
    opacity: 0.9,
  },
  deleteEventButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginTop: 12,
    paddingVertical: 8,
  },
  deleteEventText: {
    fontSize: 13,
    color: '#FF8A8A',
    fontWeight: '600',
  },
  deleteIconButton: {
    padding: 6,
    marginLeft: 4,
  },
  loadingWrap: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 12,
  },
  loadingText: { fontSize: 14, color: COLORS.textMuted },
  emptyWrap: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 32,
    gap: 8,
  },
  emptyTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: COLORS.text,
    marginTop: 8,
  },
  emptyText: {
    fontSize: 14,
    color: COLORS.textMuted,
    textAlign: 'center',
    lineHeight: 20,
  },
  footerHint: {
    fontSize: 11,
    color: COLORS.textMuted,
    textAlign: 'center',
    paddingVertical: 16,
    paddingBottom: 24,
  },
  permissionCard: {
    flex: 1,
    paddingHorizontal: 24,
    paddingTop: 24,
    alignItems: 'center',
    gap: 12,
  },
  permissionIcon: {
    width: 72,
    height: 72,
    borderRadius: 36,
    backgroundColor: COLORS.purpleMuted,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 8,
  },
  permissionTitle: {
    fontSize: 20,
    fontWeight: '600',
    color: COLORS.text,
    textAlign: 'center',
  },
  permissionText: {
    fontSize: 14,
    color: COLORS.textMuted,
    textAlign: 'center',
    lineHeight: 22,
  },
  permissionDenied: {
    fontSize: 13,
    color: '#FF8A8A',
    textAlign: 'center',
    lineHeight: 20,
  },
  primaryButton: {
    backgroundColor: COLORS.purple,
    paddingHorizontal: 28,
    paddingVertical: 14,
    borderRadius: 14,
    marginTop: 8,
    minWidth: 220,
    alignItems: 'center',
  },
  primaryButtonText: {
    color: COLORS.text,
    fontSize: 16,
    fontWeight: '600',
  },
  secondaryButton: {
    paddingVertical: 12,
    paddingHorizontal: 16,
  },
  secondaryButtonText: {
    color: COLORS.purple,
    fontSize: 14,
    fontWeight: '500',
  },
  codeBox: {
    backgroundColor: COLORS.surface,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: COLORS.border,
    padding: 14,
    marginTop: 12,
    width: '100%',
    gap: 6,
  },
  codeLabel: {
    fontSize: 12,
    color: COLORS.textMuted,
    fontWeight: '600',
    marginBottom: 4,
  },
  codeText: {
    fontSize: 13,
    color: COLORS.text,
    fontFamily: Platform.OS === 'ios' ? 'Menlo' : 'monospace',
  },
});
