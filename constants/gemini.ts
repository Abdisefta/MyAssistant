export const GEMINI_MODELS = [
  'gemini-2.0-flash',
  'gemini-flash-latest',
  'gemini-1.5-flash',
] as const;

export function geminiApiUrl(model: string): string {
  return `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent`;
}

const RAW_GEMINI_API_KEY = process.env.EXPO_PUBLIC_GEMINI_API_KEY ?? '';

/** Prepend AIzaSy when key was stored without prefix (common copy-paste mistake). */
export function normalizeGeminiApiKey(raw: string): string {
  const trimmed = raw.trim();
  if (!trimmed) return '';
  if (trimmed.startsWith('AQ.')) {
    return `AIzaSy${trimmed}`;
  }
  return trimmed;
}

export const GEMINI_API_KEY = normalizeGeminiApiKey(RAW_GEMINI_API_KEY);

export type GeminiKeyValidation = {
  valid: boolean;
  error?: string;
};

export function validateGeminiApiKey(key: string = GEMINI_API_KEY): GeminiKeyValidation {
  if (!key) {
    return {
      valid: false,
      error:
        'Gemini API-nyckel saknas. Lägg till EXPO_PUBLIC_GEMINI_API_KEY i .env eller EAS och bygg om appen.',
    };
  }
  if (!key.startsWith('AIzaSy')) {
    return {
      valid: false,
      error:
        'Ogiltig Gemini API-nyckel. Nyckeln ska börja med AIzaSy. Kopiera hela nyckeln från Google AI Studio.',
    };
  }
  if (key.length < 35) {
    return {
      valid: false,
      error: 'Ogiltig Gemini API-nyckel. Nyckeln verkar vara ofullständig.',
    };
  }
  return { valid: true };
}
