import { Ionicons } from '@expo/vector-icons';
import { useMemo } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { APP_COLORS as COLORS } from '@/constants/app-theme';
import { getSwedishHolidayForDate } from '@/services/swedish-holidays';

type Props = {
  monthDate: Date;
  selectedDate: Date;
  busyDays: Set<string>;
  onSelectDay: (date: Date) => void;
  onPrevMonth: () => void;
  onNextMonth: () => void;
};

const WEEKDAYS = ['M', 'T', 'O', 'T', 'F', 'L', 'S'];

function dayKey(d: Date): string {
  return d.toISOString().slice(0, 10);
}

function isSameDay(a: Date, b: Date): boolean {
  return (
    a.getFullYear() === b.getFullYear() &&
    a.getMonth() === b.getMonth() &&
    a.getDate() === b.getDate()
  );
}

export function CalendarMonthView({
  monthDate,
  selectedDate,
  busyDays,
  onSelectDay,
  onPrevMonth,
  onNextMonth,
}: Props) {
  const cells = useMemo(() => {
    const year = monthDate.getFullYear();
    const month = monthDate.getMonth();
    const first = new Date(year, month, 1);
    const startOffset = (first.getDay() + 6) % 7;
    const gridStart = new Date(year, month, 1 - startOffset);
    return Array.from({ length: 42 }, (_, i) => {
      const d = new Date(gridStart);
      d.setDate(gridStart.getDate() + i);
      return d;
    });
  }, [monthDate]);

  const title = monthDate.toLocaleDateString('sv-SE', { month: 'long', year: 'numeric' });

  return (
    <View style={styles.wrap}>
      <View style={styles.header}>
        <Pressable onPress={onPrevMonth} hitSlop={12}>
          <Ionicons name="chevron-back" size={22} color={COLORS.purple} />
        </Pressable>
        <Text style={styles.title}>{title}</Text>
        <Pressable onPress={onNextMonth} hitSlop={12}>
          <Ionicons name="chevron-forward" size={22} color={COLORS.purple} />
        </Pressable>
      </View>

      <View style={styles.weekRow}>
        {WEEKDAYS.map((w) => (
          <Text key={w} style={styles.weekday}>
            {w}
          </Text>
        ))}
      </View>

      <View style={styles.grid}>
        {cells.map((d) => {
          const inMonth = d.getMonth() === monthDate.getMonth();
          const selected = isSameDay(d, selectedDate);
          const today = isSameDay(d, new Date());
          const holiday = getSwedishHolidayForDate(d);
          const busy = busyDays.has(dayKey(d));

          return (
            <Pressable
              key={dayKey(d)}
              style={[
                styles.cell,
                selected && styles.cellSelected,
                today && styles.cellToday,
              ]}
              onPress={() => onSelectDay(d)}
            >
              <Text
                style={[
                  styles.dayNum,
                  !inMonth && styles.dayMuted,
                  holiday?.isRedDay && styles.dayRed,
                  selected && styles.daySelected,
                ]}
              >
                {d.getDate()}
              </Text>
              {holiday?.isRedDay ? <View style={styles.redDot} /> : busy ? <View style={styles.dot} /> : null}
            </Pressable>
          );
        })}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { marginBottom: 12 },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 8,
  },
  title: {
    fontSize: 17,
    fontWeight: '600',
    color: COLORS.text,
    textTransform: 'capitalize',
  },
  weekRow: {
    flexDirection: 'row',
    marginBottom: 4,
  },
  weekday: {
    flex: 1,
    textAlign: 'center',
    fontSize: 12,
    color: COLORS.textMuted,
    fontWeight: '600',
  },
  grid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
  },
  cell: {
    width: '14.2857%',
    minHeight: 44,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 10,
  },
  cellSelected: {
    backgroundColor: COLORS.purpleMuted,
  },
  cellToday: {
    borderWidth: 1,
    borderColor: 'rgba(139, 124, 247, 0.5)',
  },
  dayNum: {
    fontSize: 15,
    color: COLORS.text,
    fontWeight: '500',
  },
  dayMuted: {
    color: COLORS.textMuted,
    opacity: 0.45,
  },
  dayRed: {
    color: '#FF8A8A',
  },
  daySelected: {
    color: COLORS.purple,
    fontWeight: '700',
  },
  dot: {
    width: 5,
    height: 5,
    borderRadius: 3,
    backgroundColor: COLORS.purple,
    marginTop: 2,
  },
  redDot: {
    width: 5,
    height: 5,
    borderRadius: 3,
    backgroundColor: '#FF8A8A',
    marginTop: 2,
  },
});
