export const GEMINI_MODELS = [
  'gemini-2.5-flash',
  'gemini-2.5-flash-lite',
  'gemini-flash-latest',
] as const;

export function geminiApiUrl(model: string): string {
  return `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent`;
}

const RAW_GEMINI_API_KEY = process.env.EXPO_PUBLIC_GEMINI_API_KEY ?? '';

export function normalizeGeminiApiKey(raw: string): string {
  return raw.trim();
}

function isWorkingGeminiKey(key: string): boolean {
  return key.startsWith('AIzaSy') && key.length >= 35;
}

/** Endast AIzaSy-nycklar — AQ från AI Studio fungerar inte i mobilappen. */
export function getGeminiApiKeyCandidates(): string[] {
  const fromEnv = normalizeGeminiApiKey(RAW_GEMINI_API_KEY);
  if (isWorkingGeminiKey(fromEnv)) return [fromEnv];
  return [];
}

export const GEMINI_API_KEY = getGeminiApiKeyCandidates()[0] ?? '';

export type GeminiKeyValidation = {
  valid: boolean;
  error?: string;
};

export function validateGeminiApiKey(key: string = GEMINI_API_KEY): GeminiKeyValidation {
  if (!key) {
    return {
      valid: false,
      error:
        'Gemini API-nyckel saknas. Skapa AIzaSy-nyckel i Google Cloud Console och bygg om appen.',
    };
  }
  if (key.startsWith('AQ.')) {
    return {
      valid: false,
      error:
        'AQ-nycklar från AI Studio fungerar inte. Skapa AIzaSy-nyckel i Google Cloud Console → Credentials.',
    };
  }
  if (isWorkingGeminiKey(key)) {
    return { valid: true };
  }
  return {
    valid: false,
    error:
      "Ogiltig Gemini API-nyckel. Använd AIzaSy-nyckel från Google Cloud Console (Don't restrict key).",
  };
}
