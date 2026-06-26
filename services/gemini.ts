import {
  GEMINI_MODELS,
  geminiApiUrl,
  getGeminiApiKeyCandidates,
  validateGeminiApiKey,
} from '@/constants/gemini';
import { checkUsageAllowed, recordBillableUsage, UsageLimitExceededError } from '@/services/usage-limits';
import type { ConversationMessage } from '@/types/memory';

type GeminiRole = 'user' | 'model';

type GeminiContent = {
  role: GeminiRole;
  parts: { text: string }[];
};

type GeminiResponse = {
  candidates?: Array<{
    content?: {
      parts?: Array<{ text?: string }>;
    };
  }>;
  error?: { message?: string; status?: string };
};

const REQUEST_TIMEOUT_MS = 15000;

function withTimeout<T>(promise: Promise<T>, ms: number): Promise<T> {
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => {
      reject(new Error('Gemini tog för lång tid. Kontrollera internet och försök igen.'));
    }, ms);
    promise
      .then((value) => {
        clearTimeout(timer);
        resolve(value);
      })
      .catch((err) => {
        clearTimeout(timer);
        reject(err);
      });
  });
}

function isTechnicalGeminiError(message: string): boolean {
  return /models\/|api version|generatecontent|listsmodels|not found for api/i.test(
    message,
  );
}

export function toUserFacingGeminiError(message: string): {
  display: string;
  speak: string;
} {
  if (isTechnicalGeminiError(message)) {
    return {
      display: 'Assistenten kunde inte svara just nu. Försök igen.',
      speak: 'Jag kunde inte svara just nu. Försök igen.',
    };
  }
  if (message.includes('tog för lång tid')) {
    return {
      display: message,
      speak: 'Det tog för lång tid. Kontrollera internet och försök igen.',
    };
  }
  if (/api key|ogiltig gemini/i.test(message)) {
    return {
      display: message,
      speak: 'Jag har problem med anslutningen. Kontrollera inställningarna.',
    };
  }
  return { display: message, speak: message };
}

function parseGeminiError(data: GeminiResponse, status: number, apiKey?: string): string {
  if (status === 401 || status === 403) {
    if (apiKey?.startsWith('AQ.')) {
      return 'Gemini-nyckel (AQ) accepteras inte. Skapa AIzaSy-nyckel i Google Cloud Console → Credentials → API key.';
    }
    return 'Ogiltig Gemini API-nyckel. Skapa AIzaSy-nyckel i Google Cloud Console.';
  }
  const message = data.error?.message ?? '';
  if (message) return message;
  return `Gemini API-fel (${status})`;
}

async function callGeminiOnce(
  model: string,
  apiKey: string,
  systemInstruction: string,
  contents: GeminiContent[],
): Promise<string> {
  const controller = new AbortController();
  const abortTimer = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);

  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    'x-goog-api-key': apiKey,
  };

  try {
    const response = await fetch(geminiApiUrl(model), {
      method: 'POST',
      headers,
      body: JSON.stringify({
        systemInstruction: { parts: [{ text: systemInstruction }] },
        contents,
        generationConfig: {
          temperature: 0.95,
          maxOutputTokens: 1024,
        },
      }),
      signal: controller.signal,
    });

    const data = (await response.json()) as GeminiResponse;

    if (!response.ok) {
      throw new Error(parseGeminiError(data, response.status, apiKey));
    }

    const text = data.candidates?.[0]?.content?.parts?.[0]?.text?.trim();
    if (!text) {
      throw new Error('Tomt svar från Gemini');
    }
    return text;
  } catch (err) {
    if (err instanceof Error && err.name === 'AbortError') {
      throw new Error('Gemini tog för lång tid. Kontrollera internet och försök igen.');
    }
    throw err;
  } finally {
    clearTimeout(abortTimer);
  }
}

