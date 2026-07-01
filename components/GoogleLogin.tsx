import { Ionicons } from '@expo/vector-icons';
import { useState } from 'react';
import { ActivityIndicator, Pressable, StyleSheet, Text, View } from 'react-native';

import { APP_COLORS as COLORS } from '@/constants/app-theme';
import { useLocale } from '@/contexts/locale-context';
import { signInWithGoogle, type GoogleUserSession } from '@/services/google-auth';

type Props = {
  onConnected: (session: GoogleUserSession) => void;
};

export default function GoogleLogin({ onConnected }: Props) {
  const { strings } = useLocale();
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleConnect = async () => {
    setError(null);
    setIsLoading(true);
    try {
      const { session, error: connectError } = await signInWithGoogle();
      if (connectError) {
        setError(connectError);
        return;
      }
      if (session) {
        onConnected(session);
      }
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <View style={styles.container}>
      <View style={styles.iconWrap}>
        <Ionicons name="mail-outline" size={36} color={COLORS.purple} />
      </View>
      <Text style={styles.title}>{strings.gmail.title}</Text>
      <Text style={styles.subtitle}>{strings.gmail.subtitle}</Text>

      <Pressable
        style={[styles.connectButton, isLoading && styles.disabled]}
        onPress={handleConnect}
        disabled={isLoading}
      >
        {isLoading ? (
          <ActivityIndicator color={COLORS.text} />
        ) : (
          <>
            <Ionicons name="logo-google" size={20} color={COLORS.text} />
            <Text style={styles.connectButtonText}>{strings.gmail.connectButton}</Text>
          </>
        )}
      </Pressable>

      <Text style={styles.hint}>{strings.gmail.connectHint}</Text>
      {error ? <Text style={styles.error}>{error}</Text> : null}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: COLORS.background,
    paddingHorizontal: 28,
    gap: 10,
  },
  iconWrap: {
    width: 72,
    height: 72,
    borderRadius: 36,
    backgroundColor: COLORS.purpleMuted,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 8,
  },
  title: {
    fontSize: 22,
    fontWeight: '700',
    color: COLORS.text,
    textAlign: 'center',
  },
  subtitle: {
    fontSize: 14,
    color: COLORS.textMuted,
    textAlign: 'center',
    lineHeight: 21,
    marginBottom: 8,
  },
  connectButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 10,
    backgroundColor: COLORS.purple,
    paddingHorizontal: 22,
    paddingVertical: 15,
    borderRadius: 14,
    minWidth: 260,
    marginTop: 4,
  },
  connectButtonText: {
    color: COLORS.text,
    fontSize: 16,
    fontWeight: '600',
  },
  hint: {
    fontSize: 12,
    color: COLORS.textMuted,
    textAlign: 'center',
    lineHeight: 18,
    marginTop: 6,
    paddingHorizontal: 12,
  },
  error: {
    fontSize: 13,
    color: '#FF8A8A',
    textAlign: 'center',
    lineHeight: 19,
    marginTop: 8,
  },
  disabled: { opacity: 0.65 },
});
