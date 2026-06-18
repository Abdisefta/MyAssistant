import { Ionicons } from '@expo/vector-icons';
import { useEffect, useState } from 'react';
import { Linking, Pressable, StyleSheet, Text, View } from 'react-native';

import { APP_COLORS as COLORS } from '@/constants/app-theme';
import { countEventsForDay } from '@/services/device-calendar';

type Props = {
  accessToken?: string;
  userName?: string;
  onOpenEmail?: () => void;
};

async function fetchUnreadCount(accessToken: string): Promise<number | null> {
  try {
    const res = await fetch('https://gmail.googleapis.com/gmail/v1/users/me/labels/INBOX', {
      headers: { Authorization: `Bearer ${accessToken}` },
    });
    if (!res.ok) return null;
    const data = await res.json();
    return typeof data.messagesUnread === 'number' ? data.messagesUnread : null;
  } catch {
    return null;
  }
}

export function MorningBriefing({ accessToken, userName, onOpenEmail }: Props) {
  const [unread, setUnread] = useState<number | null>(null);
  const [meetingsToday, setMeetingsToday] = useState<number | null>(null);

  useEffect(() => {
    if (!accessToken) {
      setUnread(null);
      return;
    }
    fetchUnreadCount(accessToken).then(setUnread);
  }, [accessToken]);

  useEffect(() => {
    countEventsForDay(new Date()).then(setMeetingsToday);
  }, []);

  const greeting = userName ? `God morgon, ${userName.split(' ')[0]}` : 'Dagens briefing';

  const openMaps = () => {
    Linking.openURL('https://www.google.com/maps/search/?api=1&query=kontor');
  };

  return (
    <View style={styles.wrap}>
      <Text style={styles.greeting}>{greeting}</Text>
      <View style={styles.row}>
        <Pressable style={styles.card} onPress={onOpenEmail}>
          <Ionicons name="mail-outline" size={18} color={COLORS.purple} />
          <Text style={styles.cardValue}>
            {unread !== null ? unread : '—'}
          </Text>
          <Text style={styles.cardLabel}>Olästa mail</Text>
        </Pressable>

        <View style={styles.card}>
          <Ionicons name="calendar-outline" size={18} color={COLORS.purple} />
          <Text style={styles.cardValue}>
            {meetingsToday !== null ? meetingsToday : '—'}
          </Text>
          <Text style={styles.cardLabel}>Möten idag</Text>
        </View>

        <Pressable style={styles.card} onPress={openMaps}>
          <Ionicons name="car-outline" size={18} color={COLORS.purple} />
          <Text style={styles.cardValue}>+12</Text>
          <Text style={styles.cardLabel}>min till jobbet</Text>
        </Pressable>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    marginBottom: 4,
  },
  greeting: {
    fontSize: 13,
    color: COLORS.textMuted,
    marginBottom: 10,
  },
  row: {
    flexDirection: 'row',
    gap: 8,
  },
  card: {
    flex: 1,
    backgroundColor: COLORS.surface,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: COLORS.border,
    paddingVertical: 10,
    paddingHorizontal: 8,
    alignItems: 'center',
    gap: 2,
  },
  cardValue: {
    fontSize: 16,
    fontWeight: '600',
    color: COLORS.text,
  },
  cardLabel: {
    fontSize: 10,
    color: COLORS.textMuted,
    textAlign: 'center',
  },
});
