import {
  composeEmailFromRequest,
  parseCalendarBookingRequest,
  parseEmailFromConversation,
  parseEmailRequest,
  parseTaskReminderRequest,
} from '@/services/gemini';
import { markSentEmailCacheDirty } from '@/services/email-cache-events';
import { ensureEmailSignature } from '@/services/email-signature';
import { loadBossContact } from '@/services/boss-contact';
import { findContactEmailByName, sendGmailMessage, batchDeleteGmailMessages, fetchMessageSubjects, listGmailMessageIds } from '@/services/gmail-api';
import {
  createCalendarEvent,
  cancelCalendarEventsMatching,
  cancelAllEventsForDay,
  fetchEventsForDay,
  formatBookingSummary,
  formatDayLabel,
  formatEventTime,
  type CalendarEventItem,
} from '@/services/device-calendar';
import { getCalendarAnswer } from '@/services/meeting-context';
import {
  answerEmailQuestion,
  looksLikeEmailReadRequest,
} from '@/services/email-context';
import { cancelTaskReminder, formatTaskReminderLabel, scheduleTaskReminder } from '@/services/task-reminders';
import {
  createBirthdayEntry,
  syncBirthdayReminders,
} from '@/services/birthday-reminders';
import { parseSwedishBirthdayDate, parseSwedishClockTime, parseSwedishReminder } from '@/utils/parse-swedish-datetime';
import type { PendingCalendarBooking, PendingEmailDraft, PendingJunkCleanup, PendingSickDay } from '@/types/assistant';
import type { AgentTask, ConversationMessage, UserMemory } from '@/types/memory';

export function looksLikeEmailRequest(text: string): boolean {
  const t = text.toLowerCase();
  return (
    /\b(skriv till|maila|mejla|skicka\s+(?:ett\s+)?(?:mail|mejl|email)|vill skicka|skicka mail|skicka mejl)\b/.test(
      t,
    ) ||
    (t.includes('till') && (t.includes('mail') || t.includes('mejl') || t.includes('email')))
  );
}

export function assistantAskedAboutEmail(text: string): boolean {
  return /ska jag skicka|förberett ett mail|jag har skrivit detta mail|mejl som väntar|vem vill du maila|vem ska jag skicka|vilket mail|mottagare|skicka det\?/i.test(
    text,
  );
}

export function shouldContinueEmailFlow(history: ConversationMessage[]): boolean {
  const lastAssistant = [...history].reverse().find((m) => m.role === 'assistant');
  if (!lastAssistant) return false;
  return assistantAskedAboutEmail(lastAssistant.text);
}

function extractDraftFromAssistantPreview(text: string): PendingEmailDraft | null {
  const toLine = text.match(/Till:\s*(.+?)\s*\(([^\s@]+@[^\s)]+)\)/i);
  const subjectLine = text.match(/Ämne:\s*(.+)/i);
  if (!toLine || !subjectLine) return null;

  const bodyStart = text.indexOf(subjectLine[0]) + subjectLine[0].length;
  const confirmIdx = text.search(/Ska jag skicka/i);
  const body = text
    .slice(bodyStart, confirmIdx > 0 ? confirmIdx : undefined)
    .trim();

  if (!body) return null;

  return {
    to: toLine[2].trim(),
    toName: toLine[1].trim(),
    subject: subjectLine[1].trim(),
    body,
  };
}

export function assistantAskedAboutCancel(text: string): boolean {
  return /vill du att jag ska avboka|ska jag avboka|vill du avboka|ska jag ta bort mötet/i.test(
    text,
  );
}

export function isAffirmativeReply(text: string): boolean {
  const t = text.trim().toLowerCase();
  if (/\b(avboka|avbryt|nej|inte|ta bort)\b/.test(t)) return false;
  return /^(ja|japp|jaa|javisst|ok|okej|gör det|yes|kör|absolut|bekräfta)\b/.test(t);
}

export function isBookingConfirmation(text: string): boolean {
  const t = text.trim().toLowerCase();
  if (/\b(avboka|avbryt|nej|inte|ta bort|skicka inte|boka inte)\b/.test(t)) return false;
  return (
    /^(ja|japp|jaa|javisst|boka|ok|okej|gör det|yes|kör|absolut|bekräfta)\b/.test(t) ||
    /^boka( det)?[.!]?$/.test(t)
  );
}

export function isEmailConfirmation(text: string): boolean {
  const t = text.trim().toLowerCase();
  return (
    /^(ja|japp|jaa|javisst|skicka|send|ok|okej|gör det|yes|kör|absolut|bekräfta)\b/.test(t) ||
    /^skicka( det)?[.!]?$/.test(t)
  );
}

/** @deprecated use isBookingConfirmation or isEmailConfirmation */
export function isSendConfirmation(text: string): boolean {
  return isBookingConfirmation(text) || isEmailConfirmation(text);
}

export function shouldAutoSendEmail(text: string): boolean {
  return false;
}

function parseSimpleEmailRequest(
  userMessage: string,
): { recipientName: string; messageIntent: string } | null {
  const t = userMessage.trim();

  const directEmail = t.match(
    /(?:skicka|maila|mejla|skriv)\s+(?:ett\s+)?(?:mail|mejl|e-?post)?\s*(?:till\s+)?([^\s@]+@[^\s@]+\.[^\s@]+)/i,
  );
  if (directEmail) {
    const intent =
      t.match(/\b(?:och\s+)?(?:säg|skriv|att)\s+(.+)$/i)?.[1]?.trim() ||
      t.match(/\bmed\s+(?:budskap|text|innehåll)\s+(.+)$/i)?.[1]?.trim() ||
      'Hej';
    return { recipientName: directEmail[1], messageIntent: intent };
  }

  const emailVerbMatch = t.match(
    /(?:skriv|maila|mejla|skicka)\s+(?:ett\s+)?(?:mail|mejl|e-?post)?\s*till\s+(.+)/i,
  );
  if (!emailVerbMatch) return null;

  let remainder = emailVerbMatch[1].trim();

  const intentAfterKeyword = remainder.match(
    /\b(?:och\s+)?(?:säg|skriv)\s+(?:att\s+)?(.+)$/i,
  );
  if (intentAfterKeyword?.index !== undefined) {
    const intent = intentAfterKeyword[1].trim();
    const name = remainder.slice(0, intentAfterKeyword.index).trim();
    if (name && intent) return { recipientName: name, messageIntent: intent };
  }

  const jagSplit = remainder.match(
    /^([A-Za-zÅÄÖåäöéü0-9][A-Za-zÅÄÖåäöéü0-9-]*(?:\s+[A-Za-zÅÄÖåäöéü][A-Za-zÅÄÖåäöéü0-9-]*)*)\s+(jag\s.+)$/i,
  );
  if (jagSplit) {
    return { recipientName: jagSplit[1].trim(), messageIntent: jagSplit[2].trim() };
  }

  const attSplit = remainder.match(
    /^([A-Za-zÅÄÖåäöéü0-9][A-Za-zÅÄÖåäöéü0-9-]*(?:\s+[A-Za-zÅÄÖåäöéü][A-Za-zÅÄÖåäöéü0-9-]*)*)\s+(att\s.+)$/i,
  );
  if (attSplit) {
    return {
      recipientName: attSplit[1].trim(),
      messageIntent: attSplit[2].replace(/^att\s+/i, '').trim(),
    };
  }

  const singleToken = remainder.match(/^([A-Za-zÅÄÖåäöéü0-9][A-Za-zÅÄÖåäöéü0-9-]*)$/);
  if (singleToken) {
    return { recipientName: singleToken[1], messageIntent: 'Hej' };
  }

  return null;
}

