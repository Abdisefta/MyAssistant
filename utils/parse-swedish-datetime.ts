const WEEKDAYS: Record<string, number> = {
  söndag: 0,
  mandag: 1,
  måndag: 1,
  tisdag: 2,
  onsdag: 3,
  torsdag: 4,
  fredag: 5,
  lördag: 6,
  lordag: 6,
};

const MONTHS: Record<string, number> = {
  jan: 1,
  januari: 1,
  feb: 2,
  februari: 2,
  mar: 3,
  mars: 3,
  apr: 4,
  april: 4,
  maj: 5,
  jun: 6,
  juni: 6,
  jul: 7,
  juli: 7,
  aug: 8,
  augusti: 8,
  sep: 9,
  sept: 9,
  september: 9,
  okt: 10,
  oktober: 10,
  nov: 11,
  november: 11,
  dec: 12,
  december: 12,
};

export function normalizeTimeInput(timeText: string): string {
  const trimmed = timeText.trim().replace(',', ':').replace('.', ':');
  if (/^\d{1,2}$/.test(trimmed)) {
    return `${trimmed.padStart(2, '0')}:00`;
  }
  if (/^\d{1,2}:\d$/.test(trimmed)) {
    const [hours, minutes] = trimmed.split(':');
    return `${hours.padStart(2, '0')}:${minutes}0`;
  }
  if (/^\d{1,2}:\d{2}$/.test(trimmed)) {
    const [hours, minutes] = trimmed.split(':');
    return `${hours.padStart(2, '0')}:${minutes}`;
  }
  return trimmed;
}

function nextWeekday(from: Date, weekday: number): Date {
  const result = new Date(from);
  result.setHours(9, 0, 0, 0);
  const diff = (weekday - result.getDay() + 7) % 7;
  result.setDate(result.getDate() + (diff === 0 ? 7 : diff));
  return result;
}

function applyTime(base: Date, hours: number, minutes: number): Date {
  const result = new Date(base);
  result.setHours(hours, minutes, 0, 0);
  return result;
}

function rollForwardIfPast(date: Date): Date {
  const result = new Date(date);
  while (result.getTime() <= Date.now()) {
    result.setDate(result.getDate() + 1);
  }
  return result;
}

export type ParsedReminder = {
  remindAt?: number;
  recurrence?: { weekdays: number[]; hour: number; minute: number };
  /** Human-readable hint shown while typing, e.g. "Imorgon 15:00" */
  hint?: string;
};

function extractTime(t: string): { hours: number; minutes: number; rangeEnd?: number } | null {
  const rangeMatch = t.match(/\b(\d{1,2})\s*[-–]\s*(\d{1,2})\b/);
  if (rangeMatch) {
    const hours = Number(rangeMatch[1]);
    const rangeEnd = Number(rangeMatch[2]);
    if (hours > 23 || rangeEnd > 23) return null;
    return { hours, minutes: 0, rangeEnd };
  }

  const klMatch = t.match(/\b(?:kl\.?|klockan)\s*(\d{1,2})(?:[:.](\d{1,2}))?\b/);
  if (klMatch) {
    return { hours: Number(klMatch[1]), minutes: klMatch[2] ? Number(klMatch[2]) : 0 };
  }

  if (/^\d{1,2}$/.test(t.trim())) {
    const hours = Number(t.trim());
    if (hours > 23) return null;
    return { hours, minutes: 0 };
  }

  const bareMatch = t.match(/(?:^|\s)(\d{1,2})(?:[:.](\d{2}))?(?:\s|$)/);
  if (bareMatch && !/\d{1,2}\s*[-–]\s*\d{1,2}/.test(t)) {
    const hours = Number(bareMatch[1]);
    const minutes = bareMatch[2] ? Number(bareMatch[2]) : 0;
    if (hours > 23 || minutes > 59) return null;
    return { hours, minutes };
  }

  return null;
}

const WEEKDAY_NAMES = Object.keys(WEEKDAYS);

function parseWeekdayToken(token: string): number | null {
  const key = token
    .replace('mandag', 'måndag')
    .replace('lordag', 'lördag')
    .replace('sondag', 'söndag');
  return WEEKDAYS[key] ?? null;
}

