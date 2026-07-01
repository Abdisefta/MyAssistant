import AsyncStorage from '@react-native-async-storage/async-storage';
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

import { FIREBASE_CONFIG, isFirebaseConfigured } from '@/constants/firebase';

export type AppUser = {
  uid: string;
  email: string | null;
  displayName: string | null;
  provider: 'email' | 'google' | 'apple';
};

let firebaseApp: FirebaseApp | null = null;
let auth: Auth | null = null;

function detectProvider(user: User): AppUser['provider'] {
  const providerId = user.providerData[0]?.providerId;
  if (providerId === 'google.com') return 'google';
  if (providerId === 'apple.com') return 'apple';
  return 'email';
}

export function mapFirebaseUser(user: User): AppUser {
  return {
    uid: user.uid,
    email: user.email,
    displayName: user.displayName,
    provider: detectProvider(user),
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

export async function signInWithGoogleCredential(
  idToken: string,
): Promise<{ user: AppUser | null; error: string | null }> {
  const firebaseAuth = getFirebaseAuth();
  if (!firebaseAuth) {
    return { user: null, error: 'Inloggning är inte konfigurerad.' };
  }

  try {
    const credential = GoogleAuthProvider.credential(idToken);
    const result = await signInWithCredential(firebaseAuth, credential);
    return { user: mapFirebaseUser(result.user), error: null };
  } catch (err: unknown) {
    return { user: null, error: mapAuthError(err) };
  }
}

export async function signInWithAppleCredential(
  identityToken: string,
): Promise<{ user: AppUser | null; error: string | null }> {
  const firebaseAuth = getFirebaseAuth();
  if (!firebaseAuth) {
    return { user: null, error: 'Inloggning är inte konfigurerad.' };
  }

  try {
    const provider = new OAuthProvider('apple.com');
    const credential = provider.credential({ idToken: identityToken });
    const result = await signInWithCredential(firebaseAuth, credential);
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
      return 'Denna inloggningsmetod är inte aktiverad i Firebase (Authentication → Sign-in method).';
    case 'auth/account-exists-with-different-credential':
      return 'E-postadressen är redan kopplad till ett annat konto. Logga in med den metoden du använde först.';
    case 'auth/popup-closed-by-user':
      return 'Inloggning avbröts.';
    case 'auth/invalid-api-key':
    case 'auth/api-key-not-valid':
    case 'auth/api-key-not-valid.-please-pass-a-valid-api-key.':
      return 'Firebase-nyckeln i appen är ogiltig. Uppdatera .env med rätt nycklar från Firebase Console och bygg om APK — eller tryck "Fortsätt utan konto" nedan.';
    default:
      if (code.includes('api-key-not-valid') || code.includes('invalid-api-key')) {
        return 'Firebase-nyckeln i appen är ogiltig. Uppdatera .env med rätt nycklar från Firebase Console och bygg om APK — eller tryck "Fortsätt utan konto" nedan.';
      }
      return code
        ? `Inloggning misslyckades (${code}). Försök igen.`
        : 'Inloggning misslyckades. Försök igen.';
  }
}