export function isSendCancellation(text: string): boolean {
  if (looksLikeCalendarCancelRequest(text)) return false;
  const t = normalizeSpeechText(text);
  if (/\b(avbryt|strunta|skicka inte|boka inte|nej tack|ändra)\b/.test(t)) {
    return true;
  }
  return /^(nej|cancel|stop)\b/.test(t);
}

export function looksLikeTaskOrReminderRequest(text: string): boolean {
  const t = normalizeSpeechText(text);
  if (looksLikeCalendarBookingRequest(text)) return false;
  if (looksLikeCalendarCancelRequest(text)) return false;
  if (looksLikeTaskRemoveRequest(text)) return false;
  return (
    /\b(påminn|påminna|påminner|kom\s*ihåg|komihåg|notera|uppgift)\b/.test(t) ||
    /\b(kan du|skulle du|vill du|snälla)\b.*\b(påminn|påminna|kom)\b/.test(t) ||
    /\b(påminn|kom ihåg|komihåg).*\b(dej|dejt|träff|träffa)\b/.test(t) ||
    /\b(handla|köpa|shopping|inköp|göra\s*lista|gör\s*lista|efter jobbet)\b/.test(t) ||
    (/\b(påminn|kom ihåg)\b/.test(t) && t.length > 8)
  );
}

export function normalizeSpeechText(text: string): string {
  return text
    .toLowerCase()
    .replace(/\s+/g, ' ')
    .replace(/\bav\s+bok(?:a|ar|at)?\b/g, 'avboka')
    .replace(/\bi\s+morgon\b/g, 'imorgon')
    .replace(/\bi\s+morron\b/g, 'imorgon')
    .replace(/\bimorg\b/g, 'imorgon')
    .replace(/\bimorrg?\b/g, 'imorgon')
    .replace(/\bimorn\b/g, 'imorgon')
    .replace(/\bmorgondagen\b/g, 'imorgon')
    .replace(/\bklokna\b/g, 'klockan')
    .replace(/\bcl\b/g, 'kl')
    .trim();
}

function hasCancelVerb(text: string): boolean {
  const t = normalizeSpeechText(text);
  return (
    /\b(avboka|avbokar|avbokat|ställ in|stall in|stryk|stryker|ta bort|radera|rensa|remove|cancel|delete|skippa|skip|strunta)\b/.test(
      t,
    ) || /\b(strunta i|ta bort|ta veck|ta väck)\b/.test(t)
  );
}

function looksLikeCalendarReadQuestion(text: string): boolean {
  const t = normalizeSpeechText(text);
  return /\b(vad har jag|har jag|har ja|finns det|något inbokat|något planerat|något bokat|visa schema|kolla schema)\b/.test(
    t,
  );
}

export function looksLikeBulkCalendarCancel(text: string): boolean {
  const t = normalizeSpeechText(text);
  return (
    /\b(avboka|ta bort|radera|rensa|stryk)\b.*\balla\b/.test(t) ||
    /\brensa\s+(morgondagen|imorgon|dagen|idag|kalendern)\b/.test(t) ||
    /\bta bort alla\b.*\b(möte|möten|mötes|kalender|bokning|träff)\b/.test(t) ||
    /\b(avboka|ta bort)\b.*\b(morgondagen|hela dagen)\b/.test(t)
  );
}

export function looksLikeCalendarCancelRequest(text: string): boolean {
  const t = normalizeSpeechText(text);
  if (!hasCancelVerb(text)) return false;

  if (looksLikeBulkCalendarCancel(text)) return true;

  return (
    /\b(möte|möten|mötes|dejt|träff|kalender|bokning|appointment|event|tid|inbokat|inbokad)\b/.test(t) ||
    /\b(imorgon|idag|ikväll|ikvall|morgondagen)\b/.test(t) ||
    /\b\d{1,2}\s*[-–]\s*\d{1,2}\b/.test(t) ||
    /\b(?:kl|klockan)\s*\d/.test(t) ||
    /\bmed\s+[a-zåäö]/i.test(text) ||
    /\b(senaste|det|det där|den)\b/.test(t) ||
    /^(ta bort|avboka|radera|skippa)( det| mötet| de(t|t där))?[.!]?$/i.test(t)
  );
}

export function looksLikeCalendarBookingRequest(text: string): boolean {
  const t = normalizeSpeechText(text);
  if (looksLikeCalendarCancelRequest(text)) return false;
  if (looksLikeEmailRequest(text)) return false;
  if (looksLikeCalendarReadQuestion(text)) return false;
  // Påminnelse ska sparas som uppgift — inte bokas i kalendern.
  if (/\b(påminn|påminna|påminner|kom\s*ihåg|komihåg|notera)\b/.test(t)) return false;

  const hasBookVerb =
    /\b(boka|bokar|boka in|boka en tid|boka tid|lägg in|lägg till|lägg|skapa|sätt in|planera|nytt möte|skapa möte|vill ha|behöver|fixa)\b/.test(
      t,
    );
  const hasCalendarNoun =
    /\b(kalender|kalendern|möte|mötes|dejt|avtal|tid|schema|träff|appointment)\b/.test(t);
  const hasTimeHint =
    /\b(imorgon|idag|på\s+\w+|kl\s*\d|klockan\s*(\d|[a-zåäö]+)|\d{1,2}[:\.]\d{2}|kväll|morgon|eftermiddag|nästa vecka)\b/.test(
      t,
    );
  const hasClockTime =
    /\b(?:kl|klockan)\s*(?:\d|[a-zåäö]+)|\d{1,2}[:\.]\d{2}\b|\d{1,2}\s*[-–]\s*\d{1,2}\b/.test(t);

  if (hasBookVerb && (hasCalendarNoun || hasTimeHint)) return true;

  // Röst missar ofta "boka": "möte imorgon kl 15" ska bokas, inte läsas
  if (hasCalendarNoun && hasTimeHint && hasClockTime) return true;

  return false;
}

export function shouldAutoConfirmCalendarBooking(text: string): boolean {
  return looksLikeCalendarBookingRequest(text);
}

export function looksLikeCalendarReadRequest(text: string): boolean {
  if (looksLikeCalendarBookingRequest(text)) return false;
  if (looksLikeTaskOrReminderRequest(text)) return false;

  const t = normalizeSpeechText(text);
  if (/\b(boka|bokar|lägg in|skapa möte|nytt möte)\b/.test(t)) return false;

  if (looksLikeCalendarReadQuestion(text)) return true;

  return (
    /\b(kalender|schema|nästa möte)\b/.test(t) ||
    (/\b(imorgon|idag|veckan)\b/.test(t) && /\b(har jag|planerat|inbokat)\b/.test(t))
  );
}

function formatDraftPreview(draft: PendingEmailDraft): string {
  return [
    `Till: ${draft.toName} (${draft.to})`,
    `Ämne: ${draft.subject}`,
    '',
    draft.body,
    '',
    'Ska jag skicka det? Säg "ja" eller "skicka" för att bekräfta, eller "nej" / "avbryt" för att ändra.',
  ].join('\n');
}

function formatSpokenDraftPreview(draft: PendingEmailDraft): string {
  const intro = `Jag har skrivit detta mail till ${draft.toName}.`;
  const content = `Ämne: ${draft.subject}. ${draft.body.replace(/\n+/g, ' ')}`;
  return `${intro}\n\n${content}\n\nSka jag skicka det? Säg "ja" eller "skicka" för att bekräfta, eller "nej" / "avbryt" för att ändra.`;
}

