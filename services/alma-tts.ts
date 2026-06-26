import { Audio, InterruptionModeAndroid, InterruptionModeIOS } from 'expo-av';
import * as FileSystem from 'expo-file-system/legacy';

import {
  ALMA_TTS_BASE_URL,
  ALMA_TTS_ENDPOINT,
  ALMA_TTS_FETCH_RETRIES,
  ALMA_TTS_MAX_CHARS,
  ALMA_TTS_REQUEST_TIMEOUT_MS,
  ALMA_TTS_RETRY_DELAY_MS,
} from '@/constants/alma-tts';
import { trackAnalyticsEvent } from '@/services/analytics-sync';
import { checkUsageAllowed } from '@/services/usage-limits';

let currentSound: Audio.Sound | null = null;
let playbackGeneration = 0;
let speaking = false;
const speakingListeners = new Set<(value: boolean) => void>();

function setSpeaking(next: boolean) {
  if (speaking === next) return;
  speaking = next;
  for (const listener of speakingListeners) {
    listener(next);
  }
}

export function subscribeAlmaSpeaking(listener: (value: boolean) => void): () => void {
  speakingListeners.add(listener);
  listener(speaking);
  return () => {
    speakingListeners.delete(listener);
  };
}

export function isAlmaSpeaking(): boolean {
  return speaking;
}

async function unloadCurrentSound(): Promise<void> {
  if (!currentSound) return;
  try {
    await currentSound.stopAsync();
    await currentSound.unloadAsync();
  } catch {
    // ignore
  }
  currentSound = null;
}

export function nextAlmaPlaybackGeneration(): number {
  playbackGeneration += 1;
  return playbackGeneration;
}

export function getAlmaPlaybackGeneration(): number {
  return playbackGeneration;
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function formatAlmaFetchError(err: unknown): Error {
  const endpoint = ALMA_TTS_ENDPOINT;
  if (err instanceof Error) {
    if (err.name === 'AbortError') {
      return new Error(
        `Alma TTS tog för lång tid (${endpoint}). Kontrollera att servern svarar.`,
      );
    }
    if (err.message === 'Network request failed' || err.message.includes('Failed to fetch')) {
      return new Error(
        `Nätverksfel — kunde inte nå ${endpoint}. URL: ${ALMA_TTS_BASE_URL}. Kontrollera internet och att TTS-servern är igång.`,
      );
    }
    return err;
  }
  return new Error(`Alma TTS misslyckades (${endpoint}).`);
}

async function fetchAlmaSpeechAudioOnce(text: string): Promise<Uint8Array> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), ALMA_TTS_REQUEST_TIMEOUT_MS);

  try {
    const response = await fetch(ALMA_TTS_ENDPOINT, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Accept: 'audio/wav' },
      body: JSON.stringify({ text }),
      signal: controller.signal,
    });

    if (!response.ok) {
      let detail = `HTTP ${response.status}`;
      try {
        const payload = (await response.json()) as { error?: string; detail?: string };
        detail = payload.detail ?? payload.error ?? detail;
      } catch {
        // not JSON
      }
      throw new Error(`${detail} (${ALMA_TTS_ENDPOINT})`);
    }

    const buffer = await response.arrayBuffer();
    if (!buffer.byteLength) {
      throw new Error(`Tom ljudfil från Alma TTS (${ALMA_TTS_ENDPOINT}).`);
    }
    return new Uint8Array(buffer);
  } finally {
    clearTimeout(timer);
  }
}

export async function fetchAlmaSpeechAudio(text: string): Promise<Uint8Array> {
  const trimmed = text.trim();
  if (!trimmed) {
    throw new Error('Texten är tom.');
  }
  const ttsLimit = await checkUsageAllowed('tts_request');
  if (!ttsLimit.allowed) {
    throw new Error(ttsLimit.message ?? 'Du har nått dagens gräns för röst. Försök igen imorgon.');
  }
  if (trimmed.length > ALMA_TTS_MAX_CHARS) {
    throw new Error(`Texten är för lång (max ${ALMA_TTS_MAX_CHARS} tecken).`);
  }

  let lastError: Error | undefined;
  const attempts = ALMA_TTS_FETCH_RETRIES + 1;

  for (let attempt = 1; attempt <= attempts; attempt += 1) {
    try {
      const audio = await fetchAlmaSpeechAudioOnce(trimmed);
      void trackAnalyticsEvent('tts_request', { chars: trimmed.length });
      return audio;
    } catch (err) {
      lastError = formatAlmaFetchError(err);
      const retryable =
        lastError.message.includes('Nätverksfel') ||
        lastError.message.includes('tog för lång tid');
      if (!retryable || attempt >= attempts) {
        throw lastError;
      }
      await sleep(ALMA_TTS_RETRY_DELAY_MS * attempt);
    }
  }

  throw lastError ?? new Error(`Alma TTS misslyckades (${ALMA_TTS_ENDPOINT}).`);
}

