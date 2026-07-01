import AsyncStorage from '@react-native-async-storage/async-storage';

import {
  checkGmailAccess,
  GMAIL_SCOPES,
  GOOGLE_WEB_CLIENT_ID,
  refreshGoogleAccessTokenWithRefreshToken,
  type GoogleUserSession,
} from '@/services/google-auth-shared';
import {
  googleSignInForGmail,
  refreshGoogleTokens,
  signOutGoogleNative,
} from '@/services/google-signin-config';

export { GOOGLE_WEB_CLIENT_ID, GMAIL_SCOPES, type GoogleUserSession };

const SESSION_KEY = '@my_assistant_gmail_oauth_session';

async function persistSession(session: GoogleUserSession): Promise<void> {
  await AsyncStorage.setItem(SESSION_KEY, JSON.stringify(session));
}

export async function getGoogleSession(): Promise<GoogleUserSession | null> {
  try {
    const raw = await AsyncStorage.getItem(SESSION_KEY);
    if (!raw) return null;

    const session = JSON.parse(raw) as GoogleUserSession;
    if (!session.accessToken) return null;

    if (session.refreshToken) {
      const refreshed = await refreshGoogleAccessTokenWithRefreshToken(
        session.refreshToken,
        GOOGLE_WEB_CLIENT_ID,
      );
      if (refreshed?.accessToken) {
        session.accessToken = refreshed.accessToken;
        if (refreshed.expiresIn) {
          session.expiresAt = Date.now() + refreshed.expiresIn * 1000;
        }
        await persistSession(session);
      }
    }

    const check = await checkGmailAccess(session.accessToken);
    return check.ok ? session : null;
  } catch {
    return null;
  }
}

export async function signInWithGoogle(): Promise<{
  session: GoogleUserSession | null;
  error: string | null;
}> {
  try {
    const { accessToken, email, name, photo, id, error } = await googleSignInForGmail();
    if (error) {
      return { session: null, error: error || null };
    }
    if (!accessToken) {
      return { session: null, error: null };
    }

    const session: GoogleUserSession = {
      accessToken,
      email,
      name,
      photo,
      id,
    };

    const check = await checkGmailAccess(session.accessToken);
    if (!check.ok) {
      return {
        session: null,
        error:
          check.message ||
          'Google gav inte mail-behörighet. Tryck Tillåt när Google frågar om Gmail.',
      };
    }

    await persistSession(session);
    return { session, error: null };
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : String(err);
    return {
      session: null,
      error: message || 'Kunde inte koppla Gmail. Försök igen.',
    };
  }
}

export async function refreshGoogleAccessToken(): Promise<string | null> {
  const session = await getGoogleSession();
  if (!session?.accessToken) return null;

  const fresh = await refreshGoogleTokens();
  if (fresh) {
    session.accessToken = fresh;
    await persistSession(session);
    return fresh;
  }

  return session.accessToken;
}

export async function signOutGoogle(): Promise<void> {
  await signOutGoogleNative();
  await AsyncStorage.removeItem(SESSION_KEY);
}

export async function resetGoogleAccess(): Promise<void> {
  await signOutGoogle();
}