async function callGemini(
  systemInstruction: string,
  contents: GeminiContent[],
): Promise<string> {
  const geminiLimit = await checkUsageAllowed('gemini_request');
  if (!geminiLimit.allowed) {
    throw new UsageLimitExceededError(geminiLimit);
  }

  const candidates = getGeminiApiKeyCandidates();
  if (!candidates.length) {
    throw new Error(
      'Gemini API-nyckel saknas. Skapa AIzaSy-nyckel i Google Cloud Console (myassistant-499522) och bygg om.',
    );
  }

  let lastError: Error | null = null;

  for (const apiKey of candidates) {
    const validation = validateGeminiApiKey(apiKey);
    if (!validation.valid) continue;

    for (const model of GEMINI_MODELS) {
      try {
        const text = await callGeminiOnce(model, apiKey, systemInstruction, contents);
        void recordBillableUsage('gemini_request', { model });
        return text;
      } catch (err) {
        lastError = err instanceof Error ? err : new Error(String(err));
        console.warn(`Gemini ${model} key=${apiKey.slice(0, 8)}...`, lastError.message);
        if (lastError.message.includes('tog för lång tid')) {
          throw lastError;
        }
      }
    }
  }

  throw lastError ?? new Error('Gemini API-nyckel saknas eller är ogiltig. Använd AIzaSy från Google Cloud Console.');
}

export function toGeminiHistory(history: ConversationMessage[]): GeminiContent[] {
  return history.slice(-20).map((msg) => ({
    role: msg.role === 'user' ? 'user' : 'model',
    parts: [{ text: msg.text }],
  }));
}

export async function generateAssistantReply(
  systemInstruction: string,
  history: ConversationMessage[],
  userMessage: string,
): Promise<string> {
  const contents: GeminiContent[] = [
    ...toGeminiHistory(history),
    { role: 'user', parts: [{ text: userMessage }] },
  ];
  return callGemini(systemInstruction, contents);
}

export async function extractLearnings(
  userMessage: string,
  assistantReply: string,
  existingNotes: string[],
  existingPreferences: string[],
): Promise<{ notes: string[]; preferences: string[] }> {
  const prompt = `Analysera konversationen. Returnera JSON: {"notes":[],"preferences":[]}
Användare: "${userMessage}"
Assistent: "${assistantReply}"`;

  try {
    const raw = await callGemini(
      'Svara endast med JSON.',
      [{ role: 'user', parts: [{ text: prompt }] }],
    );
    const jsonMatch = raw.match(/\{[\s\S]*\}/);
    if (!jsonMatch) return { notes: [], preferences: [] };
    const parsed = JSON.parse(jsonMatch[0]) as {
      notes?: string[];
      preferences?: string[];
    };
    return {
      notes: (parsed.notes ?? []).filter((n) => typeof n === 'string'),
      preferences: (parsed.preferences ?? []).filter((p) => typeof p === 'string'),
    };
  } catch {
    return { notes: [], preferences: [] };
  }
}

export async function generateWelcomeMessage(
  systemInstruction: string,
  name: string,
): Promise<string> {
  return callGemini(systemInstruction, [
    {
      role: 'user',
      parts: [{ text: `Välkomna ${name} personligt med förnamnet. Max 2 meningar. Nämn att du anpassar dig efter just den här personen.` }],
    },
  ]);
}

function parseJsonFromGemini<T>(raw: string): T | null {
  const jsonMatch = raw.match(/\{[\s\S]*\}/);
  if (!jsonMatch) return null;
  try {
    return JSON.parse(jsonMatch[0]) as T;
  } catch {
    return null;
  }
}