/** Hermes on Android lacks `btoa` — pure-JS base64 avoids silent playback failures. */
function bytesToBase64(bytes: Uint8Array): string {
  const alphabet = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/';
  let result = '';
  for (let i = 0; i < bytes.length; i += 3) {
    const a = bytes[i];
    const b = i + 1 < bytes.length ? bytes[i + 1] : 0;
    const c = i + 2 < bytes.length ? bytes[i + 2] : 0;
    result += alphabet[a >> 2];
    result += alphabet[((a & 0x03) << 4) | (b >> 4)];
    result += i + 1 < bytes.length ? alphabet[((b & 0x0f) << 2) | (c >> 6)] : '=';
    result += i + 2 < bytes.length ? alphabet[c & 0x3f] : '=';
  }
  return result;
}

const PLAYBACK_WATCHDOG_MS = 90_000;

export async function setAlmaAudioMode(): Promise<void> {
  await Audio.setAudioModeAsync({
    allowsRecordingIOS: false,
    playsInSilentModeIOS: true,
    staysActiveInBackground: false,
    shouldDuckAndroid: true,
    playThroughEarpieceAndroid: false,
    interruptionModeAndroid: InterruptionModeAndroid.DuckOthers,
    interruptionModeIOS: InterruptionModeIOS.DuckOthers,
  });
}

export async function playAlmaSpeech(
  wavBytes: Uint8Array,
  generation: number,
): Promise<void> {
  if (generation !== playbackGeneration) return;

  const cacheDir = FileSystem.cacheDirectory;
  if (!cacheDir) {
    throw new Error('Cache directory unavailable');
  }

  await unloadCurrentSound();
  await setAlmaAudioMode();

  const fileUri = `${cacheDir}alma-tts-${Date.now()}-${generation}.wav`;
  await FileSystem.writeAsStringAsync(fileUri, bytesToBase64(wavBytes), {
    encoding: FileSystem.EncodingType.Base64,
  });

  if (generation !== playbackGeneration) {
    await FileSystem.deleteAsync(fileUri, { idempotent: true });
    return;
  }

  setSpeaking(true);

  const { sound } = await Audio.Sound.createAsync(
    { uri: fileUri },
    { shouldPlay: false, volume: 1.0, isMuted: false },
  );
  currentSound = sound;

  await new Promise<void>((resolve, reject) => {
    let settled = false;
    let watchdog: ReturnType<typeof setTimeout> | undefined;

    const finish = (fn: () => void) => {
      if (settled) return;
      settled = true;
      if (watchdog) clearTimeout(watchdog);
      fn();
    };

    const cleanup = () => {
      currentSound = null;
      void FileSystem.deleteAsync(fileUri, { idempotent: true });
      if (generation === playbackGeneration) {
        setSpeaking(false);
      }
    };

    const finishPlayback = () => {
      void sound.unloadAsync().finally(() => {
        cleanup();
        finish(resolve);
      });
    };

    const watchdogTimer = setTimeout(() => {
      void sound.stopAsync().finally(finishPlayback);
    }, PLAYBACK_WATCHDOG_MS);
    watchdog = watchdogTimer;

    sound.setOnPlaybackStatusUpdate((status) => {
      if (!status.isLoaded) return;

      const atEnd =
        status.didJustFinish ||
        (status.durationMillis != null &&
          status.durationMillis > 0 &&
          status.positionMillis >= status.durationMillis - 250);

      if (atEnd) {
        finishPlayback();
        return;
      }

      if ('error' in status && status.error) {
        cleanup();
        finish(() => reject(new Error(status.error)));
      }
    });

    void sound.playAsync().catch((err) => {
      cleanup();
      finish(() => reject(err));
    });
  });
}

export type AlmaSpeakResult = { ok: true } | { ok: false; error: string };

export async function speakAlmaText(
  text: string,
  generation: number,
): Promise<AlmaSpeakResult> {
  try {
    const wav = await fetchAlmaSpeechAudio(text);
    if (generation !== playbackGeneration) {
      return { ok: false, error: 'Uppspelning avbröts.' };
    }
    await playAlmaSpeech(wav, generation);
    if (generation !== playbackGeneration) {
      return { ok: false, error: 'Uppspelning avbröts.' };
    }
    return { ok: true };
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Alma TTS misslyckades';
    console.warn('[alma-tts]', err);
    if (generation === playbackGeneration) {
      setSpeaking(false);
    }
    return { ok: false, error: message };
  }
}

export function stopAlmaSpeech(): void {
  playbackGeneration += 1;
  setSpeaking(false);
  void unloadCurrentSound();
}