export async function trySendPendingEmail(
  draft: PendingEmailDraft,
  accessToken: string,
): Promise<string> {
  console.log('[email] Skickar via Gmail API:', {
    to: draft.to,
    subject: draft.subject,
  });
  try {
    await sendGmailMessage(accessToken, draft.to, draft.subject, draft.body);
    await markSentEmailCacheDirty();
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : String(err);
    if (message.includes('gmail_token_expired') || message.includes('401')) {
      throw new Error(
        'Gmail-åtkomst har gått ut. Gå till Email-fliken → Koppla Google Mail igen.',
      );
    }
    if (message.includes('gmail_send_denied') || message.includes('403')) {
      throw new Error(
        'Gmail tillåter inte utskick. Koppla Google Mail igen och godkänn skicka-behörighet.',
      );
    }
    throw new Error('Kunde inte skicka mejlet. Kontrollera internet och Gmail-koppling.');
  }
  console.log('[email] Gmail API send OK');
  return `Mejl skickat till ${draft.toName}.`;
}

/** Skicka när användaren bekräftat men pendingDraft tappades (t.ex. Gemini-svar utan ref). */
export async function trySendEmailAfterConfirmation(
  history: ConversationMessage[],
  accessToken: string,
  senderName: string,
  senderJob?: string,
): Promise<string | null> {
  const lastAssistant = [...history].reverse().find((m) => m.role === 'assistant');
  if (!lastAssistant || !assistantAskedAboutEmail(lastAssistant.text)) return null;

  const fromPreview = extractDraftFromAssistantPreview(lastAssistant.text);
  if (fromPreview) {
    return trySendPendingEmail(fromPreview, accessToken);
  }

  const parsed = await parseEmailFromConversation(history);
  if (!parsed) return null;

  const userLines = history
    .filter((m) => m.role === 'user')
    .map((m) => m.text)
    .join(' ');
  const { draft } = await prepareEmailDraft(userLines, accessToken, senderName, senderJob);
  return trySendPendingEmail(draft, accessToken);
}

export async function continueEmailConversation(
  historyWithUser: ConversationMessage[],
  accessToken: string,
  senderName: string,
  senderJob?: string,
): Promise<{ draft: PendingEmailDraft; previewReply: string } | null> {
  const parsed = await parseEmailFromConversation(historyWithUser);
  if (!parsed) return null;

  const userLines = historyWithUser
    .filter((m) => m.role === 'user')
    .map((m) => m.text)
    .join(' ');

  return prepareEmailDraft(userLines, accessToken, senderName, senderJob);
}

export async function prepareEmailDraft(
  userMessage: string,
  accessToken: string,
  senderName: string,
  senderJob?: string,
): Promise<{ draft: PendingEmailDraft; previewReply: string }> {
  const parsed = parseSimpleEmailRequest(userMessage) ?? (await parseEmailRequest(userMessage));
  if (!parsed) {
    throw new Error(
      'Jag förstod inte vem du vill maila. Prova: "Skriv till Magnus och säg att jag kommer sent."',
    );
  }

  const contact = await findContactEmailByName(accessToken, parsed.recipientName);
  if (!contact) {
    throw new Error(
      `Jag hittar ingen e-postadress för ${parsed.recipientName} i din Gmail. Skriv adressen, t.ex. "Skriv till magnus@firma.se och säg hej."`,
    );
  }

  const composed = await composeEmailFromRequest(
    contact.displayName || parsed.recipientName,
    parsed.messageIntent,
    senderName,
    senderJob,
  );

  const draft: PendingEmailDraft = {
    to: contact.email,
    toName: contact.displayName || parsed.recipientName,
    subject: composed.subject,
    body: ensureEmailSignature(composed.body, senderName, senderJob),
  };

  return {
    draft,
    previewReply: formatSpokenDraftPreview(draft),
  };
}

export async function answerCalendarQuestion(userMessage: string): Promise<string | null> {
  if (!looksLikeCalendarReadRequest(userMessage)) return null;
  return getCalendarAnswer(userMessage);
}

export async function answerEmailReadQuestion(
  userMessage: string,
  accessToken: string,
): Promise<string | null> {
  if (!looksLikeEmailReadRequest(userMessage)) return null;
  return answerEmailQuestion(userMessage, accessToken);
}

function findConflictingEvents(
  start: Date,
  end: Date,
  dayEvents: Awaited<ReturnType<typeof fetchEventsForDay>>,
): string[] {
  const startMs = start.getTime();
  const endMs = end.getTime();

  return dayEvents
    .filter((e) => e.end.getTime() > startMs && e.start.getTime() < endMs)
    .map((e) => `${formatEventTime(e)} ${e.title}`);
}

function parseSimpleCalendarBooking(userMessage: string): {
  title: string;
  start: Date;
  end: Date;
  summary: string;
} | null {
  const t = normalizeSpeechText(userMessage);
  if (!looksLikeCalendarBookingRequest(userMessage)) return null;

  const day = new Date();
  if (/\bimorgon\b/.test(t)) {
    day.setDate(day.getDate() + 1);
  } else if (/\bidag\b/.test(t)) {
    // today
  } else if (/\bövermorgon\b/.test(t)) {
    day.setDate(day.getDate() + 2);
  } else {
    return null;
  }

  const clock = parseSwedishClockTime(t);
  if (!clock) return null;

  const hours = clock.hours;
  const minutes = clock.minutes;
  let endHours: number | null = clock.endHours ?? null;
  const endMinutes = 0;
  if (hours > 23 || minutes > 59) return null;

  const start = new Date(day);
  start.setHours(hours, minutes, 0, 0);
  const end = new Date(start);
  if (endHours !== null) {
    if (endHours > 23) return null;
    end.setHours(endHours, endMinutes, 0, 0);
  } else {
    end.setHours(end.getHours() + 1);
  }

  let title = 'Möte';
  if (/\bdejt\b/.test(t)) title = 'Dejt';
  else if (/\btandläkare\b/.test(t)) title = 'Tandläkare';
  else if (/\bläkare\b/.test(t)) title = 'Läkarbesök';
  else if (/\bjobb\b/.test(t)) title = 'Jobbmöte';

  const medMatch = t.match(/\bmed\s+([a-zåäöéüA-ZÅÄÖÉÜ][\wåäöéüÅÄÖÉÜ\s-]{1,30})/i);
  if (medMatch) {
    const person = medMatch[1]
      .replace(/\b(?:kl|klockan|imorgon|idag|på)\b.*$/i, '')
      .trim();
    if (person) title = `${title} med ${person}`;
  }

  const timeLabel = `${String(hours).padStart(2, '0')}:${String(minutes).padStart(2, '0')}`;
  const endLabel = `${String(end.getHours()).padStart(2, '0')}:${String(end.getMinutes()).padStart(2, '0')}`;
  const summary = `${title} ${formatDayLabel(start)} kl ${timeLabel}–${endLabel}`;

  return { title, start, end, summary };
}

function parseDayFromHistory(history?: ConversationMessage[]): Date | null {
  if (!history?.length) return null;

  for (const msg of [...history].reverse().slice(0, 12)) {
    const t = normalizeSpeechText(msg.text);
    if (/\bimorgon\b/.test(t)) {
      const day = new Date();
      day.setHours(12, 0, 0, 0);
      day.setDate(day.getDate() + 1);
      return day;
    }
    if (/\bidag\b/.test(t)) {
      const day = new Date();
      day.setHours(12, 0, 0, 0);
      return day;
    }
  }

  return null;
}

async function resolveCancelDayFromMeetings(
  userMessage: string,
  userId?: string,
): Promise<Date | null> {
  const t = normalizeSpeechText(userMessage);
  const preferTomorrow = /\bimorgon\b/.test(t);

  for (let offset = preferTomorrow ? 1 : 0; offset <= 7; offset++) {
    const day = new Date();
    day.setHours(12, 0, 0, 0);
    day.setDate(day.getDate() + offset);
    const events = await fetchEventsForDay(day, userId);
    if (events.length > 0) return day;
  }

  if (preferTomorrow) {
    const tomorrow = new Date();
    tomorrow.setHours(12, 0, 0, 0);
    tomorrow.setDate(tomorrow.getDate() + 1);
    return tomorrow;
  }

  return null;
}

