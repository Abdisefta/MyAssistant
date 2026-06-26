import type { CalendarEventItem } from '@/services/device-calendar';

export type CalendarGroup = 'family' | 'work' | 'colleagues' | 'other';

const FAMILY_HINTS = [
  'familj',
  'family',
  'barn',
  'hem',
  'home',
  'privat',
  'private',
  'födelsedag',
  'birthday',
];

const WORK_HINTS = [
  'jobb',
  'work',
  'arbete',
  'kontor',
  'office',
  'företag',
  'company',
  'my assistant',
  'kalender',
];

const COLLEAGUE_HINTS = [
  'kolleg',
  'team',
  'projekt',
  'project',
  'avdelning',
  'department',
  'möte',
  'meeting',
];

export function categorizeCalendar(calendarName: string): CalendarGroup {
  const lower = calendarName.toLowerCase();
  if (FAMILY_HINTS.some((hint) => lower.includes(hint))) return 'family';
  if (COLLEAGUE_HINTS.some((hint) => lower.includes(hint))) return 'colleagues';
  if (WORK_HINTS.some((hint) => lower.includes(hint))) return 'work';
  return 'other';
}

export function groupEventsByCategory(
  events: CalendarEventItem[],
): Record<CalendarGroup, CalendarEventItem[]> {
  const groups: Record<CalendarGroup, CalendarEventItem[]> = {
    family: [],
    work: [],
    colleagues: [],
    other: [],
  };

  for (const event of events) {
    const group = categorizeCalendar(event.calendarName || event.title);
    groups[group].push(event);
  }

  for (const key of Object.keys(groups) as CalendarGroup[]) {
    groups[key].sort((a, b) => a.start.getTime() - b.start.getTime());
  }

  return groups;
}
