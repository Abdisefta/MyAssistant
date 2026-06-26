import { getActiveLocale } from '@/constants/i18n';
import { getSpeechLocale } from '@/constants/i18n/resolve-locale';
import { useCallback, useEffect, useRef, useState } from 'react';
import {
  ExpoSpeechRecognitionModule,
  useSpeechRecognitionEvent,
} from 'expo-speech-recognition';

type Options = {
  onFinalResult: (text: string) => void;
  enabled?: boolean;
};

const SILENCE_MS = 2200;

/** USB-build / installerad APK — riktig röst. Tryck för att prata (ingen håll-knapp). */
export function useVoiceInput({ onFinalResult, enabled = true }: Options) {
  const [isListening, setIsListening] = useState(false);
  const [partialText, setPartialText] = useState('');
  const [isAvailable, setIsAvailable] = useState(false);

  const onFinalResultRef = useRef(onFinalResult);
  onFinalResultRef.current = onFinalResult;

  const latestTranscriptRef = useRef('');
  const listeningRef = useRef(false);
  const silenceTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const clearSilenceTimer = useCallback(() => {
    if (silenceTimerRef.current) {
      clearTimeout(silenceTimerRef.current);
      silenceTimerRef.current = null;
    }
  }, []);

  const scheduleSilenceStop = useCallback(() => {
    clearSilenceTimer();
    silenceTimerRef.current = setTimeout(() => {
      if (!listeningRef.current) return;
      try {
        ExpoSpeechRecognitionModule.stop();
      } catch {
        listeningRef.current = false;
        setIsListening(false);
      }
    }, SILENCE_MS);
  }, [clearSilenceTimer]);

  useEffect(() => {
    let active = true;
    void (async () => {
      try {
        const available = ExpoSpeechRecognitionModule.isRecognitionAvailable();
        if (active) setIsAvailable(available);
      } catch {
        if (active) setIsAvailable(false);
      }
    })();
    return () => {
      active = false;
      clearSilenceTimer();
    };
  }, [clearSilenceTimer]);

  useSpeechRecognitionEvent('start', () => {
    listeningRef.current = true;
    setIsListening(true);
    scheduleSilenceStop();
  });

  useSpeechRecognitionEvent('end', () => {
    listeningRef.current = false;
    setIsListening(false);
    clearSilenceTimer();

    const text = latestTranscriptRef.current.trim();
    if (text) {
      onFinalResultRef.current(text);
    }
    latestTranscriptRef.current = '';
    setPartialText('');
  });

  useSpeechRecognitionEvent('result', (event) => {
    const text = event.results?.[0]?.transcript?.trim() ?? '';
    if (!text) return;

    latestTranscriptRef.current = text;
    setPartialText(text);
    scheduleSilenceStop();

    if (event.isFinal && listeningRef.current) {
      listeningRef.current = false;
      setIsListening(false);
      clearSilenceTimer();
      onFinalResultRef.current(text);
      latestTranscriptRef.current = '';
      setPartialText('');
      try {
        ExpoSpeechRecognitionModule.stop();
      } catch {
        // ignore
      }
    }
  });

  useSpeechRecognitionEvent('error', (event) => {
    console.warn('[voice] recognition error:', event.error, event.message);
    listeningRef.current = false;
    setIsListening(false);
    clearSilenceTimer();
    setPartialText('');
  });

  const startListening = useCallback(async () => {
    if (!enabled) return false;

    try {
      if (!ExpoSpeechRecognitionModule.isRecognitionAvailable()) {
        return false;
      }

      const permission = await ExpoSpeechRecognitionModule.requestPermissionsAsync();
      if (!permission.granted) {
        return false;
      }

      latestTranscriptRef.current = '';
      setPartialText('');

      ExpoSpeechRecognitionModule.start({
        lang: getSpeechLocale(getActiveLocale()),
        interimResults: true,
        continuous: true,
        maxAlternatives: 1,
      });

      return true;
    } catch (error) {
      console.warn('[voice] start failed:', error);
      return false;
    }
  }, [enabled]);

  const stopListening = useCallback(() => {
    clearSilenceTimer();
    if (!listeningRef.current) return;

    try {
      ExpoSpeechRecognitionModule.stop();
    } catch {
      listeningRef.current = false;
      setIsListening(false);

      const text = latestTranscriptRef.current.trim();
      if (text) {
        onFinalResultRef.current(text);
      }
      latestTranscriptRef.current = '';
      setPartialText('');
    }
  }, [clearSilenceTimer]);

  const toggleListening = useCallback(async () => {
    if (listeningRef.current) {
      stopListening();
      return false;
    }
    return startListening();
  }, [startListening, stopListening]);

  return {
    isListening,
    partialText,
    isAvailable,
    startListening,
    stopListening,
    toggleListening,
  };
};
