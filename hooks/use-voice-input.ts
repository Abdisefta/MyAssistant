import { useCallback, useEffect, useRef, useState } from 'react';
import {
  ExpoSpeechRecognitionModule,
  useSpeechRecognitionEvent,
} from 'expo-speech-recognition';

type Options = {
  onFinalResult: (text: string) => void;
  enabled?: boolean;
};

export function useVoiceInput({ onFinalResult, enabled = true }: Options) {
  const [isListening, setIsListening] = useState(false);
  const [partialText, setPartialText] = useState('');
  const [isAvailable, setIsAvailable] = useState(false);
  const finalTextRef = useRef('');

  useEffect(() => {
    try {
      setIsAvailable(ExpoSpeechRecognitionModule.isRecognitionAvailable());
    } catch {
      setIsAvailable(false);
    }
  }, []);

  useSpeechRecognitionEvent('start', () => setIsListening(true));
  useSpeechRecognitionEvent('end', () => {
    setIsListening(false);
    const text = finalTextRef.current.trim();
    finalTextRef.current = '';
    setPartialText('');
    if (text) onFinalResult(text);
  });
  useSpeechRecognitionEvent('result', (event) => {
    const text = event.results?.[0]?.transcript ?? '';
    if (event.isFinal) {
      finalTextRef.current = text;
      setPartialText(text);
    } else {
      setPartialText(text);
    }
  });
  useSpeechRecognitionEvent('error', () => {
    setIsListening(false);
    setPartialText('');
    finalTextRef.current = '';
  });

  const startListening = useCallback(async () => {
    if (!enabled || !isAvailable || isListening) return false;

    try {
      const perms = await ExpoSpeechRecognitionModule.requestPermissionsAsync();
      if (!perms.granted) return false;

      finalTextRef.current = '';
      setPartialText('');
      ExpoSpeechRecognitionModule.start({
        lang: 'sv-SE',
        interimResults: true,
        maxAlternatives: 1,
        continuous: false,
      });
      return true;
    } catch {
      return false;
    }
  }, [enabled, isAvailable, isListening]);

  const stopListening = useCallback(() => {
    try {
      if (isListening) {
        ExpoSpeechRecognitionModule.stop();
      }
    } catch {
      setIsListening(false);
    }
  }, [isListening]);

  return {
    isListening,
    partialText,
    isAvailable,
    startListening,
    stopListening,
  };
}
