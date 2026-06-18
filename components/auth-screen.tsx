import { Ionicons } from '@expo/vector-icons';
import { useState } from 'react';
import {
  ActivityIndicator,
  KeyboardAvoidingView,
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
import {
  isAppleSignInAvailable,
  loginWithApple,
  loginWithEmail,
  loginWithGoogle,
  registerWithEmail,
} from '@/services/app-auth';

type Mode = 'login' | 'register';

export function AuthScreen({ isConfigured }: { isConfigured: boolean }) {
  const [mode, setMode] = useState<Mode>('login');
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);

  const run = async (action: () => Promise<{ user: unknown; error: string | null }>) => {
    setError(null);
    setIsLoading(true);
    try {
      const { error: actionError } = await action();
      if (actionError) setError(actionError);
    } finally {
      setIsLoading(false);
    }
  };

  const handleEmail = () => {
    if (!email.trim() || !password) {
      setError('Fyll i e-post och lösenord.');
      return;
    }
    if (mode === 'register') {
      if (!name.trim()) {
        setError('Fyll i ditt namn.');
        return;
      }
      run(() => registerWithEmail(email, password, name));
    } else {
      run(() => loginWithEmail(email, password));
    }
  };

  if (!isConfigured) {
    return (
      <SafeAreaView style={styles.safe}>
        <View style={styles.setupWrap}>
          <Ionicons name="shield-checkmark-outline" size={40} color={COLORS.purple} />
          <Text style={styles.title}>Inloggning aktiveras snart</Text>
          <Text style={styles.setupText}>
            Appen behöver Firebase för inloggning. Detta sätts upp inför Play Store och App Store.
          </Text>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.safe}>
      <KeyboardAvoidingView
        style={styles.flex}
        behavior={Platform.OS === 'ios' ? 'padding' : 'padding'}
      >
        <ScrollView
          contentContainerStyle={styles.scroll}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
        >
          <View style={styles.logoWrap}>
            <Ionicons name="sparkles" size={32} color={COLORS.purple} />
          </View>
          <Text style={styles.title}>My Assistant</Text>
          <Text style={styles.subtitle}>
            Logga in med Google{isAppleSignInAvailable() ? ', Apple' : ''} eller skapa konto med e-post.
          </Text>

          <Pressable
            style={[styles.socialButton, isLoading && styles.disabled]}
            onPress={() => run(loginWithGoogle)}
            disabled={isLoading}
          >
            <Text style={styles.socialIcon}>G</Text>
            <Text style={styles.socialText}>Fortsätt med Google</Text>
          </Pressable>

          {isAppleSignInAvailable() && (
            <Pressable
              style={[styles.socialButton, styles.appleButton, isLoading && styles.disabled]}
              onPress={() => run(loginWithApple)}
              disabled={isLoading}
            >
              <Ionicons name="logo-apple" size={20} color={COLORS.text} />
              <Text style={styles.socialText}>Fortsätt med Apple</Text>
            </Pressable>
          )}

          <View style={styles.dividerRow}>
            <View style={styles.dividerLine} />
            <Text style={styles.dividerText}>eller med e-post</Text>
            <View style={styles.dividerLine} />
          </View>

          <View style={styles.modeRow}>
            <Pressable
              style={[styles.modeTab, mode === 'login' && styles.modeTabActive]}
              onPress={() => setMode('login')}
            >
              <Text style={[styles.modeText, mode === 'login' && styles.modeTextActive]}>
                Logga in
              </Text>
            </Pressable>
            <Pressable
              style={[styles.modeTab, mode === 'register' && styles.modeTabActive]}
              onPress={() => setMode('register')}
            >
              <Text style={[styles.modeText, mode === 'register' && styles.modeTextActive]}>
                Registrera
              </Text>
            </Pressable>
          </View>

          {mode === 'register' && (
            <TextInput
              style={styles.input}
              placeholder="Ditt namn"
              placeholderTextColor={COLORS.textMuted}
              value={name}
              onChangeText={setName}
              autoCapitalize="words"
              editable={!isLoading}
              cursorColor={COLORS.purple}
              keyboardAppearance="dark"
            />
          )}

          <TextInput
            style={styles.input}
            placeholder="E-post"
            placeholderTextColor={COLORS.textMuted}
            value={email}
            onChangeText={setEmail}
            keyboardType="email-address"
            autoCapitalize="none"
            editable={!isLoading}
            cursorColor={COLORS.purple}
            keyboardAppearance="dark"
          />

          <TextInput
            style={styles.input}
            placeholder="Lösenord (minst 6 tecken)"
            placeholderTextColor={COLORS.textMuted}
            value={password}
            onChangeText={setPassword}
            secureTextEntry
            editable={!isLoading}
            cursorColor={COLORS.purple}
            keyboardAppearance="dark"
          />

          {error ? <Text style={styles.error}>{error}</Text> : null}

          <Pressable
            style={[styles.primaryButton, isLoading && styles.disabled]}
            onPress={handleEmail}
            disabled={isLoading}
          >
            {isLoading ? (
              <ActivityIndicator color={COLORS.text} />
            ) : (
              <Text style={styles.primaryButtonText}>
                {mode === 'register' ? 'Skapa konto' : 'Logga in'}
              </Text>
            )}
          </Pressable>

          <Text style={styles.footerHint}>
            Mail och kalender kopplas efter inloggning i respektive flik.
          </Text>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: {
    flex: 1,
    backgroundColor: COLORS.background,
  },
  flex: { flex: 1 },
  scroll: {
    paddingHorizontal: 24,
    paddingBottom: 32,
    paddingTop: 16,
  },
  logoWrap: {
    width: 64,
    height: 64,
    borderRadius: 32,
    backgroundColor: COLORS.purpleMuted,
    alignItems: 'center',
    justifyContent: 'center',
    alignSelf: 'center',
    marginBottom: 16,
  },
  title: {
    fontSize: 26,
    fontWeight: '700',
    color: COLORS.text,
    textAlign: 'center',
  },
  subtitle: {
    fontSize: 14,
    color: COLORS.textMuted,
    textAlign: 'center',
    lineHeight: 20,
    marginTop: 8,
    marginBottom: 24,
  },
  socialButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 10,
    backgroundColor: COLORS.surface,
    borderWidth: 1,
    borderColor: COLORS.border,
    borderRadius: 14,
    paddingVertical: 14,
    marginBottom: 10,
  },
  appleButton: {
    backgroundColor: COLORS.surfaceElevated,
  },
  socialIcon: {
    fontSize: 18,
    fontWeight: '700',
    color: COLORS.purple,
  },
  socialText: {
    fontSize: 16,
    fontWeight: '600',
    color: COLORS.text,
  },
  dividerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    marginVertical: 20,
  },
  dividerLine: {
    flex: 1,
    height: 1,
    backgroundColor: COLORS.border,
  },
  dividerText: {
    fontSize: 12,
    color: COLORS.textMuted,
  },
  modeRow: {
    flexDirection: 'row',
    gap: 8,
    marginBottom: 12,
  },
  modeTab: {
    flex: 1,
    paddingVertical: 10,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: COLORS.border,
    alignItems: 'center',
  },
  modeTabActive: {
    backgroundColor: COLORS.purpleMuted,
    borderColor: 'rgba(139, 124, 247, 0.4)',
  },
  modeText: {
    fontSize: 14,
    color: COLORS.textMuted,
    fontWeight: '500',
  },
  modeTextActive: {
    color: COLORS.purple,
    fontWeight: '600',
  },
  input: {
    backgroundColor: COLORS.surface,
    borderWidth: 1,
    borderColor: COLORS.border,
    borderRadius: 12,
    paddingHorizontal: 14,
    paddingVertical: 14,
    color: '#FFFFFF',
    fontSize: 16,
    marginBottom: 10,
  },
  error: {
    fontSize: 13,
    color: '#FF8A8A',
    textAlign: 'center',
    marginBottom: 8,
  },
  primaryButton: {
    backgroundColor: COLORS.purple,
    borderRadius: 14,
    paddingVertical: 16,
    alignItems: 'center',
    marginTop: 4,
  },
  primaryButtonText: {
    color: COLORS.text,
    fontSize: 16,
    fontWeight: '600',
  },
  disabled: { opacity: 0.6 },
  footerHint: {
    fontSize: 12,
    color: COLORS.textMuted,
    textAlign: 'center',
    marginTop: 16,
    lineHeight: 18,
  },
  setupWrap: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: 32,
    gap: 12,
  },
  setupText: {
    fontSize: 14,
    color: COLORS.textMuted,
    textAlign: 'center',
    lineHeight: 22,
  },
});
