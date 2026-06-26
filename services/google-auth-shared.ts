export const GOOGLE_WEB_CLIENT_ID =
  process.env.EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID ??
  '194397490077-ufj8ubshkv7qjqubmmaptob7p6s680m1.apps.googleusercontent.com';

export const GMAIL_SCOPES = [
  'https://www.googleapis.com/auth/gmail.readonly',
  'https://www.googleapis.com/auth/gmail.send',
];

export type GoogleUserSession = {
  accessToken: string;
  refreshToken?: string;
  expiresAt?: number;
  email?: string;
  name?: string;
  photo?: string;
  id?: string;
};

export async function refreshGoogleAccessTokenWithRefreshToken(
  refreshToken: string,
  clientId: string,
): Promise<{ accessToken: string; expiresIn?: number } | null> {
  try {
    const res = await fetch('https://oauth2.googleapis.com/token', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        grant_type: 'refresh_token',
        refresh_token: refreshToken,
        client_id: clientId,
      }).toString(),
    });

    if (!res.ok) return null;

    const data = (await res.json()) as { access_token?: string; expires_in?: number };
    if (!data.access_token) return null;

    return {
      accessToken: data.access_token,
      expiresIn: data.expires_in,
    };
  } catch {
    return null;
  }
}

export async function checkGmailAccess(
  accessToken: string,
): Promise<{ ok: boolean; message: string }> {
  try {
    const res = await fetch('https://gmail.googleapis.com/gmail/v1/users/me/profile', {
      headers: { Authorization: `Bearer ${accessToken}` },
    });

    if (res.ok) {
      return { ok: true, message: '' };
    }

    if (res.status === 401 || res.status === 403) {
      return {
        ok: false,
        message:
          'Google gav inte mail-behörighet. Gå till Email → Koppla Google Mail igen och tryck Tillåt.',
      };
    }

    return {
      ok: false,
      message: `Kunde inte nå Gmail (fel ${res.status}). Kolla internet.`,
    };
  } catch {
    return {
      ok: false,
      message: 'Kunde inte nå Gmail. Kolla internet och försök igen.',
    };
  }
}
