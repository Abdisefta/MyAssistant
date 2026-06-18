import { Ionicons } from '@expo/vector-icons';
import { useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';

import { APP_COLORS as COLORS } from '@/constants/app-theme';

const INITIAL_TASKS = [
  { id: '1', text: 'Svara på Magnus mail om avtalet', done: false },
  { id: '2', text: 'Förbered presentation inför mötet', done: false },
  { id: '3', text: 'Skicka tidsrapport till HR', done: true },
];

export function TasksTab() {
  const [tasks, setTasks] = useState(INITIAL_TASKS);

  const toggle = (id: string) => {
    setTasks((prev) =>
      prev.map((t) => (t.id === id ? { ...t, done: !t.done } : t)),
    );
  };

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.title}>Uppgifter</Text>
        <Text style={styles.sub}>
          {tasks.filter((t) => !t.done).length} kvar idag
        </Text>
      </View>
      <ScrollView style={styles.list} showsVerticalScrollIndicator={false}>
        {tasks.map((task) => (
          <Pressable
            key={task.id}
            style={styles.taskRow}
            onPress={() => toggle(task.id)}
          >
            <View style={[styles.checkbox, task.done && styles.checkboxDone]}>
              {task.done && <Ionicons name="checkmark" size={14} color={COLORS.text} />}
            </View>
            <Text style={[styles.taskText, task.done && styles.taskTextDone]}>
              {task.text}
            </Text>
          </Pressable>
        ))}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: COLORS.background },
  header: { paddingHorizontal: 20, paddingTop: 8, paddingBottom: 12 },
  title: { fontSize: 22, fontWeight: '600', color: COLORS.text },
  sub: { fontSize: 13, color: COLORS.purple, marginTop: 2 },
  list: { flex: 1, paddingHorizontal: 16 },
  taskRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    backgroundColor: COLORS.surface,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: COLORS.border,
    padding: 14,
    marginBottom: 8,
  },
  checkbox: {
    width: 22,
    height: 22,
    borderRadius: 6,
    borderWidth: 2,
    borderColor: COLORS.purple,
    alignItems: 'center',
    justifyContent: 'center',
  },
  checkboxDone: {
    backgroundColor: COLORS.purple,
    borderColor: COLORS.purple,
  },
  taskText: { flex: 1, fontSize: 15, color: COLORS.text },
  taskTextDone: { color: COLORS.textMuted, textDecorationLine: 'line-through' },
});
