import { useCallback, useEffect, useState } from 'react';

import {
  fetchAlmaSpeechAudio,
  isAlmaSpeaking,
  nextAlmaPlaybackGeneration,
  playAlmaSpeech,
  speakAlmaText,
  stopAlmaSpeech,
  subscribeAlmaSpeaking,
} from '@/services/alma-tts';
import { normalizeForSpeech, splitTextForSpeech } from '@/services/speech-text';

export function useAlmaSpeech() {
  const [isSpeaking, setIsSpeaking] = useState(isAlmaSpeaking());
  const [error, setError] = useState<string | null>(null);

  useEffect(() => subscribeAlmaSpeaking(setIsSpeaking), []);

  const speak = useCallback(async (text: string) => {
    const chunks = splitTextForSpeech(text);
    if (!chunks.length) return;

    setError(null);
    stopAlmaSpeech();
    const generation = nextAlmaPlaybackGeneration();

    for (const chunk of chunks) {
      const result = await speakAlmaText(chunk, generation);
      if (!result.ok) {
        setError(result.error);
        break;
      }
    }
  }, []);

  const speakRaw = useCallback(async (text: string) => {
    setError(null);
    const generation = nextAlmaPlaybackGeneration();
    try {
      const wav = await fetchAlmaSpeechAudio(normalizeForSpeech(text));
      await playAlmaSpeech(wav, generation);
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Alma TTS misslyckades';
      setError(message);
      throw err;
    }
  }, []);

  const stop = useCallback(() => {
    stopAlmaSpeech();
  }, []);

  return {
    speak,
    speakRaw,
    stop,
    isSpeaking,
    error,
  };
}