function parseCancelDay(userMessage: string, history?: ConversationMessage[]): Date | null {
  const t = normalizeSpeechText(userMessage);
  const day = new Date();
  day.setHours(12, 0, 0, 0);

  if (/\b(imorgon|morgondagen)\b/.test(t)) {
    day.setDate(day.getDate() + 1);
    return day;
  }
  if (/\bidag\b/.test(t) || /\bdagen\b/.test(t)) {
    return day;
  }
  if (looksLikeBulkCalendarCancel(userMessage)) {
    return day;
  }

  const fromHistory = parseDayFromHistory(history);
  if (fromHistory) return fromHistory;

  if (extractPersonHint(userMessage)) {
    day.setDate(day.getDate() + 1);
    return day;
  }

  if (hasCancelVerb(userMessage) && /\b(möte|möten|dejt|bokning|träff|kalender)\b/.test(t)) {
    day.setDate(day.getDate() + 1);
    return day;
  }

  return null;
}

function parseSimpleCalendarCancel(
  userMessage: string,
  history?: ConversationMessage[],
): {
  day: Date;
  windowStart?: Date;
  windowEnd?: Date;
  bulkAll?: boolean;
} | null {
  const t = normalizeSpeechText(userMessage);
  if (!looksLikeCalendarCancelRequest(userMessage)) return null;

  const bulkAll = looksLikeBulkCalendarCancel(userMessage) || /\balla\b/.test(t);
  const day = parseCancelDay(userMessage, history);
  if (!day) return null;

  if (bulkAll) {
    return { day, bulkAll: true };
  }

  const rangeMatch = t.match(/\b(\d{1,2})\s*[-–]\s*(\d{1,2})\b/);
  if (rangeMatch) {
    const startHour = Number(rangeMatch[1]);
    const endHour = Number(rangeMatch[2]);
    if (startHour > 23 || endHour > 23) return null;
    const windowStart = new Date(day);
    windowStart.setHours(startHour, 0, 0, 0);
    const windowEnd = new Date(day);
    windowEnd.setHours(endHour, 0, 0, 0);
    return { day, windowStart, windowEnd };
  }

  const klMatch = t.match(/\b(?:kl|klockan|mellan)\s*(\d{1,2})(?:[:\.](\d{2}))?\s*(?:och|-)?\s*(\d{1,2})?(?:[:\.](\d{2}))?\b/);
  if (klMatch) {
    const hours = Number(klMatch[1]);
    const minutes = klMatch[2] ? Number(klMatch[2]) : 0;
    const endHours = klMatch[3] ? Number(klMatch[3]) : hours + 1;
    const endMinutes = klMatch[4] ? Number(klMatch[4]) : minutes;
    if (hours > 23 || minutes > 59) return null;
    const windowStart = new Date(day);
    windowStart.setHours(hours, minutes, 0, 0);
    const windowEnd = new Date(day);
    windowEnd.setHours(endHours, endMinutes, 0, 0);
    return { day, windowStart, windowEnd };
  }

  const timePair = userMessage.match(/(\d{1,2}):(\d{2}).*?(\d{1,2}):(\d{2})/);
  if (timePair) {
    const windowStart = new Date(day);
    windowStart.setHours(Number(timePair[1]), Number(timePair[2]), 0, 0);
    const windowEnd = new Date(day);
    windowEnd.setHours(Number(timePair[3]), Number(timePair[4]), 0, 0);
    return { day, windowStart, windowEnd };
  }

  const klOnly = t.match(/\b(?:kl|klockan)\s*(\d{1,2})(?:[:\.](\d{2}))?\b/);
  if (klOnly) {
    const hours = Number(klOnly[1]);
    const minutes = klOnly[2] ? Number(klOnly[2]) : 0;
    if (hours > 23 || minutes > 59) return null;
    const windowStart = new Date(day);
    windowStart.setHours(hours, minutes, 0, 0);
    const windowEnd = new Date(windowStart);
    windowEnd.setHours(windowEnd.getHours() + 1);
    return { day, windowStart, windowEnd };
  }

  const timeMatch = t.match(/\b(\d{1,2})[:\.](\d{2})\b/);
  if (timeMatch) {
    const hours = Number(timeMatch[1]);
    const minutes = Number(timeMatch[2]);
    const windowStart = new Date(day);
    windowStart.setHours(hours, minutes, 0, 0);
    const windowEnd = new Date(windowStart);
    windowEnd.setHours(windowEnd.getHours() + 1);
    return { day, windowStart, windowEnd };
  }

  return { day, bulkAll: false };
}

async function cancelAllMeetingsForDay(day: Date, userId?: string): Promise<string> {
  const dayLabel = formatDayLabel(day);
  const before = await fetchEventsForDay(day, userId);
  if (before.length === 0) {
    return `Du har inga möten ${dayLabel.toLowerCase()}.`;
  }

  const { removed, remaining } = await cancelAllEventsForDay(day, userId);

  if (remaining > 0) {
    return `Jag tog bort ${removed} möten ${dayLabel.toLowerCase()}, men ${remaining} kopia${remaining > 1 ? 'or' : ''} finns kvar. Öppna Kalender-fliken och tryck Ta bort alla.`;
  }

  if (removed === 0) {
    return `Jag kunde inte avboka mötena ${dayLabel.toLowerCase()}. Ta bort dem manuellt i Kalender-fliken.`;
  }

  return `Avbokat ${removed} möte${removed > 1 ? 'n' : ''} ${dayLabel.toLowerCase()}.`;
}

function eventMatchesCancelWindow(
  event: CalendarEventItem,
  windowStart?: Date,
  windowEnd?: Date,
): boolean {
  if (!windowStart) return true;

  const eventStart = event.start.getTime();
  const eventEnd = event.end.getTime();
  const rangeStart = windowStart.getTime();
  const rangeEnd = (windowEnd ?? new Date(windowStart.getTime() + 60 * 60 * 1000)).getTime();

  return eventEnd > rangeStart && eventStart < rangeEnd;
}

function extractPersonHint(text: string): string | null {
  const medMatch = text.match(/\bmed\s+([A-ZÅÄÖa-zåäö][\wåäöÅÄÖ-]{1,30})/i);
  if (medMatch) return medMatch[1].trim();

  const nameMatch = text.match(/\bmöte\s+med\s+([A-ZÅÄÖa-zåäö][\wåäöÅÄÖ-]{1,30})/i);
  if (nameMatch) return nameMatch[1].trim();

  const bareName = text.match(/\b(Ellinor|Marie|Magnus|Anna|Erik|Sara|Ali|Fatima)\b/i);
  if (bareName) return bareName[1];

  const titleName = text.match(/\b([A-ZÅÄÖ][a-zåäö]{2,20})\b/);
  if (titleName && !/^(Möte|Imorgon|Idag|Tisdag|Onsdag|Fredag|Lördag|Söndag|Måndag|Jag|Du|Assistent|Bokat|Vill|Eller|Kl|Klockan)$/i.test(titleName[1])) {
    return titleName[1];
  }

  return null;
}

function eventMatchesPerson(event: CalendarEventItem, personHint: string): boolean {
  return event.title.toLowerCase().includes(personHint.toLowerCase());
}

