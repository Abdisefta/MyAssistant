import {
  fetchEventsForDay,
  formatEventTime,
  getCalendarAccessState,
  type CalendarEventItem,
} from '@/services/device-calendar';

function addDays(date: Date, days: number): Date {
  const next = new Date(date);
  next.setDate(next.getDate() + days);
  return next;
}

export async function getUpcomingMeetingsSummary(daysAhead = 2): Promise<string> {
  try {
    const access = await getCalendarAccessState();
    if (access !== 'granted') {
      return 'Kalenderbehörighet saknas — kan inte läsa möten.';
    }

    const today = new Date();
    const allEvents: CalendarEventItem[] = [];

    for (let i = 0; i <= daysAhead; i++) {
      const dayEvents = await fetchEventsForDay(addDays(today, i));
      allEvents.push(...dayEvents);
    }

  if (!allEvents.length) {
    return 'Inga möten de närmaste dagarna.';
  }

  const now = Date.now();
  const upcoming = allEvents
    .filter((e) => e.end.getTime() > now)
    .sort((a, b) => a.start.getTime() - b.start.getTime())
    .slice(0, 8);

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