export async function parseEmailFromConversation(
  messages: ConversationMessage[],
): Promise<{ recipientName: string; messageIntent: string } | null> {
  const transcript = messages
    .slice(-10)
    .map((m) => `${m.role === 'user' ? 'Användare' : 'Assistent'}: ${m.text}`)
    .join('\n');

  const prompt = `Analysera hela mail-konversationen. Extrahera vem mailet ska till och vad det ska säga.
Returnera endast JSON: {"recipientName":"...","messageIntent":"..."}
Om information saknas returnera {"recipientName":"","messageIntent":""}

Konversation:
${transcript}`;

  try {
    const raw = await callGemini(
      'Svara endast med giltig JSON.',
      [{ role: 'user', parts: [{ text: prompt }] }],
    );
    const parsed = parseJsonFromGemini<{
      recipientName?: string;
      messageIntent?: string;
    }>(raw);
    if (!parsed?.recipientName?.trim() || !parsed.messageIntent?.trim()) return null;
    return {
      recipientName: parsed.recipientName.trim(),
      messageIntent: parsed.messageIntent.trim(),
    };
  } catch {
    return null;
  }
}

export async function parseEmailRequest(
  userMessage: string,
): Promise<{ recipientName: string; messageIntent: string } | null> {
  const prompt = `Analysera användarens önskan att skicka e-post.
Returnera endast JSON: {"recipientName":"...","messageIntent":"..."}

recipientName = mottagarens namn ELLER full e-postadress om angiven
messageIntent = kort vad mailet ska säga

Exempel: "Skriv till Magnus och säg att jag kommer sent" → {"recipientName":"Magnus","messageIntent":"jag kommer sent"}
Exempel: "Skicka hej till ellinora@mail.com" → {"recipientName":"ellinora@mail.com","messageIntent":"hej"}

Användare: "${userMessage}"`;

  try {
    const raw = await callGemini(
      'Svara endast med giltig JSON. Inga markdown-block.',
      [{ role: 'user', parts: [{ text: prompt }] }],
    );
    const parsed = parseJsonFromGemini<{
      recipientName?: string;
      messageIntent?: string;
    }>(raw);
    if (!parsed?.recipientName?.trim()) return null;
    return {
      recipientName: parsed.recipientName.trim(),
      messageIntent: parsed.messageIntent?.trim() || 'Hej',
    };
  } catch {
    return null;
  }
}

export async function composeEmailFromRequest(
  recipientName: string,
  messageIntent: string,
  senderName: string,
  originalRequest: string,
): Promise<{ subject: string; body: string }> {
  const prompt = `Skriv ett kort professionellt mejl på svenska.
Returnera endast JSON: {"subject":"...","body":"..."}

Från: ${senderName || 'Användaren'}
Till: ${recipientName}
Budskap: ${messageIntent}
Original önskemål: ${originalRequest}

Regler:
- subject: kort och tydligt
- body: 2-5 meningar, vänlig ton, signera med avsändarens namn
- inga markdown-block`;

  const raw = await callGemini(
    'Svara endast med JSON.',
    [{ role: 'user', parts: [{ text: prompt }] }],
  );
  const parsed = parseJsonFromGemini<{ subject?: string; body?: string }>(raw);
  if (!parsed?.body?.trim()) {
    return {
      subject: 'Meddelande',
      body: `Hej ${recipientName},\n\n${messageIntent}\n\nVänliga hälsningar,\n${senderName || ''}`.trim(),
    };
  }
  return {
    subject: parsed.subject?.trim() || 'Meddelande',
    body: parsed.body.trim(),
  };
}

