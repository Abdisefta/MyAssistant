import type { CalendarEventItem } from '@/services/device-calendar';
import type { WeatherSnapshot } from '@/services/weather';
import type { AgentTask } from '@/types/memory';

export type BriefingKind = 'morning' | 'evening';

export function getBriefingKind(hour: number): BriefingKind | null {
  if (hour >= 5 && hour < 12) return 'morning';
  if (hour >= 17 && hour < 23) return 'evening';
  return null;
}

export function getNextUpcomingMeeting(
  events: CalendarEventItem[],
  now = new Date(),
): CalendarEventItem | null {
  const ts = now.getTime();
  return (
    events
      .filter((e) => e.end.getTime() > ts)
      .sort((a, b) => a.start.getTime() - b.start.getTime())[0] ?? null
  );
}

export function minutesUntil(date: Date, now = new Date()): number {
  return Math.max(0, Math.round((date.getTime() - now.getTime()) / 60_000));
}

type BriefingInput = {
  kind: BriefingKind;
  firstName?: string;
  weather: WeatherSnapshot | null;
  todayMeetings: CalendarEventItem[];
  tomorrowMeetings: CalendarEventItem[];
  openTasks: AgentTask[];
  unreadMail: number | null;
};

export function buildBriefingLines(input: BriefingInput): string[] {
  const { kind, firstName, weather, todayMeetings, tomorrowMeetings, openTasks, unreadMail } =
    input;
  const name = firstName?.trim();
  const lines: string[] = [];

  if (kind === 'morning') {
    lines.push(name ? `God morgon ${name}!` : 'God morgon!');
    if (weather) {
      lines.push(`Vädret: ${weather.temperature}° och ${weather.description.toLowerCase()} i ${weather.city}.`);
    }
    if (todayMeetings.length === 0) {
      lines.push('Inga möten idag — en lugn dag.');
    } else {
      const next = getNextUpcomingMeeting(todayMeetings);
      lines.push(`Du har ${todayMeetings.length} möte${todayMeetings.length > 1 ? 'n' : ''} idag.`);
      if (next) {
        const time = next.allDay
          ? 'hela dagen'
          : next.start.toLocaleTimeString('sv-SE', { hour: '2-digit', minute: '2-digit' });
        lines.push(`Nästa: ${next.title} kl ${time}.`);
      }
    }
    if (openTasks.length > 0) {
      lines.push(`${openTasks.length} uppgift${openTasks.length > 1 ? 'er' : ''} att göra.`);
    }
    if (typeof unreadMail === 'number' && unreadMail > 0) {
      lines.push(`${unreadMail} olästa mail i inkorgen.`);
    }
  } else {
    lines.push(name ? `God kväll ${name}!` : 'God kväll!');
    const remaining = todayMeetings.filter((e) => e.end.getTime() > Date.now());
    if (remaining.length > 0) {
      lines.push(`Du har ${remaining.length} möte kvar idag.`);
    } else {
      lines.push('Inga fler möten idag.');
    }
    if (tomorrowMeetings.length === 0) {
      lines.push('Imorgon ser ledigt ut i kalendern.');
    } else {
      lines.push(`Imorgon: ${tomorrowMeetings.length} möte${tomorrowMeetings.length > 1 ? 'n' : ''}.`);
      const first = tomorrowMeetings[0];
      const time = first.allDay
        ? 'hela dagen'
        : first.start.toLocaleTimeString('sv-SE', { hour: '2-digit', minute: '2-digit' });
      lines.push(`Första: ${first.title} kl ${time}.`);
    }
    if (openTasks.length > 0) {
      lines.push(`Glöm inte ${openTasks.length} öppna uppgift${openTasks.length > 1 ? 'er' : ''}.`);
    }
  }

  return lines;
}

export function buildMeetingPrepLines(event: CalendarEventItem, now = new Date()): string[] {
  const mins = minutesUntil(event.start, now);
  const time = event.allDay
    ? 'Hela dagen'
    : event.start.toLocaleTimeString('sv-SE', { hour: '2-digit', minute: '2-digit' });

  const lines = [
    `${event.title}`,
    event.allDay ? time : `Kl ${time}${mins > 0 ? ` · om ${mins} min` : ''}`,
  ];

  if (event.location) lines.push(`Plats: ${event.location}`);
  if (event.calendarName) lines.push(`Kalender: ${event.calendarName}`);
  if (event.notes?.trim()) lines.push(event.notes.trim());

  lines.push('Tips: Fråga assistenten "Förbered mig inför mötet" för mer hjälp.');

  return lines;
}
