import {
  GoogleSignin,
  isErrorWithCode,
  isSuccessResponse,
  statusCodes,
} from '@react-native-google-signin/google-signin';

import { GMAIL_SCOPES, GOOGLE_WEB_CLIENT_ID } from '@/services/google-auth-shared';

const GOOGLE_IOS_CLIENT_ID = process.env.EXPO_PUBLIC_GOOGLE_IOS_CLIENT_ID ?? '';

export type GoogleSignInMode = 'auth' | 'gmail';

let lastMode: GoogleSignInMode | null = null;

export function configureGoogleSignIn(mode: GoogleSignInMode = 'auth'): void {
  if (lastMode === mode) return;
  lastMode = mode;

  GoogleSignin.configure({
    webClientId: GOOGLE_WEB_CLIENT_ID,
    iosClientId: GOOGLE_IOS_CLIENT_ID || undefined,
    scopes: mode === 'gmail' ? GMAIL_SCOPES : undefined,
    offlineAccess: mode === 'gmail',
  });
}

export async function googleSignInForAuth(): Promise<{
  idToken: string | null;
  error: string | null;
}> {
  configureGoogleSignIn('auth');

  try {
    await GoogleSignin.hasPlayServices({ showPlayServicesUpdateDialog: true });
    const response = await GoogleSignin.signIn();

    if (!isSuccessResponse(response)) {
      return { idToken: null, error: null };
    }

    const idToken = response.data.idToken;
    if (!idToken) {
      return {
        idToken: null,
        error: 'Google gav ingen inloggningstoken. Kontrollera SHA-1 i Firebase Console.',
      };
    }

    return { idToken, error: null };
  } catch (err: unknown) {
    return { idToken: null, error: mapGoogleError(err) };
  }
}

export async function googleSignInForGmail(): Promise<{
  accessToken: string | null;
  email?: string;
  name?: string;
  photo?: string;
  id?: string;
  error: string | null;
}> {
  configureGoogleSignIn('gmail');

  try {
    await GoogleSignin.hasPlayServices({ showPlayServicesUpdateDialog: true });
    const response = await GoogleSignin.signIn();

    if (!isSuccessResponse(response)) {
      return { accessToken: null, error: null };
    }

    const tokens = await GoogleSignin.getTokens();
    const profile = response.data.user;

    return {
      accessToken: tokens.accessToken,
      email: profile.email ?? undefined,
      name: profile.name ?? undefined,
      photo: profile.photo ?? undefined,
      id: profile.id,
      error: null,
    };
  } catch (err: unknown) {
    return { accessToken: null, error: mapGoogleError(err) };
  }
}

export async function refreshGoogleTokens(): Promise<string | null> {
  try {
    configureGoogleSignIn('gmail');
    const tokens = await GoogleSignin.getTokens();
    return tokens.accessToken ?? null;
  } catch {
    return null;
  }
}

export async function signOutGoogleNative(): Promise<void> {
  try {
    await GoogleSignin.signOut();
  } catch {
    // ignore
  }
  lastMode = null;
}

function mapGoogleError(err: unknown): string {
  if (isErrorWithCode(err)) {
    if (err.code === statusCodes.SIGN_IN_CANCELLED) {
      return '';
    }
    if (err.code === statusCodes.IN_PROGRESS) {
      return 'Google-inloggning pågår redan.';
    }
    if (err.code === statusCodes.PLAY_SERVICES_NOT_AVAILABLE) {
      return 'Google Play Services saknas på enheten.';
    }
  }
  const message = err instanceof Error ? err.message : String(err);
  return message || 'Google-inloggning misslyckades.';
}
