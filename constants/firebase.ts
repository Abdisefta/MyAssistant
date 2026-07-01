/** Firebase client config — prefer build-time generated values for release APKs. */
import { Platform } from 'react-native';
import Constants from 'expo-constants';

import { FIREBASE_BUILD_CONFIG } from '@/constants/firebase.generated';

type FirebaseExtra = {
  apiKey?: string;
  androidApiKey?: string;
  authDomain?: string;
  projectId?: string;
  storageBucket?: string;
  messagingSenderId?: string;
  appId?: string;
};

const extraFirebase = (Constants.expoConfig?.extra?.firebase ?? {}) as FirebaseExtra;

function pick(...values: Array<string | undefined>): string {
  for (const value of values) {
    if (value) return value;
  }
  return '';
}

function resolveApiKey(): string {
  const webKey = pick(
    FIREBASE_BUILD_CONFIG.apiKey,
    extraFirebase.apiKey,
    process.env.EXPO_PUBLIC_FIREBASE_API_KEY,
  );
  const androidKey = pick(
    FIREBASE_BUILD_CONFIG.androidApiKey,
    extraFirebase.androidApiKey,
    process.env.EXPO_PUBLIC_FIREBASE_ANDROID_API_KEY,
  );

  return Platform.OS === 'android' && androidKey ? androidKey : webKey;
}

export const FIREBASE_CONFIG = {
  apiKey: resolveApiKey(),
  authDomain: pick(
    FIREBASE_BUILD_CONFIG.authDomain,
    extraFirebase.authDomain,
    process.env.EXPO_PUBLIC_FIREBASE_AUTH_DOMAIN,
  ),
  projectId: pick(
    FIREBASE_BUILD_CONFIG.projectId,
    extraFirebase.projectId,
    process.env.EXPO_PUBLIC_FIREBASE_PROJECT_ID,
  ),
  storageBucket: pick(
    FIREBASE_BUILD_CONFIG.storageBucket,
    extraFirebase.storageBucket,
    process.env.EXPO_PUBLIC_FIREBASE_STORAGE_BUCKET,
  ),
  messagingSenderId: pick(
    FIREBASE_BUILD_CONFIG.messagingSenderId,
    extraFirebase.messagingSenderId,
    process.env.EXPO_PUBLIC_FIREBASE_MESSAGING_SENDER_ID,
  ),
  appId: pick(
    FIREBASE_BUILD_CONFIG.appId,
    extraFirebase.appId,
    process.env.EXPO_PUBLIC_FIREBASE_APP_ID,
  ),
};

export function isFirebaseConfigured(): boolean {
  return Boolean(
    FIREBASE_CONFIG.apiKey &&
      FIREBASE_CONFIG.authDomain &&
      FIREBASE_CONFIG.projectId &&
      FIREBASE_CONFIG.appId,
  );
}

export function getFirebaseConfigPreview(): string {
  const key = FIREBASE_CONFIG.apiKey;
  if (!key) return 'Firebase ej konfigurerad';
  const platform = Platform.OS === 'android' ? 'Android' : Platform.OS;
  return `${platform} · ${key.slice(0, 8)}…${key.slice(-4)} · ${FIREBASE_CONFIG.projectId}`;
}
