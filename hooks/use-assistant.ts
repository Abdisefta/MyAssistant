import { useLocale } from '@/contexts/locale-context';
import { getSpeechLocale } from '@/constants/i18n/resolve-locale';
import { useCallback, useEffect, useRef, useState } from 'react';
import * as Notifications from '@/services/notifications';

import {
  answerCalendarQuestion,
  answerEmailReadQuestion,
  assistantAskedAboutSickDay,
  continueEmailConversation,
  executeSickDayAction,
  handleTaskReminderRequest,
  handleTaskRemoveRequest,
  handleSickDayRequest,
  isBookingConfirmation,
  isEmailConfirmation,
  isSendCancellation,
  looksLikeCalendarBookingRequest,
  looksLikeCalendarCancelRequest,
  looksLikeEmailRequest,
  looksLikeSickDayRequest,
  looksLikeTaskOrReminderRequest,
  looksLikeTaskRemoveRequest,
  prepareCalendarBooking,
  prepareEmailDraft,
  prepareSickDayAction,
  shouldContinueEmailFlow,
  tryCancelCalendarBooking,
  tryCancelCalendarBookingFromContext,
  isAffirmativeReply,
  assistantAskedAboutCancel,
  tryCreatePendingBooking,
  trySendEmailAfterConfirmation,
  trySendPendingEmail,
} from '@/services/assistant-actions';
import {
  extractLearnings,
  generateAssistantReply,
  generateWelcomeMessage,
  toUserFacingGeminiError,
} from '@/services/gemini';
import { getUpcomingMeetingsSummary } from '@/services/meeting-context';
import { getInboxSummaryForAgent } from '@/services/email-context';
import { syncMeetingReminders } from '@/services/meeting-reminders';
import {
  buildSystemPrompt,
  createMessage,
  loadMemory,
  saveMemory,
  clearConversationHistory,
} from '@/services/memory';
import { recordAssistantMessage } from '@/services/usage-stats';
import { setNotificationAlertStyle } from '@/services/notification-settings';
import { initAssistantVoice, speakAssistant } from '@/services/speech';
import { cancelTaskReminder, scheduleTaskReminder } from '@/services/task-reminders';
import type { AgentTask, ConversationMessage, NotificationAlertStyle, UserMemory } from '@/types/memory';
import type { PendingCalendarBooking, PendingEmailDraft, PendingSickDay } from '@/types/assistant';

export type TranscriptEntry = {
  id: string;
  role: 'user' | 'assistant' | 'system';
  text: string;
};

export type UseAssistantOptions = {
  getGoogleAccessToken?: () => string | null | undefined;
  refreshGoogleAccessToken?: () => Promise<string | null>;
};

