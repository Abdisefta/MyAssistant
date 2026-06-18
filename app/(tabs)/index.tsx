import { Ionicons } from '@expo/vector-icons';
import { useCallback, useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { AuthScreen } from '@/components/auth-screen';
import { AssistantScreen } from '@/components/assistant-screen';
import { CalendarTab } from '@/components/calendar-tab';
import { EmailTab } from '@/components/email-tab';
import GoogleLogin from '@/components/GoogleLogin';
import { OnboardingModal } from '@/components/onboarding-modal';
import { TasksTab } from '@/components/tasks-tab';
import { APP_COLORS as COLORS } from '@/constants/app-theme';
import { useAssistant } from '@/hooks/use-assistant';
import { useAppAuth } from '@/hooks/use-app-auth';
import { useVoiceInput } from '@/hooks/use-voice-input';
import {
  signOutApp,
  type AppUser,
} from '@/services/app-auth';
import {
  getGoogleSession,
  refreshGoogleAccessToken,
  signOutGoogle,
  type GoogleUserSession,
} from '@/services/google-auth';

type TabId = 'email' | 'kalender' | 'assistent' | 'uppgifter' | 'installningar';

const TABS: {
  id: TabId;
  label: string;
  icon: React.ComponentProps<typeof Ionicons>['name'];
}[] = [
  { id: 'email', label: 'Email', icon: 'mail-outline' },
  { id: 'kalender', label: 'Kalender', icon: 'calendar-outline' },
  { id: 'assistent', label: 'Assistent', icon: 'mic-outline' },
  { id: 'uppgifter', label: 'Uppgifter', icon: 'checkbox-outline' },
  { id: 'installningar', label: 'Inställningar', icon: 'settings-outline' },
];

function PlaceholderTab({
  title,
  icon,
}: {
  title: string;
  icon: React.ComponentProps<typeof Ionicons>['name'];
}) {
  return (
    <View style={styles.placeholder}>
      <View style={styles.placeholderIconWrap}>
        <Ionicons name={icon} size={36} color={COLORS.purple} />
      </View>
      <Text style={styles.placeholderTitle}>{title}</Text>
      <Text style={styles.placeholderSubtitle}>Kommer snart</Text>
    </View>
  );
}

function SettingsTab({
  memory,
  appUser,
  googleUser,
  onClearHistory,
  onAppLogout,
  onGoogleLogout,
  onToggleMeetingReminders,
}: {
  memory: ReturnType<typeof useAssistant>['memory'];
  appUser: AppUser | null;
  googleUser: GoogleUserSession | null;
  onClearHistory: () => void;
  onAppLogout: () => void;
  onGoogleLogout: () => void;
  onToggleMeetingReminders: (enabled: boolean) => void;
}) {
  if (!memory) return null;

  const providerLabel =
    appUser?.provider === 'google'
      ? 'Google'
      : appUser?.provider === 'apple'
        ? 'Apple'
        : appUser?.provider === 'facebook'
          ? 'Facebook'
          : appUser?.provider === 'microsoft'
            ? 'Microsoft'
            : appUser?.provider === 'email'
              ? 'E-post'
              : '—';

  return (
    <ScrollView style={styles.settingsScroll} contentContainerStyle={styles.settingsContent}>
      <Text style={styles.settingsTitle}>Inställningar</Text>

      {appUser ? (
        <>
          <Text style={styles.settingsSection}>App-konto</Text>
          <View style={styles.settingsCard}>
            <Text style={styles.settingsLabel}>Inloggad som</Text>
            <Text style={styles.settingsValue}>
              {appUser.displayName || appUser.email || '—'}
            </Text>
            <Text style={styles.settingsLabel}>Inloggning via</Text>
            <Text style={styles.settingsValue}>{providerLabel}</Text>
            <Pressable
              style={[styles.clearButton, { marginTop: 10, marginBottom: 0 }]}
              onPress={onAppLogout}
            >
              <Ionicons name="log-out-outline" size={18} color={COLORS.purple} />
              <Text style={styles.clearButtonText}>Logga ut från appen</Text>
            </Pressable>
          </View>
        </>
      ) : null}

      <Text style={styles.settingsSection}>Google Mail</Text>
      {googleUser ? (
        <View style={styles.settingsCard}>
          <Text style={styles.settingsLabel}>Inloggad som</Text>
          <Text style={styles.settingsValue}>{googleUser.email || googleUser.name || '—'}</Text>
          <Pressable style={[styles.clearButton, { marginTop: 10, marginBottom: 0 }]} onPress={onGoogleLogout}>
            <Ionicons name="log-out-outline" size={18} color={COLORS.purple} />
            <Text style={styles.clearButtonText}>Logga ut från Google</Text>
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
            <Text style={styles.clearButtonText}>Rensa Google-behörighet</Text>
          </Pressable>
        </View>
      ) : (
        <View style={styles.settingsCard}>
          <Text style={styles.settingsMuted}>Inte inloggad med Google</Text>
        </View>
      )}

      <Text style={styles.settingsSection}>Profil</Text>
      <View style={styles.settingsCard}>
        <Text style={styles.settingsLabel}>Namn</Text>
        <Text style={styles.settingsValue}>{memory.name || '—'}</Text>
        <Text style={styles.settingsLabel}>Yrke</Text>
        <Text style={styles.settingsValue}>{memory.job || '—'}</Text>
      </View>

      <Text style={styles.settingsSection}>Assistent</Text>
      <View style={styles.settingsCard}>
        <Text style={styles.settingsLabel}>Mötesnotiser</Text>
        <Text style={styles.settingsValue}>
          {memory.meetingRemindersEnabled
            ? `På — ${memory.reminderMinutesBefore} min innan möte`
            : 'Av'}
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
            {memory.meetingRemindersEnabled ? 'Stäng av mötesnotiser' : 'Aktivera mötesnotiser'}
          </Text>
        </Pressable>
        <Text style={[styles.settingsMuted, { marginTop: 8 }]}>
          Assistenten sparar notiser och kan läsa upp dem när ett möte närmar sig.
        </Text>
      </View>

      <Text style={styles.settingsSection}>Preferenser</Text>
      <View style={styles.settingsCard}>
        {memory.preferences.length === 0 ? (
          <Text style={styles.settingsMuted}>Inga preferenser ännu</Text>
        ) : (
          memory.preferences.map((pref, i) => (
            <Text key={i} style={styles.settingsListItem}>• {pref}</Text>
          ))
        )}
      </View>

      <Text style={styles.settingsSection}>Personligt minne</Text>
      <View style={styles.settingsCard}>
        {memory.personalNotes.length === 0 ? (
          <Text style={styles.settingsMuted}>Assistenten lär sig mer ju mer du pratar</Text>
        ) : (
          memory.personalNotes.map((note, i) => (
            <Text key={i} style={styles.settingsListItem}>• {note}</Text>
          ))
        )}
      </View>

      <Text style={styles.settingsSection}>
        Konversationer ({memory.conversationHistory.length} meddelanden)
      </Text>
      <Pressable style={styles.clearButton} onPress={onClearHistory}>
        <Ionicons name="trash-outline" size={18} color={COLORS.purple} />
        <Text style={styles.clearButtonText}>Rensa konversationshistorik</Text>
      </Pressable>
    </ScrollView>
  );
}

export default function HomeScreen() {
  const { user: appUser, isLoading: authLoading, isConfigured: authConfigured } = useAppAuth();
  const userId = appUser?.uid;

  const {
    memory,
    transcript,
    isLoading,
    isThinking,
    showOnboarding,
    completeOnboarding,
    sendMessage,
    clearHistory,
    setListeningState,
    syncReminders,
    updateMeetingReminders,
  } = useAssistant(userId);

  const [activeTab, setActiveTab] = useState<TabId>('assistent');
  const [inputText, setInputText] = useState('');
  const [googleUser, setGoogleUser] = useState<GoogleUserSession | null>(null);
  const [composeOpen, setComposeOpen] = useState(false);
  const hideNavBar = composeOpen;

  const voice = useVoiceInput({
    onFinalResult: (text) => sendMessage(text),
    enabled: !isThinking,
  });

  useEffect(() => {
    getGoogleSession().then((session) => {
      if (session) setGoogleUser(session);
    });
  }, []);

  useEffect(() => {
    if (memory) syncReminders();
  }, [memory, syncReminders]);

  useEffect(() => {
    if (voice.isListening) {
      setListeningState(true, voice.partialText || undefined);
    }
  }, [voice.isListening, voice.partialText, setListeningState]);

  const handleAppLogout = useCallback(async () => {
    await signOutGoogle();
    setGoogleUser(null);
    await signOutApp();
  }, []);

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

  const handleSend = useCallback(() => {
    if (!inputText.trim() || isThinking) return;
    sendMessage(inputText);
    setInputText('');
  }, [inputText, isThinking, sendMessage]);

  const handleMicPressIn = async () => {
    if (isThinking) return;
    setListeningState(true);
    await voice.startListening();
  };

  const handleMicPressOut = () => {
    voice.stopListening();
    setListeningState(false);
  };

  const renderContent = () => {
    if (isLoading) {
      return (
        <View style={styles.loadingWrap}>
          <ActivityIndicator size="large" color={COLORS.purple} />
          <Text style={styles.loadingText}>Laddar minne...</Text>
        </View>
      );
    }

    switch (activeTab) {
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
          : <GoogleLogin onLogin={setGoogleUser} />;
      case 'kalender':
        return <CalendarTab />;
      case 'uppgifter':
        return <TasksTab />;
      case 'installningar':
        return (
          <SettingsTab
            memory={memory}
            appUser={appUser}
            googleUser={googleUser}
            onClearHistory={clearHistory}
            onAppLogout={handleAppLogout}
            onGoogleLogout={handleGoogleLogout}
            onToggleMeetingReminders={handleToggleMeetingReminders}
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
            googleAccessToken={googleUser?.accessToken}
            onComposeOpenChange={setComposeOpen}
            onInputChange={setInputText}
            onSend={handleSend}
            onMicPressIn={handleMicPressIn}
            onMicPressOut={handleMicPressOut}
            onOpenEmail={() => setActiveTab('email')}
          />
        );
    }
  };

  if (authConfigured && authLoading) {
    return (
      <SafeAreaView style={styles.container} edges={['top', 'bottom']}>
        <View style={styles.loadingWrap}>
          <ActivityIndicator size="large" color={COLORS.purple} />
          <Text style={styles.loadingText}>Laddar...</Text>
        </View>
      </SafeAreaView>
    );
  }

  if (authConfigured && !appUser) {
    return <AuthScreen isConfigured={true} />;
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
                    {tab.label}
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
    fontSize: 10,
    color: COLORS.textMuted,
  },
  navLabelActive: {
    color: COLORS.purple,
    fontWeight: '600',
  },
});
