import { Ionicons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import { useEffect, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Animated,
  Easing,
  KeyboardAvoidingView,
  Modal,
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

import { APP_COLORS as COLORS } from '@/constants/app-theme';
import { useLocale } from '@/contexts/locale-context';
import type { TranscriptEntry } from '@/hooks/use-assistant';

const QUICK_PHRASES: { label: string; phrase: string }[] = [
  { label: 'Möten idag?', phrase: 'Vad har jag för möten idag?' },
  { label: 'Boka imorgon', phrase: 'Boka möte imorgon kl 10' },
  { label: 'Påminnelse', phrase: 'Påminn mig att handla mat' },
  { label: 'Ta bort möte', phrase: 'Ta bort senaste mötet' },
];

type Props = {
  memoryName?: string;
  memoryJob?: string;
  transcript: TranscriptEntry[];
  isThinking: boolean;
  inputText: string;
  isListening: boolean;
  onInputChange: (text: string) => void;
  onSend: () => void;
  onMicPress: () => void;
  onQuickPhrase: (phrase: string) => void;
  onComposeOpenChange?: (open: boolean) => void;
};

function TranscriptBubble({ entry }: { entry: TranscriptEntry }) {
  const { strings } = useLocale();

  if (entry.role === 'system') {
    return (
      <View style={styles.systemRow}>
        {entry.id === 'thinking' ? (
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
      style={[styles.bubbleRow, isUser ? styles.bubbleRowUser : styles.bubbleRowAssistant]}
    >
      {!isUser && (
        <View style={styles.avatar}>
          <Ionicons name="sparkles" size={12} color={COLORS.purple} />
        </View>
      )}
      <View style={[styles.bubble, isUser ? styles.bubbleUser : styles.bubbleAssistant]}>
        <Text style={styles.bubbleLabel}>
          {isUser ? strings.common.you : strings.common.assistant}
        </Text>
        <Text style={styles.bubbleText}>{entry.text}</Text>
      </View>
    </View>
  );
}

function ComposeModal({
  visible,
  transcript,
  inputText,
  isThinking,
  onChangeText,
  onClose,
  onSend,
}: {
  visible: boolean;
  transcript: TranscriptEntry[];
  inputText: string;
  isThinking: boolean;
  onChangeText: (text: string) => void;
  onClose: () => void;
  onSend: () => void;
}) {
  const { strings } = useLocale();
  const scrollRef = useRef<ScrollView>(null);

  useEffect(() => {
    if (visible) {
      setTimeout(() => scrollRef.current?.scrollToEnd({ animated: false }), 150);
    }
  }, [visible, transcript, inputText]);

  const handleSend = () => {
    if (!inputText.trim() || isThinking) return;
    onSend();
    onClose();
  };

  return (
    <Modal visible={visible} animationType="slide" transparent statusBarTranslucent>
      <KeyboardAvoidingView
        style={styles.composeOverlay}
        behavior={Platform.OS === 'ios' ? 'padding' : 'padding'}
      >
        <SafeAreaView edges={['top', 'bottom']} style={styles.composeSafe}>
          <View style={styles.composeCard}>
            <View style={styles.composeHeader}>
              <Text style={styles.composeTitle}>{strings.assistant.writePlaceholder}</Text>
              <Pressable onPress={onClose} hitSlop={12} disabled={isThinking}>
                <Ionicons name="close" size={24} color={COLORS.textMuted} />
              </Pressable>
            </View>

            <ScrollView
              ref={scrollRef}
              style={styles.composeHistory}
              contentContainerStyle={styles.composeHistoryContent}
              showsVerticalScrollIndicator
              keyboardShouldPersistTaps="handled"
            >
              {transcript.map((entry) => (
                <TranscriptBubble key={entry.id} entry={entry} />
              ))}
            </ScrollView>

            {inputText.trim().length > 0 && (
              <View style={styles.livePreview}>
                <Text style={styles.livePreviewLabel}>{strings.common.you}</Text>
                <Text style={styles.livePreviewText}>{inputText}</Text>
              </View>
            )}

            <TextInput
              style={styles.composeInput}
              value={inputText}
              onChangeText={onChangeText}
              placeholder={strings.assistant.writePlaceholder}
              placeholderTextColor={COLORS.textMuted}
              multiline
              textAlignVertical="top"
              editable={!isThinking}
              cursorColor={COLORS.purple}
              selectionColor={COLORS.purpleMuted}
              keyboardAppearance="dark"
              autoFocus
              autoCorrect
            />

            <Pressable
              style={[
                styles.composeSendButton,
                (!inputText.trim() || isThinking) && styles.composeSendDisabled,
              ]}
              onPress={handleSend}
              disabled={!inputText.trim() || isThinking}
            >
              {isThinking ? (
                <ActivityIndicator color={COLORS.text} />
              ) : (
                <>
                  <Ionicons name="send" size={18} color={COLORS.text} />
                  <Text style={styles.composeSendText}>Skicka</Text>
                </>
              )}
            </Pressable>
          </View>
        </SafeAreaView>
      </KeyboardAvoidingView>
    </Modal>
  );
}

export function AssistantScreen({
  memoryName,
  memoryJob,
  transcript,
  isThinking,
  inputText,
  isListening,
  onInputChange,
  onSend,
  onMicPress,
  onQuickPhrase,
  onComposeOpenChange,
}: Props) {
  const { strings } = useLocale();
  const pulseOuter = useRef(new Animated.Value(1)).current;
  const pulseInner = useRef(new Animated.Value(1)).current;
  const glowOpacity = useRef(new Animated.Value(0.35)).current;
  const scrollRef = useRef<ScrollView>(null);
  const [composeOpen, setComposeOpen] = useState(false);

  const openCompose = () => {
    setComposeOpen(true);
    onComposeOpenChange?.(true);
  };

  const closeCompose = () => {
    setComposeOpen(false);
    onComposeOpenChange?.(false);
  };

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

  return (
    <View style={styles.container}>
      <Text style={styles.headerTitle}>
        My Assistant{memoryName ? ` · ${memoryName}` : ''}
      </Text>
      <Text style={styles.headerSubtitle}>
        {memoryJob ? `${memoryJob} · ${strings.assistant.modelLabel}` : strings.assistant.modelLabel}
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
          showsVerticalScrollIndicator
        >
          {transcript.map((entry) => (
            <TranscriptBubble key={entry.id} entry={entry} />
          ))}
        </ScrollView>
      </View>

      <Pressable style={styles.inputTrigger} onPress={openCompose}>
        <View style={styles.inputTriggerBody}>
          <Text style={styles.inputTriggerLabel}>Skriv till assistenten</Text>
          <Text
            style={[styles.inputTriggerText, inputText.trim() && styles.inputTriggerTextFilled]}
            numberOfLines={3}
          >
            {inputText.trim() || strings.assistant.writePlaceholder}
          </Text>
        </View>
        <View style={styles.inputTriggerIcon}>
          <Ionicons name="create-outline" size={22} color={COLORS.purple} />
        </View>
      </Pressable>

      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={styles.quickPhrasesRow}
        keyboardShouldPersistTaps="handled"
      >
        {QUICK_PHRASES.map(({ label, phrase }) => (
          <Pressable
            key={phrase}
            style={[styles.quickPhraseChip, isThinking && styles.quickPhraseDisabled]}
            onPress={() => {
              if (isThinking) return;
              void Haptics.selectionAsync();
              onQuickPhrase(phrase);
            }}
            disabled={isThinking}
          >
            <Text style={styles.quickPhraseText} numberOfLines={1}>
              {label}
            </Text>
          </Pressable>
        ))}
      </ScrollView>

      <View style={styles.micSection}>
        <Text style={styles.micHint}>
          {isListening
            ? strings.assistant.micListening
            : isThinking
              ? strings.assistant.micThinking
              : strings.assistant.micHint}
        </Text>
        <Pressable
          onPress={() => {
            void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
            onMicPress();
          }}
          disabled={isThinking}
          style={({ pressed }) => [
            styles.micButton,
            isListening && styles.micButtonActive,
            pressed && !isListening && styles.micButtonPressed,
            isThinking && styles.micButtonDisabled,
          ]}
        >
          <Ionicons name={isListening ? 'mic' : 'mic-outline'} size={30} color={COLORS.text} />
        </Pressable>
      </View>

      <ComposeModal
        visible={composeOpen}
        transcript={transcript}
        inputText={inputText}
        isThinking={isThinking}
        onChangeText={onInputChange}
        onClose={closeCompose}
        onSend={onSend}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
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
    marginBottom: 4,
  },
  orbSection: {
    alignItems: 'center',
    paddingVertical: 0,
    marginBottom: 2,
  },
  orbContainer: {
    width: 72,
    height: 72,
    alignItems: 'center',
    justifyContent: 'center',
  },
  orbRing: {
    position: 'absolute',
    borderRadius: 999,
  },
  orbRingOuter: {
    width: 66,
    height: 66,
    backgroundColor: COLORS.purpleMuted,
    borderWidth: 1,
    borderColor: 'rgba(139, 124, 247, 0.2)',
  },
  orbRingInner: {
    width: 52,
    height: 52,
    backgroundColor: 'rgba(139, 124, 247, 0.22)',
    borderWidth: 1,
    borderColor: 'rgba(167, 139, 250, 0.3)',
  },
  orbCore: {
    width: 38,
    height: 38,
    borderRadius: 19,
    backgroundColor: COLORS.purpleDark,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: COLORS.purpleGlow,
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.7,
    shadowRadius: 14,
    elevation: 8,
  },
  orbCoreActive: {
    shadowOpacity: 1,
    shadowRadius: 28,
    transform: [{ scale: 1.05 }],
  },
  orbInner: {
    width: 24,
    height: 24,
    borderRadius: 12,
    backgroundColor: COLORS.purple,
  },
  transcriptContainer: {
    flex: 1,
    minHeight: 240,
    backgroundColor: COLORS.surface,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: COLORS.border,
    marginBottom: 8,
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
    flexShrink: 1,
  },
  inputTrigger: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 12,
    backgroundColor: COLORS.surfaceElevated,
    borderWidth: 1.5,
    borderColor: 'rgba(139, 124, 247, 0.45)',
    borderRadius: 16,
    paddingHorizontal: 16,
    paddingVertical: 10,
    marginBottom: 8,
    minHeight: 56,
  },
  inputTriggerBody: {
    flex: 1,
    gap: 4,
  },
  inputTriggerLabel: {
    fontSize: 11,
    fontWeight: '700',
    color: COLORS.purple,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  inputTriggerText: {
    fontSize: 16,
    lineHeight: 22,
    color: COLORS.textMuted,
  },
  inputTriggerTextFilled: {
    color: '#FFFFFF',
  },
  inputTriggerIcon: {
    width: 40,
    height: 40,
    borderRadius: 12,
    backgroundColor: COLORS.purpleMuted,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 2,
  },
  quickPhrasesRow: {
    gap: 8,
    paddingTop: 6,
    paddingBottom: 4,
    alignItems: 'center',
  },
  quickPhraseChip: {
    maxWidth: 130,
    paddingHorizontal: 12,
    paddingVertical: 7,
    borderRadius: 16,
    backgroundColor: COLORS.purpleMuted,
    borderWidth: 1,
    borderColor: 'rgba(139, 124, 247, 0.35)',
  },
  quickPhraseDisabled: {
    opacity: 0.5,
  },
  quickPhraseText: {
    fontSize: 12,
    color: COLORS.purple,
    fontWeight: '600',
  },
  micSection: {
    alignItems: 'center',
    paddingBottom: 2,
    gap: 6,
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
  composeOverlay: {
    flex: 1,
    backgroundColor: COLORS.background,
  },
  composeSafe: {
    flex: 1,
  },
  composeCard: {
    flex: 1,
    paddingHorizontal: 20,
    paddingBottom: 12,
    gap: 10,
  },
  composeHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 8,
  },
  composeTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: COLORS.text,
  },
  composeHistory: {
    flex: 1,
    backgroundColor: COLORS.surface,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: COLORS.border,
  },
  composeHistoryContent: {
    padding: 12,
    gap: 10,
  },
  livePreview: {
    backgroundColor: COLORS.userBubble,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: COLORS.border,
    padding: 12,
  },
  livePreviewLabel: {
    fontSize: 10,
    fontWeight: '600',
    color: COLORS.purple,
    marginBottom: 4,
    textTransform: 'uppercase',
  },
  livePreviewText: {
    fontSize: 16,
    color: '#FFFFFF',
    lineHeight: 22,
  },
  composeInput: {
    minHeight: 100,
    maxHeight: 140,
    backgroundColor: COLORS.surfaceElevated,
    borderWidth: 1,
    borderColor: COLORS.border,
    borderRadius: 14,
    paddingHorizontal: 16,
    paddingVertical: 14,
    color: '#FFFFFF',
    fontSize: 17,
    lineHeight: 24,
  },
  composeSendButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    backgroundColor: COLORS.purple,
    borderRadius: 14,
    paddingVertical: 14,
  },
  composeSendDisabled: {
    opacity: 0.5,
  },
  composeSendText: {
    color: COLORS.text,
    fontSize: 16,
    fontWeight: '600',
  },
});
