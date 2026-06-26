import { useCallback, useState } from 'react';

type Options = {
  onFinalResult: (text: string) => void;
  enabled?: boolean;
};

/** Fallback utan native modul — Expo Go och web. */
export function useVoiceInput({ enabled = true }: Options) {
  const [isListening] = useState(false);
  const [partialText] = useState('');

  const startListening = useCallback(async () => {
    if (!enabled) return false;
    return false;
  }, [enabled]);

  const stopListening = useCallback(() => {}, []);

  const toggleListening = useCallback(async () => false, []);

  return {
    isListening,
    partialText,
    isAvailable: false,
    startListening,
    stopListening,
    toggleListening,
  };
}
