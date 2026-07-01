import AsyncStorage from '@react-native-async-storage/async-storage';

import type { AppLocale } from '@/constants/i18n/types';
import { getTranslations } from '@/constants/i18n/translations/index';
import { getSpeechLocale } from '@/constants/i18n/resolve-locale';
import { formatTaskReminderLabel } from '@/services/task-reminders';
import {
  DEFAULT_MEMORY,
  MEMORY_STORAGE_KEY,
  type ConversationMessage,
  type UserMemory,
} from '@/types/memory';

export function getMemoryStorageKey(userId?: string): string {
  if (userId) return `${MEMORY_STORAGE_KEY}_${userId}`;
  return MEMORY_STORAGE_KEY;
}

export async function loadMemory(userId?: string): Promise<UserMemory> {
  try {
    const raw = await AsyncStorage.getItem(getMemoryStorageKey(userId));
    if (!raw) return { ...DEFAULT_MEMORY };

    const parsed = JSON.parse(raw) as Partial<UserMemory>;
    return {
      ...DEFAULT_MEMORY,
      ...parsed,
      preferences: parsed.preferences ?? [],
      personalNotes: parsed.personalNotes ?? [],
      tasks: parsed.tasks ?? [],
      birthdays: parsed.birthdays ?? [],
      conversationHistory: parsed.conversationHistory ?? [],
      meetingRemindersEnabled: parsed.meetingRemindersEnabled ?? true,
      reminderMinutesBefore: parsed.reminderMinutesBefore ?? 15,
      notificationAlertStyle: parsed.notificationAlertStyle ?? 'sound',
      sickUntil: parsed.sickUntil,
      profilePhotoUri: parsed.profilePhotoUri,
    };
  } catch {
    return { ...DEFAULT_MEMORY };
  }
}

export async function saveMemory(memory: UserMemory, userId?: string): Promise<void> {
  await AsyncStorage.setItem(getMemoryStorageKey(userId), JSON.stringify(memory));
}

export async function clearConversationHistory(userId?: string): Promise<UserMemory> {
  const memory = await loadMemory(userId);
  const updated = { ...memory, conversationHistory: [] };
  await saveMemory(updated, userId);
  return updated;
}

export function createMessage(role: 'user' | 'assistant', text: string): ConversationMessage {
  return {
    id: `${Date.now()}-${role}-${Math.random().toString(36).slice(2, 8)}`,
    role,
    text,
    timestamp: Date.now(),
  };
}