function extractWeekdays(t: string): number[] {
  const found: number[] = [];
  const recurring = /\b(?:varje|var)\b/.test(t);
  if (!recurring) return found;

  for (const name of WEEKDAY_NAMES) {
    const pattern = new RegExp(`\\b${name}\\b`, 'g');
    if (pattern.test(t)) {
      const day = parseWeekdayToken(name);
      if (day != null && !found.includes(day)) found.push(day);
    }
  }
  return found.sort((a, b) => a - b);
}

function formatRecurrenceHint(weekdays: number[], hour: number, minute: number): string {
  const labels = ['sön', 'mån', 'tis', 'ons', 'tor', 'fre', 'lör'];
  const days = weekdays.map((d) => labels[d] ?? String(d)).join(', ');
  return `Varje ${days} kl ${pad(hour)}:${pad(minute)}`;
}
/** Parse Swedish reminder text for tasks — "13", "imorgon 15", "fredag kl 9", "varje måndag kl 9". */
export function parseSwedishReminder(raw: string): ParsedReminder | undefined {
  const t = raw.trim().toLowerCase().replace(/\s+/g, ' ');
  if (!t) return undefined;

  const recurringWeekdays = extractWeekdays(t);
  if (recurringWeekdays.length > 0) {
    const time = extractTime(t);
    const hour = time?.hours ?? 9;
    const minute = time?.minutes ?? 0;
    return {
      recurrence: { weekdays: recurringWeekdays, hour, minute },
      hint: formatRecurrenceHint(recurringWeekdays, hour, minute),
    };
  }

  let base = new Date();
  base.setSeconds(0, 0);

  if (/\bövermorgon\b/.test(t)) {
    base.setDate(base.getDate() + 2);
  } else if (/\bimorgon\b/.test(t)) {
    base.setDate(base.getDate() + 1);
  } else if (/\b(idag|i dag)\b/.test(t)) {
    // keep today
  }

  const weekdayMatch = t.match(/\b(?:på\s+)?(måndag|mandag|tisdag|onsdag|torsdag|fredag|lördag|lordag|söndag|sondag)\b/);
  if (weekdayMatch) {
    const key = weekdayMatch[1].replace('mandag', 'måndag').replace('lordag', 'lördag').replace('sondag', 'söndag');
    const weekday = WEEKDAYS[key];
    if (weekday != null) {
      base = nextWeekday(new Date(), weekday);
    }
  }

  const dateMatch = t.match(/\b(\d{1,2})\s+(jan(?:uari)?|feb(?:ruari)?|mar(?:s)?|apr(?:il)?|maj|jun(?:i)?|jul(?:i)?|aug(?:usti)?|sep(?:t(?:ember)?)?|okt(?:ober)?|nov(?:ember)?|dec(?:ember)?)\b/);
  if (dateMatch) {
    const day = Number(dateMatch[1]);
    const month = resolveMonth(dateMatch[2]);
    if (month && day >= 1 && day <= 31) {
      const candidate = new Date(base.getFullYear(), month - 1, day, 9, 0, 0, 0);
      if (candidate.getTime() <= Date.now()) {
        candidate.setFullYear(candidate.getFullYear() + 1);
      }
      base = candidate;
    }
  }

  if (/\befter jobbet\b/.test(t)) {
    const remindAt = rollForwardIfPast(applyTime(base, 17, 30)).getTime();
    return { remindAt, hint: formatHint(remindAt) };
  }

  const time = extractTime(t);
  const hours = time?.hours ?? 9;
  const minutes = time?.minutes ?? 0;

  let remindAt = rollForwardIfPast(applyTime(base, hours, minutes)).getTime();
  let hint = formatHint(remindAt);
  if (time?.rangeEnd != null) {
    hint = `${hint.split(' ')[0]} ${pad(hours)}:00–${pad(time.rangeEnd)}:00`;
  }

  return { remindAt, hint };
}

function resolveMonth(token: string): number | null {
  const t = token.toLowerCase();
  for (const [key, month] of Object.entries(MONTHS)) {
    if (t === key || t.startsWith(key.slice(0, 3))) return month;
  }
  return null;
}

