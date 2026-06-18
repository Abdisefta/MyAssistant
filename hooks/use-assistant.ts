import { useCallback, useEffect, useRef, useState } from 'react';
import * as Notifications from 'expo-notifications';
import * as Speech from 'expo-speech';

import {
  extractLearnings,
  generateAssistantReply,
  generateWelcomeMessage,
} from '@/services/gemini';
import { getUpcomingMeetingsSummary } from '@/services/meeting-context';
import { syncMeetingReminders } from '@/services/meeting-reminders';
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
        text: 'Hej! Håll inne mikrofonen eller skriv för att prata med mig.',
      },
    ];
  }

  return history.map((msg) => ({
    id: msg.id,
    role: msg.role,
    text: msg.text,
  }));
}

function promiseWithTimeout<T>(promise: Promise<T>, ms: number, fallback: T): Promise<T> {
  return new Promise((resolve) => {
    const timer = setTimeout(() => resolve(fallback), ms);
    promise
      .then((value) => {
        clearTimeout(timer);
        resolve(value);
      })
      .catch(() => {
        clearTimeout(timer);
        resolve(fallback);
      });
  });
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

export function useAssistant(userId?: string) {
  const userIdRef = useRef(userId);
  userIdRef.current = userId;

  const [memory, setMemory] = useState<UserMemory | null>(null);
  const [transcript, setTranscript] = useState<TranscriptEntry[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isThinking, setIsThinking] = useState(false);
  const [showOnboarding, setShowOnboarding] = useState(false);

  const speak = useCallback((text: string) => {
    Speech.stop();
    Speech.speak(text, { language: 'sv-SE', rate: 0.95 });
  }, []);

  const refreshReminders = useCallback(async (mem: UserMemory) => {
    try {
      await syncMeetingReminders(mem);
    } catch (error) {
      console.warn('Meeting reminders sync failed:', error);
    }
  }, []);

  useEffect(() => {
    let active = true;

    (async () => {
      setIsLoading(true);
      const stored = await loadMemory(userId);
      if (!active) return;
      setMemory(stored);
      setTranscript(historyToTranscript(stored.conversationHistory));
      setShowOnboarding(!stored.onboardingComplete);
      setIsLoading(false);
      await refreshReminders(stored);
    })();

    return () => {
      active = false;
    };
  }, [userId, refreshReminders]);

  useEffect(() => {
    const sub = Notifications.addNotificationReceivedListener((notification) => {
      const data = notification.request.content.data;
      if (data?.type === 'meeting' && notification.request.content.body) {
        speak(notification.request.content.body as string);
      }
    });
    return () => sub.remove();
  }, [speak]);

  const completeOnboarding = useCallback(
    async (name: string, job: string) => {
      const trimmedName = name.trim();
      const trimmedJob = job.trim();
      const uid = userIdRef.current;

      const baseMemory: UserMemory = {
        name: trimmedName,
        job: trimmedJob,
        preferences: [],
        personalNotes: [],
        onboardingComplete: true,
        conversationHistory: [],
        meetingRemindersEnabled: true,
        reminderMinutesBefore: 15,
      };

      setIsThinking(true);

      try {
        const meetingContext = await getUpcomingMeetingsSummary();
        const systemPrompt = buildSystemPrompt(baseMemory, meetingContext);
        const welcome = await generateWelcomeMessage(systemPrompt, trimmedName);
        const welcomeMessage = createMessage('assistant', welcome);
        const updatedMemory: UserMemory = {
          ...baseMemory,
          conversationHistory: [welcomeMessage],
        };

        await saveMemory(updatedMemory, uid);
        setMemory(updatedMemory);
        setTranscript(historyToTranscript(updatedMemory.conversationHistory));
        setShowOnboarding(false);
        speak(welcome);
        await refreshReminders(updatedMemory);
      } catch (error) {
        const fallback = `Hej ${trimmedName}! Jag är din personliga assistent. Hur kan jag hjälpa dig idag?`;
        const welcomeMessage = createMessage('assistant', fallback);
        const updatedMemory: UserMemory = {
          ...baseMemory,
          conversationHistory: [welcomeMessage],
        };

        await saveMemory(updatedMemory, uid);
        setMemory(updatedMemory);
        setTranscript(historyToTranscript(updatedMemory.conversationHistory));
        setShowOnboarding(false);
        speak(fallback);
        console.error('Onboarding welcome error:', error);
      } finally {
        setIsThinking(false);
      }
    },
    [speak, refreshReminders],
  );

  const sendMessage = useCallback(
    async (text: string) => {
      const trimmed = text.trim();
      if (!trimmed || !memory || isThinking) return;

      const uid = userIdRef.current;
      const userMessage = createMessage('user', trimmed);
      const historyWithUser = [...memory.conversationHistory, userMessage];

      setTranscript((prev) => [
        ...prev.filter((e) => e.text !== 'Lyssnar...' && e.id !== 'partial'),
        { id: userMessage.id, role: 'user', text: trimmed },
        { id: 'thinking', role: 'system', text: 'Tänker...' },
      ]);
      setIsThinking(true);

      try {
        const meetingContext = await promiseWithTimeout(
          getUpcomingMeetingsSummary(),
          3000,
          '',
        );
        const systemPrompt = buildSystemPrompt(memory, meetingContext);
        const reply = await generateAssistantReply(
          systemPrompt,
          memory.conversationHistory,
          trimmed,
        );

        const assistantMessage = createMessage('assistant', reply);
        const updatedHistory = [...historyWithUser, assistantMessage];

        setMemory((prev) =>
          prev ? { ...prev, conversationHistory: updatedHistory } : prev,
        );
        setTranscript(historyToTranscript(updatedHistory));
        speak(reply);
        setIsThinking(false);

        void (async () => {
          try {
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

            await saveMemory(updatedMemory, uid);
            setMemory(updatedMemory);
          } catch (bgError) {
            console.warn('Background learning save failed:', bgError);
            try {
              const fallbackMemory: UserMemory = {
                ...memory,
                conversationHistory: updatedHistory,
              };
              await saveMemory(fallbackMemory, uid);
              setMemory(fallbackMemory);
            } catch (saveError) {
              console.warn('Background conversation save failed:', saveError);
            }
          }
        })();
      } catch (error) {
        const errorText =
          error instanceof Error ? error.message : 'Något gick fel. Försök igen.';

        setTranscript((prev) => [
          ...prev.filter((e) => e.text !== 'Tänker...'),
          { id: `error-${Date.now()}`, role: 'system', text: errorText },
        ]);
        setIsThinking(false);
      }
    },
    [memory, isThinking, speak],
  );

  const clearHistory = useCallback(async () => {
    const updated = await clearConversationHistory(userIdRef.current);
    setMemory(updated);
    setTranscript(historyToTranscript([]));
  }, []);

  const setListeningState = useCallback((listening: boolean, partial?: string) => {
    if (listening) {
      setTranscript((prev) => {
        const filtered = prev.filter(
          (e) => e.id !== 'listening' && e.id !== 'partial' && e.text !== 'Lyssnar...',
        );
        if (partial?.trim()) {
          return [
            ...filtered,
            { id: 'partial', role: 'user', text: partial.trim() },
          ];
        }
        return [...filtered, { id: 'listening', role: 'system', text: 'Lyssnar...' }];
      });
    } else {
      setTranscript((prev) =>
        prev.filter(
          (e) => e.id !== 'listening' && e.id !== 'partial' && e.text !== 'Lyssnar...',
        ),
      );
    }
  }, []);

  const syncReminders = useCallback(async () => {
    if (!memory) return;
    await refreshReminders(memory);
  }, [memory, refreshReminders]);

  const updateMeetingReminders = useCallback(
    async (enabled: boolean) => {
      if (!memory) return;
      const uid = userIdRef.current;
      const updated: UserMemory = { ...memory, meetingRemindersEnabled: enabled };
      await saveMemory(updated, uid);
      setMemory(updated);
      await refreshReminders(updated);
    },
    [memory, refreshReminders],
  );

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
    syncReminders,
    updateMeetingReminders,
  };
}
