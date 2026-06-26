import { Ionicons } from '@expo/vector-icons';
import { useEffect, useState } from 'react';
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

import { APP_COLORS as COLORS } from '@/constants/app-theme';

const QUICK_TASKS = ['Handla mat', 'Ringa kund', 'Skicka rapport', 'Betala räkning', 'Träning'];

export function AddTaskModal({
  visible,
  onClose,
  onSave,
}: {
  visible: boolean;
  onClose: () => void;
  onSave: (text: string, remindAt?: number) => Promise<void>;
}) {
  const [text, setText] = useState('');
  const [reminderText, setReminderText] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [isSaving, setIsSaving] = useState(false);

  useEffect(() => {
    if (visible) {
      setText('');
      setReminderText('');
      setError(null);
    }
  }, [visible]);

  const parseReminder = (raw: string): number | undefined => {
    const t = raw.trim().toLowerCase();
    if (!t) return undefined;

    const klMatch = t.match(/(?:kl|klockan)\s*(\d{1,2})(?:[:.](\d{2}))?/);
    const hours = klMatch ? Number(klMatch[1]) : 9;
    const minutes = klMatch?.[2] ? Number(klMatch[2]) : 0;
    const date = new Date();

    if (/\bimorgon\b/.test(t)) {
      date.setDate(date.getDate() + 1);
    }

    date.setHours(hours, minutes, 0, 0);
    if (date.getTime() <= Date.now()) {
      date.setDate(date.getDate() + 1);
    }
    return date.getTime();
  };

  const handleSave = async () => {
    const trimmed = text.trim();
    if (!trimmed) {
      setError('Skriv vad du ska göra.');
      return;
    }

    setIsSaving(true);
    setError(null);
    try {
      await onSave(trimmed, parseReminder(reminderText));
      onClose();
    } catch {
      setError('Kunde inte spara uppgiften.');
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <Modal visible={visible} animationType="slide" transparent statusBarTranslucent onRequestClose={onClose}>
      <KeyboardAvoidingView
        style={styles.overlay}
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        keyboardVerticalOffset={Platform.OS === 'ios' ? 0 : 24}
      >
        <Pressable style={styles.backdrop} onPress={onClose} />
        <SafeAreaView edges={['bottom']} style={styles.safe}>
          <View style={styles.card}>
            <View style={styles.header}>
              <Text style={styles.headerTitle}>Ny uppgift</Text>
              <Pressable onPress={onClose} hitSlop={12}>
                <Ionicons name="close" size={24} color={COLORS.textMuted} />
              </Pressable>
            </View>

            <Text style={styles.label}>Vad ska du göra?</Text>
            <TextInput
              style={styles.input}
              value={text}
              onChangeText={setText}
              placeholder="T.ex. Ringa Magnus, Handla mat, Skicka offert"
              placeholderTextColor={COLORS.textMuted}
              editable={!isSaving}
              multiline
            />

            <View style={styles.chipsRow}>
              {QUICK_TASKS.map((chip) => (
                <Pressable key={chip} style={styles.chip} onPress={() => setText(chip)}>
                  <Text style={styles.chipText}>{chip}</Text>
                </Pressable>
              ))}
            </View>

            <Text style={styles.label}>Påminnelse (valfritt)</Text>
            <TextInput
              style={styles.input}
              value={reminderText}
              onChangeText={setReminderText}
              placeholder="T.ex. imorgon kl 17"
              placeholderTextColor={COLORS.textMuted}
              editable={!isSaving}
            />

            {error ? <Text style={styles.error}>{error}</Text> : null}

            <Pressable
              style={[styles.saveButton, isSaving && styles.saveDisabled]}
              onPress={handleSave}
              disabled={isSaving}
            >
              {isSaving ? (
                <ActivityIndicator color={COLORS.text} />
              ) : (
                <Text style={styles.saveText}>Spara uppgift</Text>
              )}
            </Pressable>
          </View>
        </SafeAreaView>
      </KeyboardAvoidingView>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: { flex: 1, justifyContent: 'flex-end' },
  backdrop: { ...StyleSheet.absoluteFillObject, backgroundColor: 'rgba(0,0,0,0.6)' },
  safe: { maxHeight: '90%' },
  card: {
    backgroundColor: COLORS.surface,
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    padding: 20,
    paddingBottom: 28,
    borderWidth: 1,
    borderColor: COLORS.border,
    gap: 8,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 4,
  },
  headerTitle: { fontSize: 20, fontWeight: '600', color: COLORS.text },
  label: { fontSize: 12, fontWeight: '600', color: COLORS.purple, marginTop: 4 },
  input: {
    backgroundColor: COLORS.background,
    borderWidth: 1,
    borderColor: COLORS.border,
    borderRadius: 12,
    paddingHorizontal: 14,
    paddingVertical: 12,
    color: COLORS.text,
    fontSize: 16,
    minHeight: 48,
  },
  chipsRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginTop: 4 },
  chip: {
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 20,
    backgroundColor: COLORS.purpleMuted,
    borderWidth: 1,
    borderColor: 'rgba(139, 124, 247, 0.35)',
  },
  chipText: { fontSize: 12, color: COLORS.purple, fontWeight: '600' },
  error: { fontSize: 13, color: '#FF8A8A', marginTop: 4 },
  saveButton: {
    backgroundColor: COLORS.purple,
    borderRadius: 14,
    paddingVertical: 14,
    alignItems: 'center',
    marginTop: 12,
  },
  saveDisabled: { opacity: 0.6 },
  saveText: { color: COLORS.text, fontSize: 16, fontWeight: '600' },
});
