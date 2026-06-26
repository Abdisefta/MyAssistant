/** Produktionsserver — alltid fallback i release-APK. */
const PRODUCTION_ALMA_TTS_URL = 'http://195.201.128.118:3001';

const DEV_HOSTS = ['localhost', '127.0.0.1', '10.0.2.2'];

function isDevTtsUrl(url: string): boolean {
  try {
    const { hostname } = new URL(url);
    return DEV_HOSTS.some((host) => hostname === host);
  } catch {
    return false;
  }
}

function resolveAlmaTtsBaseUrl(): string {
  const fromEnv = process.env.EXPO_PUBLIC_ALMA_TTS_URL?.trim().replace(/\/$/, '');
  if (fromEnv) {
    // Release builds must never call localhost baked in at bundle time.
    if (__DEV__ || !isDevTtsUrl(fromEnv)) {
      return fromEnv;
    }
  }
  return PRODUCTION_ALMA_TTS_URL;
}

/** Base URL for self-hosted Alma Piper TTS (no trailing slash). */
export const ALMA_TTS_BASE_URL = resolveAlmaTtsBaseUrl();

export const ALMA_TTS_ENDPOINT = `${ALMA_TTS_BASE_URL}/api/tts`;

export const ALMA_TTS_MAX_CHARS = 2000;

export const ALMA_TTS_REQUEST_TIMEOUT_MS = 60_000;

export const ALMA_TTS_FETCH_RETRIES = 2;

export const ALMA_TTS_RETRY_DELAY_MS = 1_500;
