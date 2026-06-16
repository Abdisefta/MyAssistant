import { GEMINI_API_KEY, GEMINI_API_URL } from '@/constants/gemini';
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
  error?: { message?: string };
};

async function callGemini(
  systemInstruction: string,
  contents: GeminiContent[],
): Promise<string> {
  if (!GEMINI_API_KEY) {
    throw new Error(
      'Gemini API-nyckel saknas. Lägg till EXPO_PUBLIC_GEMINI_API_KEY i .env',
    );
  }

  const response = await fetch(`${GEMINI_API_URL}?key=${GEMINI_API_KEY}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
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
  });

  const data = (await response.json()) as GeminiResponse;

  if (!response.ok) {
    throw new Error(data.error?.message ?? `Gemini API-fel (${response.status})`);
  }

  const text = data.candidates?.[0]?.content?.parts?.[0]?.text?.trim();
  if (!text) {
    throw new Error('Tomt svar från Gemini');
  }

  return text;
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
