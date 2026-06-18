import AsyncStorage from '@react-native-async-storage/async-storage';
import * as AppleAuthentication from 'expo-apple-authentication';
import { GoogleSignin } from '@react-native-google-signin/google-signin';
import { initializeApp, getApps, type FirebaseApp } from 'firebase/app';
import {
  createUserWithEmailAndPassword,
  getAuth,
  GoogleAuthProvider,
  initializeAuth,
  getReactNativePersistence,
  OAuthProvider,
  onAuthStateChanged,
  signInWithCredential,
  signInWithEmailAndPassword,
  signOut as firebaseSignOut,
  updateProfile,
  type Auth,
  type User,
} from 'firebase/auth';
import { Platform } from 'react-native';

import { FIREBASE_CONFIG, isFirebaseConfigured } from '@/constants/firebase';
import {
  configureGoogleSignIn,
  isGoogleSignInConfigured,
} from '@/services/google-signin-config';

export type AppUser = {
  uid: string;
  email: string | null;
  displayName: string | null;
  provider: 'google' | 'apple' | 'email' | 'unknown';
};

let firebaseApp: FirebaseApp | null = null;
let auth: Auth | null = null;

function getProviderId(user: User): AppUser['provider'] {
  const providerId = user.providerData[0]?.providerId;
  if (providerId === 'google.com') return 'google';
  if (providerId === 'apple.com') return 'apple';
  if (providerId === 'password') return 'email';
  return 'unknown';
}

export function mapFirebaseUser(user: User): AppUser {
  return {
    uid: user.uid,
    email: user.email,
    displayName: user.displayName,
    provider: getProviderId(user),
  };
}

export function getFirebaseAuth(): Auth | null {
  if (!isFirebaseConfigured()) return null;

  if (!firebaseApp) {
    firebaseApp = getApps().length
      ? getApps()[0]
      : initializeApp(FIREBASE_CONFIG);
  }

  if (!auth) {
    try {
      auth = initializeAuth(firebaseApp, {
        persistence: getReactNativePersistence(AsyncStorage),
      });
    } catch {
      auth = getAuth(firebaseApp);
    }
  }

  return auth;
}

export function subscribeToAuth(callback: (user: AppUser | null) => void): () => void {
  const firebaseAuth = getFirebaseAuth();
  if (!firebaseAuth) {
    callback(null);
    return () => undefined;
  }

  return onAuthStateChanged(firebaseAuth, (user) => {
    callback(user ? mapFirebaseUser(user) : null);
  });
}

export async function registerWithEmail(
  email: string,
  password: string,
  name: string,
): Promise<{ user: AppUser | null; error: string | null }> {
  const firebaseAuth = getFirebaseAuth();
  if (!firebaseAuth) {
    return { user: null, error: 'Inloggning är inte konfigurerad ännu. Kontakta support.' };
  }

  try {
    const result = await createUserWithEmailAndPassword(
      firebaseAuth,
      email.trim(),
      password,
    );
    if (name.trim()) {
      await updateProfile(result.user, { displayName: name.trim() });
    }
    return { user: mapFirebaseUser(result.user), error: null };
  } catch (err: unknown) {
    return { user: null, error: mapAuthError(err) };
  }
}

export async function loginWithEmail(
  email: string,
  password: string,
): Promise<{ user: AppUser | null; error: string | null }> {
  const firebaseAuth = getFirebaseAuth();
  if (!firebaseAuth) {
    return { user: null, error: 'Inloggning är inte konfigurerad ännu.' };
  }

  try {
    const result = await signInWithEmailAndPassword(
      firebaseAuth,
      email.trim(),
      password,
    );
    return { user: mapFirebaseUser(result.user), error: null };
  } catch (err: unknown) {
    return { user: null, error: mapAuthError(err) };
  }
}

