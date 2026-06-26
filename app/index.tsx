import { Ionicons } from '@expo/vector-icons';
import { useCallback, useEffect, useLayoutEffect, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { AssistantScreen } from '@/components/assistant-screen';
import { CalendarTab } from '@/components/calendar-tab';
import { EmailTab } from '@/components/email-tab';
import GoogleLogin from '@/components/GoogleLogin';
import { HomeTab } from '@/components/home-tab';
import { OnboardingModal } from '@/components/onboarding-modal';
import { TasksTab } from '@/components/tasks-tab';
import { APP_COLORS as COLORS } from '@/constants/app-theme';
import { APP_VERSION } from '@/constants/app-version';
import { ALMA_TTS_BASE_URL } from '@/constants/alma-tts';
import { useLocale } from '@/contexts/locale-context';
import { useAssistant } from '@/hooks/use-assistant';
import { useAlmaSpeech } from '@/hooks/use-alma-speech';
import { useVoiceInput } from '@/hooks/use-voice-input';
import { stopAssistantSpeech } from '@/services/speech';
import {
  refreshGoogleAccessToken,
  signOutGoogle,
  type GoogleUserSession,
} from '@/services/google-auth';
import { setLocalCalendarUserId, migrateLegacyCalendarEvents } from '@/services/local-calendar-store';
import { bootstrapAppPermissions } from '@/services/app-permissions';
import { recordAppOpen, recordUsageMinute } from '@/services/usage-stats';
import { trackAppLaunch } from '@/services/analytics-sync';
import type { NotificationAlertStyle } from '@/types/memory';

type TabId = 'hem' | 'email' | 'kalender' | 'assistent' | 'uppgifter' | 'installningar';

/** Ingen inloggning tills appen är klar — all data sparas lokalt på telefonen. */
const GUEST_USER_ID = 'local-guest';

const TABS: {
  id: TabId;
  labelKey: 'home' | 'email' | 'calendar' | 'assistant' | 'tasks' | 'settings';
  icon: React.ComponentProps<typeof Ionicons>['name'];
}[] = [
  { id: 'hem', labelKey: 'home', icon: 'home-outline' },
  { id: 'email', labelKey: 'email', icon: 'mail-outline' },
  { id: 'kalender', labelKey: 'calendar', icon: 'calendar-outline' },
  { id: 'assistent', labelKey: 'assistant', icon: 'mic-outline' },
  { id: 'uppgifter', labelKey: 'tasks', icon: 'checkbox-outline' },
  { id: 'installningar', labelKey: 'settings', icon: 'settings-outline' },
];

function PlaceholderTab({
  title,
  icon,
  subtitle,
}: {
  title: string;
  icon: React.ComponentProps<typeof Ionicons>['name'];
  subtitle: string;
}) {
  return (
    <View style={styles.placeholder}>
      <View style={styles.placeholderIconWrap}>
        <Ionicons name={icon} size={36} color={COLORS.purple} />
      </View>
      <Text style={styles.placeholderTitle}>{title}</Text>
      <Text style={styles.placeholderSubtitle}>{subtitle}</Text>
    </View>
  );
}

function SettingsTab({
  memory,
  googleUser,
  onClearHistory,
  onGoogleLogout,
  onToggleMeetingReminders,
  onNotificationAlertStyle,
}: {
  memory: ReturnType<typeof useAssistant>['memory'];
  googleUser: GoogleUserSession | null;
  onClearHistory: () => void;
  onGoogleLogout: () => void;
  onToggleMeetingReminders: (enabled: boolean) => void;
  onNotificationAlertStyle: (style: NotificationAlertStyle) => void;
}) {
  const { strings, t } = useLocale();
  const { speakRaw, isSpeaking, error: ttsError } = useAlmaSpeech();
  if (!memory) return null;

  const alertStyle = memory.notificationAlertStyle ?? 'sound';
  const styleOptions: { id: NotificationAlertStyle; label: string; icon: React.ComponentProps<typeof Ionicons>['name'] }[] = [
    { id: 'sound', label: strings.settings.notificationSound, icon: 'volume-high-outline' },
    { id: 'vibration', label: strings.settings.notificationVibration, icon: 'phone-portrait-outline' },
    { id: 'silent', label: strings.settings.notificationSilent, icon: 'notifications-off-outline' },
  ];

  return (
    <ScrollView style={styles.settingsScroll} contentContainerStyle={styles.settingsContent}>
      <Text style={styles.settingsTitle}>{strings.settings.title}</Text>

      <Text style={styles.settingsSection}>{strings.settings.app}</Text>
      <View style={styles.settingsCard}>
        <Text style={styles.settingsLabel}>Appversion</Text>
        <Text style={styles.settingsValue}>{APP_VERSION}</Text>
        <Text style={styles.settingsMuted}>
          Rätt version har Lägg till, papperskorg och Jag är sjuk på Hem.
        </Text>
      </View>
      <View style={styles.settingsCard}>
        <Text style={styles.settingsLabel}>{strings.settings.mode}</Text>
        <Text style={styles.settingsValue}>{strings.settings.testMode}</Text>
        <Text style={styles.settingsMuted}>{strings.settings.testModeDesc}</Text>
      </View>

      <Text style={styles.settingsSection}>{strings.settings.language}</Text>
      <View style={styles.settingsCard}>
        <Text style={styles.settingsLabel}>{strings.settings.languageAuto}</Text>
        <Text style={styles.settingsValue}>{strings.localeName}</Text>
      </View>

      <Text style={styles.settingsSection}>{strings.settings.googleMail}</Text>
      {googleUser ? (
        <View style={styles.settingsCard}>
          <Text style={styles.settingsLabel}>{strings.settings.loggedInAs}</Text>
          <Text style={styles.settingsValue}>{googleUser.email || googleUser.name || '—'}</Text>
          <Pressable style={[styles.clearButton, { marginTop: 10, marginBottom: 0 }]} onPress={onGoogleLogout}>
            <Ionicons name="log-out-outline" size={18} color={COLORS.purple} />
            <Text style={styles.clearButtonText}>{strings.settings.logoutGoogle}</Text>
          </Pressable>
          <Pressable
            style={[styles.clearButton, { marginTop: 8, marginBottom: 0 }]}
            onPress={async () => {
              const { resetGoogleAccess } = await import('@/services/google-auth');
              await resetGoogleAccess();
              onGoogleLogout();
            }}
          >
            <Ionicons name="refresh-outline" size={18} color={COLORS.purple} />
            <Text style={styles.clearButtonText}>{strings.settings.clearGoogle}</Text>
          </Pressable>
        </View>
      ) : (
        <View style={styles.settingsCard}>
          <Text style={styles.settingsMuted}>{strings.settings.notLoggedInGoogle}</Text>
        </View>
      )}

      <Text style={styles.settingsSection}>{strings.settings.profile}</Text>
      <View style={styles.settingsCard}>
        <Text style={styles.settingsLabel}>{strings.settings.name}</Text>
        <Text style={styles.settingsValue}>{memory.name || '—'}</Text>
        <Text style={styles.settingsLabel}>{strings.settings.job}</Text>
        <Text style={styles.settingsValue}>{memory.job || '—'}</Text>
      </View>

      <Text style={styles.settingsSection}>{strings.tabs.assistant}</Text>
      <View style={styles.settingsCard}>
        <Text style={styles.settingsLabel}>Alma TTS</Text>
        <Text style={styles.settingsMuted}>{ALMA_TTS_BASE_URL}</Text>
        <Pressable
          style={[styles.clearButton, { marginTop: 10, marginBottom: 0 }]}
          onPress={() => void speakRaw('Hej! Det här är Alma.')}
          disabled={isSpeaking}
        >
          {isSpeaking ? (
            <ActivityIndicator color={COLORS.purple} size="small" />
          ) : (
            <Ionicons name="volume-high-outline" size={18} color={COLORS.purple} />
          )}
          <Text style={styles.clearButtonText}>Testa Alma-röst</Text>
        </Pressable>
        {ttsError ? (
          <Text style={[styles.settingsMuted, { marginTop: 8, color: '#FFB4B4' }]}>{ttsError}</Text>
        ) : null}
      </View>
      <View style={styles.settingsCard}>
        <Text style={styles.settingsLabel}>{strings.settings.meetingReminders}</Text>
        <Text style={styles.settingsValue}>
          {memory.meetingRemindersEnabled
            ? t('settings.remindersOn', { minutes: memory.reminderMinutesBefore })
            : strings.settings.remindersOff}
        </Text>
        <Pressable
          style={[styles.clearButton, { marginTop: 10, marginBottom: 0 }]}
          onPress={() => onToggleMeetingReminders(!memory.meetingRemindersEnabled)}
        >
          <Ionicons
            name={memory.meetingRemindersEnabled ? 'notifications-off-outline' : 'notifications-outline'}
            size={18}
            color={COLORS.purple}
          />
          <Text style={styles.clearButtonText}>
            {memory.meetingRemindersEnabled
              ? strings.settings.disableReminders
              : strings.settings.enableReminders}
          </Text>
        </Pressable>
        <Text style={[styles.settingsMuted, { marginTop: 8 }]}>{strings.settings.remindersHint}</Text>
      </View>

      <View style={styles.settingsCard}>
        <Text style={styles.settingsLabel}>{strings.settings.notificationStyle}</Text>
        <View style={styles.notifyStyleRow}>
          {styleOptions.map((option) => {
            const selected = alertStyle === option.id;
            return (
              <Pressable
                key={option.id}
                style={[styles.notifyStyleChip, selected && styles.notifyStyleChipActive]}
                onPress={() => onNotificationAlertStyle(option.id)}
              >
                <Ionicons
                  name={option.icon}
                  size={16}
                  color={selected ? COLORS.text : COLORS.purple}
                />
                <Text style={[styles.notifyStyleChipText, selected && styles.notifyStyleChipTextActive]}>
                  {option.label}
                </Text>
              </Pressable>
            );
          })}
        </View>
        <Text style={[styles.settingsMuted, { marginTop: 8 }]}>{strings.settings.notificationStyleHint}</Text>
      </View>

      <Text style={styles.settingsSection}>{strings.settings.preferences}</Text>
      <View style={styles.settingsCard}>
        {memory.preferences.length === 0 ? (
          <Text style={styles.settingsMuted}>{strings.settings.noPreferences}</Text>
        ) : (
          memory.preferences.map((pref, i) => (
            <Text key={i} style={styles.settingsListItem}>• {pref}</Text>
          ))
        )}
      </View>

      <Text style={styles.settingsSection}>{strings.settings.personalMemory}</Text>
      <View style={styles.settingsCard}>
        {memory.personalNotes.length === 0 ? (
          <Text style={styles.settingsMuted}>{strings.settings.noNotes}</Text>
        ) : (
          memory.personalNotes.map((note, i) => (
            <Text key={i} style={styles.settingsListItem}>• {note}</Text>
          ))
        )}
      </View>

      <Text style={styles.settingsSection}>
        {t('settings.conversations', { count: memory.conversationHistory.length })}
      </Text>
      <Pressable style={styles.clearButton} onPress={onClearHistory}>
        <Ionicons name="trash-outline" size={18} color={COLORS.purple} />
        <Text style={styles.clearButtonText}>{strings.settings.clearHistory}</Text>
      </Pressable>
    </ScrollView>
  );
}

export default function HomeScreen() {
  const userId = GUEST_USER_ID;
  const { strings } = useLocale();

  const [activeTab, setActiveTab] = useState<TabId>('hem');
  const [inputText, setInputText] = useState('');
  const [googleUser, setGoogleUser] = useState<GoogleUserSession | null>(null);
  const [composeOpen, setComposeOpen] = useState(false);
  const hideNavBar = composeOpen;

  const googleUserRef = useRef<GoogleUserSession | null>(null);
  googleUserRef.current = googleUser;
  const pendingAssistantPrompt = useRef<string | null>(null);

  const refreshGoogleAccess = useCallback(async (): Promise<string | null> => {
    const token = await refreshGoogleAccessToken();
    if (token) {
      setGoogleUser((prev) => (prev ? { ...prev, accessToken: token } : null));
      return token;
    }
    return null;
  }, []);

  const {
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
    syncReminders,
    updateMeetingReminders,
    updateNotificationAlertStyle,
    updateProfilePhoto,
    toggleTaskDone,
    addTask,
    deleteTask,
  } = useAssistant(userId, {
    getGoogleAccessToken: () => googleUserRef.current?.accessToken ?? null,
    refreshGoogleAccessToken: refreshGoogleAccess,
  });

  const voice = useVoiceInput({
    onFinalResult: (text) => sendMessage(text),
    enabled: !isThinking,
  });

  useLayoutEffect(() => {
    setLocalCalendarUserId(GUEST_USER_ID);
    void migrateLegacyCalendarEvents(GUEST_USER_ID);
    void bootstrapAppPermissions();
    void recordAppOpen(GUEST_USER_ID);
    void trackAppLaunch();
  }, []);

  useEffect(() => {
    const timer = setInterval(() => {
      void recordUsageMinute(GUEST_USER_ID);
    }, 60_000);
    return () => clearInterval(timer);
  }, []);

  useEffect(() => {
    if (activeTab !== 'assistent' || !pendingAssistantPrompt.current || !memory || isThinking) {
      return;
    }
    const prompt = pendingAssistantPrompt.current;
    pendingAssistantPrompt.current = null;
    void sendMessage(prompt);
  }, [activeTab, memory, isThinking, sendMessage]);
  useEffect(() => {
    if (!memory) return;
    void syncReminders();
    // eslint-disable-next-line react-hooks/exhaustive-deps -- medvetet: bara när påminnelse-inställning ändras
  }, [memory?.meetingRemindersEnabled, memory?.reminderMinutesBefore]);

  useEffect(() => {
    if (voice.isListening) {
      setListeningState(true, voice.partialText || undefined);
    } else {
      setListeningState(false);
    }
  }, [voice.isListening, voice.partialText, setListeningState]);

  const handleGoogleLogout = useCallback(async () => {
    await signOutGoogle();
    setGoogleUser(null);
  }, []);

  const handleToggleMeetingReminders = useCallback(
    (enabled: boolean) => {
      updateMeetingReminders(enabled);
    },
    [updateMeetingReminders],
  );

  const handleNotificationAlertStyle = useCallback(
    (style: NotificationAlertStyle) => {
      void updateNotificationAlertStyle(style);
    },
    [updateNotificationAlertStyle],
  );

  const handleSend = useCallback(() => {
    if (!inputText.trim() || isThinking) return;
    sendMessage(inputText);
    setInputText('');
  }, [inputText, isThinking, sendMessage]);

  const handleMicPress = useCallback(async () => {
    if (isThinking) return;

    if (voice.isListening) {
      voice.stopListening();
      return;
    }

    stopAssistantSpeech();
    setListeningState(true);
    await voice.startListening();
  }, [isThinking, voice, setListeningState]);

  const handleQuickPhrase = useCallback(
    (phrase: string) => {
      stopAssistantSpeech();
      sendMessage(phrase);
    },
    [sendMessage],
  );

  const handleSickDayFromHome = useCallback(() => {
    Alert.alert(
      'Är du säker på detta?',
      'Alla dagens möten avbokas och deltagarna får mail om att du är sjuk.',
      [
        { text: 'Avbryt', style: 'cancel' },
        {
          text: 'Ja, jag är sjuk',
          style: 'destructive',
          onPress: () => {
            setActiveTab('assistent');
            void triggerSickDay('Jag är sjuk');
          },
        },
      ],
    );
  }, [triggerSickDay]);

  const handleOpenAssistantWithPrompt = useCallback((prompt: string) => {
    pendingAssistantPrompt.current = prompt;
    setActiveTab('assistent');
  }, []);

  const renderContent = () => {
    const memoryStillLoading = isLoading && !memory;

    if (memoryStillLoading && (activeTab === 'assistent' || activeTab === 'uppgifter')) {
      return (
        <View style={styles.loadingWrap}>
          <ActivityIndicator size="large" color={COLORS.purple} />
          <Text style={styles.loadingText}>{strings.common.loadingMemory}</Text>
        </View>
      );
    }

    switch (activeTab) {
      case 'hem':
        return (
          <HomeTab
            userId={GUEST_USER_ID}
            userName={memory?.name}
            userJob={memory?.job}
            profilePhotoUri={memory?.profilePhotoUri}
            onProfilePhotoChange={(uri) => void updateProfilePhoto(uri)}
            tasks={memory?.tasks ?? []}
            googleAccessToken={googleUser?.accessToken}
            onOpenAssistant={() => setActiveTab('assistent')}
            onOpenAssistantWithPrompt={handleOpenAssistantWithPrompt}
            onOpenCalendar={() => setActiveTab('kalender')}
            onOpenEmail={() => setActiveTab('email')}
            onOpenTasks={() => setActiveTab('uppgifter')}
            onSickDay={handleSickDayFromHome}
            isSickDayBusy={isThinking}
          />
        );
      case 'email':
        return googleUser
          ? (
            <EmailTab
              accessToken={googleUser.accessToken}
              onSessionExpired={handleGoogleLogout}
              onRefreshToken={async () => {
                const token = await refreshGoogleAccessToken();
                if (token) {
                  setGoogleUser((prev) => (prev ? { ...prev, accessToken: token } : null));
                  return token;
                }
                await handleGoogleLogout();
                return null;
              }}
            />
          )
          : <GoogleLogin />;
      case 'kalender':
        return <CalendarTab userId={GUEST_USER_ID} />;
      case 'uppgifter':
        return (
          <TasksTab
            tasks={memory?.tasks ?? []}
            onToggleTask={toggleTaskDone}
            onAddTask={addTask}
            onDeleteTask={deleteTask}
          />
        );
      case 'installningar':
        return (
          <SettingsTab
            memory={memory}
            googleUser={googleUser}
            onClearHistory={clearHistory}
            onGoogleLogout={handleGoogleLogout}
            onToggleMeetingReminders={handleToggleMeetingReminders}
            onNotificationAlertStyle={handleNotificationAlertStyle}
          />
        );
      default:
        return (
          <AssistantScreen
            memoryName={memory?.name}
            memoryJob={memory?.job}
            transcript={transcript}
            isThinking={isThinking}
            inputText={inputText}
            isListening={voice.isListening}
            onComposeOpenChange={setComposeOpen}
            onInputChange={setInputText}
            onSend={handleSend}
            onMicPress={handleMicPress}
            onQuickPhrase={handleQuickPhrase}
          />
        );
    }
  };

  if (isLoading && !memory && (activeTab === 'assistent' || activeTab === 'uppgifter')) {
    return (
      <SafeAreaView style={styles.container} edges={['top', 'bottom']}>
        <View style={styles.loadingWrap}>
          <ActivityIndicator size="large" color={COLORS.purple} />
          <Text style={styles.loadingText}>{strings.common.loading}</Text>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <View style={styles.content}>{renderContent()}</View>

      {!hideNavBar && (
        <SafeAreaView edges={['bottom']} style={styles.navSafe}>
          <View style={styles.navbar}>
            {TABS.map((tab) => {
              const isActive = activeTab === tab.id;
              return (
                <TouchableOpacity
                  key={tab.id}
                  style={styles.navItem}
                  onPress={() => setActiveTab(tab.id)}
                  activeOpacity={0.7}
                >
                  <View style={[styles.navIconWrap, isActive && styles.navIconWrapActive]}>
                    <Ionicons
                      name={tab.icon}
                      size={20}
                      color={isActive ? COLORS.purple : COLORS.textMuted}
                    />
                  </View>
                  <Text style={[styles.navLabel, isActive && styles.navLabelActive]}>
                    {strings.tabs[tab.labelKey]}
                  </Text>
                </TouchableOpacity>
              );
            })}
          </View>
        </SafeAreaView>
      )}

      <OnboardingModal
        visible={showOnboarding}
        isSubmitting={isThinking}
        initialName={googleUser?.name?.split(' ')[0] ?? ''}
        onComplete={completeOnboarding}
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: COLORS.background,
  },
  content: {
    flex: 1,
  },
  loadingWrap: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 12,
  },
  loadingText: {
    color: COLORS.textMuted,
    fontSize: 14,
  },
  placeholder: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 12,
    paddingHorizontal: 24,
  },
  placeholderIconWrap: {
    width: 72,
    height: 72,
    borderRadius: 36,
    backgroundColor: COLORS.purpleMuted,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: 'rgba(139, 124, 247, 0.25)',
  },
  placeholderTitle: {
    fontSize: 22,
    fontWeight: '600',
    color: COLORS.text,
  },
  placeholderSubtitle: {
    fontSize: 14,
    color: COLORS.textMuted,
  },
  settingsScroll: {
    flex: 1,
  },
  settingsContent: {
    padding: 20,
    paddingTop: 12,
    gap: 8,
  },
  settingsTitle: {
    fontSize: 22,
    fontWeight: '600',
    color: COLORS.text,
    marginBottom: 8,
  },
  settingsSection: {
    fontSize: 12,
    fontWeight: '600',
    color: COLORS.purple,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    marginTop: 8,
  },
  settingsCard: {
    backgroundColor: COLORS.surface,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: COLORS.border,
    padding: 14,
    gap: 4,
  },
  settingsLabel: {
    fontSize: 11,
    color: COLORS.textMuted,
    marginTop: 6,
  },
  settingsValue: {
    fontSize: 16,
    color: COLORS.text,
  },
  settingsMuted: {
    fontSize: 14,
    color: COLORS.textMuted,
  },
  settingsListItem: {
    fontSize: 14,
    color: COLORS.text,
    lineHeight: 22,
  },
  clearButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    padding: 14,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: 'rgba(139, 124, 247, 0.3)',
    backgroundColor: COLORS.purpleMuted,
    marginTop: 8,
    marginBottom: 20,
  },
  clearButtonText: {
    color: COLORS.purple,
    fontSize: 14,
    fontWeight: '500',
  },
  notifyStyleRow: {
    flexDirection: 'row',
    gap: 8,
    marginTop: 10,
  },
  notifyStyleChip: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 4,
    paddingVertical: 10,
    paddingHorizontal: 6,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: COLORS.border,
    backgroundColor: COLORS.background,
  },
  notifyStyleChipActive: {
    backgroundColor: COLORS.purple,
    borderColor: COLORS.purple,
  },
  notifyStyleChipText: {
    fontSize: 11,
    fontWeight: '600',
    color: COLORS.purple,
    textAlign: 'center',
  },
  notifyStyleChipTextActive: {
    color: COLORS.text,
  },
  navSafe: {
    backgroundColor: COLORS.background,
  },
  navbar: {
    flexDirection: 'row',
    borderTopWidth: 1,
    borderTopColor: COLORS.border,
    paddingTop: 8,
    paddingHorizontal: 4,
    backgroundColor: COLORS.background,
  },
  navItem: {
    flex: 1,
    alignItems: 'center',
    gap: 4,
    paddingVertical: 4,
  },
  navIconWrap: {
    width: 36,
    height: 28,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 14,
  },
  navIconWrapActive: {
    backgroundColor: COLORS.purpleMuted,
  },
  navLabel: {
    fontSize: 9,
    color: COLORS.textMuted,
  },
  navLabelActive: {
    color: COLORS.purple,
    fontWeight: '600',
  },
});