function formatHint(ts: number): string {
  const d = new Date(ts);
  const now = new Date();
  const isTomorrow =
    d.getDate() === now.getDate() + 1 && d.getMonth() === now.getMonth() && d.getFullYear() === now.getFullYear();
  const time = `${pad(d.getHours())}:${pad(d.getMinutes())}`;
  if (isTomorrow) return `Imorgon ${time}`;
  if (d.toDateString() === now.toDateString()) return `Idag ${time}`;
  return `${d.toLocaleDateString('sv-SE', { weekday: 'short', day: 'numeric', month: 'short' })} ${time}`;
}

/** Parse "15 juli" style date for birthdays (month 1-12, day 1-31). */
export function parseSwedishBirthdayDate(raw: string): { month: number; day: number } | null {
  const t = raw.trim().toLowerCase();
  const match = t.match(/\b(\d{1,2})\s*[/.-]?\s*(jan(?:uari)?|feb(?:ruari)?|mar(?:s)?|apr(?:il)?|maj|jun(?:i)?|jul(?:i)?|aug(?:usti)?|sep(?:t(?:ember)?)?|okt(?:ober)?|nov(?:ember)?|dec(?:ember)?)\b/);
  if (!match) {
    const numeric = t.match(/\b(\d{1,2})[/.-](\d{1,2})\b/);
    if (numeric) {
      const day = Number(numeric[1]);
      const month = Number(numeric[2]);
      if (month >= 1 && month <= 12 && day >= 1 && day <= 31) return { month, day };
    }
    return null;
  }
  const day = Number(match[1]);
  const monthToken = match[2];
  const month = resolveMonth(monthToken);
  if (month && day >= 1 && day <= 31) return { month, day };
  return null;
}

function pad(n: number): string {
  return String(n).padStart(2, '0');
}

const HOUR_WORDS: Record<string, number> = {
  noll: 0,
  midnatt: 0,
  en: 1,
  ett: 1,
  två: 2,
  tva: 2,
  tre: 3,
  fyra: 4,
  fyr: 4,
  fem: 5,
  sex: 6,
  sju: 7,
  sjua: 7,
  åtta: 8,
  atta: 8,
  otta: 8,
  nio: 9,
  tio: 10,
  elva: 11,
  tolv: 12,
};

/** Parse "klockan nio", "kl 15", "15-16", "13" from Swedish text. */
export function parseSwedishClockTime(raw: string): { hours: number; minutes: number; endHours?: number } | null {
  const t = raw.trim().toLowerCase().replace(/\s+/g, ' ');

  const rangeMatch = t.match(/\b(\d{1,2})\s*[-–]\s*(\d{1,2})\b/);
  if (rangeMatch) {
    const hours = Number(rangeMatch[1]);
    const endHours = Number(rangeMatch[2]);
    if (hours > 23 || endHours > 23) return null;
    return { hours, minutes: 0, endHours };
  }

  const klWord = t.match(/\b(?:kl\.?|klockan)\s+([a-zåäö]+)\b/);
  if (klWord && HOUR_WORDS[klWord[1]] != null) {
    return { hours: HOUR_WORDS[klWord[1]], minutes: 0 };
  }

  const klDigit = t.match(/\b(?:kl\.?|klockan)\s*(\d{1,2})(?:[:.](\d{2}))?\b/);
  if (klDigit) {
    return {
      hours: Number(klDigit[1]),
      minutes: klDigit[2] ? Number(klDigit[2]) : 0,
    };
  }

  if (/^\d{1,2}$/.test(t.trim())) {
    const hours = Number(t.trim());
    if (hours > 23) return null;
    return { hours, minutes: 0 };
  }

  const bare = t.match(/(?:^|\s)(\d{1,2})(?:[:.](\d{2}))?(?:\s|$)/);
  if (bare && !/\d{1,2}\s*[-–]\s*\d{1,2}/.test(t)) {
    const hours = Number(bare[1]);
    const minutes = bare[2] ? Number(bare[2]) : 0;
    if (hours > 23 || minutes > 59) return null;
    return { hours, minutes };
  }

  return null;
}
