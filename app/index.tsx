import { Ionicons } from '@expo/vector-icons';
import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Linking,
  Modal,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import { Gesture, GestureDetector } from 'react-native-gesture-handler';
import { SafeAreaView } from 'react-native-safe-area-context';

import { AssistantScreen } from '@/components/assistant-screen';
import { AppToast } from '@/components/app-toast';
import { AuthScreen } from '@/components/auth-screen';
import { CalendarTab } from '@/components/calendar-tab';
import { EmailTab } from '@/components/email-tab';
import GoogleLogin from '@/components/GoogleLogin';
import { HomeTab } from '@/components/home-tab';
import { OnboardingModal } from '@/components/onboarding-modal';
import { UpgradeModal } from '@/components/upgrade-modal';
import { WhatsNewModal } from '@/components/whats-new-modal';
import { LegalModal } from '@/components/legal-modal';
import { TasksTab } from '@/components/tasks-tab';
import { APP_COLORS as COLORS } from '@/constants/app-theme';
import { APP_VERSION } from '@/constants/app-version';
import {
  DESKTOP_MAX_CONTENT_WIDTH,
  DESKTOP_SIDEBAR_WIDTH,
} from '@/constants/desktop-layout';
import { SUPPORT_EMAIL } from '@/constants/app-support';
import { ALMA_TTS_BASE_URL } from '@/constants/alma-tts';
import { isFirebaseConfigured } from '@/constants/firebase';
import { useLocale } from '@/contexts/locale-context';
import { useAssistant } from '@/hooks/use-assistant';
import { useAlmaSpeech } from '@/hooks/use-alma-speech';
import { useIsDesktop } from '@/hooks/use-is-desktop';
import { useVoiceInput } from '@/hooks/use-voice-input';
import { stopAssistantSpeech } from '@/services/speech';
import {
  getGoogleSession,
  refreshGoogleAccessToken,
  signOutGoogle,
  type GoogleUserSession,
} from '@/services/google-auth';
import { setLocalCalendarUserId, migrateLegacyCalendarEvents } from '@/services/local-calendar-store';
import { bootstrapAppPermissions } from '@/services/app-permissions';
import { recordAppOpen, recordUsageMinute } from '@/services/usage-stats';
import { trackAppLaunch, registerTrialEmailWithServer } from '@/services/analytics-sync';
import { onUsageLimitHit, getBudgetStatus, type UsageCheckResult } from '@/services/usage-limits';
import { subscribeToAuth, signOutApp, type AppUser } from '@/services/app-auth';
import { loadBossContact, saveBossContact } from '@/services/boss-contact';
import {
  getLastSeenVersion,
  hasSeenAssistantTip,
  markAssistantTipSeen,
  setLastSeenVersion,
} from '@/services/app-preferences';
import { hapticLight } from '@/utils/haptics';
import {
  PRIVACY_POLICY_SV,
  SUBSCRIPTION_INFO_SV,
  TERMS_OF_SERVICE_SV,
} from '@/constants/legal-sv';
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

function DesktopSidebar({
  activeTab,
  onSelectTab,
  labels,
}: {
  activeTab: TabId;
  onSelectTab: (tabId: TabId) => void;
  labels: Record<(typeof TABS)[number]['labelKey'], string>;
}) {
  return (
    <View style={styles.desktopSidebar}>
      <Text style={styles.desktopSidebarTitle}>My Assistant</Text>
      <View style={styles.desktopSidebarNav}>
        {TABS.map((tab) => {
          const isActive = activeTab === tab.id;
          return (
            <Pressable
              key={tab.id}
              style={[styles.desktopSidebarItem, isActive && styles.desktopSidebarItemActive]}
              onPress={() => onSelectTab(tab.id)}
            >
              <View style={[styles.desktopSidebarIconWrap, isActive && styles.desktopSidebarIconWrapActive]}>
                <Ionicons
                  name={tab.icon}
                  size={22}
                  color={isActive ? COLORS.purple : COLORS.textMuted}
                />
              </View>
              <Text style={[styles.desktopSidebarLabel, isActive && styles.desktopSidebarLabelActive]}>
                {labels[tab.labelKey]}
              </Text>
            </Pressable>
          );
        })}
      </View>
    </View>
  );
}

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

function providerLabel(provider: AppUser['provider']): string {
  if (provider === 'google') return 'Google';
  if (provider === 'apple') return 'Apple';
  return 'E-post';
}