function pickSingleCancelTarget(
  events: CalendarEventItem[],
  userMessage: string,
  history?: ConversationMessage[],
): CalendarEventItem | null {
  if (events.length === 0) return null;
  if (events.length === 1) return events[0];

  const personHint = extractPersonHint(userMessage);
  if (personHint) {
    const matched = events.filter((event) => eventMatchesPerson(event, personHint));
    if (matched.length === 1) return matched[0];
    if (matched.length > 1) {
      return matched.sort((a, b) => a.start.getTime() - b.start.getTime())[0];
    }
  }

  if (history?.length) {
    for (const msg of [...history].reverse().slice(0, 8)) {
      const klMatch = msg.text.match(/\b(?:kl|klockan)\s*(\d{1,2})(?:[:\.](\d{2}))?\b/i);
      if (!klMatch) continue;
      const hours = Number(klMatch[1]);
      const minutes = klMatch[2] ? Number(klMatch[2]) : 0;
      const found = events.find(
        (event) => event.start.getHours() === hours && event.start.getMinutes() === minutes,
      );
      if (found) return found;
    }
  }

  if (/\bsenaste\b/.test(normalizeSpeechText(userMessage))) {
    return [...events].sort((a, b) => b.start.getTime() - a.start.getTime())[0] ?? null;
  }

  const now = Date.now();
  const upcoming = events
    .filter((event) => event.end.getTime() > now)
    .sort((a, b) => a.start.getTime() - b.start.getTime());
  if (upcoming.length > 0) return upcoming[0];

  return events[events.length - 1];
}

export async function tryCancelCalendarBookingFromContext(
  history: ConversationMessage[],
  userId?: string,
): Promise<string | null> {
  const lastAssistant = [...history].reverse().find((m) => m.role === 'assistant');
  if (!lastAssistant || !assistantAskedAboutCancel(lastAssistant.text)) return null;

  const context = [...history]
    .slice(-8)
    .map((m) => m.text)
    .join(' ');
  return tryCancelCalendarBooking(`avboka ${context}`, userId, history);
}

export async function tryCancelCalendarBooking(
  userMessage: string,
  userId?: string,
  history?: ConversationMessage[],
): Promise<string> {
  let parsed = parseSimpleCalendarCancel(userMessage, history);

  if (!parsed && looksLikeCalendarCancelRequest(userMessage)) {
    const day =
      parseDayFromHistory(history) ?? (await resolveCancelDayFromMeetings(userMessage, userId));
    if (day) {
      parsed = {
        day,
        bulkAll: looksLikeBulkCalendarCancel(userMessage) || /\balla\b/.test(normalizeSpeechText(userMessage)),
      };
    }
  }

  if (!parsed) {
    throw new Error(
      'Jag förstod inte vad jag skulle avboka. Prova: "Avboka alla möten imorgon" — eller öppna Kalender-fliken och ta bort mötet där.',
    );
  }

  if (parsed.bulkAll && !parsed.windowStart) {
    return cancelAllMeetingsForDay(parsed.day, userId);
  }

  const personHint = parsed.bulkAll ? null : extractPersonHint(userMessage);
  let before = await fetchEventsForDay(parsed.day, userId);

  if (before.length === 0) {
    for (let offset = 0; offset <= 7; offset++) {
      const probe = new Date(parsed.day);
      probe.setHours(12, 0, 0, 0);
      probe.setDate(probe.getDate() + offset);
      const found = await fetchEventsForDay(probe, userId);
      if (found.length > 0) {
        parsed = { ...parsed, day: probe };
        before = found;
        break;
      }
    }
  }

  let cancelParams: {
    day: Date;
    windowStart?: Date;
    windowEnd?: Date;
    titleHint?: string;
    exactEvent?: { start: Date; end: Date; title?: string };
  };

  if (!parsed.bulkAll && !parsed.windowStart) {
    let candidates = before;
    if (personHint) {
      candidates = before.filter((event) => eventMatchesPerson(event, personHint));
    }
    const target = pickSingleCancelTarget(candidates, userMessage, history);
    if (!target) {
      const dayLabel = formatDayLabel(parsed.day);
      return `Jag hittar inget möte att avboka ${dayLabel.toLowerCase()}.`;
    }
    cancelParams = {
      day: parsed.day,
      exactEvent: {
        start: target.start,
        end: target.end,
        title: target.title.length > 2 && !/^möte$/i.test(target.title) ? target.title : undefined,
      },
    };
  } else {
    const hadMatches = before.some(
      (event) =>
        eventMatchesCancelWindow(event, parsed.windowStart, parsed.windowEnd) &&
        (!personHint || eventMatchesPerson(event, personHint)),
    );

    if (!hadMatches) {
      const dayLabel = formatDayLabel(parsed.day);
      const timeHint = parsed.windowStart
        ? ` runt ${formatEventTime({
            id: 'tmp',
            title: 'Möte',
            start: parsed.windowStart,
            end: parsed.windowEnd ?? parsed.windowStart,
            calendarName: '',
            allDay: false,
          })}`
        : '';
      return `Jag hittar inget möte att avboka ${dayLabel}${timeHint}.`;
    }

    cancelParams = {
      day: parsed.day,
      windowStart: parsed.windowStart,
      windowEnd: parsed.windowEnd,
      titleHint: personHint ?? undefined,
    };
  }

  const { removed, remaining } = await cancelCalendarEventsMatching(cancelParams, userId);

  if (remaining > 0) {
    return `Jag tog bort ${removed} möten, men ${remaining} kopia${remaining > 1 ? 'or' : ''} finns kvar. Öppna Kalender-fliken och tryck på mötet → Ta bort möte.`;
  }

  if (removed === 0) {
    return 'Jag kunde inte avboka mötet just nu. Ta bort det manuellt i Kalender-fliken.';
  }

  return removed === 1
    ? `Avbokat 1 möte ${formatDayLabel(parsed.day)}.`
    : `Avbokat ${removed} möte${removed > 1 ? 'n' : ''} ${formatDayLabel(parsed.day)}.`;
}

export async function prepareCalendarBooking(
  userMessage: string,
  userId?: string,
): Promise<{ booking: PendingCalendarBooking; previewReply: string }> {
  const geminiParsed = await parseCalendarBookingRequest(userMessage).catch(() => null);
  const simpleParsed = parseSimpleCalendarBooking(userMessage);

  const parsed = geminiParsed
    ? {
        title: geminiParsed.title,
        start: new Date(geminiParsed.startIso),
        end: new Date(geminiParsed.endIso),
        summary: geminiParsed.summary || geminiParsed.title,
      }
    : simpleParsed;

  if (!parsed || Number.isNaN(parsed.start.getTime()) || Number.isNaN(parsed.end.getTime())) {
    throw new Error(
      'Jag förstod inte vad jag skulle boka. Prova: "Boka möte imorgon kl 15" — eller öppna Kalender-fliken och tryck Boka möte.',
    );
  }

  const start = parsed.start;
  const end = parsed.end;
  const summary = formatBookingSummary(parsed.title, start, end);

  const dayEvents = await fetchEventsForDay(start, userId);
  const conflicts = findConflictingEvents(start, end, dayEvents);
  const conflictNote =
    conflicts.length > 0
      ? `\n\nObs: Du har redan ${conflicts.slice(0, 2).join(' och ')}${conflicts.length > 2 ? ' m.m.' : ''} då.`
      : '';

  const booking: PendingCalendarBooking = {
    title: parsed.title,
    start,
    end,
    summary,
  };

  return {
    booking,
    previewReply: `Jag föreslår: ${parsed.summary || summary}.${conflictNote}\n\nSka jag boka det i din kalender? Säg "ja" eller "boka", annars "avbryt".`,
  };
}

export async function tryCreatePendingBooking(
  booking: PendingCalendarBooking,
  userId?: string,
): Promise<string> {
  const result = await createCalendarEvent(
    {
      title: booking.title,
      start: booking.start,
      end: booking.end,
    },
    userId,
  );

  if (!result.ok) {
    console.error('[calendar] Bokning misslyckades:', result.error);
    throw new Error(result.error);
  }

  if (result.mode === 'native_dialog') {
    return `Jag öppnade kalendern på telefonen med ${booking.summary}. Tryck Spara där — då syns det i appen.`;
  }

  return `Bokat: ${booking.summary}.`;
}

