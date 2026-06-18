import React, { useState } from 'react';
import {
  ActivityIndicator,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';

import {
  resetGoogleAccess,
  signInWithGoogle,
  type GoogleUserSession,
} from '@/services/google-auth';

interface Props {
  onLogin: (userInfo: GoogleUserSession) => void;
}

export default function GoogleLogin({ onLogin }: Props) {
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const signIn = async () => {
    setError(null);
    setIsLoading(true);
    try {
      const { session, error: signInError } = await signInWithGoogle();
      if (signInError) {
        setError(signInError);
        return;
      }
      if (session) {
        onLogin(session);
      }
    } finally {
      setIsLoading(false);
    }
  };

  const resetAndSignIn = async () => {
    setError(null);
    setIsLoading(true);
    try {
      await resetGoogleAccess();
      const { session, error: signInError } = await signInWithGoogle();
      if (signInError) {
        setError(signInError);
        return;
      }
      if (session) {
        onLogin(session);
      }
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <View style={styles.container}>
      <View style={styles.iconWrap}>
        <Text style={styles.icon}>G</Text>
      </View>
      <Text style={styles.title}>Koppla Google Mail</Text>
      <Text style={styles.subtitle}>
        Anslut Google för att läsa och skicka mail. När Google frågar — tryck Tillåt för
        mail-behörighet.
      </Text>

      {error ? <Text style={styles.errorText}>{error}</Text> : null}

      <TouchableOpacity
        style={[styles.button, isLoading && styles.buttonDisabled]}
        onPress={signIn}
        disabled={isLoading}
        activeOpacity={0.8}
      >
        {isLoading ? (
          <ActivityIndicator size="small" color="#fff" />
        ) : (
          <Text style={styles.buttonText}>Koppla Google Mail</Text>
        )}
      </TouchableOpacity>

      <TouchableOpacity
        style={styles.secondaryButton}
        onPress={resetAndSignIn}
        disabled={isLoading}
      >
        <Text style={styles.secondaryButtonText}>
          {error ? 'Rensa och försök igen' : 'Problem? Rensa och logga in igen'}
        </Text>
      </TouchableOpacity>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#0D0D0D',
    paddingHorizontal: 32,
    gap: 12,
  },
  iconWrap: {
    width: 64,
    height: 64,
    borderRadius: 32,
    backgroundColor: '#1C1C1C',
    borderWidth: 1,
    borderColor: '#2A2A2A',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 8,
  },
  icon: {
    fontSize: 28,
    fontWeight: '700',
    color: '#8B7CF7',
  },
  title: {
    fontSize: 22,
    fontWeight: '600',
    color: '#F5F5F5',
  },
  subtitle: {
    fontSize: 14,
    color: '#6B6B6B',
    textAlign: 'center',
    lineHeight: 20,
    marginBottom: 8,
  },
  errorText: {
    fontSize: 13,
    color: '#FF6B6B',
    textAlign: 'center',
    lineHeight: 18,
  },
  button: {
    backgroundColor: '#8B7CF7',
    paddingHorizontal: 32,
    paddingVertical: 16,
    borderRadius: 14,
    minWidth: 240,
    alignItems: 'center',
    marginTop: 8,
  },
  buttonDisabled: {
    opacity: 0.6,
  },
  buttonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
  },
  secondaryButton: {
    paddingVertical: 12,
    paddingHorizontal: 16,
  },
  secondaryButtonText: {
    color: '#8B7CF7',
    fontSize: 14,
    fontWeight: '500',
  },
});