function SettingsTab({
  memory,
  appUser,
  googleUser,
  firebaseConfigured,
  onClearHistory,
  onGoogleLogout,
  onAppLogout,
  onOpenLogin,
  onToggleMeetingReminders,
  onNotificationAlertStyle,
  isDesktop,
}: {
  memory: ReturnType<typeof useAssistant>['memory'];
  appUser: AppUser | null;
  googleUser: GoogleUserSession | null;
  firebaseConfigured: boolean;
  onClearHistory: () => void;
  onGoogleLogout: () => void;
  onAppLogout: () => void;
  onOpenLogin?: () => void;
  onToggleMeetingReminders: (enabled: boolean) => void;
  onNotificationAlertStyle: (style: NotificationAlertStyle) => void;
  isDesktop?: boolean;
}) {
  const { strings, t } = useLocale();
  const { speakRaw, isSpeaking, error: ttsError } = useAlmaSpeech();
  const [legalDoc, setLegalDoc] = useState<'privacy' | 'terms' | 'subscription' | null>(null);
  const [bossName, setBossName] = useState('');
  const [bossEmail, setBossEmail] = useState('');
  const [bossSaved, setBossSaved] = useState(false);
  const [bossSaving, setBossSaving] = useState(false);

  useEffect(() => {
    void loadBossContact().then((contact) => {
      if (!contact) return;
      setBossName(contact.name);
      setBossEmail(contact.email);
    });
  }, []);

  if (!memory) return null;

  const alertStyle = memory.notificationAlertStyle ?? 'sound';
  const styleOptions: { id: NotificationAlertStyle; label: string; icon: React.ComponentProps<typeof Ionicons>['name'] }[] = [
    { id: 'sound', label: strings.settings.notificationSound, icon: 'volume-high-outline' },
    { id: 'vibration', label: strings.settings.notificationVibration, icon: 'phone-portrait-outline' },
    { id: 'silent', label: strings.settings.notificationSilent, icon: 'notifications-off-outline' },
  ];

  const handleSupport = () => {
    void Linking.openURL(`mailto:${SUPPORT_EMAIL}?subject=${encodeURIComponent('My Assistant feedback')}`).catch(
      () => {
        Alert.alert('Kontakta support', `Skicka e-post till ${SUPPORT_EMAIL}`);
      },
    );
  };

  const handleSaveBossContact = async () => {
    const email = bossEmail.trim().toLowerCase();
    if (email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      Alert.alert('Ogiltig e-post', 'Ange en giltig e-postadress till din chef.');
      return;
    }
    setBossSaving(true);
    try {
      await saveBossContact({ name: bossName.trim(), email });
      setBossSaved(true);
      setTimeout(() => setBossSaved(false), 2000);
    } finally {
      setBossSaving(false);
    }
  };

  return (
    <ScrollView
      style={styles.settingsScroll}
      contentContainerStyle={[styles.settingsContent, isDesktop && styles.settingsContentDesktop]}
    >
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

      <Text style={styles.settingsSection}>Sjukfrånvaro</Text>
      <View style={styles.settingsCard}>
        <Text style={styles.settingsMuted}>
          När du trycker &quot;Jag är sjuk&quot; kan assistenten maila din chef automatiskt (kräver Gmail).
        </Text>
        <Text style={styles.settingsLabel}>Din chef</Text>
        <TextInput
          style={styles.settingsInput}
          placeholder="t.ex. Anna Andersson"
          placeholderTextColor={COLORS.textMuted}
          value={bossName}
          onChangeText={setBossName}
          autoCapitalize="words"
          cursorColor={COLORS.purple}
          selectionColor="rgba(139, 124, 247, 0.3)"
          keyboardAppearance="dark"
        />
        <Text style={styles.settingsLabel}>Chefens e-post</Text>
        <TextInput
          style={styles.settingsInput}
          placeholder="chef@foretag.se"
          placeholderTextColor={COLORS.textMuted}
          value={bossEmail}
          onChangeText={setBossEmail}
          autoCapitalize="none"
          autoCorrect={false}
          keyboardType="email-address"
          cursorColor={COLORS.purple}
          selectionColor="rgba(139, 124, 247, 0.3)"
          keyboardAppearance="dark"
        />
        <Pressable
          style={[styles.clearButton, { marginTop: 10, marginBottom: 0 }]}
          onPress={() => void handleSaveBossContact()}
          disabled={bossSaving}
        >
          {bossSaving ? (
            <ActivityIndicator color={COLORS.purple} size="small" />
          ) : (
            <Ionicons name="save-outline" size={18} color={COLORS.purple} />
          )}
          <Text style={styles.clearButtonText}>{bossSaved ? 'Sparat!' : 'Spara chef'}</Text>
        </Pressable>
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

      <Text style={styles.settingsSection}>Abonnemang</Text>
      <View style={styles.settingsCard}>
        <Text style={styles.settingsLabel}>My Assistant Pro</Text>
        <Text style={styles.settingsValue}>199 kr/mån efter 2 mån gratis</Text>
        <Text style={styles.settingsMuted}>
          Betalning via Google Play / App Store aktiveras snart. Gratisperiod gäller automatiskt.
        </Text>
        <Pressable
          style={[styles.clearButton, { marginTop: 10, marginBottom: 0 }]}
          onPress={() => setLegalDoc('subscription')}
        >
          <Ionicons name="card-outline" size={18} color={COLORS.purple} />
          <Text style={styles.clearButtonText}>Läs om abonnemang</Text>
        </Pressable>
      </View>

      <Text style={styles.settingsSection}>Konto</Text>
      <View style={styles.settingsCard}>
        {firebaseConfigured && appUser ? (
          <>
            <Text style={styles.settingsLabel}>Inloggad som</Text>
            <Text style={styles.settingsValue}>
              {appUser.displayName || appUser.email || appUser.uid}
            </Text>
            {appUser.email ? (
              <Text style={styles.settingsMuted}>{appUser.email}</Text>
            ) : null}
            <Text style={styles.settingsMuted}>Via {providerLabel(appUser.provider)}</Text>
            <Pressable
              style={[styles.clearButton, { marginTop: 10, marginBottom: 0 }]}
              onPress={onAppLogout}
            >
              <Ionicons name="log-out-outline" size={18} color={COLORS.purple} />
              <Text style={styles.clearButtonText}>Logga ut</Text>
            </Pressable>
          </>
        ) : (
          <>
            <Text style={styles.settingsMuted}>
              {firebaseConfigured
                ? 'Du är inte inloggad. Appen fungerar i gästläge — logga in för att synka konto i molnet.'
                : 'Lokal gästläge — data sparas på telefonen utan molnkonto.'}
            </Text>
            {firebaseConfigured && onOpenLogin ? (
              <Pressable
                style={[styles.clearButton, { marginTop: 10, marginBottom: 0 }]}
                onPress={onOpenLogin}
              >
                <Ionicons name="log-in-outline" size={18} color={COLORS.purple} />
                <Text style={styles.clearButtonText}>Logga in / Skapa konto</Text>
              </Pressable>
            ) : null}
          </>
        )}
      </View>

      <Text style={styles.settingsSection}>Support</Text>
      <View style={styles.settingsCard}>
        <Text style={styles.settingsLabel}>Kontakta support</Text>
        <Text style={styles.settingsMuted}>
          Frågor, buggar eller idéer? Skicka gärna ett mejl — vi läser allt.
        </Text>
        <Text style={styles.settingsValue}>{SUPPORT_EMAIL}</Text>
        <Pressable
          style={[styles.clearButton, { marginTop: 10, marginBottom: 0 }]}
          onPress={handleSupport}
        >
          <Ionicons name="mail-outline" size={18} color={COLORS.purple} />
          <Text style={styles.clearButtonText}>Skicka e-post</Text>
        </Pressable>
      </View>

      <Text style={styles.settingsSection}>Juridik</Text>
      <View style={styles.settingsCard}>
        <Pressable
          style={[styles.clearButton, { marginTop: 0, marginBottom: 0 }]}
          onPress={() => setLegalDoc('privacy')}
        >
          <Ionicons name="shield-outline" size={18} color={COLORS.purple} />
          <Text style={styles.clearButtonText}>Integritetspolicy</Text>
        </Pressable>
        <Pressable
          style={[styles.clearButton, { marginTop: 8, marginBottom: 0 }]}
          onPress={() => setLegalDoc('terms')}
        >
          <Ionicons name="document-text-outline" size={18} color={COLORS.purple} />
          <Text style={styles.clearButtonText}>Användarvillkor</Text>
        </Pressable>
      </View>

      <Text style={styles.settingsSection}>
        {t('settings.conversations', { count: memory.conversationHistory.length })}
      </Text>
      <Pressable style={styles.clearButton} onPress={onClearHistory}>
        <Ionicons name="trash-outline" size={18} color={COLORS.purple} />
        <Text style={styles.clearButtonText}>{strings.settings.clearHistory}</Text>
      </Pressable>

      <LegalModal
        visible={legalDoc === 'privacy'}
        title="Integritetspolicy"
        body={PRIVACY_POLICY_SV}
        onClose={() => setLegalDoc(null)}
      />
      <LegalModal
        visible={legalDoc === 'terms'}
        title="Användarvillkor"
        body={TERMS_OF_SERVICE_SV}
        onClose={() => setLegalDoc(null)}
      />
      <LegalModal
        visible={legalDoc === 'subscription'}
        title="Abonnemang"
        body={SUBSCRIPTION_INFO_SV}
        onClose={() => setLegalDoc(null)}
      />
    </ScrollView>
  );
}

