import {
  isAlmaSpeaking,
  nextAlmaPlaybackGeneration,
  setAlmaAudioMode,
  speakAlmaText,
  stopAlmaSpeech,
} from '@/services/alma-tts';
import { splitTextForSpeech } from '@/services/speech-text';

let speakGeneration = 0;
let speaking = false;

export type SpeakAssistantOptions = {
  onError?: (message: string) => void;
};

async function runSpeakQueue(
  generation: number,
  chunks: string[],
  onError?: (message: string) => void,
): Promise<void> {
  try {
    for (const chunk of chunks) {
      if (generation !== speakGeneration) break;
      const result = await speakAlmaText(chunk, generation);
      if (!result.ok) {
        onError?.(result.error);
        break;
      }
    }
  } finally {
    if (generation === speakGeneration) {
      speaking = false;
    }
  }
}

/** Uppläsning via självhostad Alma (Piper TTS). */
export function speakAssistant(text: string, options?: SpeakAssistantOptions): void {
  stopAssistantSpeech();

  const chunks = splitTextForSpeech(text);
  speaking = chunks.length > 0;
  if (!speaking) return;

  speakGeneration = nextAlmaPlaybackGeneration();
  void runSpeakQueue(speakGeneration, chunks, options?.onError);
}

export function stopAssistantSpeech(): void {
  stopAlmaSpeech();
  speakGeneration = nextAlmaPlaybackGeneration();
  speaking = false;
}

export function isAssistantSpeaking(): boolean {
  return speaking || isAlmaSpeaking();
}

/** Behålls för kompatibilitet — sätter ljudläge så Alma hörs på telefonen. */
export async function initAssistantVoice(_localeTag?: string): Promise<void> {
  try {
    await setAlmaAudioMode();
  } catch (err) {
    console.warn('[speech] init audio mode failed:', err);
  }
}

export { normalizeForSpeech, splitTextForSpeech } from '@/services/speech-text';
