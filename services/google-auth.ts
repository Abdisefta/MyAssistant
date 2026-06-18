import {
  GoogleSignin,
  statusCodes,
} from '@react-native-google-signin/google-signin';

export const WEB_CLIENT_ID =
  '374079725397-jkr64l8u91blmbdeib0r2vnq6hc9s8hq.apps.googleusercontent.com';

export const GMAIL_SCOPES = [
  'https://www.googleapis.com/auth/gmail.readonly',
  'https://www.googleapis.com/auth/gmail.send',
];

GoogleSignin.configure({
  webClientId: WEB_CLIENT_ID,
  offlineAccess: true,
});

export type GoogleUserSession = {
  accessToken: string;
  email?: string;
  name?: string;
  photo?: string;
  id?: string;
};

export async function getGoogleSession(): Promise<GoogleUserSession | null> {
  try {
    const silent = await GoogleSignin.signInSilently();
    if (silent.type !== 'success') return null;

    const scopeResult = await GoogleSignin.addScopes({ scopes: GMAIL_SCOPES });
    if (scopeResult?.type === 'cancelled') return null;

    const tokens = await GoogleSignin.getTokens();
    if (!tokens.accessToken) return null;

    const check = await checkGmailAccess(tokens.accessToken);
    if (!check.ok) return null;

    return {
      accessToken: tokens.accessToken,
      email: silent.data.user.email ?? undefined,
      name: silent.data.user.name ?? undefined,
      photo: silent.data.user.photo ?? undefined,
      id: silent.data.user.id ?? undefined,
    };
  } catch {
    return null;
  }
}

export async function signInWithGoogle(): Promise<{
  session: GoogleUserSession | null;
  error: string | null;
}> {
  try {
    await GoogleSignin.hasPlayServices({ showPlayServicesUpdateDialog: true });

    const response = await GoogleSignin.signIn();
    if (response.type !== 'success') {
      return { session: null, error: null };
    }

    const scopeResult = await GoogleSignin.addScopes({ scopes: GMAIL_SCOPES });
    if (scopeResult?.type === 'cancelled') {
      return {
        session: null,
        error: 'Du måste godkänna mail-behörighet för att fortsätta.',
      };
    }

    const tokens = await GoogleSignin.getTokens();
    if (!tokens.accessToken) {
      return {
        session: null,
        error: 'Kunde inte få åtkomst till Google. Försök logga in igen.',
      };
    }

    const check = await checkGmailAccess(tokens.accessToken);

    if (!check.ok) {
      return {
        session: null,
        error: check.message,
      };
    }

    return {
      session: {
        accessToken: tokens.accessToken,
        email: response.data.user.email ?? undefined,
        name: response.data.user.name ?? undefined,
        photo: response.data.user.photo ?? undefined,
        id: response.data.user.id ?? undefined,
      },
      error: null,
    };
  } catch (err: unknown) {
    const code = (err as { code?: string })?.code;
    const message = (err as { message?: string })?.message ?? '';

    if (code === statusCodes.SIGN_IN_CANCELLED) {
      return { session: null, error: null };
    }
    if (code === statusCodes.IN_PROGRESS) {
      return { session: null, error: 'Inloggning pågår redan. Vänta lite.' };
    }
    if (code === statusCodes.PLAY_SERVICES_NOT_AVAILABLE) {
      return { session: null, error: 'Google Play Services saknas eller behöver uppdateras.' };
    }
    if (code === '10' || message.includes('DEVELOPER_ERROR')) {
      return {
        session: null,
        error:
          'Google-inställning fel (DEVELOPER_ERROR). Kontrollera SHA-1 i Google Cloud Console.',
      };
    }

    console.error('[GoogleAuth] signIn error:', err);
    return {
      session: null,
      error: 'Inloggning misslyckades. Försök igen eller logga ut från Google först.',
    };
  }
}

export async function refreshGoogleAccessToken(): Promise<string | null> {
  try {
    const tokens = await GoogleSignin.getTokens();
    return tokens.accessToken ?? null;
  } catch {
    return null;
  }
}

export async function signOutGoogle(): Promise<void> {
  try {
    await GoogleSignin.signOut();
  } catch {
    // ignore
  }
}

export async function resetGoogleAccess(): Promise<void> {
  try {
    await GoogleSignin.revokeAccess();
  } catch {
    // ignore
  }
  try {
    await GoogleSignin.signOut();
  } catch {
    // ignore
  }
}

async function checkGmailAccess(accessToken: string): Promise<{ ok: boolean; message: string }> {
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
          'Google gav inte mail-behörighet. Gå till Inställningar → Rensa Google → logga in igen och tryck Tillåt.',
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
