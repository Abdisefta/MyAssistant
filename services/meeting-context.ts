import {
  fetchEventsForDay,
  formatDayLabel,
  formatEventTime,
  getCalendarAccessState,
  type CalendarEventItem,
} from '@/services/device-calendar';

function addDays(date: Date, days: number): Date {
  const next = new Date(date);
  next.setDate(next.getDate() + days);
  return next;
}

function formatEventsForDay(date: Date, events: CalendarEventItem[]): string {
  if (!events.length) return `${formatDayLabel(date)}: inga möten.`;

  const lines = events.map((e) => {
    const time = e.allDay ? 'hela dagen' : formatEventTime(e);
    const loc = e.location ? ` (${e.location})` : '';
    return `${time} — ${e.title}${loc}`;
  });

  return `${formatDayLabel(date)}:\n- ${lines.join('\n- ')}`;
}

async function collectEvents(daysAhead: number): Promise<CalendarEventItem[]> {
  const access = await getCalendarAccessState();
  if (access !== 'granted') return [];

  const today = new Date();
  const allEvents: CalendarEventItem[] = [];

  for (let i = 0; i <= daysAhead; i++) {
    const dayEvents = await fetchEventsForDay(addDays(today, i));
    allEvents.push(...dayEvents);
  }

  return allEvents;
}

export async function getUpcomingMeetingsSummary(daysAhead = 7): Promise<string> {
  try {
    const access = await getCalendarAccessState();
    if (access !== 'granted') {
      return 'Kalenderbehörighet saknas — kan inte läsa möten.';
    }

    const allEvents = await collectEvents(daysAhead);

    if (!allEvents.length) {
      return 'Inga möten de närmaste dagarna.';
    }

    const now = Date.now();
    const upcoming = allEvents
      .filter((e) => e.end.getTime() > now)
      .sort((a, b) => a.start.getTime() - b.start.getTime())
      .slice(0, 12);

    if (!upcoming.length) {
      return 'Inga kvarvarande möten idag.';
    }

    return upcoming
      .map((e) => {
        const dayLabel = e.start.toLocaleDateString('sv-SE', {
          weekday: 'short',
          day: 'numeric',
          month: 'short',
        });
        const time = e.allDay ? 'hela dagen' : formatEventTime(e);
        const loc = e.location ? ` (${e.location})` : '';
        return `${dayLabel} ${time}: ${e.title}${loc}`;
      })
      .join('\n- ');
  } catch {
    return 'Kunde inte läsa kalender just nu.';
  }
}

export async function getCalendarAnswer(userMessage: string): Promise<string> {
  const lower = userMessage.toLowerCase().replace(/\bimorrg?\b/g, 'imorgon');
  if (/\b(boka|bokar|lägg in|skapa möte|nytt möte)\b/.test(lower)) {
    return 'För att boka: säg t.ex. "Boka möte imorgon kl 15" och bekräfta med ja — eller öppna Kalender-fliken och tryck Boka möte.';
  }

  const access = await getCalendarAccessState();
  if (access !== 'granted') {
    return 'Jag har inte tillgång till kalendern. Ge kalenderbehörighet i telefonens inställningar.';
  }

  const today = new Date();

  if (/\bidag\b/.test(lower)) {
    const events = await fetchEventsForDay(today);
    const upcoming = events.filter((e) => e.end.getTime() > Date.now());
    if (!upcoming.length) return 'Du har inga fler möten idag.';
    return formatEventsForDay(today, upcoming);
  }

  if (/\bimorgon\b/.test(lower)) {
    const tomorrow = addDays(today, 1);
    const events = await fetchEventsForDay(tomorrow);
    if (!events.length) return 'Du har inga möten imorgon.';
    return formatEventsForDay(tomorrow, events);
  }

  const allEvents = await collectEvents(7);
  const now = Date.now();
  const upcoming = allEvents
    .filter((e) => e.end.getTime() > now)
    .sort((a, b) => a.start.getTime() - b.start.getTime());

  if (!upcoming.length) {
    return 'Du har inga kommande möten de närmaste dagarna.';
  }

  const grouped = new Map<string, CalendarEventItem[]>();
  for (const event of upcoming) {
    const key = event.start.toDateString();
    const list = grouped.get(key) ?? [];
    list.push(event);
    grouped.set(key, list);
  }

  const parts: string[] = [];
  for (const [, events] of grouped) {
    parts.push(formatEventsForDay(events[0].start, events));
  }

  return parts.slice(0, 4).join('\n\n');
}
