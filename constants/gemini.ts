import { GEMINI_BUILD_CONFIG } from '@/constants/gemini.generated';

export const GEMINI_MODELS = [
  'gemini-2.5-flash',
  'gemini-2.5-flash-lite',
  'gemini-flash-latest',
] as const;

export function geminiApiUrl(model: string): string {
  return `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent`;
}

function isWorkingGeminiKey(key: string): boolean {
  return key.startsWith('AIzaSy') && key.length >= 35;
}

export function normalizeGeminiApiKey(raw: string): string {
  return raw.trim();
}

function resolveGeminiKey(): string {
  const baked = normalizeGeminiApiKey(GEMINI_BUILD_CONFIG.apiKey);
  if (isWorkingGeminiKey(baked)) return baked;

  const fromEnv = normalizeGeminiApiKey(process.env.EXPO_PUBLIC_GEMINI_API_KEY ?? '');
  if (isWorkingGeminiKey(fromEnv)) return fromEnv;

  return '';
}

/** Endast AIzaSy-nycklar — AQ från AI Studio fungerar inte i mobilappen. */
export function getGeminiApiKeyCandidates(): string[] {
  const key = resolveGeminiKey();
  return key ? [key] : [];
}

export const GEMINI_API_KEY = getGeminiApiKeyCandidates()[0] ?? '';

export type GeminiKeyValidation = {
  valid: boolean;
  error?: string;
};

export function validateGeminiApiKey(key: string = GEMINI_API_KEY): GeminiKeyValidation {
  if (!key) {
    const envRaw = normalizeGeminiApiKey(process.env.EXPO_PUBLIC_GEMINI_API_KEY ?? '');
    if (envRaw.startsWith('AQ.')) {
      return {
        valid: false,
        error:
          'AQ-nyckeln fungerar inte i appen. I Google Cloud → Credentials → Gemini Developer API key → Show key (AIzaSy...) → lägg i .env och bygg om.',
      };
    }
    return {
      valid: false,
      error:
        'Gemini API-nyckel saknas. Google Cloud → Credentials → Gemini Developer API key → Show key (AIzaSy...) → lägg i .env och bygg om.',
    };
  }
  if (key.startsWith('AQ.')) {
    return {
      valid: false,
      error:
        'AQ-nyckeln fungerar inte i appen. Använd AIzaSy-nyckeln från Google Cloud → Credentials.',
    };
  }
  if (isWorkingGeminiKey(key)) {
    return { valid: true };
  }
  return {
    valid: false,
    error:
      "Ogiltig Gemini API-nyckel. Använd AIzaSy från Google Cloud Console (Don't restrict key).",
  };
}
