import { Platform } from 'react-native';
import * as AppleAuthentication from 'expo-apple-authentication';

import {
  configureGoogleSignIn,
  googleSignInForAuth,
} from '@/services/google-signin-config';

export function configureSocialAuth(): void {
  configureGoogleSignIn('auth');
}

export async function signInWithGoogleNative(): Promise<{
  idToken: string | null;
  error: string | null;
}> {
  const result = await googleSignInForAuth();
  if (!result.error) return result;
  return { idToken: null, error: result.error || null };
}

export async function signInWithAppleNative(): Promise<{
  identityToken: string | null;
  error: string | null;
}> {
  if (Platform.OS !== 'ios') {
    return { identityToken: null, error: 'Apple-inloggning finns bara på iPhone/iPad.' };
  }

  const available = await AppleAuthentication.isAvailableAsync();
  if (!available) {
    return { identityToken: null, error: 'Sign in with Apple är inte tillgängligt på denna enhet.' };
  }

  try {
    const credential = await AppleAuthentication.signInAsync({
      requestedScopes: [
        AppleAuthentication.AppleAuthenticationScope.FULL_NAME,
        AppleAuthentication.AppleAuthenticationScope.EMAIL,
      ],
    });

    if (!credential.identityToken) {
      return { identityToken: null, error: 'Apple gav ingen inloggningstoken.' };
    }

    return { identityToken: credential.identityToken, error: null };
  } catch (err: unknown) {
    const code = (err as { code?: string })?.code;
    if (code === 'ERR_REQUEST_CANCELED') {
      return { identityToken: null, error: null };
    }
    const message = err instanceof Error ? err.message : String(err);
    return { identityToken: null, error: message || 'Apple-inloggning misslyckades.' };
  }
}

export function isAppleSignInAvailable(): boolean {
  return Platform.OS === 'ios';
}
