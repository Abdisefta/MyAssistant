import { Ionicons } from '@expo/vector-icons';
import { useState } from 'react';
import {
  ActivityIndicator,
  KeyboardAvoidingView,
  Modal,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

const COLORS = {
  background: '#0D0D0D',
  surface: '#161616',
  border: '#2A2A2A',
  purple: '#8B7CF7',
  purpleDark: '#2A2050',
  text: '#F5F5F5',
  textMuted: '#6B6B6B',
};

type OnboardingModalProps = {
  visible: boolean;
  isSubmitting: boolean;
  onComplete: (name: string, job: string) => void;
};

export function OnboardingModal({ visible, isSubmitting, onComplete }: OnboardingModalProps) {
  const [name, setName] = useState('');
  const [job, setJob] = useState('');

  const canSubmit = name.trim().length > 0 && job.trim().length > 0 && !isSubmitting;

  return (
    <Modal visible={visible} animationType="fade" transparent statusBarTranslucent>
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : 'padding'}
        style={styles.overlay}
      >
        <SafeAreaView edges={['top', 'bottom']} style={styles.safe}>
          <View style={styles.card}>
            <View style={styles.iconWrap}>
              <Ionicons name="sparkles" size={28} color={COLORS.purple} />
            </View>
            <Text style={styles.title}>Välkommen till My Assistant</Text>
            <Text style={styles.subtitle}>
              Jag blir mer personlig ju mer vi pratar. Berätta lite om dig först.
            </Text>

            <Text style={styles.label}>Vad heter du?</Text>
            <TextInput
              style={styles.input}
              placeholder="Ditt namn"
              placeholderTextColor={COLORS.textMuted}
              value={name}
              onChangeText={setName}
              autoCapitalize="words"
              editable={!isSubmitting}
              cursorColor={COLORS.purple}
              selectionColor="rgba(139, 124, 247, 0.3)"
              keyboardAppearance="dark"
            />

            <Text style={styles.label}>Vad jobbar du med?</Text>
            <TextInput
              style={styles.input}
              placeholder="Till exempel: projektledare, utvecklare..."
              placeholderTextColor={COLORS.textMuted}
              value={job}
              onChangeText={setJob}
              editable={!isSubmitting}
              cursorColor={COLORS.purple}
              selectionColor="rgba(139, 124, 247, 0.3)"
              keyboardAppearance="dark"
            />

            <Pressable
              style={[styles.button, !canSubmit && styles.buttonDisabled]}
              disabled={!canSubmit}
              onPress={() => onComplete(name, job)}
            >
              {isSubmitting ? (
                <ActivityIndicator color={COLORS.text} />
              ) : (
                <Text style={styles.buttonText}>Kom igång</Text>
              )}
            </Pressable>
          </View>
        </SafeAreaView>
      </KeyboardAvoidingView>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.85)',
    justifyContent: 'center',
  },
  safe: {
    flex: 1,
    justifyContent: 'center',
    padding: 24,
  },
  card: {
    backgroundColor: COLORS.surface,
    borderRadius: 20,
    padding: 24,
    borderWidth: 1,
    borderColor: COLORS.border,
  },
  iconWrap: {
    width: 52,
    height: 52,
    borderRadius: 26,
    backgroundColor: 'rgba(139, 124, 247, 0.15)',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 16,
  },
  title: {
    fontSize: 22,
    fontWeight: '600',
    color: COLORS.text,
    marginBottom: 8,
  },
  subtitle: {
    fontSize: 14,
    color: COLORS.textMuted,
    lineHeight: 20,
    marginBottom: 20,
  },
  label: {
    fontSize: 13,
    fontWeight: '600',
    color: COLORS.purple,
    marginBottom: 8,
    marginTop: 4,
  },
  input: {
    backgroundColor: COLORS.background,
    borderWidth: 1,
    borderColor: COLORS.border,
    borderRadius: 12,
    paddingHorizontal: 14,
    paddingVertical: 12,
    color: '#FFFFFF',
    fontSize: 16,
    marginBottom: 8,
  },
  button: {
    backgroundColor: COLORS.purple,
    borderRadius: 12,
    paddingVertical: 14,
    alignItems: 'center',
    marginTop: 12,
  },
  buttonDisabled: {
    opacity: 0.5,
  },
  buttonText: {
    color: COLORS.text,
    fontSize: 16,
    fontWeight: '600',
  },
});
