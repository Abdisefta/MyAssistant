import { Ionicons } from '@expo/vector-icons';
import { useCallback, useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';

import { APP_COLORS as COLORS } from '@/constants/app-theme';
import {
  type CalendarAccessState,
  type CalendarEventItem,
  fetchEventsForDay,
  formatDayLabel,
  formatEventTime,
  getCalendarAccessState,
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

export function CalendarTab() {
  const [selectedDate, setSelectedDate] = useState(() => new Date());
  const [access, setAccess] = useState<CalendarAccessState>('undetermined');
  const [events, setEvents] = useState<CalendarEventItem[]>([]);
  const [calendarNames, setCalendarNames] = useState<string[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [expandedId, setExpandedId] = useState<string | null>(null);

  const loadEvents = useCallback(async (date: Date) => {
    setIsLoading(true);
    setError(null);
    try {
      const state = await getCalendarAccessState();
      setAccess(state);

      if (state !== 'granted') {
        setEvents([]);
        setCalendarNames([]);
        return;
      }

      const calendars = await listConnectedCalendars();
      setCalendarNames(calendars.map((c) => c.title));

      const dayEvents = await fetchEventsForDay(date);
      setEvents(dayEvents);
    } catch {
      setError('Kunde inte läsa kalendern. Försök igen.');
      setEvents([]);
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    loadEvents(selectedDate);
  }, [selectedDate, loadEvents]);

  const handleRequestAccess = async () => {
    const granted = await requestCalendarAccess();
    setAccess(granted ? 'granted' : 'denied');
    if (granted) {
      await loadEvents(selectedDate);
    }
  };

  const goToday = () => setSelectedDate(new Date());

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
        <View style={styles.header}>
          <Text style={styles.title}>Kalender</Text>
          <Text style={styles.sub}>{getPlatformCalendarHint()}</Text>
        </View>

        <View style={styles.permissionCard}>
          <View style={styles.permissionIcon}>
            <Ionicons name="calendar-outline" size={32} color={COLORS.purple} />
          </View>
          <Text style={styles.permissionTitle}>Kalenderbehörighet behövs</Text>
          <Text style={styles.permissionText}>
            För att visa dina möten behöver appen läsa kalendern på telefonen. Det fungerar med
            Google Kalender, Apple Kalender, Outlook och andra kalendrar du har kopplat.
          </Text>

          {access === 'denied' ? (
            <Text style={styles.permissionDenied}>
              Behörighet nekad. Gå till telefonens inställningar och tillåt kalender för My
              Assistant.
            </Text>
          ) : null}

          <Pressable style={styles.primaryButton} onPress={handleRequestAccess}>
            <Text style={styles.primaryButtonText}>Tillåt kalender</Text>
          </Pressable>

          {access === 'denied' ? (
            <Pressable style={styles.secondaryButton} onPress={openAppSettings}>
              <Text style={styles.secondaryButtonText}>Öppna inställningar</Text>
            </Pressable>
          ) : null}
        </View>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.title}>Kalender</Text>
        <Text style={styles.sub}>{formatDayLabel(selectedDate)}</Text>
      </View>

      <View style={styles.dayNav}>
        <Pressable
          style={styles.dayNavButton}
          onPress={() => setSelectedDate((d) => shiftDay(d, -1))}
        >
          <Ionicons name="chevron-back" size={20} color={COLORS.purple} />
        </Pressable>

        <Pressable style={styles.dayNavCenter} onPress={goToday}>
          <Text style={styles.dayNavDate}>
            {selectedDate.toLocaleDateString('sv-SE', {
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
          <Text style={styles.emptyText}>Inget planerat denna dag i dina kalendrar.</Text>
        </View>
      ) : (
        <ScrollView style={styles.list} showsVerticalScrollIndicator={false}>
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
                </View>
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
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: COLORS.background },
  header: { paddingHorizontal: 20, paddingTop: 8, paddingBottom: 8 },
  title: { fontSize: 22, fontWeight: '600', color: COLORS.text },
  sub: { fontSize: 13, color: COLORS.purple, marginTop: 2 },
  dayNav: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    marginBottom: 8,
    gap: 8,
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
    color: COLORS.muted,
    fontWeight: '600',
    marginBottom: 4,
  },
  codeText: {
    fontSize: 13,
    color: COLORS.text,
    fontFamily: Platform.OS === 'ios' ? 'Menlo' : 'monospace',
  },
});