function MainApp({
  userId,
  appUser,
  onOpenLogin,
}: {
  userId: string;
  appUser: AppUser | null;
  onOpenLogin?: () => void;
}) {
  const firebaseConfigured = isFirebaseConfigured();
  const { strings } = useLocale();
  const isDesktop = useIsDesktop();

  const [activeTab, setActiveTab] = useState<TabId>('hem');
  const [inputText, setInputText] = useState('');
  const [googleUser, setGoogleUser] = useState<GoogleUserSession | null>(null);
  const [composeOpen, setComposeOpen] = useState(false);
  const [upgradeCheck, setUpgradeCheck] = useState<UsageCheckResult | null>(null);
  const [showUpgrade, setShowUpgrade] = useState(false);
  const [showWhatsNew, setShowWhatsNew] = useState(false);
  const [showAssistantTip, setShowAssistantTip] = useState(false);
  const [toastMessage, setToastMessage] = useState<string | null>(null);
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

  const handleBookingSuccess = useCallback((summary: string) => {
    setToastMessage(`Möte bokat: ${summary}`);
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
    onBookingSuccess: handleBookingSuccess,
  });

  const voice = useVoiceInput({
    onFinalResult: (text) => sendMessage(text),
    enabled: !isThinking,
  });

  useLayoutEffect(() => {
    setLocalCalendarUserId(userId);
    void migrateLegacyCalendarEvents(userId);
    void bootstrapAppPermissions();
    void recordAppOpen(userId);
    void trackAppLaunch();
  }, [userId]);

  useEffect(() => {
    void (async () => {
      const session = await getGoogleSession();
      if (session) setGoogleUser(session);
    })();
  }, []);

  useEffect(() => {
    const timer = setInterval(() => {
      void recordUsageMinute(userId);
    }, 60_000);
    return () => clearInterval(timer);
  }, [userId]);

  useEffect(() => {
    return onUsageLimitHit((check) => {
      setUpgradeCheck(check);
      setShowUpgrade(true);
    });
  }, []);

  useEffect(() => {
    void (async () => {
      const status = await getBudgetStatus();
      if (status.level === 'warning' && status.message) {
        setToastMessage(status.message);
      }
      if (status.level === 'blocked' && status.message) {
        setUpgradeCheck({
          allowed: false,
          used: 0,
          limit: 0,
          period: 'blocked',
          message: status.message,
        });
        setShowUpgrade(true);
        return;
      }
      if (status.level === 'exceeded' && status.message) {
        setUpgradeCheck({
          allowed: false,
          used: status.costMonth,
          limit: status.budget,
          period: 'budget',
          message: status.message,
        });
        setShowUpgrade(true);
      }
    })();
  }, [userId]);

  useEffect(() => {
    if (showOnboarding || !memory) return;
    void (async () => {
      const lastSeen = await getLastSeenVersion();
      if (lastSeen !== APP_VERSION) {
        setShowWhatsNew(true);
      }
    })();
  }, [showOnboarding, memory]);

  useEffect(() => {
    if (activeTab !== 'assistent') return;
    void (async () => {
      const seen = await hasSeenAssistantTip();
      if (!seen) setShowAssistantTip(true);
    })();
  }, [activeTab]);

  const dismissWhatsNew = useCallback(() => {
    setShowWhatsNew(false);
    void setLastSeenVersion(APP_VERSION);
  }, []);

  const dismissAssistantTip = useCallback(() => {
    setShowAssistantTip(false);
    void markAssistantTipSeen();
  }, []);

  const tryAssistantTip = useCallback(() => {
    dismissAssistantTip();
    void sendMessage('Boka möte imorgon klockan tio');
  }, [dismissAssistantTip, sendMessage]);

  const switchTab = useCallback((tabId: TabId) => {
    hapticLight();
    setActiveTab(tabId);
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

  const handleAppLogout = useCallback(async () => {
    await signOutApp();
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
            switchTab('assistent');
            void triggerSickDay('Jag är sjuk');
          },
        },
      ],
    );
  }, [triggerSickDay]);

  const handleOpenAssistantWithPrompt = useCallback((prompt: string) => {
    pendingAssistantPrompt.current = prompt;
    switchTab('assistent');
  }, []);

  const tabSwipeGesture = useMemo(
    () =>
      Gesture.Pan()
        .enabled(!isDesktop)
        .activeOffsetX([-32, 32])
        .failOffsetY([-20, 20])
        .runOnJS(true)
        .onEnd((e) => {
          if (composeOpen || isDesktop) return;
          const idx = TABS.findIndex((t) => t.id === activeTab);
          if (e.translationX < -55 && idx < TABS.length - 1) {
            switchTab(TABS[idx + 1].id);
          } else if (e.translationX > 55 && idx > 0) {
            switchTab(TABS[idx - 1].id);
          }
        }),
    [activeTab, composeOpen, isDesktop, switchTab],
  );

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
            userId={userId}
            userName={memory?.name}
            userJob={memory?.job}
            profilePhotoUri={memory?.profilePhotoUri}
            onProfilePhotoChange={(uri) => void updateProfilePhoto(uri)}
            tasks={memory?.tasks ?? []}
            birthdays={memory?.birthdays ?? []}
            googleAccessToken={googleUser?.accessToken}
            onOpenAssistant={() => switchTab('assistent')}
            onOpenAssistantWithPrompt={handleOpenAssistantWithPrompt}
            onOpenCalendar={() => switchTab('kalender')}
            onOpenEmail={() => switchTab('email')}
            onOpenTasks={() => switchTab('uppgifter')}
            onSickDay={handleSickDayFromHome}
            isSickDayBusy={isThinking}
          />
        );
      case 'email':
        return googleUser
          ? (
            <EmailTab
              accessToken={googleUser.accessToken}
              senderName={memory?.name}
              senderJob={memory?.job}
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
          : <GoogleLogin onConnected={setGoogleUser} />;
      case 'kalender':
        return <CalendarTab userId={userId} />;
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
            appUser={appUser}
            googleUser={googleUser}
            firebaseConfigured={firebaseConfigured}
            onClearHistory={clearHistory}
            onGoogleLogout={handleGoogleLogout}
            onAppLogout={handleAppLogout}
            onOpenLogin={onOpenLogin}
            onToggleMeetingReminders={handleToggleMeetingReminders}
            onNotificationAlertStyle={handleNotificationAlertStyle}
            isDesktop={isDesktop}
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
            showTipChip={showAssistantTip}
            onDismissTipChip={dismissAssistantTip}
            onTryTipChip={tryAssistantTip}
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

  const mainContent = (
    <View style={[styles.content, isDesktop && styles.desktopContent]}>
      <View style={[styles.contentInner, isDesktop && styles.desktopContentInner]}>
        {renderContent()}
      </View>
    </View>
  );

  return (
    <SafeAreaView style={styles.container} edges={isDesktop ? ['top', 'bottom'] : ['top']}>
      {isDesktop ? (
        <View style={styles.desktopShell}>
          {!hideNavBar && (
            <DesktopSidebar
              activeTab={activeTab}
              onSelectTab={switchTab}
              labels={strings.tabs}
            />
          )}
          {mainContent}
        </View>
      ) : (
        <>
          <GestureDetector gesture={tabSwipeGesture}>{mainContent}</GestureDetector>
          {!hideNavBar && (
            <SafeAreaView edges={['bottom']} style={styles.navSafe}>
              <View style={styles.navbar}>
                {TABS.map((tab) => {
                  const isActive = activeTab === tab.id;
                  return (
                    <TouchableOpacity
                      key={tab.id}
                      style={styles.navItem}
                      onPress={() => switchTab(tab.id)}
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
        </>
      )}

      <OnboardingModal
        visible={showOnboarding}
        isSubmitting={isThinking}
        initialName={googleUser?.name?.split(' ')[0] ?? ''}
        onComplete={completeOnboarding}
      />
      <WhatsNewModal visible={showWhatsNew} onClose={dismissWhatsNew} />
      <AppToast
        visible={toastMessage !== null}
        message={toastMessage ?? ''}
        onHide={() => setToastMessage(null)}
      />
      <UpgradeModal
        visible={showUpgrade}
        check={upgradeCheck}
        onClose={() => setShowUpgrade(false)}
      />
    </SafeAreaView>
  );
}

export default function HomeScreen() {
  const firebaseConfigured = isFirebaseConfigured();
  const { strings } = useLocale();
  const [authUser, setAuthUser] = useState<AppUser | null>(null);
  const [authReady, setAuthReady] = useState(!firebaseConfigured);
  const [showAuthModal, setShowAuthModal] = useState(false);

  useEffect(() => {
    if (!firebaseConfigured) return;
    return subscribeToAuth((user) => {
      setAuthUser(user);
      setAuthReady(true);
      if (user) {
        setShowAuthModal(false);
        if (user.email) {
          void registerTrialEmailWithServer(user.email, user.uid);
        }
      }
    });
  }, [firebaseConfigured]);

  if (firebaseConfigured && !authReady) {
    return (
      <SafeAreaView style={styles.container} edges={['top', 'bottom']}>
        <View style={styles.loadingWrap}>
          <ActivityIndicator size="large" color={COLORS.purple} />
          <Text style={styles.loadingText}>{strings.common.loading}</Text>
        </View>
      </SafeAreaView>
    );
  }

  const userId = authUser?.uid ?? GUEST_USER_ID;

  return (
    <>
      <MainApp
        userId={userId}
        appUser={authUser}
        onOpenLogin={() => setShowAuthModal(true)}
      />
      <Modal
        visible={showAuthModal}
        animationType="slide"
        presentationStyle="pageSheet"
        onRequestClose={() => setShowAuthModal(false)}
      >
        <AuthScreen
          isConfigured={firebaseConfigured}
          asModal
          onClose={() => setShowAuthModal(false)}
          onContinueAsGuest={() => setShowAuthModal(false)}
        />
      </Modal>
    </>
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
  contentInner: {
    flex: 1,
  },
  desktopShell: {
    flex: 1,
    flexDirection: 'row',
  },
  desktopContent: {
    flex: 1,
    paddingHorizontal: 24,
    paddingVertical: 8,
  },
  desktopContentInner: {
    flex: 1,
    width: '100%',
    maxWidth: DESKTOP_MAX_CONTENT_WIDTH,
    alignSelf: 'center',
  },
  desktopSidebar: {
    width: DESKTOP_SIDEBAR_WIDTH,
    backgroundColor: COLORS.surface,
    borderRightWidth: 1,
    borderRightColor: COLORS.border,
    paddingTop: 16,
    paddingHorizontal: 12,
    paddingBottom: 12,
  },
  desktopSidebarTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: COLORS.text,
    paddingHorizontal: 12,
    marginBottom: 20,
  },
  desktopSidebarNav: {
    gap: 4,
  },
  desktopSidebarItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingVertical: 10,
    paddingHorizontal: 12,
    borderRadius: 12,
  },
  desktopSidebarItemActive: {
    backgroundColor: COLORS.purpleMuted,
  },
  desktopSidebarIconWrap: {
    width: 36,
    height: 36,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 10,
  },
  desktopSidebarIconWrapActive: {
    backgroundColor: 'rgba(139, 124, 247, 0.25)',
  },
  desktopSidebarLabel: {
    fontSize: 15,
    color: COLORS.textMuted,
    fontWeight: '500',
  },
  desktopSidebarLabelActive: {
    color: COLORS.purple,
    fontWeight: '600',
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
  settingsContentDesktop: {
    paddingHorizontal: 32,
    paddingTop: 20,
    paddingBottom: 32,
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
  settingsInput: {
    marginTop: 4,
    paddingHorizontal: 12,
    paddingVertical: 10,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: COLORS.border,
    backgroundColor: COLORS.background,
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
