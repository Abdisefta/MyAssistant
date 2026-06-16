import { useCallback, useEffect, useState } from 'react';
import * as Speech from 'expo-speech';

import {
  extractLearnings,
  generateAssistantReply,
  generateWelcomeMessage,
} from '@/services/gemini';
import {
  buildSystemPrompt,
  createMessage,
  loadMemory,
  saveMemory,
  clearConversationHistory,
} from '@/services/memory';
import type { ConversationMessage, UserMemory } from '@/types/memory';

export type TranscriptEntry = {
  id: string;
  role: 'user' | 'assistant' | 'system';
  text: string;
};

function historyToTranscript(history: ConversationMessage[]): TranscriptEntry[] {
  if (history.length === 0) {
    return [
      {
        id: 'welcome',
        role: 'assistant',
        text: 'Hej! Skriv eller skicka ett meddelande för att prata med mig.',
      },
    ];
  }

  return history.map((msg) => ({
    id: msg.id,
    role: msg.role,
    text: msg.text,
  }));
}

function mergeUnique(existing: string[], additions: string[]): string[] {
  const set = new Set(existing.map((s) => s.toLowerCase()));
  const merged = [...existing];

  for (const item of additions) {
    if (!set.has(item.toLowerCase())) {
      set.add(item.toLowerCase());
      merged.push(item);
    }
  }

  return merged;
}

export function useAssistant() {
  const [memory, setMemory] = useState<UserMemory | null>(null);
  const [transcript, setTranscript] = useState<TranscriptEntry[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isThinking, setIsThinking] = useState(false);
  const [showOnboarding, setShowOnboarding] = useState(false);

  const speak = useCallback((text: string) => {
    Speech.stop();
    Speech.speak(text, { language: 'sv-SE', rate: 0.95 });
  }, []);

  useEffect(() => {
    (async () => {
      const stored = await loadMemory();
      setMemory(stored);
      setTranscript(historyToTranscript(stored.conversationHistory));
      setShowOnboarding(!stored.onboardingComplete);
      setIsLoading(false);
    })();
  }, []);

  const completeOnboarding = useCallback(
    async (name: string, job: string) => {
      const trimmedName = name.trim();
      const trimmedJob = job.trim();

      const baseMemory: UserMemory = {
        name: trimmedName,
        job: trimmedJob,
        preferences: [],
        personalNotes: [],
        onboardingComplete: true,
        conversationHistory: [],
      };

      setIsThinking(true);

      try {
        const systemPrompt = buildSystemPrompt(baseMemory);
        const welcome = await generateWelcomeMessage(systemPrompt, trimmedName);
        const welcomeMessage = createMessage('assistant', welcome);
        const updatedMemory: UserMemory = {
          ...baseMemory,
          conversationHistory: [welcomeMessage],
        };

        await saveMemory(updatedMemory);
        setMemory(updatedMemory);
        setTranscript(historyToTranscript(updatedMemory.conversationHistory));
        setShowOnboarding(false);
        speak(welcome);
      } catch (error) {
        const fallback =
          `Hej ${trimmedName}! Jag är din assistent. Hur kan jag hjälpa dig idag?`;
        const welcomeMessage = createMessage('assistant', fallback);
        const updatedMemory: UserMemory = {
          ...baseMemory,
          conversationHistory: [welcomeMessage],
        };

        await saveMemory(updatedMemory);
        setMemory(updatedMemory);
        setTranscript(historyToTranscript(updatedMemory.conversationHistory));
        setShowOnboarding(false);
        speak(fallback);
        console.error('Onboarding welcome error:', error);
      } finally {
        setIsThinking(false);
      }
    },
    [speak],
  );

  const sendMessage = useCallback(
    async (text: string) => {
      const trimmed = text.trim();
      if (!trimmed || !memory || isThinking) return;

      const userMessage = createMessage('user', trimmed);
      const historyWithUser = [...memory.conversationHistory, userMessage];

      setTranscript((prev) => [
        ...prev.filter((e) => e.text !== 'Lyssnar...'),
        { id: userMessage.id, role: 'user', text: trimmed },
        { id: 'thinking', role: 'system', text: 'Tänker...' },
      ]);
      setIsThinking(true);

      try {
        const systemPrompt = buildSystemPrompt(memory);
        const reply = await generateAssistantReply(
          systemPrompt,
          memory.conversationHistory,
          trimmed,
        );

        const assistantMessage = createMessage('assistant', reply);
        const updatedHistory = [...historyWithUser, assistantMessage];

        const learnings = await extractLearnings(
          trimmed,
          reply,
          memory.personalNotes,
          memory.preferences,
        );

        const updatedMemory: UserMemory = {
          ...memory,
          conversationHistory: updatedHistory,
          personalNotes: mergeUnique(memory.personalNotes, learnings.notes),
          preferences: mergeUnique(memory.preferences, learnings.preferences),
        };

        await saveMemory(updatedMemory);
        setMemory(updatedMemory);
        setTranscript(historyToTranscript(updatedHistory));
        speak(reply);
      } catch (error) {
        const errorText =
          error instanceof Error
            ? error.message
            : 'Något gick fel. Försök igen.';

        setTranscript((prev) => [
          ...prev.filter((e) => e.text !== 'Tänker...'),
          { id: `error-${Date.now()}`, role: 'system', text: errorText },
        ]);
      } finally {
        setIsThinking(false);
      }
    },
    [memory, isThinking, speak],
  );

  const clearHistory = useCallback(async () => {
    const updated = await clearConversationHistory();
    setMemory(updated);
    setTranscript(historyToTranscript([]));
  }, []);

  const setListeningState = useCallback((listening: boolean) => {
    if (listening) {
      setTranscript((prev) => {
        if (prev.some((e) => e.text === 'Lyssnar...')) return prev;
        return [...prev, { id: 'listening', role: 'system', text: 'Lyssnar...' }];
      });
    } else {
      setTranscript((prev) => prev.filter((e) => e.text !== 'Lyssnar...'));
    }
  }, []);

  return {
    memory,
    transcript,
    isLoading,
    isThinking,
    showOnboarding,
    completeOnboarding,
    sendMessage,
    clearHistory,
    setListeningState,
    speak,
  };
}
