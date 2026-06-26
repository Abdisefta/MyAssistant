import AsyncStorage from '@react-native-async-storage/async-storage';
import { initializeApp, getApps, type FirebaseApp } from 'firebase/app';
import {
  createUserWithEmailAndPassword,
  getAuth,
  initializeAuth,
  getReactNativePersistence,
  onAuthStateChanged,
  signInWithEmailAndPassword,
  signOut as firebaseSignOut,
  updateProfile,
  type Auth,
  type User,
} from 'firebase/auth';

import { FIREBASE_CONFIG, isFirebaseConfigured } from '@/constants/firebase';

export type AppUser = {
  uid: string;
  email: string | null;
  displayName: string | null;
  provider: 'email';
};

let firebaseApp: FirebaseApp | null = null;
let auth: Auth | null = null;

export function mapFirebaseUser(user: User): AppUser {
  return {
    uid: user.uid,
    email: user.email,
    displayName: user.displayName,
    provider: 'email',
  };
}

export function getFirebaseAuth(): Auth | null {
  if (!isFirebaseConfigured()) return null;

  if (!firebaseApp) {
    firebaseApp = getApps().length ? getApps()[0] : initializeApp(FIREBASE_CONFIG);
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
    return { user: null, error: 'Inloggning är inte konfigurerad.' };
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
    return { user: null, error: 'Inloggning är inte konfigurerad.' };
  }

  try {
    const result = await signInWithEmailAndPassword(firebaseAuth, email.trim(), password);
    return { user: mapFirebaseUser(result.user), error: null };
  } catch (err: unknown) {
    return { user: null, error: mapAuthError(err) };
  }
}

export async function signOutApp(): Promise<void> {
  const firebaseAuth = getFirebaseAuth();
  if (firebaseAuth) {
    await firebaseSignOut(firebaseAuth);
  }
}

function mapAuthError(err: unknown): string {
  const code = (err as { code?: string })?.code ?? '';

  switch (code) {
    case 'auth/email-already-in-use':
      return 'E-postadressen används redan. Tryck Registrera och logga in istället.';
    case 'auth/invalid-email':
      return 'Ogiltig e-postadress.';
    case 'auth/weak-password':
      return 'Lösenordet måste vara minst 6 tecken.';
    case 'auth/user-not-found':
    case 'auth/wrong-password':
    case 'auth/invalid-credential':
      return 'Fel e-post eller lösenord. Har du inget konto? Tryck Registrera.';
    case 'auth/too-many-requests':
      return 'För många försök. Vänta lite och försök igen.';
    case 'auth/network-request-failed':
      return 'Nätverksfel. Kolla att telefonen har internet.';
    case 'auth/operation-not-allowed':
      return 'E-post är inte aktiverat i Firebase. Gå till Authentication → Sign-in method → Email/Password → Enable.';
    case 'auth/invalid-api-key':
      return 'Firebase-nyckeln blockeras. Kontakta support eller försök igen om en stund.';
    default:
      return code
        ? `Inloggning misslyckades (${code}). Försök igen.`
        : 'Inloggning misslyckades. Försök igen.';
  }
}
