import { Ionicons } from '@expo/vector-icons';
import { useEffect, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  AppState,
  KeyboardAvoidingView,
  Modal,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { APP_COLORS as COLORS } from '@/constants/app-theme';
import { createCalendarEvent, formatDayLabel } from '@/services/device-calendar';

const TITLE_CHIPS = ['Möte', 'Dejt', 'Jobbmöte', 'Privat', 'Läkare', 'Tandläkare'];

function normalizeTimeInput(timeText: string): string {
  const trimmed = timeText.trim().replace(',', ':').replace('.', ':');
  if (/^\d{1,2}$/.test(trimmed)) {
    return `${trimmed.padStart(2, '0')}:00`;
  }
  if (/^\d{1,2}:\d$/.test(trimmed)) {
    const [hours, minutes] = trimmed.split(':');
    return `${hours.padStart(2, '0')}:${minutes}0`;
  }
  if (/^\d{1,2}:\d{2}$/.test(trimmed)) {
    const [hours, minutes] = trimmed.split(':');
    return `${hours.padStart(2, '0')}:${minutes}`;
  }
  return trimmed;
}

function parseTimeOnDate(date: Date, timeText: string): Date | null {
  const normalized = normalizeTimeInput(timeText);
  const match = normalized.match(/^(\d{1,2}):(\d{2})$/);
  if (!match) return null;
  const hours = Number(match[1]);
  const minutes = Number(match[2]);
  if (hours > 23 || minutes > 59) return null;
  const result = new Date(date);
  result.setHours(hours, minutes, 0, 0);
  return result;
}

export function BookEventModal({
  visible,
  selectedDate,
  userId,
  onClose,
  onBooked,
}: {
  visible: boolean;
  selectedDate: Date;
  userId: string;
  onClose: () => void;
  onBooked: () => void;
}) {
  const [title, setTitle] = useState('');
  const [notes, setNotes] = useState('');
  const [startTime, setStartTime] = useState('15:00');
  const [endTime, setEndTime] = useState('16:00');
  const [error, setError] = useState<string | null>(null);
  const [info, setInfo] = useState<string | null>(null);
  const [isSaving, setIsSaving] = useState(false);
  const pendingNativeSaveRef = useRef(false);

  useEffect(() => {
    if (visible) {
      setTitle('');
      setNotes('');
      setStartTime('15:00');
      setEndTime('16:00');
      setError(null);
      setInfo(null);
      pendingNativeSaveRef.current = false;
    }
  }, [visible, selectedDate]);

  useEffect(() => {
    if (!visible) return;

    const sub = AppState.addEventListener('change', (state) => {
      if (state === 'active' && pendingNativeSaveRef.current) {
        pendingNativeSaveRef.current = false;
        onBooked();
        onClose();
      }
    });

    return () => sub.remove();
  }, [visible, onBooked, onClose]);

  const handleTimeBlur = (value: string, setter: (next: string) => void) => {
    const normalized = normalizeTimeInput(value);
    if (normalized !== value.trim()) {
      setter(normalized);
    }
  };

  const handleSave = async () => {
    const trimmed = title.trim();
    if (!trimmed) {
      setError('Skriv vad mötet heter, t.ex. "Möte" eller "Tandläkare".');
      return;
    }

    const normalizedStart = normalizeTimeInput(startTime);
    const normalizedEnd = normalizeTimeInput(endTime);
    setStartTime(normalizedStart);
    setEndTime(normalizedEnd);

    const start = parseTimeOnDate(selectedDate, normalizedStart);
    const end = parseTimeOnDate(selectedDate, normalizedEnd);
    if (!start || !end) {
      setError('Skriv tid som 17 eller 17:30 — appen fixar resten.');
      return;
    }
    if (end.getTime() <= start.getTime()) {
      setError('Sluttiden måste vara efter starttiden.');
      return;
    }

    setIsSaving(true);
    setError(null);

    const result = await createCalendarEvent(
      {
        title: trimmed,
        start,
        end,
        notes: notes.trim() || undefined,
      },
      userId,
    );

    setIsSaving(false);

    if (!result.ok) {
      setError(result.error);
      Alert.alert('Kunde inte spara', result.error);
      return;
    }

    if (result.mode === 'native_dialog') {
      pendingNativeSaveRef.current = true;
      setInfo(
        'Google Kalender öppnas. Kontrollera tid och rubrik — tryck Spara där. Dra ned i Kalender-fliken för att uppdatera.',
      );
      setError(null);
      return;
    }

    Alert.alert('Klart!', `Mötet "${trimmed}" sparades i kalendern.`);
    onBooked();
    onClose();
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
              <Text style={styles.headerTitle}>Lägg till i kalendern</Text>
              <Pressable onPress={onClose} hitSlop={12}>
                <Ionicons name="close" size={24} color={COLORS.textMuted} />
              </Pressable>
            </View>

            <ScrollView
              keyboardShouldPersistTaps="handled"
              showsVerticalScrollIndicator={false}
              contentContainerStyle={styles.scrollContent}
            >
              <Text style={styles.dateLabel}>{formatDayLabel(selectedDate)}</Text>

              <Text style={styles.label}>Rubrik</Text>
              <TextInput
                style={styles.input}
                value={title}
                onChangeText={setTitle}
                placeholder="T.ex. Dejt med Marie, Möte med Magnus"
                placeholderTextColor={COLORS.textMuted}
                editable={!isSaving}
              />

              <View style={styles.chipsRow}>
                {TITLE_CHIPS.map((chip) => (
                  <Pressable
                    key={chip}
                    style={styles.chip}
                    onPress={() => setTitle((prev) => (prev ? `${prev}, ${chip}` : chip))}
                  >
                    <Text style={styles.chipText}>{chip}</Text>
                  </Pressable>
                ))}
              </View>

              <Text style={styles.label}>Anteckning (valfritt)</Text>
              <TextInput
                style={[styles.input, styles.notesInput]}
                value={notes}
                onChangeText={setNotes}
                placeholder="Plats, telefonnummer, detaljer..."
                placeholderTextColor={COLORS.textMuted}
                editable={!isSaving}
                multiline
              />

              <View style={styles.timeRow}>
                <View style={styles.timeCol}>
                  <Text style={styles.label}>Start</Text>
                  <TextInput
                    style={styles.input}
                    value={startTime}
                    onChangeText={setStartTime}
                    onBlur={() => handleTimeBlur(startTime, setStartTime)}
                    placeholder="17 eller 17:30"
                    placeholderTextColor={COLORS.textMuted}
                    keyboardType="numbers-and-punctuation"
                    editable={!isSaving}
                  />
                </View>
                <View style={styles.timeCol}>
                  <Text style={styles.label}>Slut</Text>
                  <TextInput
                    style={styles.input}
                    value={endTime}
                    onChangeText={setEndTime}
                    onBlur={() => handleTimeBlur(endTime, setEndTime)}
                    placeholder="18 eller 18:30"
                    placeholderTextColor={COLORS.textMuted}
                    keyboardType="numbers-and-punctuation"
                    editable={!isSaving}
                  />
                </View>
              </View>

              {error ? <Text style={styles.error}>{error}</Text> : null}
              {info ? <Text style={styles.info}>{info}</Text> : null}

              <Text style={styles.hint}>Mötet sparas i appen kopplat till ditt konto.</Text>

              <Pressable
                style={[styles.saveButton, isSaving && styles.saveDisabled]}
                onPress={handleSave}
                disabled={isSaving}
              >
                {isSaving ? (
                  <ActivityIndicator color={COLORS.text} />
                ) : (
                  <Text style={styles.saveText}>Spara i kalendern</Text>
                )}
              </Pressable>
            </ScrollView>
          </View>
        </SafeAreaView>
      </KeyboardAvoidingView>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: { flex: 1, justifyContent: 'flex-end' },
  backdrop: { ...StyleSheet.absoluteFillObject, backgroundColor: 'rgba(0,0,0,0.6)' },
  safe: { maxHeight: '92%' },
  card: {
    backgroundColor: COLORS.surface,
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    paddingHorizontal: 20,
    paddingTop: 20,
    paddingBottom: 12,
    borderWidth: 1,
    borderColor: COLORS.border,
    maxHeight: '100%',
  },
  scrollContent: {
    gap: 8,
    paddingBottom: 24,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 4,
  },
  headerTitle: { fontSize: 20, fontWeight: '600', color: COLORS.text },
  dateLabel: { fontSize: 14, color: COLORS.purple, marginBottom: 8 },
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
  },
  timeRow: { flexDirection: 'row', gap: 12 },
  timeCol: { flex: 1 },
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
  notesInput: { minHeight: 72, textAlignVertical: 'top' },
  error: { fontSize: 13, color: '#FF8A8A', marginTop: 4 },
  info: { fontSize: 13, color: '#8AE6A0', marginTop: 4, lineHeight: 18 },
  hint: { fontSize: 12, color: COLORS.textMuted, lineHeight: 18, marginTop: 4 },
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