function todayContext(): string {
  const now = new Date();
  return now.toLocaleString('sv-SE', {
    weekday: 'long',
    year: 'numeric',
    month: 'long',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

export async function parseCalendarBookingRequest(
  userMessage: string,
): Promise<{
  title: string;
  startIso: string;
  endIso: string;
  summary: string;
} | null> {
  const prompt = `Du tolkar en begäran om att BOKA något i användarens kalender.
Nuvarande datum och tid: ${todayContext()}

Returnera endast JSON:
{"title":"...","startIso":"2026-06-20T19:00:00","endIso":"2026-06-20T21:00:00","summary":"kort svensk mening för bekräftelse"}

Regler:
- Välj själv rimlig dag och tid utifrån texten (imorgon, på fredag, kväll, efter jobbet ≈ 17–18, dejt ≈ 19–21).
- Om person nämns (med Marie, med Magnus, träffa Anna): sätt title t.ex. "Dejt med Marie" eller "Möte med Magnus".
- Om tidsintervall som 14-15 eller 14–15: startIso kl 14:00, endIso kl 15:00 samma dag.
- startIso/endIso i lokal tid, ISO 8601 utan Z.
- summary: t.ex. "Dejt med Marie imorgon kl 14:00–15:00"

Användare: "${userMessage}"`;

  try {
    const raw = await callGemini(
      'Svara endast med giltig JSON.',
      [{ role: 'user', parts: [{ text: prompt }] }],
    );
    const parsed = parseJsonFromGemini<{
      title?: string;
      startIso?: string;
      endIso?: string;
      summary?: string;
    }>(raw);
    if (!parsed?.title?.trim() || !parsed.startIso || !parsed.endIso) return null;

    const start = new Date(parsed.startIso);
    const end = new Date(parsed.endIso);
    if (Number.isNaN(start.getTime()) || Number.isNaN(end.getTime())) return null;

    return {
      title: parsed.title.trim(),
      startIso: parsed.startIso,
      endIso: parsed.endIso,
      summary: parsed.summary?.trim() || parsed.title.trim(),
    };
  } catch {
    return null;
  }
}

export async function summarizeEmailForVoice(
  userMessage: string,
  emailData: string,
): Promise<string> {
  const prompt = `Användaren frågade om sina mail via röstassistenten.
Svara naturligt på svenska — som ChatGPT — kort och tydligt (2–5 meningar).
Läs INTE upp allt ordagrant; sammanfatta det viktigaste.
Nämn avsändare och ämne när det är relevant.

Användarens fråga: "${userMessage}"

Mail-data:
${emailData}`;

  try {
    return await callGemini(
      'Du är en personlig assistent som sammanfattar mail för röst. Svara bara med talet/svaret.',
      [{ role: 'user', parts: [{ text: prompt }] }],
    );
  } catch {
    return emailData.split('\n').slice(0, 4).join(' ');
  }
}

export async function parseTaskReminderRequest(
  userMessage: string,
  userName: string,
): Promise<{
  taskText: string;
  remindAtIso: string | null;
  spokenReply: string;
} | null> {
  const prompt = `Användaren vill att du ska KOMMA IHÅG eller PÅMINNA om något (inte läsa kalender).
Nuvarande datum och tid: ${todayContext()}
Användarens namn: ${userName || 'du'}

Returnera endast JSON:
{"taskText":"kort uppgift","remindAtIso":"2026-06-20T17:00:00 eller null","spokenReply":"naturligt svar på svenska, 1-3 meningar, varm ton"}

Regler:
- taskText: kort, t.ex. "Handla mat efter jobbet"
- remindAtIso: om tid nämns (imorgon, efter jobbet, kl 17) — annars null
- spokenReply: bekräfta att du minns, t.ex. "Okej ${userName ? userName.split(' ')[0] : ''}! Jag påminner dig imorgon efter jobbet om att handla."
- NÄMN ALDRIG kalenderbehörighet.

Användare: "${userMessage}"`;

  try {
    const raw = await callGemini(
      'Svara endast med giltig JSON.',
      [{ role: 'user', parts: [{ text: prompt }] }],
    );
    const parsed = parseJsonFromGemini<{
      taskText?: string;
      remindAtIso?: string | null;
      spokenReply?: string;
    }>(raw);
    if (!parsed?.taskText?.trim() || !parsed.spokenReply?.trim()) return null;

    return {
      taskText: parsed.taskText.trim(),
      remindAtIso: parsed.remindAtIso?.trim() || null,
      spokenReply: parsed.spokenReply.trim(),
    };
  } catch {
    return null;
  }
}