export async function loginWithGoogle(): Promise<{ user: AppUser | null; error: string | null }> {
  const firebaseAuth = getFirebaseAuth();
  if (!firebaseAuth) {
    return { user: null, error: 'Inloggning är inte konfigurerad ännu.' };
  }

  if (!isGoogleSignInConfigured()) {
    return {
      user: null,
      error: 'Google-inloggning är inte konfigurerad. Sätt EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID.',
    };
  }

  try {
    configureGoogleSignIn();
    await GoogleSignin.hasPlayServices({ showPlayServicesUpdateDialog: true });
    const response = await GoogleSignin.signIn();
    if (response.type !== 'success') {
      return { user: null, error: null };
    }

    const tokens = await GoogleSignin.getTokens();
    if (!tokens.idToken) {
      return { user: null, error: 'Kunde inte logga in med Google. Försök igen.' };
    }

    const credential = GoogleAuthProvider.credential(tokens.idToken);
    const result = await signInWithCredential(firebaseAuth, credential);
    return { user: mapFirebaseUser(result.user), error: null };
  } catch (err: unknown) {
    return { user: null, error: mapAuthError(err) };
  }
}

export async function loginWithApple(): Promise<{ user: AppUser | null; error: string | null }> {
  if (Platform.OS !== 'ios') {
    return { user: null, error: 'Apple-inloggning finns bara på iPhone.' };
  }

  const firebaseAuth = getFirebaseAuth();
  if (!firebaseAuth) {
    return { user: null, error: 'Inloggning är inte konfigurerad ännu.' };
  }

  try {
    const available = await AppleAuthentication.isAvailableAsync();
    if (!available) {
      return { user: null, error: 'Apple-inloggning är inte tillgänglig på denna enhet.' };
    }

    const appleResult = await AppleAuthentication.signInAsync({
      requestedScopes: [
        AppleAuthentication.AppleAuthenticationScope.FULL_NAME,
        AppleAuthentication.AppleAuthenticationScope.EMAIL,
      ],
    });

    if (!appleResult.identityToken) {
      return { user: null, error: 'Apple-inloggning misslyckades. Försök igen.' };
    }

    const provider = new OAuthProvider('apple.com');
    const credential = provider.credential({
      idToken: appleResult.identityToken,
    });
    const result = await signInWithCredential(firebaseAuth, credential);

    if (appleResult.fullName?.givenName && !result.user.displayName) {
      const name = [appleResult.fullName.givenName, appleResult.fullName.familyName]
        .filter(Boolean)
        .join(' ');
      if (name) await updateProfile(result.user, { displayName: name });
    }

    return { user: mapFirebaseUser(result.user), error: null };
  } catch (err: unknown) {
    const code = (err as { code?: string })?.code;
    if (code === 'ERR_REQUEST_CANCELED') {
      return { user: null, error: null };
    }
    return { user: null, error: mapAuthError(err) };
  }
}

export async function signOutApp(): Promise<void> {
  const firebaseAuth = getFirebaseAuth();
  if (firebaseAuth) {
    await firebaseSignOut(firebaseAuth);
  }
}

export function isAppleSignInAvailable(): boolean {
  return Platform.OS === 'ios';
}

function mapAuthError(err: unknown): string {
  const code = (err as { code?: string })?.code ?? '';
  const message = (err as { message?: string })?.message ?? '';

  switch (code) {
    case 'auth/email-already-in-use':
      return 'E-postadressen används redan. Logga in istället.';
    case 'auth/invalid-email':
      return 'Ogiltig e-postadress.';
    case 'auth/weak-password':
      return 'Lösenordet måste vara minst 6 tecken.';
    case 'auth/user-not-found':
    case 'auth/wrong-password':
    case 'auth/invalid-credential':
      return 'Fel e-post eller lösenord.';
    case 'auth/too-many-requests':
      return 'För många försök. Vänta lite och försök igen.';
    case 'auth/network-request-failed':
      return 'Nätverksfel. Kolla internet.';
    default:
      if (message.includes('DEVELOPER_ERROR')) {
        return 'Google-inloggning fel. Kontrollera SHA-1 och Web client ID i Google Cloud.';
      }
      return 'Inloggning misslyckades. Försök igen.';
  }
}