function historyToTranscript(
  history: ConversationMessage[],
  welcomeText: string,
): TranscriptEntry[] {
  if (history.length === 0) {
    return [
      {
        id: 'welcome',
        role: 'assistant',
        text: welcomeText,
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

async function resolveGoogleToken(
  getToken: () => string | null | undefined,
  refreshToken?: () => Promise<string | null>,
): Promise<string | null> {
  const current = getToken();
  if (current) return current;
  if (!refreshToken) return null;
  return refreshToken();
}

export function useAssistant(userId?: string, options: UseAssistantOptions = {}) {
  const { locale, strings, t } = useLocale();
  const optionsRef = useRef(options);
  optionsRef.current = options;

  const userIdRef = useRef(userId);
  userIdRef.current = userId;

  const pendingEmailDraftRef = useRef<PendingEmailDraft | null>(null);
  const pendingCalendarBookingRef = useRef<PendingCalendarBooking | null>(null);
  const pendingSickDayRef = useRef<PendingSickDay | null>(null);

  const [memory, setMemory] = useState<UserMemory | null>(null);
  const [transcript, setTranscript] = useState<TranscriptEntry[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isThinking, setIsThinking] = useState(false);
  const [showOnboarding, setShowOnboarding] = useState(false);

  const speak = useCallback((text: string) => {
    speakAssistant(text, {
      onError: (message) => {
        setTranscript((prev) => [
          ...prev,
          {
            id: `tts-error-${Date.now()}`,
            role: 'system',
            text: `Kunde inte spela upp röst: ${message}`,
          },
        ]);
      },
    });
  }, []);

  useEffect(() => {
    void initAssistantVoice(getSpeechLocale(locale));
  }, [locale]);

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
      setNotificationAlertStyle(stored.notificationAlertStyle ?? 'sound');
      setTranscript(historyToTranscript(stored.conversationHistory, strings.welcome.default));
      setShowOnboarding(!stored.onboardingComplete);
      setIsLoading(false);
      await refreshReminders(stored);
    })();

    return () => {
      active = false;
    };
  }, [userId, refreshReminders, strings.welcome.default]);

  useEffect(() => {
    const sub = Notifications.addNotificationReceivedListener((notification: Notifications.Notification) => {
      const data = notification.request.content.data;
      const body = notification.request.content.body;
      if (!body) return;
      if (data?.type === 'meeting' || data?.type === 'task') {
        if (memory?.notificationAlertStyle === 'sound') {
          speak(body as string);
        }
      }
    });
    return () => sub.remove();
  }, [speak, memory?.notificationAlertStyle]);

  const finishReply = useCallback(
    async (
      memorySnapshot: UserMemory,
      historyWithUser: ConversationMessage[],
      reply: string,
      userText: string,
    ) => {
      const uid = userIdRef.current;
      const assistantMessage = createMessage('assistant', reply);
      const updatedHistory = [...historyWithUser, assistantMessage];

      const withHistory: UserMemory = {
        ...memorySnapshot,
        conversationHistory: updatedHistory,
      };

      setMemory(withHistory);
      setTranscript(historyToTranscript(updatedHistory, strings.welcome.default));
      speak(reply);
      setIsThinking(false);

      void (async () => {
        try {
          const learnings = await extractLearnings(
            userText,
            reply,
            memorySnapshot.personalNotes,
            memorySnapshot.preferences,
          );

          const updatedMemory: UserMemory = {
            ...withHistory,
            personalNotes: mergeUnique(memorySnapshot.personalNotes, learnings.notes),
            preferences: mergeUnique(memorySnapshot.preferences, learnings.preferences),
          };

          await saveMemory(updatedMemory, uid);
          setMemory(updatedMemory);
        } catch (bgError) {
          console.warn('Background learning save failed:', bgError);
          try {
            await saveMemory(withHistory, uid);
          } catch (saveError) {
            console.warn('Background conversation save failed:', saveError);
          }
        }
      })();
    },
    [speak],
  );

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
        tasks: [],
        onboardingComplete: true,
        conversationHistory: [],
        meetingRemindersEnabled: true,
        reminderMinutesBefore: 15,
        notificationAlertStyle: 'sound',
      };

      setIsThinking(true);

      try {
        const meetingContext = await getUpcomingMeetingsSummary();
        const systemPrompt = buildSystemPrompt(baseMemory, meetingContext, undefined, locale);
        const welcome = await generateWelcomeMessage(systemPrompt, trimmedName);
        const welcomeMessage = createMessage('assistant', welcome);
        const updatedMemory: UserMemory = {
          ...baseMemory,
          conversationHistory: [welcomeMessage],
        };

        await saveMemory(updatedMemory, uid);
        setMemory(updatedMemory);
        setTranscript(historyToTranscript(updatedMemory.conversationHistory, strings.welcome.default));
        setShowOnboarding(false);
        speak(welcome);
        await refreshReminders(updatedMemory);
      } catch (error) {
        const fallback = strings.welcome.default;
        const welcomeMessage = createMessage('assistant', fallback);
        const updatedMemory: UserMemory = {
          ...baseMemory,
          conversationHistory: [welcomeMessage],
        };

        await saveMemory(updatedMemory, uid);
        setMemory(updatedMemory);
        setTranscript(historyToTranscript(updatedMemory.conversationHistory, strings.welcome.default));
        setShowOnboarding(false);
        speak(fallback);
        console.error('Onboarding welcome error:', error);
      } finally {
        setIsThinking(false);
      }
    },
    [speak, refreshReminders, locale, strings.welcome.default],
  );

  const sendMessage = useCallback(
    async (text: string) => {
      const trimmed = text.trim();
      if (!trimmed || !memory || isThinking) return;

      void recordAssistantMessage(userIdRef.current);

      const userMessage = createMessage('user', trimmed);
      const historyWithUser = [...memory.conversationHistory, userMessage];

      setTranscript((prev) => [
        ...prev.filter((e) => e.id !== 'listening' && e.id !== 'partial'),
        { id: userMessage.id, role: 'user', text: trimmed },
        { id: 'thinking', role: 'system', text: strings.common.thinking },
      ]);
      setIsThinking(true);

      try {
        const { getGoogleAccessToken, refreshGoogleAccessToken } = optionsRef.current;

        const lastAssistant = [...memory.conversationHistory].reverse().find((m) => m.role === 'assistant');
        if (
          lastAssistant &&
          assistantAskedAboutCancel(lastAssistant.text) &&
          (isAffirmativeReply(trimmed) || isSendCancellation(trimmed))
        ) {
          const cancelReply = await tryCancelCalendarBookingFromContext(historyWithUser, userIdRef.current);
          if (cancelReply) {
            await finishReply(memory, historyWithUser, cancelReply, trimmed);
            if (memory.meetingRemindersEnabled) {
              void refreshReminders(memory);
            }
            return;
          }
        }

        const pendingSickDay = pendingSickDayRef.current;
        if (pendingSickDay) {
          if (isSendCancellation(trimmed)) {
            pendingSickDayRef.current = null;
            await finishReply(
              memory,
              historyWithUser,
              'Okej, jag avbokade inget. Krya på dig!',
              trimmed,
            );
            return;
          }

          if (isBookingConfirmation(trimmed) || isAffirmativeReply(trimmed)) {
            const token = await resolveGoogleToken(
              () => getGoogleAccessToken?.() ?? null,
              refreshGoogleAccessToken,
            );
            const sickReply = await executeSickDayAction(
              pendingSickDay,
              token,
              memory.name,
              userIdRef.current,
            );
            pendingSickDayRef.current = null;
            await finishReply(memory, historyWithUser, sickReply, trimmed);
            if (memory.meetingRemindersEnabled) {
              void refreshReminders(memory);
            }
            return;
          }

          await finishReply(
            memory,
            historyWithUser,
            `Du har ${pendingSickDay.eventSummaries.length} möten ${pendingSickDay.dayLabel.toLowerCase()}. Säg "ja" för att avboka alla och maila, eller "avbryt".`,
            trimmed,
          );
          return;
        }

        if (
          lastAssistant &&
          assistantAskedAboutSickDay(lastAssistant.text) &&
          (isAffirmativeReply(trimmed) || isBookingConfirmation(trimmed))
        ) {
          const context = [...historyWithUser]
            .slice(-8)
            .map((m) => m.text)
            .join(' ');
          let pending = pendingSickDayRef.current;
          if (!pending) {
            try {
              const prepared = await prepareSickDayAction(context, userIdRef.current);
              pending = prepared.pending;
            } catch {
              pending = null;
            }
          }
          if (pending) {
            const token = await resolveGoogleToken(
              () => getGoogleAccessToken?.() ?? null,
              refreshGoogleAccessToken,
            );
            const sickReply = await executeSickDayAction(
              pending,
              token,
              memory.name,
              userIdRef.current,
            );
            pendingSickDayRef.current = null;
            await finishReply(memory, historyWithUser, sickReply, trimmed);
            if (memory.meetingRemindersEnabled) {
              void refreshReminders(memory);
            }
            return;
          }
        }

        const pendingBooking = pendingCalendarBookingRef.current;
        if (looksLikeCalendarCancelRequest(trimmed)) {
          pendingCalendarBookingRef.current = null;
          const cancelReply = await tryCancelCalendarBooking(trimmed, userIdRef.current, historyWithUser);
          await finishReply(memory, historyWithUser, cancelReply, trimmed);
          if (memory.meetingRemindersEnabled) {
            void refreshReminders(memory);
          }
          return;
        }

        if (pendingBooking) {
          if (isSendCancellation(trimmed)) {
            pendingCalendarBookingRef.current = null;
            await finishReply(
              memory,
              historyWithUser,
              strings.agent.bookingCancelled,
              trimmed,
            );
            return;
          }

          if (isBookingConfirmation(trimmed)) {
            const bookedReply = await tryCreatePendingBooking(pendingBooking, userIdRef.current);
            pendingCalendarBookingRef.current = null;
            await finishReply(memory, historyWithUser, bookedReply, trimmed);
            if (memory.meetingRemindersEnabled) {
              void refreshReminders(memory);
            }
            return;
          }

          await finishReply(
            memory,
            historyWithUser,
            t('agent.pendingBooking', { summary: pendingBooking.summary }),
            trimmed,
          );
          return;
        }

        if (looksLikeCalendarBookingRequest(trimmed)) {
          const { booking, previewReply } = await prepareCalendarBooking(trimmed, userIdRef.current);
          pendingCalendarBookingRef.current = booking;
          await finishReply(memory, historyWithUser, previewReply, trimmed);
          return;
        }

        if (looksLikeTaskRemoveRequest(trimmed)) {
          const { reply, updatedMemory } = await handleTaskRemoveRequest(trimmed, memory);
          await finishReply(updatedMemory, historyWithUser, reply, trimmed);
          return;
        }

        if (looksLikeTaskOrReminderRequest(trimmed)) {
          const { reply, updatedMemory } = await handleTaskReminderRequest(trimmed, memory);
          await finishReply(updatedMemory, historyWithUser, reply, trimmed);
          return;
        }

        const pendingDraft = pendingEmailDraftRef.current;
        if (pendingDraft) {
          if (isSendCancellation(trimmed)) {
            pendingEmailDraftRef.current = null;
            await finishReply(
              memory,
              historyWithUser,
              strings.agent.emailCancelled,
              trimmed,
            );
            return;
          }

          if (isEmailConfirmation(trimmed)) {
            const token = await resolveGoogleToken(
              () => getGoogleAccessToken?.() ?? null,
              refreshGoogleAccessToken,
            );
            if (!token) {
              throw new Error(strings.agent.gmailRequiredSend);
            }
            const sentReply = await trySendPendingEmail(pendingDraft, token);
            pendingEmailDraftRef.current = null;
            await finishReply(memory, historyWithUser, sentReply, trimmed);
            return;
          }

          await finishReply(
            memory,
            historyWithUser,
            strings.agent.pendingEmail,
            trimmed,
          );
          return;
        }

        if (isEmailConfirmation(trimmed) && shouldContinueEmailFlow(memory.conversationHistory)) {
          const token = await resolveGoogleToken(
            () => getGoogleAccessToken?.() ?? null,
            refreshGoogleAccessToken,
          );
          if (token) {
            const sentReply = await trySendEmailAfterConfirmation(
              historyWithUser,
              token,
              memory.name,
            );
            if (sentReply) {
              await finishReply(memory, historyWithUser, sentReply, trimmed);
              return;
            }
          }
        }

        if (
          shouldContinueEmailFlow(memory.conversationHistory) &&
          !isSendCancellation(trimmed)
        ) {
          const token = await resolveGoogleToken(
            () => getGoogleAccessToken?.() ?? null,
            refreshGoogleAccessToken,
          );
          if (token) {
            const continued = await continueEmailConversation(
              historyWithUser,
              token,
              memory.name,
            );
            if (continued) {
              pendingEmailDraftRef.current = continued.draft;
              await finishReply(memory, historyWithUser, continued.previewReply, trimmed);
              return;
            }
          }
        }

        if (looksLikeEmailRequest(trimmed)) {
          const token = await resolveGoogleToken(
            () => getGoogleAccessToken?.() ?? null,
            refreshGoogleAccessToken,
          );
          if (!token) {
            throw new Error(strings.agent.gmailRequiredEmail);
          }

          const { draft } = await prepareEmailDraft(trimmed, token, memory.name);
          const sentReply = await trySendPendingEmail(draft, token);
          pendingEmailDraftRef.current = null;
          await finishReply(memory, historyWithUser, sentReply, trimmed);
          return;
        }

        if (looksLikeSickDayRequest(trimmed)) {
          const token = await resolveGoogleToken(
            () => getGoogleAccessToken?.() ?? null,
            refreshGoogleAccessToken,
          );
          try {
            const { reply, sickUntil } = await handleSickDayRequest(
              trimmed,
              token,
              memory.name,
              userIdRef.current,
            );
            pendingSickDayRef.current = null;
            const updatedMemory: UserMemory = { ...memory, sickUntil };
            await finishReply(updatedMemory, historyWithUser, reply, trimmed);
            if (memory.meetingRemindersEnabled) {
              void refreshReminders(updatedMemory);
            }
          } catch (sickError) {
            const msg =
              sickError instanceof Error
                ? sickError.message
                : 'Kunde inte hantera sjukanmälan just nu.';
            await finishReply(memory, historyWithUser, msg, trimmed);
          }
          return;
        }

        const googleToken = await resolveGoogleToken(
          () => getGoogleAccessToken?.() ?? null,
          refreshGoogleAccessToken,
        );

        const emailReadAnswer = googleToken
          ? await promiseWithTimeout(answerEmailReadQuestion(trimmed, googleToken), 6000, null)
          : null;
        if (emailReadAnswer) {
          await finishReply(memory, historyWithUser, emailReadAnswer, trimmed);
          return;
        }

        const calendarAnswer = await promiseWithTimeout(
          answerCalendarQuestion(trimmed),
          3000,
          null,
        );
        if (calendarAnswer) {
          await finishReply(memory, historyWithUser, calendarAnswer, trimmed);
          return;
        }

        const [meetingContext, emailContext] = await Promise.all([
          promiseWithTimeout(getUpcomingMeetingsSummary(7), 4000, strings.agent.calendarLoadError),
          googleToken
            ? promiseWithTimeout(getInboxSummaryForAgent(googleToken), 6000, strings.agent.gmailLoadError)
            : Promise.resolve(strings.agent.gmailNotConnected),
        ]);

        const systemPrompt = buildSystemPrompt(memory, meetingContext, emailContext, locale);
        const reply = await generateAssistantReply(
          systemPrompt,
          memory.conversationHistory,
          trimmed,
        );

        await finishReply(memory, historyWithUser, reply, trimmed);
      } catch (error) {
        const raw =
          error instanceof Error ? error.message : strings.agent.genericError;
        const { display, speak: speakText } = toUserFacingGeminiError(raw);

        setTranscript((prev) => [
          ...prev.filter((e) => e.id !== 'thinking'),
          { id: `error-${Date.now()}`, role: 'system', text: display },
        ]);
        setIsThinking(false);
        speak(speakText);
      }
    },
    [memory, isThinking, speak, finishReply, locale, strings, t],
  );

  const clearHistory = useCallback(async () => {
    pendingEmailDraftRef.current = null;
    pendingCalendarBookingRef.current = null;
    const updated = await clearConversationHistory(userIdRef.current);
    setMemory(updated);
    setTranscript(historyToTranscript([], strings.welcome.default));
  }, [strings.welcome.default]);

  const toggleTaskDone = useCallback(
    async (taskId: string) => {
      if (!memory) return;
      const uid = userIdRef.current;
      const tasks = memory.tasks.map((t) =>
        t.id === taskId ? { ...t, done: !t.done } : t,
      );
      const updated: UserMemory = { ...memory, tasks };
      await saveMemory(updated, uid);
      setMemory(updated);
      const task = tasks.find((t) => t.id === taskId);
      if (task?.done) {
        await cancelTaskReminder(taskId);
      }
    },
    [memory],
  );

  const addTask = useCallback(
    async (text: string, remindAt?: number) => {
      if (!memory) return;
      const uid = userIdRef.current;
      const trimmed = text.trim();
      if (!trimmed) return;

      const task: AgentTask = {
        id: `task-${Date.now()}`,
        text: trimmed,
        createdAt: Date.now(),
        remindAt,
        done: false,
      };

      const updated: UserMemory = {
        ...memory,
        tasks: [...memory.tasks.filter((t) => !t.done), task].slice(-30),
      };
      await saveMemory(updated, uid);
      setMemory(updated);
      if (remindAt) {
        await scheduleTaskReminder(task, memory.notificationAlertStyle ?? 'sound');
      }
    },
    [memory],
  );

  const deleteTask = useCallback(
    async (taskId: string) => {
      if (!memory) return;
      const uid = userIdRef.current;
      await cancelTaskReminder(taskId);
      const updated: UserMemory = {
        ...memory,
        tasks: memory.tasks.filter((t) => t.id !== taskId),
      };
      await saveMemory(updated, uid);
      setMemory(updated);
    },
    [memory],
  );

  const setListeningState = useCallback((listening: boolean, partial?: string) => {
    if (listening) {
      setTranscript((prev) => {
        const filtered = prev.filter(
          (e) => e.id !== 'listening' && e.id !== 'partial',
        );
        if (partial?.trim()) {
          return [
            ...filtered,
            { id: 'partial', role: 'user', text: partial.trim() },
          ];
        }
        return [...filtered, { id: 'listening', role: 'system', text: strings.common.listening }];
      });
    } else {
      setTranscript((prev) =>
        prev.filter(
          (e) => e.id !== 'listening' && e.id !== 'partial',
        ),
      );
    }
  }, [strings.common.listening]);

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

  const updateNotificationAlertStyle = useCallback(
    async (style: NotificationAlertStyle) => {
      if (!memory) return;
      const uid = userIdRef.current;
      const updated: UserMemory = { ...memory, notificationAlertStyle: style };
      setNotificationAlertStyle(style);
      await saveMemory(updated, uid);
      setMemory(updated);
      await refreshReminders(updated);
      for (const task of updated.tasks) {
        if (!task.done && task.remindAt && task.remindAt > Date.now()) {
          await scheduleTaskReminder(task, style);
        }
      }
    },
    [memory, refreshReminders],
  );

  const updateProfilePhoto = useCallback(
    async (profilePhotoUri: string | undefined) => {
      if (!memory) return;
      const uid = userIdRef.current;
      const updated: UserMemory = { ...memory, profilePhotoUri };
      await saveMemory(updated, uid);
      setMemory(updated);
    },
    [memory],
  );

  const triggerSickDay = useCallback(
    async (message = 'Jag är sjuk') => {
      await sendMessage(message);
    },
    [sendMessage],
  );

  return {
    memory,
    transcript,
    isLoading,
    isThinking,
    showOnboarding,
    completeOnboarding,
    sendMessage,
    triggerSickDay,
    clearHistory,
    setListeningState,
    speak,
    syncReminders,
    updateMeetingReminders,
    updateNotificationAlertStyle,
    updateProfilePhoto,
    toggleTaskDone,
    addTask,
    deleteTask,
  };
}
