import {
  GEMINI_API_KEY,
  GEMINI_MODELS,
  geminiApiUrl,
  validateGeminiApiKey,
} from '@/constants/gemini';
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

const REQUEST_TIMEOUT_MS = 12000;

const keyCheck = validateGeminiApiKey();
if (!keyCheck.valid) {
  console.warn('[Gemini]', keyCheck.error);
}

function isTimeoutError(err: Error): boolean {
  return err.message.includes('tog för lång tid');
}

function withTimeout<T>(promise: Promise<T>, ms: number, label: string): Promise<T> {
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => {
      reject(new Error(`${label} tog för lång tid. Kontrollera internet och försök igen.`));
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

function parseGeminiError(data: GeminiResponse, status: number): string {
  if (status === 401 || status === 403) {
    return 'Ogiltig Gemini API-nyckel. Kontrollera EXPO_PUBLIC_GEMINI_API_KEY i EAS och bygg om appen.';
  }

  const message = data.error?.message ?? '';
  const lower = message.toLowerCase();

  if (
    lower.includes('api key') ||
    lower.includes('api_key') ||
    lower.includes('invalid key') ||
    lower.includes('permission denied')
  ) {
    return 'Ogiltig Gemini API-nyckel. Kontrollera att hela nyckeln är korrekt i EAS och bygg om appen.';
  }

  if (message) return message;
  return `Gemini API-fel (${status})`;
}

async function callGeminiOnce(
  model: string,
  systemInstruction: string,
  contents: GeminiContent[],
): Promise<string> {
  const url = geminiApiUrl(model);

  const response = await withTimeout(
    fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-goog-api-key': GEMINI_API_KEY,
      },
      body: JSON.stringify({
        systemInstruction: {
          parts: [{ text: systemInstruction }],
        },
        contents,
        generationConfig: {
          temperature: 0.85,
          maxOutputTokens: 512,
        },
      }),
    }),
    REQUEST_TIMEOUT_MS,
    'Gemini',
  );

  const data = (await response.json()) as GeminiResponse;

  if (!response.ok) {
    throw new Error(parseGeminiError(data, response.status));
  }

  const text = data.candidates?.[0]?.content?.parts?.[0]?.text?.trim();
  if (!text) {
    throw new Error('Tomt svar från Gemini');
  }

  return text;
}

async function callGemini(
  systemInstruction: string,
  contents: GeminiContent[],
): Promise<string> {
  const validation = validateGeminiApiKey();
  if (!validation.valid) {
    throw new Error(validation.error);
  }

  let lastError: Error | null = null;

  for (const model of GEMINI_MODELS) {
    try {
      return await callGeminiOnce(model, systemInstruction, contents);
    } catch (err) {
      lastError = err instanceof Error ? err : new Error(String(err));
      console.warn(`Gemini model ${model} failed:`, lastError.message);

      if (isTimeoutError(lastError)) {
        throw lastError;
      }
    }
  }

  throw lastError ?? new Error('Kunde inte nå Gemini. Försök igen.');
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
  const prompt = `Analysera denna konversation och extrahera NYA fakta om användaren.

Befintliga anteckningar: ${JSON.stringify(existingNotes)}
Befintliga preferenser: ${JSON.stringify(existingPreferences)}

Användare: "${userMessage}"
Assistent: "${assistantReply}"

Returnera ENDAST giltig JSON i detta format:
{"notes":["ny personlig fakta"],"preferences":["ny preferens"]}

Om inget nytt, returnera {"notes":[],"preferences":[]}.
Anteckningar = personliga fakta (familj, intressen, rutiner).
Preferenser = hur användaren vill bli hjälpt (ton, format, ämnen).`;

  try {
    const raw = await callGemini(
      'Du extraherar strukturerad minnesdata. Svara endast med JSON.',
      [{ role: 'user', parts: [{ text: prompt }] }],
    );

    const jsonMatch = raw.match(/\{[\s\S]*\}/);
    if (!jsonMatch) return { notes: [], preferences: [] };

    const parsed = JSON.parse(jsonMatch[0]) as {
      notes?: string[];
      preferences?: string[];
    };

    const notes = (parsed.notes ?? [])
      .filter((n) => typeof n === 'string' && n.trim().length > 0)
      .map((n) => n.trim());

    const preferences = (parsed.preferences ?? [])
      .filter((p) => typeof p === 'string' && p.trim().length > 0)
      .map((p) => p.trim());

    return { notes, preferences };
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
      parts: [
        {
          text: `Användaren ${name} har precis slutfört onboarding. Välkomna dem personligt och fråga hur du kan hjälpa idag. Max 2 meningar.`,
        },
      ],
    },
  ]);
}
