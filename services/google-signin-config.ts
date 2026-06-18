import { GoogleSignin } from '@react-native-google-signin/google-signin';

export const GOOGLE_WEB_CLIENT_ID = process.env.EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID ?? '';

let configured = false;

export function configureGoogleSignIn(): void {
  if (configured || !GOOGLE_WEB_CLIENT_ID) return;

  GoogleSignin.configure({
    webClientId: GOOGLE_WEB_CLIENT_ID,
    offlineAccess: true,
  });
  configured = true;
}

export function isGoogleSignInConfigured(): boolean {
  return Boolean(GOOGLE_WEB_CLIENT_ID);
}