export function looksLikeTaskRemoveRequest(text: string): boolean {
  const t = normalizeSpeechText(text);
  if (looksLikeCalendarCancelRequest(text)) return false;
  return (
    /\b(ta bort|radera|stryk|remove|delete|rensa)\b/.test(t) &&
    (/\b(uppgift|uppgifter|påminnelse|todo|task|listan)\b/.test(t) || t.length > 14)
  );
}

function extractTaskQuery(text: string): string {
  return normalizeSpeechText(text)
    .replace(/\b(ta bort|radera|stryk|remove|delete|rensa|uppgift|uppgifter|påminnelse|min|mina|den|det)\b/gi, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

export async function handleTaskRemoveRequest(
  userMessage: string,
  memory: UserMemory,
): Promise<{ reply: string; updatedMemory: UserMemory }> {
  const openTasks = memory.tasks.filter((task) => !task.done);
  if (openTasks.length === 0) {
    return { reply: 'Du har inga öppna uppgifter att ta bort.', updatedMemory: memory };
  }

  const query = extractTaskQuery(userMessage);
  let targets = openTasks;

  if (query.length >= 3) {
    const matched = openTasks.filter((task) =>
      task.text.toLowerCase().includes(query) || query.includes(task.text.toLowerCase().slice(0, 8)),
    );
    if (matched.length > 0) targets = matched;
  }

  if (/\balla\b/.test(normalizeSpeechText(userMessage))) {
    targets = openTasks;
  }

  const removeIds = new Set(targets.map((task) => task.id));
  for (const id of removeIds) {
    await cancelTaskReminder(id);
  }

  const updatedMemory: UserMemory = {
    ...memory,
    tasks: memory.tasks.filter((task) => !removeIds.has(task.id)),
  };

  if (targets.length === 1) {
    return { reply: `Okej, jag tog bort "${targets[0].text}".`, updatedMemory };
  }

  return {
    reply: `Okej, jag tog bort ${targets.length} uppgifter.`,
    updatedMemory,
  };
}

function formatReminderWhenSpeech(remindAt: Date | null, normalized: string): string {
  if (!remindAt) {
    const bits: string[] = [];
    if (/\bimorgon\b/.test(normalized)) bits.push('imorgon');
    if (/\befter jobbet\b/.test(normalized)) bits.push('efter jobbet');
    return bits.length ? ` ${bits.join(' ')}` : '';
  }

  const h = remindAt.getHours();
  const m = remindAt.getMinutes();
  const time = m === 0 ? `kl ${h}` : `kl ${h}:${String(m).padStart(2, '0')}`;
  const now = new Date();
  const tomorrow = new Date(now);
  tomorrow.setDate(tomorrow.getDate() + 1);
  const sameDay = (a: Date, b: Date) =>
    a.getFullYear() === b.getFullYear() &&
    a.getMonth() === b.getMonth() &&
    a.getDate() === b.getDate();

  if (sameDay(remindAt, tomorrow) || /\bimorgon\b/.test(normalized)) return ` imorgon ${time}`;
  if (sameDay(remindAt, now) || /\b(idag|i dag)\b/.test(normalized)) return ` idag ${time}`;
  const date = remindAt.toLocaleDateString('sv-SE', {
    weekday: 'long',
    day: 'numeric',
    month: 'short',
  });
  return ` ${date} ${time}`;
}

function parseSimpleTaskReminder(
  userMessage: string,
  userName: string,
): {
  taskText: string;
  remindAtIso: string | null;
  spokenReply: string;
} | null {
  const t = normalizeSpeechText(userMessage);
  const isReminder =
    /\b(påminn|påminna|påminner|kom\s*ihåg|komihåg|notera)\b/.test(t) ||
    /\b(kan du|skulle du|vill du|snälla)\b.*\b(påminn|påminna|kom)\b/.test(t);

  if (!isReminder) return null;

  let taskText = userMessage.trim();
  for (const pattern of [
    /^(kan du\s+)?(snälla\s+)?(påminn|påminna|påminner)(\s+mig)?(\s+att)?\s+/i,
    /^(kom ihåg|komihåg)(\s+att)?\s+/i,
    /^(notera)(\s+att)?\s+/i,
  ]) {
    taskText = taskText.replace(pattern, '');
  }
  taskText = taskText.trim();

  const day = new Date();
  let remindAt: Date | null = null;

  if (/\bimorgon\b/.test(t)) {
    day.setDate(day.getDate() + 1);
  }

  if (/\befter jobbet\b/.test(t)) {
    remindAt = new Date(day);
    remindAt.setHours(17, 30, 0, 0);
    taskText = taskText.replace(/\befter jobbet\b/gi, '').trim();
  } else {
    const parsed = parseSwedishReminder(userMessage);
    if (parsed?.remindAt != null) {
      remindAt = new Date(parsed.remindAt);
    }
  }

  if (!remindAt) {
    const clock = parseSwedishClockTime(userMessage);
    if (clock) {
      remindAt = new Date(day);
      remindAt.setHours(clock.hours, clock.minutes, 0, 0);
    }
  }

  if (!remindAt) {
    const klMatch = t.match(/\b(?:kl|klockan)\s*(\d{1,2})(?:[:\.](\d{2}))?\b/);
    if (klMatch) {
      remindAt = new Date(day);
      const h = Number(klMatch[1]);
      remindAt.setHours(h >= 1 && h <= 6 ? h + 12 : h, klMatch[2] ? Number(klMatch[2]) : 0, 0, 0);
    }
  }

  taskText = taskText
    .replace(/\b(imorgon|idag|i kväll|ikväll|ikvall|övermorgon)\b/gi, '')
    .replace(/\b(?:på\s+)?(måndag|mandag|tisdag|onsdag|torsdag|fredag|lördag|lordag|söndag|sondag)\b/gi, '')
    .replace(/\b(?:kl\.?|klockan)\s*(?:\d{1,2}(?:[:.]\d{2})?|[a-zåäö]+)\b/gi, '')
    .replace(/\brunt\b/gi, '')
    .replace(/\batt\b/gi, '')
    .replace(/\s+/g, ' ')
    .trim();

  if (taskText.length < 2) return null;

  const firstName = userName?.split(' ')[0]?.trim() || '';
  const whenPart = formatReminderWhenSpeech(remindAt, t);
  const spokenReply = firstName
    ? `Okej ${firstName}! Jag påminner dig${whenPart} om ${taskText}.`
    : `Okej! Jag påminner dig${whenPart} om ${taskText}.`;

  return {
    taskText,
    remindAtIso: remindAt ? remindAt.toISOString() : null,
    spokenReply,
  };
}

export async function handleTaskReminderRequest(
  userMessage: string,
  memory: UserMemory,
): Promise<{ reply: string; updatedMemory: UserMemory }> {
  const parsed =
    parseSimpleTaskReminder(userMessage, memory.name) ??
    (await parseTaskReminderRequest(userMessage, memory.name));
  if (!parsed) {
    throw new Error(
      'Jag förstod inte uppgiften. Prova: "Påminn mig handla mat imorgon efter jobbet."',
    );
  }

  const remindAt = parsed.remindAtIso ? new Date(parsed.remindAtIso).getTime() : undefined;
  const swedishParsed = parseSwedishReminder(userMessage);
  const task: AgentTask = {
    id: `task-${Date.now()}`,
    text: parsed.taskText,
    createdAt: Date.now(),
    recurrence: swedishParsed?.recurrence,
    remindAt:
      swedishParsed?.recurrence || !remindAt || Number.isNaN(remindAt) ? undefined : remindAt,
    done: false,
  };

  // Visa alltid påminnelsetid i svaret om vi har en.
  let reply = parsed.spokenReply;
  if ((task.remindAt || task.recurrence) && !/\bkl\s*\d/.test(reply)) {
    const label = formatTaskReminderLabel(task, 'sv-SE');
    if (label && !reply.includes(label)) {
      reply = reply.replace(/\.\s*$/, '') + `. Du hittar den under Uppgifter (${label}).`;
    }
  } else if (!task.remindAt && !task.recurrence) {
    reply = reply.replace(/\.\s*$/, '') + '. Du hittar den under Uppgifter.';
  }

  const updatedMemory: UserMemory = {
    ...memory,
    tasks: [...memory.tasks.filter((t) => !t.done), task].slice(-20),
  };

  if (task.remindAt || task.recurrence) {
    await scheduleTaskReminder(task, memory.notificationAlertStyle ?? 'sound');
  }

  return {
    reply,
    updatedMemory,
  };
}

export function looksLikeBirthdaySaveRequest(text: string): boolean {
  const t = normalizeSpeechText(text);
  return (
    /\b(födelsedag|födelsedagar|fyller år|fyllde år|spara.*födelsedag|kom ihåg.*födelsedag)\b/.test(t) ||
    (/\b(födelsedag|fyller)\b/.test(t) && /\b(jan|feb|mar|apr|maj|jun|jul|aug|sep|okt|nov|dec|\d{1,2}\s+\w+)/.test(t))
  );
}

function parseBirthdayFromMessage(userMessage: string): { name: string; month: number; day: number } | null {
  const raw = userMessage.trim();
  const datePart =
    raw.match(/\b(\d{1,2}\s+(?:jan(?:uari)?|feb(?:ruari)?|mar(?:s)?|apr(?:il)?|maj|jun(?:i)?|jul(?:i)?|aug(?:usti)?|sep(?:t(?:ember)?)?|okt(?:ober)?|nov(?:ember)?|dec(?:ember)?))\b/i)?.[0] ??
    raw.match(/\b(\d{1,2}[/.-]\d{1,2})\b/)?.[0];
  if (!datePart) return null;
  const parsed = parseSwedishBirthdayDate(datePart);
  if (!parsed) return null;

  let name = raw
    .replace(datePart, '')
    .replace(/\b(spara|kom ihåg|notera|födelsedag|födelsedagar|fyller år|fyllde år|för|att|den|det)\b/gi, ' ')
    .replace(/\s+/g, ' ')
    .trim();

  const forMatch = raw.match(/\b(?:för|till)\s+([A-Za-zÅÄÖåäö]+(?:\s+[A-Za-zÅÄÖåäö]+)?)/i);
  if (forMatch) name = forMatch[1].trim();

  const nameBefore = raw.match(/^([A-Za-zÅÄÖåäö]+(?:\s+[A-Za-zÅÄÖåäö]+)?)\s+(?:fyller|födelsedag)/i);
  if (nameBefore) name = nameBefore[1].trim();

  if (!name || name.length < 2) name = 'Okänd';
  return { name, month: parsed.month, day: parsed.day };
}

export async function handleBirthdaySaveRequest(
  userMessage: string,
  memory: UserMemory,
): Promise<{ reply: string; updatedMemory: UserMemory }> {
  const parsed = parseBirthdayFromMessage(userMessage);
  if (!parsed) {
    throw new Error('Säg t.ex. "Spara födelsedag för Marie 15 juli" eller "Mamma fyller år 3 mars".');
  }

  const entry = createBirthdayEntry(parsed.name, parsed.month, parsed.day);
  const existing = memory.birthdays ?? [];
  const updatedMemory: UserMemory = {
    ...memory,
    birthdays: [...existing.filter((b) => b.name.toLowerCase() !== parsed.name.toLowerCase()), entry],
  };

  await syncBirthdayReminders(updatedMemory, memory.notificationAlertStyle ?? 'sound');

  const label = new Date(2000, parsed.month - 1, parsed.day).toLocaleDateString('sv-SE', {
    day: 'numeric',
    month: 'long',
  });
  const firstName = memory.name?.split(' ')[0]?.trim();
  const reply = firstName
    ? `Okej ${firstName}! Jag sparade ${parsed.name}s födelsedag ${label} och påminner dig dagen innan.`
    : `Okej! Jag sparade ${parsed.name}s födelsedag ${label} och påminner dig dagen innan.`;

  return { reply, updatedMemory };
}

export function looksLikeSickDayRequest(text: string): boolean {
  const t = normalizeSpeechText(text);
  return (
    /\b(jag är sjuk|är sjuk idag|jag mår dåligt|jag är förkyld|jag har feber|jag kräks|jag har migrän|kan inte komma|kan inte jobba|hemma från jobbet|sjukanmäla|sjukanmälan|ringde in sjuk|jag är hemma|jag blir hemma|måste stanna hemma|jag kan inte jobba)\b/.test(
      t,
    ) ||
    (/\b(sjuk|sjukdom|feber|förkyld|influensa|kräks)\b/.test(t) &&
      /\b(jag|mig|jag är|idag|imorgon)\b/.test(t))
  );
}

export function assistantAskedAboutSickDay(text: string): boolean {
  return /ska jag avboka alla.*möten|avboka alla möten.*maila|sjuk och maila|sjukfrånvaro/i.test(
    text,
  );
}

function parseSickDayDate(userMessage: string): Date {
  const t = normalizeSpeechText(userMessage);
  const day = new Date();
  if (/\bimorgon\b/.test(t)) {
    day.setDate(day.getDate() + 1);
  }
  day.setHours(0, 0, 0, 0);
  return day;
}

function extractEmailFromText(text: string): string | null {
  const match = text.match(/[^\s@]+@[^\s@]+\.[^\s@]+/);
  return match ? match[0].toLowerCase() : null;
}

function extractPersonFromEvent(event: CalendarEventItem): string | null {
  const medMatch = event.title.match(/\bmed\s+(.+)$/i);
  if (medMatch?.[1]) return medMatch[1].trim();

  if (event.title.length > 2 && !/^möte$/i.test(event.title.trim())) {
    return event.title.trim();
  }

  return null;
}

function buildSickEmailBody(
  event: CalendarEventItem,
  senderName: string,
  dayLabel: string,
): string {
  const time = formatEventTime(event);
  const name = senderName.trim() || 'Jag';
  return [
    'Hej,',
    '',
    `Jag är tyvärr sjuk ${dayLabel.toLowerCase()} och kan inte delta i "${event.title}" (${time}).`,
    'Jag återkommer så snart jag är frisk igen.',
    'Ursäkta besväret.',
    '',
    'Vänliga hälsningar,',
    name,
  ].join('\n');
}

function buildBossSickEmailBody(
  bossName: string,
  senderName: string,
  dayLabel: string,
): string {
  const greeting = bossName.trim() ? `Hej ${bossName.trim()},` : 'Hej,';
  const name = senderName.trim() || 'Jag';
  return [
    greeting,
    '',
    `Jag kontaktar dig för att meddela att jag är sjuk ${dayLabel.toLowerCase()} och därför inte kan komma till jobbet eller delta i möten.`,
    'Jag återkommer så snart jag är frisk nog att arbeta igen.',
    '',
    'Med vänliga hälsningar,',
    name,
  ].join('\n');
}

/** Slutet av sjukdagen (23:59:59) för minnesflagga. */
export function getSickUntilForDay(day: Date): number {
  const end = new Date(day);
  end.setHours(23, 59, 59, 999);
  return end.getTime();
}

export async function prepareSickDayAction(
  userMessage: string,
  userId?: string,
): Promise<{ pending: PendingSickDay; previewReply: string }> {
  const day = parseSickDayDate(userMessage);
  const dayLabel = formatDayLabel(day);
  const events = await fetchEventsForDay(day, userId);
  const eventSummaries = events.map((event) => `${event.title} (${formatEventTime(event)})`);
  const listText =
    eventSummaries.length <= 3
      ? eventSummaries.join(', ')
      : `${eventSummaries.slice(0, 3).join(', ')} och ${eventSummaries.length - 3} till`;

  const pending: PendingSickDay = {
    day,
    dayLabel,
    eventSummaries,
  };

  const previewReply =
    events.length === 0
      ? `Du har inga möten ${dayLabel.toLowerCase()}.`
      : `Du har ${events.length} möte${events.length > 1 ? 'n' : ''} ${dayLabel.toLowerCase()}: ${listText}.`;

  return {
    pending,
    previewReply,
  };
}

/** Avbokar dagens möten och skickar sjukanmälan — körs direkt utan extra bekräftelse. */
export async function handleSickDayRequest(
  userMessage: string,
  accessToken: string | null,
  senderName: string,
  userId?: string,
): Promise<{ reply: string; sickUntil: number }> {
  const { pending } = await prepareSickDayAction(userMessage, userId);
  const reply = await executeSickDayAction(pending, accessToken, senderName, userId);
  return { reply, sickUntil: getSickUntilForDay(pending.day) };
}

export async function executeSickDayAction(
  pending: PendingSickDay,
  accessToken: string | null,
  senderName: string,
  userId?: string,
): Promise<string> {
  const events = await fetchEventsForDay(pending.day, userId);
  const bossContact = await loadBossContact();

  const sentEmails = new Set<string>();
  let emailsSent = 0;
  let emailsFailed = 0;
  let emailsSkipped = 0;
  let bossEmailSent = false;
  let bossEmailFailed = false;

  for (const event of events) {
    if (!accessToken) {
      emailsSkipped += 1;
      continue;
    }

    const directEmail =
      extractEmailFromText(event.notes ?? '') || extractEmailFromText(event.location ?? '');
    const person = extractPersonFromEvent(event);

    let to = directEmail;

    if (!to && person) {
      const contact = await findContactEmailByName(accessToken, person);
      if (contact) {
        to = contact.email;
      }
    }

    if (!to) {
      emailsSkipped += 1;
      continue;
    }

    if (sentEmails.has(to)) continue;

    const subject = `Inställt: ${event.title} — sjukfrånvaro`;
    const body = buildSickEmailBody(event, senderName, pending.dayLabel);

    try {
      await sendGmailMessage(accessToken, to, subject, body);
      sentEmails.add(to);
      emailsSent += 1;
    } catch {
      emailsFailed += 1;
    }
  }

  if (bossContact) {
    if (accessToken) {
      const bossSubject = `Sjukanmälan — ${pending.dayLabel}`;
      const bossBody = buildBossSickEmailBody(bossContact.name, senderName, pending.dayLabel);
      try {
        await sendGmailMessage(accessToken, bossContact.email, bossSubject, bossBody);
        bossEmailSent = true;
      } catch {
        bossEmailFailed = true;
      }
    }
  }

  let remaining = 0;
  if (events.length > 0) {
    const cancelResult = await cancelAllEventsForDay(pending.day, userId);
    remaining = cancelResult.remaining;
  }

  const parts: string[] = [];

  if (events.length > 0) {
    parts.push(
      `Jag avbokade ${events.length} möte${events.length > 1 ? 'n' : ''} ${pending.dayLabel.toLowerCase()}.`,
    );
  } else {
    parts.push(`Du hade inga möten ${pending.dayLabel.toLowerCase()}.`);
  }

  if (accessToken) {
    if (emailsSent > 0) {
      parts.push(`Skickade ${emailsSent} sjukanmälan${emailsSent > 1 ? 'er' : ''} till mötesdeltagare.`);
    }
    if (emailsSkipped > 0) {
      parts.push(
        `${emailsSkipped} möte${emailsSkipped > 1 ? 'n' : ''} hade ingen e-postadress — avbokade ändå.`,
      );
    }
    if (emailsFailed > 0) {
      parts.push(`${emailsFailed} mail till deltagare kunde inte skickas.`);
    }
    if (bossEmailSent) {
      const bossLabel = bossContact?.name?.trim() || bossContact?.email || 'din chef';
      parts.push(`Skickade sjukanmälan till ${bossLabel}.`);
    }
    if (bossEmailFailed) {
      parts.push('Kunde inte skicka sjukanmälan till din chef — försök igen senare.');
    }
  } else {
    parts.push('Koppla Gmail i Email-fliken om du vill att jag mailar deltagarna också.');
  }

  if (!bossContact) {
    parts.push('Lägg till din chef i Inställningar för att skicka sjukanmälan.');
  } else if (!accessToken) {
    parts.push('Koppla Gmail i Email-fliken för att skicka sjukanmälan till din chef.');
  }

  if (remaining > 0) {
    parts.push(
      `${remaining} kopia${remaining > 1 ? 'or' : ''} finns kvar — öppna Kalender och tryck Ta bort.`,
    );
  }

  parts.push('Krya på dig!');
  return parts.join(' ');
}

export function looksLikeJunkCleanupRequest(text: string): boolean {
  const t = normalizeSpeechText(text);
  return (
    /\b(rensa|radera|ta bort|töm|tom|städa|stada)\b.*\b(spam|skräp|skräpmail|skräpmejl|sopmail|sopmejl|reklam|skräppost|sop)\b/.test(
      t,
    ) ||
    /\b(spam|skräpmail|skräpmejl|skräppost)\b.*\b(rensa|radera|ta bort|töm|tom)\b/.test(t) ||
    /\brensa\s+(mail|mejl|inkorgen|gmail)\b/.test(t)
  );
}

export async function prepareJunkCleanup(accessToken: string): Promise<PendingJunkCleanup> {
  const [spamIds, trashIds] = await Promise.all([
    listGmailMessageIds(accessToken, 'in:spam'),
    listGmailMessageIds(accessToken, 'in:trash older_than:30d'),
  ]);
  const messageIds = [...new Set([...spamIds, ...trashIds])];
  const sampleSubjects = await fetchMessageSubjects(accessToken, messageIds, 3);
  return {
    messageIds,
    spamCount: spamIds.length,
    trashCount: trashIds.length,
    sampleSubjects,
  };
}

export function buildJunkCleanupPreview(pending: PendingJunkCleanup): string {
  const total = pending.messageIds.length;
  if (total === 0) {
    return 'Jag hittade inget skräpmail att radera — spam och gammal papperskorg är redan tomma.';
  }

  const parts: string[] = [];
  if (pending.spamCount > 0) {
    parts.push(`${pending.spamCount} i spam`);
  }
  if (pending.trashCount > 0) {
    parts.push(`${pending.trashCount} i papperskorgen (äldre än 30 dagar)`);
  }

  const sample =
    pending.sampleSubjects.length > 0
      ? ` Exempel: ${pending.sampleSubjects.map((s) => `"${s}"`).join(', ')}.`
      : '';

  return `Jag hittade ${total} skräpmail (${parts.join(', ')}).${sample} Vill du att jag raderar dem permanent? Säg ja för att radera, eller avbryt.`;
}

export async function executeJunkCleanup(
  pending: PendingJunkCleanup,
  accessToken: string,
): Promise<string> {
  if (!pending.messageIds.length) {
    return 'Inget att radera.';
  }

  try {
    const deleted = await batchDeleteGmailMessages(accessToken, pending.messageIds);
    return `Klart! Jag raderade ${deleted} skräpmail permanent (spam och gammal papperskorg).`;
  } catch (error) {
    const message = error instanceof Error ? error.message : '';
    if (message.includes('gmail_modify_denied') || message.includes('403')) {
      return 'Jag behöver ny Gmail-behörighet för att radera mail. Gå till Email → Koppla Google Mail igen och godkänn alla behörigheter.';
    }
    if (message.includes('gmail_token_expired')) {
      return 'Gmail-inloggningen har gått ut. Koppla Google Mail igen under Email-fliken.';
    }
    return 'Kunde inte radera skräpmail just nu. Försök igen om en stund.';
  }
}

export { formatDraftPreview };
