import { Ionicons } from '@expo/vector-icons';
import { useCallback, useEffect, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Animated,
  Easing,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { OnboardingModal } from '@/components/onboarding-modal';
import { useAssistant, type TranscriptEntry } from '@/hooks/use-assistant';

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

const COLORS = {
  background: '#0D0D0D',
  surface: '#161616',
  surfaceElevated: '#1C1C1C',
  border: '#2A2A2A',
  purple: '#8B7CF7',
  purpleDark: '#2A2050',
  purpleGlow: '#A78BFA',
  purpleMuted: 'rgba(139, 124, 247, 0.15)',
  text: '#F5F5F5',
  textMuted: '#6B6B6B',
  userBubble: '#1E1E2E',
  assistantBubble: '#1A1528',
};

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
  onClearHistory,
}: {
  memory: ReturnType<typeof useAssistant>['memory'];
  onClearHistory: () => void;
}) {
  if (!memory) return null;

  return (
    <ScrollView style={styles.settingsScroll} contentContainerStyle={styles.settingsContent}>
      <Text style={styles.settingsTitle}>Inställningar</Text>
      <Text style={styles.settingsSection}>Profil</Text>
      <View style={styles.settingsCard}>
        <Text style={styles.settingsLabel}>Namn</Text>
        <Text style={styles.settingsValue}>{memory.name || '—'}</Text>
        <Text style={styles.settingsLabel}>Yrke</Text>
        <Text style={styles.settingsValue}>{memory.job || '—'}</Text>
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
  } = useAssistant();

  const [activeTab, setActiveTab] = useState<TabId>('assistent');
  const [inputText, setInputText] = useState('');
  const [isListening, setIsListening] = useState(false);

  const pulseOuter = useRef(new Animated.Value(1)).current;
  const pulseInner = useRef(new Animated.Value(1)).current;
  const glowOpacity = useRef(new Animated.Value(0.35)).current;
  const scrollRef = useRef<ScrollView>(null);

  useEffect(() => {
    const loopPulse = (anim: Animated.Value, delay: number) =>
      Animated.loop(
        Animated.sequence([
          Animated.delay(delay),
          Animated.timing(anim, {
            toValue: 1.28,
            duration: 2000,
            easing: Easing.inOut(Easing.ease),
            useNativeDriver: true,
          }),
          Animated.timing(anim, {
            toValue: 1,
            duration: 2000,
            easing: Easing.inOut(Easing.ease),
            useNativeDriver: true,
          }),
        ]),
      );

    const glowLoop = Animated.loop(
      Animated.sequence([
        Animated.timing(glowOpacity, {
          toValue: 0.65,
          duration: 2000,
          easing: Easing.inOut(Easing.ease),
          useNativeDriver: true,
        }),
        Animated.timing(glowOpacity, {
          toValue: 0.35,
          duration: 2000,
          easing: Easing.inOut(Easing.ease),
          useNativeDriver: true,
        }),
      ]),
    );

    const outer = loopPulse(pulseOuter, 0);
    const inner = loopPulse(pulseInner, 350);
    outer.start();
    inner.start();
    glowLoop.start();

    return () => {
      outer.stop();
      inner.stop();
      glowLoop.stop();
    };
  }, [pulseOuter, pulseInner, glowOpacity]);

  useEffect(() => {
    setTimeout(() => scrollRef.current?.scrollToEnd({ animated: true }), 100);
  }, [transcript]);

  const handleSend = useCallback(() => {
    if (!inputText.trim() || isThinking) return;
    sendMessage(inputText);
    setInputText('');
  }, [inputText, isThinking, sendMessage]);

  const handleMicPressIn = () => {
    setIsListening(true);
    setListeningState(true);
  };

  const handleMicPressOut = () => {
    setIsListening(false);
    setListeningState(false);
    if (inputText.trim()) {
      handleSend();
    }
  };

  const renderTranscriptEntry = (entry: TranscriptEntry) => {
    if (entry.role === 'system') {
      return (
        <View key={entry.id} style={styles.systemRow}>
          {entry.text === 'Tänker...' ? (
            <ActivityIndicator size="small" color={COLORS.purple} />
          ) : (
            <View style={styles.systemDot} />
          )}
          <Text style={styles.systemText}>{entry.text}</Text>
        </View>
      );
    }

    const isUser = entry.role === 'user';
    return (
      <View
        key={entry.id}
        style={[styles.bubbleRow, isUser ? styles.bubbleRowUser : styles.bubbleRowAssistant]}
      >
        {!isUser && (
          <View style={styles.avatar}>
            <Ionicons name="sparkles" size={12} color={COLORS.purple} />
          </View>
        )}
        <View style={[styles.bubble, isUser ? styles.bubbleUser : styles.bubbleAssistant]}>
          <Text style={styles.bubbleLabel}>{isUser ? 'Du' : 'Assistent'}</Text>
          <Text style={styles.bubbleText}>{entry.text}</Text>
        </View>
      </View>
    );
  };

  const renderAssistentContent = () => (
    <KeyboardAvoidingView
      style={styles.assistantContent}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      keyboardVerticalOffset={Platform.OS === 'ios' ? 8 : 0}
    >
      <Text style={styles.headerTitle}>
        My Assistant{memory?.name ? ` · ${memory.name}` : ''}
      </Text>
      <Text style={styles.headerSubtitle}>
        {memory?.job ? `${memory.job} · Gemini Flash` : 'Gemini Flash'}
      </Text>

      <View style={styles.orbSection}>
        <View style={styles.orbContainer}>
          <Animated.View
            style={[
              styles.orbRing,
              styles.orbRingOuter,
              { transform: [{ scale: pulseOuter }], opacity: glowOpacity },
            ]}
          />
          <Animated.View
            style={[
              styles.orbRing,
              styles.orbRingInner,
              { transform: [{ scale: pulseInner }] },
            ]}
          />
          <View style={[styles.orbCore, (isListening || isThinking) && styles.orbCoreActive]}>
            <View style={styles.orbInner} />
          </View>
        </View>
      </View>

      <View style={styles.transcriptContainer}>
        <View style={styles.transcriptHeader}>
          <Ionicons name="chatbubbles-outline" size={14} color={COLORS.textMuted} />
          <Text style={styles.transcriptHeaderText}>Transkript</Text>
        </View>
        <ScrollView
          ref={scrollRef}
          style={styles.transcriptScroll}
          contentContainerStyle={styles.transcriptScrollContent}
          showsVerticalScrollIndicator={false}
          onContentSizeChange={() => scrollRef.current?.scrollToEnd({ animated: true })}
        >
          {transcript.map(renderTranscriptEntry)}
        </ScrollView>
      </View>

      <View style={styles.inputRow}>
        <TextInput
          style={styles.textInput}
          placeholder="Skriv till assistenten..."
          placeholderTextColor={COLORS.textMuted}
          value={inputText}
          onChangeText={setInputText}
          onSubmitEditing={handleSend}
          editable={!isThinking}
          returnKeyType="send"
        />
        <TouchableOpacity
          style={[styles.sendButton, (!inputText.trim() || isThinking) && styles.sendButtonDisabled]}
          onPress={handleSend}
          disabled={!inputText.trim() || isThinking}
        >
          <Ionicons name="send" size={18} color={COLORS.text} />
        </TouchableOpacity>
      </View>

      <View style={styles.micSection}>
        <Text style={styles.micHint}>
          {isListening
            ? 'Släpp för att skicka'
            : isThinking
              ? 'Gemini tänker...'
              : 'Håll inne mikrofonen eller skriv ovan'}
        </Text>
        <Pressable
          onPressIn={handleMicPressIn}
          onPressOut={handleMicPressOut}
          disabled={isThinking}
          style={({ pressed }) => [
            styles.micButton,
            (isListening || isThinking) && styles.micButtonActive,
            pressed && !isListening && styles.micButtonPressed,
            isThinking && styles.micButtonDisabled,
          ]}
        >
          <Ionicons
            name={isListening ? 'mic' : 'mic-outline'}
            size={30}
            color={COLORS.text}
          />
        </Pressable>
      </View>
    </KeyboardAvoidingView>
  );

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
        return <PlaceholderTab title="Email" icon="mail-outline" />;
      case 'kalender':
        return <PlaceholderTab title="Kalender" icon="calendar-outline" />;
      case 'uppgifter':
        return <PlaceholderTab title="Uppgifter" icon="checkbox-outline" />;
      case 'installningar':
        return <SettingsTab memory={memory} onClearHistory={clearHistory} />;
      default:
        return renderAssistentContent();
    }
  };

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <View style={styles.content}>{renderContent()}</View>

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
  assistantContent: {
    flex: 1,
    paddingHorizontal: 20,
  },
  headerTitle: {
    fontSize: 22,
    fontWeight: '600',
    color: COLORS.text,
    marginTop: 8,
  },
  headerSubtitle: {
    fontSize: 13,
    color: COLORS.purple,
    marginTop: 2,
    marginBottom: 8,
  },
  orbSection: {
    alignItems: 'center',
    paddingVertical: 8,
  },
  orbContainer: {
    width: 140,
    height: 140,
    alignItems: 'center',
    justifyContent: 'center',
  },
  orbRing: {
    position: 'absolute',
    borderRadius: 999,
  },
  orbRingOuter: {
    width: 130,
    height: 130,
    backgroundColor: COLORS.purpleMuted,
    borderWidth: 1,
    borderColor: 'rgba(139, 124, 247, 0.2)',
  },
  orbRingInner: {
    width: 100,
    height: 100,
    backgroundColor: 'rgba(139, 124, 247, 0.22)',
    borderWidth: 1,
    borderColor: 'rgba(167, 139, 250, 0.3)',
  },
  orbCore: {
    width: 72,
    height: 72,
    borderRadius: 36,
    backgroundColor: COLORS.purpleDark,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: COLORS.purpleGlow,
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.7,
    shadowRadius: 20,
    elevation: 10,
  },
  orbCoreActive: {
    shadowOpacity: 1,
    shadowRadius: 28,
    transform: [{ scale: 1.05 }],
  },
  orbInner: {
    width: 50,
    height: 50,
    borderRadius: 25,
    backgroundColor: COLORS.purple,
  },
  transcriptContainer: {
    flex: 1,
    backgroundColor: COLORS.surface,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: COLORS.border,
    marginBottom: 10,
    overflow: 'hidden',
  },
  transcriptHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.border,
    backgroundColor: COLORS.surfaceElevated,
  },
  transcriptHeaderText: {
    fontSize: 12,
    fontWeight: '600',
    color: COLORS.textMuted,
    letterSpacing: 0.5,
    textTransform: 'uppercase',
  },
  transcriptScroll: {
    flex: 1,
  },
  transcriptScrollContent: {
    padding: 12,
    gap: 10,
  },
  systemRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    alignSelf: 'center',
    paddingVertical: 4,
  },
  systemDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: COLORS.purple,
  },
  systemText: {
    fontSize: 12,
    color: COLORS.textMuted,
    fontStyle: 'italic',
  },
  bubbleRow: {
    flexDirection: 'row',
    gap: 8,
    maxWidth: '100%',
  },
  bubbleRowUser: {
    alignSelf: 'flex-end',
  },
  bubbleRowAssistant: {
    alignSelf: 'flex-start',
  },
  avatar: {
    width: 24,
    height: 24,
    borderRadius: 12,
    backgroundColor: COLORS.purpleMuted,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 4,
  },
  bubble: {
    maxWidth: '85%',
    borderRadius: 14,
    paddingHorizontal: 12,
    paddingVertical: 10,
    borderWidth: 1,
  },
  bubbleUser: {
    backgroundColor: COLORS.userBubble,
    borderColor: COLORS.border,
  },
  bubbleAssistant: {
    backgroundColor: COLORS.assistantBubble,
    borderColor: 'rgba(139, 124, 247, 0.2)',
  },
  bubbleLabel: {
    fontSize: 10,
    fontWeight: '600',
    color: COLORS.purple,
    marginBottom: 4,
    textTransform: 'uppercase',
    letterSpacing: 0.4,
  },
  bubbleText: {
    fontSize: 14,
    color: COLORS.text,
    lineHeight: 20,
  },
  inputRow: {
    flexDirection: 'row',
    gap: 8,
    marginBottom: 8,
  },
  textInput: {
    flex: 1,
    backgroundColor: COLORS.surface,
    borderWidth: 1,
    borderColor: COLORS.border,
    borderRadius: 14,
    paddingHorizontal: 14,
    paddingVertical: 10,
    color: COLORS.text,
    fontSize: 15,
  },
  sendButton: {
    width: 44,
    height: 44,
    borderRadius: 14,
    backgroundColor: COLORS.purple,
    alignItems: 'center',
    justifyContent: 'center',
  },
  sendButtonDisabled: {
    opacity: 0.4,
  },
  micSection: {
    alignItems: 'center',
    paddingBottom: 4,
    gap: 8,
  },
  micHint: {
    fontSize: 12,
    color: COLORS.textMuted,
  },
  micButton: {
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: COLORS.purpleDark,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 2,
    borderColor: 'rgba(139, 124, 247, 0.4)',
  },
  micButtonActive: {
    backgroundColor: COLORS.purple,
    borderColor: COLORS.purpleGlow,
    transform: [{ scale: 1.1 }],
  },
  micButtonPressed: {
    opacity: 0.85,
  },
  micButtonDisabled: {
    opacity: 0.5,
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