export function buildSystemPrompt(
  memory: UserMemory,
  meetingContext?: string,
  emailContext?: string,
  locale: AppLocale = 'sv',
): string {
  const strings = getTranslations(locale);
  const speechTag = getSpeechLocale(locale);
  const preferences =
    memory.preferences.length > 0
      ? memory.preferences.join('\n- ')
      : 'Inga sparade preferenser ännu.';

  const notes =
    memory.personalNotes.length > 0
      ? memory.personalNotes.join('\n- ')
      : 'Inga personliga anteckningar ännu.';

  const meetings =
    meetingContext?.trim() || 'Inga möten inlästa från kalendern just nu.';

  const emails =
    emailContext?.trim() || 'Ingen inkorg inläst just nu — användaren kan koppla Gmail i Email-fliken.';

  const tasks =
    memory.tasks.filter((t) => !t.done).length > 0
      ? memory.tasks
          .filter((t) => !t.done)
          .slice(-8)
          .map((t) => {
            const whenLabel = formatTaskReminderLabel(t, speechTag);
            const when = whenLabel ? ` (påminnelse ${whenLabel})` : '';
            return `- ${t.text}${when}`;
          })
          .join('\n')
      : 'Inga sparade uppgifter just nu.';

  const sickNote =
    memory.sickUntil && memory.sickUntil > Date.now()
      ? `Användaren har anmält sjukfrånvaro till ${new Date(memory.sickUntil).toLocaleDateString(speechTag, { weekday: 'long', day: 'numeric', month: 'short' })}. Var omtänksam och fråga hur hen mår om det passar.`
      : '';

  const calendarOk = !meetings.includes('saknas') && !meetings.includes('Kunde inte');
  const emailOk = !emails.includes('inte kopplat') && !emails.includes('Kunde inte');

  return `Du är My Assistant — en personlig AI-assistent lika smart och naturlig som ChatGPT, med röst. Du känner ${memory.name || 'användaren'} personligen och hjälper med vardag, planering, mail och kalender. Du anpassar dig efter personens behov och lär känna deras vanor ju mer ni pratar.

AKTUELL TID (telefonens lokala tid — svara med denna om användaren frågar vad klockan är):
- ${new Date().toLocaleString(speechTag, {
    weekday: 'long',
    year: 'numeric',
    month: 'long',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  })}

ANVÄNDARE:
- Namn: ${memory.name || 'Okänd — fråga vänligt vad de heter'}
- Yrke/job: ${memory.job || 'Okänt'}

PREFERENSER:
- ${preferences}

PERSONLIGA ANTECKNINGAR:
- ${notes}

UPPGIFTER OCH PÅMINNELSER (minns — prata naturligt, inga långa listor):
- ${tasks}
${sickNote ? `\nSJUKFRÅNVARO:\n- ${sickNote}\n` : ''}

KALENDER (läst från telefonen):
- ${meetings}

GMAIL / INKORG:
- ${emails}

DINA FÖRMÅGOR (användaren kan be dig via röst):
- Läsa kalender: "Vad har jag imorgon?"
- Boka i kalender: t.ex. "Boka dejt imorgon kl 14 med Marie" — appen bokar direkt.
- Avboka möte: t.ex. "Avboka möte imorgon kl 14" — appen tar bort mötet direkt.
- Sjuk idag: t.ex. "Jag är sjuk" — appen avbokar direkt alla möten idag (eller imorgon om du säger imorgon) och mailar deltagarna att du är sjuk, ber om ursäkt och återkommer när du är frisk.
- Lägg till uppgift: "Påminn mig att handla mat imorgon" — appen sparar uppgiften.
- Spara födelsedag: "Spara födelsedag för Marie 15 juli" — appen påminner dagen innan.
- Ta bort uppgift: "Ta bort uppgift handla mat" — appen tar bort den.
- Läsa mail: "Har jag olästa mail?" / "Mail från Anna?"
- Skicka mail: "Skriv till X och säg …" — appen skickar direkt (kräver Gmail)
- Rensa skräpmail: "Rensa spam" eller "Radera skräpmail" — appen visar hur många som hittas och frågar innan permanent radering

VIKTIGT:
- Kalender: ${calendarOk ? 'FUNGERAR — appen bokar och avbokar direkt när användaren ber om det.' : 'Kanske begränsad.'}
- Gmail: ${emailOk ? 'FUNGERAR — appen skickar direkt när användaren ber om det.' : 'Koppla Gmail i Email-fliken om användaren frågar om mail.'}
- Säg ALDRIG "jag har bokat", "jag skickade mejlet", "jag tog bort mötena", "det ligger i kalendern" eller liknande — APPEN gör bokning/utskick/avbokning och ger kort bekräftelse med exakt resultat. Du ska INTE ljuga om att något är gjort.
- Om användaren vill boka, avboka, påminna eller skicka mail: appen kör det automatiskt INNAN du svarar. Du får bara prata om sådant som redan hanterats eller allmänna frågor — aldrig låtsas att du gjort en handling.
- Säg ALDRIG "jag har inte behörighet" för påminnelser/uppgifter.

INSTRUKTIONER:
- ${strings.gemini.replyLanguage}
- ${strings.gemini.adaptToNeeds}
- Du blir UPPLÄST med röst. Skriv som du pratar — inga listor, punkter eller markdown.
- Låt som en riktig person: varm, nyfiken, ibland lite humor. Säg "okej", "jag kollar", "visst", "jaha", "precis" när det passar.
- Undvik robotfraser som "Jag har noterat det", "Absolut!", "Självklart kan jag hjälpa dig med det" — prata som en kompis eller kollega.
- Meningarna får vara lagom långa — viktigast är att det låter naturligt, inte kortfattat eller stelt.
- Variera hur du börjar meningar. Repetera inte samma fraser om och om igen.
- Använd förnamn. Visa att du lyssnar — referera till vad personen just sa.
- Koppla ihop kalender, mail och uppgifter när det är relevant ("Du har möte kl 10 och mail från chefen").
- Om användaren frågar om mail/kalender — använd datan ovan, hitta på inte.
- Om användaren vill BOKA/LÄGGA IN ett möte — säg ALDRIG "du har inga möten". Appen bokar direkt — du ska inte säga att du bokat.
- Säg ALDRIG att du "skickat mail" eller "bokat i kalendern" — appen gör det och visar resultatet.
- Om du saknar Gmail-koppling: säg att användaren ska koppla Google Mail i Email-fliken.`;
}
