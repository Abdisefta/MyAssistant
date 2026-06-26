import { Ionicons } from '@expo/vector-icons';
import { useState } from 'react';
import { Alert, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';

import { AddTaskModal } from '@/components/add-task-modal';
import { APP_COLORS as COLORS } from '@/constants/app-theme';
import { getSpeechLocale } from '@/constants/i18n/resolve-locale';
import { useLocale } from '@/contexts/locale-context';
import type { AgentTask } from '@/types/memory';

type Props = {
  tasks: AgentTask[];
  onToggleTask: (id: string) => void;
  onAddTask: (text: string, remindAt?: number) => Promise<void>;
  onDeleteTask: (id: string) => Promise<void>;
};

export function TasksTab({ tasks, onToggleTask, onAddTask, onDeleteTask }: Props) {
  const { locale, strings, t } = useLocale();
  const speechTag = getSpeechLocale(locale);
  const [modalVisible, setModalVisible] = useState(false);
  const openTasks = tasks.filter((task) => !task.done);
  const doneTasks = tasks.filter((task) => task.done).slice(-8);

  const confirmDelete = (task: AgentTask) => {
    Alert.alert('Ta bort uppgift', `Vill du ta bort "${task.text}"?`, [
      { text: 'Avbryt', style: 'cancel' },
      {
        text: 'Ta bort',
        style: 'destructive',
        onPress: () => void onDeleteTask(task.id),
      },
    ]);
  };

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <View style={styles.headerTop}>
          <View>
            <Text style={styles.title}>{strings.tasks.title}</Text>
            <Text style={styles.sub}>
              {openTasks.length > 0
                ? t('tasks.subtitleOpen', { count: openTasks.length })
                : strings.tasks.subtitleEmpty}
            </Text>
          </View>
          <Pressable style={styles.addButton} onPress={() => setModalVisible(true)}>
            <Ionicons name="add" size={20} color={COLORS.text} />
            <Text style={styles.addButtonText}>Ny</Text>
          </Pressable>
        </View>
      </View>

      <ScrollView style={styles.list} showsVerticalScrollIndicator={false}>
        {openTasks.length === 0 && doneTasks.length === 0 ? (
          <View style={styles.emptyWrap}>
            <Ionicons name="checkbox-outline" size={36} color={COLORS.textMuted} />
            <Text style={styles.emptyText}>{strings.tasks.empty}</Text>
            <Pressable style={styles.emptyButton} onPress={() => setModalVisible(true)}>
              <Text style={styles.emptyButtonText}>+ Lägg till uppgift</Text>
            </Pressable>
          </View>
        ) : null}

        {openTasks.map((task) => (
          <View key={task.id} style={styles.taskRow}>
            <Pressable style={styles.taskMain} onPress={() => onToggleTask(task.id)}>
              <View style={styles.checkbox}>
                <Ionicons name="ellipse-outline" size={18} color={COLORS.purple} />
              </View>
              <View style={styles.taskBody}>
                <Text style={styles.taskText}>{task.text}</Text>
                {task.remindAt ? (
                  <Text style={styles.taskMeta}>
                    {strings.tasks.reminder}{' '}
                    {new Date(task.remindAt).toLocaleString(speechTag, {
                      weekday: 'short',
                      day: 'numeric',
                      month: 'short',
                      hour: '2-digit',
                      minute: '2-digit',
                    })}
                  </Text>
                ) : null}
              </View>
            </Pressable>
            <Pressable style={styles.deleteButton} onPress={() => confirmDelete(task)} hitSlop={8}>
              <Ionicons name="trash-outline" size={18} color="#FF8A8A" />
            </Pressable>
          </View>
        ))}

        {doneTasks.length > 0 ? (
          <Text style={styles.doneSection}>{strings.tasks.done}</Text>
        ) : null}
        {doneTasks.map((task) => (
          <View key={task.id} style={[styles.taskRow, styles.taskRowDone]}>
            <Pressable style={styles.taskMain} onPress={() => onToggleTask(task.id)}>
              <View style={[styles.checkbox, styles.checkboxDone]}>
                <Ionicons name="checkmark" size={14} color={COLORS.text} />
              </View>
              <Text style={[styles.taskText, styles.taskTextDone]}>{task.text}</Text>
            </Pressable>
            <Pressable style={styles.deleteButton} onPress={() => confirmDelete(task)} hitSlop={8}>
              <Ionicons name="trash-outline" size={18} color={COLORS.textMuted} />
            </Pressable>
          </View>
        ))}
      </ScrollView>

      <AddTaskModal
        visible={modalVisible}
        onClose={() => setModalVisible(false)}
        onSave={onAddTask}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: COLORS.background },
  header: { paddingHorizontal: 20, paddingTop: 8, paddingBottom: 12 },
  headerTop: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 12,
  },
  title: { fontSize: 22, fontWeight: '600', color: COLORS.text },
  sub: { fontSize: 13, color: COLORS.purple, marginTop: 4, lineHeight: 18 },
  addButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: COLORS.purple,
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderRadius: 12,
  },
  addButtonText: { color: COLORS.text, fontSize: 14, fontWeight: '600' },
  list: { flex: 1, paddingHorizontal: 16 },
  emptyWrap: {
    alignItems: 'center',
    paddingTop: 48,
    paddingHorizontal: 24,
    gap: 12,
  },
  emptyText: {
    fontSize: 14,
    color: COLORS.textMuted,
    textAlign: 'center',
    lineHeight: 20,
  },
  emptyButton: {
    marginTop: 8,
    paddingHorizontal: 18,
    paddingVertical: 12,
    borderRadius: 12,
    backgroundColor: COLORS.purpleMuted,
    borderWidth: 1,
    borderColor: 'rgba(139, 124, 247, 0.35)',
  },
  emptyButtonText: { color: COLORS.purple, fontWeight: '600' },
  taskRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: COLORS.surface,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: COLORS.border,
    paddingRight: 10,
    marginBottom: 8,
  },
  taskRowDone: { opacity: 0.65 },
  taskMain: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 12,
    padding: 14,
  },
  deleteButton: {
    width: 36,
    height: 36,
    alignItems: 'center',
    justifyContent: 'center',
  },
  checkbox: {
    width: 22,
    height: 22,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 2,
  },
  checkboxDone: {
    backgroundColor: COLORS.purple,
    borderRadius: 6,
  },
  taskBody: { flex: 1, gap: 4 },
  taskText: { fontSize: 15, color: COLORS.text, lineHeight: 21 },
  taskTextDone: { color: COLORS.textMuted, textDecorationLine: 'line-through' },
  taskMeta: { fontSize: 12, color: COLORS.purple },
  doneSection: {
    fontSize: 12,
    fontWeight: '600',
    color: COLORS.textMuted,
    marginTop: 12,
    marginBottom: 8,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
});
