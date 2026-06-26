import * as FileSystem from 'expo-file-system/legacy';

const PROFILE_BASENAME = 'profile-photo';

function guessExtension(uri: string): string {
  const lower = uri.toLowerCase();
  if (lower.includes('.png')) return 'png';
  if (lower.includes('.webp')) return 'webp';
  return 'jpg';
}

/** Kopierar vald bild till appens permanenta lagring så den överlever omstart. */
export async function persistProfilePhoto(sourceUri: string): Promise<string> {
  const docDir = FileSystem.documentDirectory;
  if (!docDir) {
    throw new Error('Document directory unavailable');
  }

  const ext = guessExtension(sourceUri);
  const dest = `${docDir}${PROFILE_BASENAME}.${ext}`;

  for (const oldExt of ['jpg', 'jpeg', 'png', 'webp']) {
    await FileSystem.deleteAsync(`${docDir}${PROFILE_BASENAME}.${oldExt}`, { idempotent: true });
  }

  await FileSystem.copyAsync({ from: sourceUri, to: dest });
  return dest;
}
