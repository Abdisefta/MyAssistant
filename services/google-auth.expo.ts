import AsyncStorage from '@react-native-async-storage/async-storage';

import {
  checkGmailAccess,
  GMAIL_SCOPES,
  GOOGLE_WEB_CLIENT_ID,
  refreshGoogleAccessTokenWithRefreshToken,
  type GoogleUserSession,
} from '@/services/google-auth-shared';

export { GOOGLE_WEB_CLIENT_ID, GMAIL_SCOPES, type GoogleUserSession };

const SESSION_KEY = '@my_assistant_gmail_oauth_session';

export async function getGoogleSession(): Promise<GoogleUserSession | null> {
  try {
    const raw = await AsyncStorage.getItem(SESSION_KEY);
    if (!raw) return null;
    const session = JSON.parse(raw) as GoogleUserSession;
    if (!session.accessToken) return null;
    const check = await checkGmailAccess(session.accessToken);
    return check.ok ? session : null;
  } catch {
    return null;
  }
}

export async function saveGoogleSessionFromAccessToken(): Promise<GoogleUserSession | null> {
  return null;
}

export async function signInWithGoogle(): Promise<{
  session: GoogleUserSession | null;
  error: string | null;
}> {
  return {
    session: null,
    error: 'Gmail kopplas senare. Du är inloggad i appen — använd Assistent och Kalender.',
  };
}

export async function refreshGoogleAccessToken(): Promise<string | null> {
  const session = await getGoogleSession();
  if (!session?.accessToken) return null;

  if (session.refreshToken) {
    const refreshed = await refreshGoogleAccessTokenWithRefreshToken(
      session.refreshToken,
      GOOGLE_WEB_CLIENT_ID,
    );
    if (refreshed) return refreshed.accessToken;
  }

  return session.accessToken;
}

export async function signOutGoogle(): Promise<void> {
  await AsyncStorage.removeItem(SESSION_KEY);
}

export async function resetGoogleAccess(): Promise<void> {
  await AsyncStorage.removeItem(SESSION_KEY);
}
