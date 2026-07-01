import AsyncStorage from '@react-native-async-storage/async-storage';

const INVALIDATE_KEY = '@email_cache_invalidate';

type Listener = () => void;
const listeners = new Set<Listener>();

/** Call after assistant or any external path sends mail — Email tab refreshes Skickade. */
export async function markSentEmailCacheDirty(): Promise<void> {
  await AsyncStorage.setItem(INVALIDATE_KEY, String(Date.now()));
  for (const fn of listeners) fn();
}

export function subscribeSentEmailCacheInvalidation(listener: Listener): () => void {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

export async function consumeSentEmailCacheInvalidation(): Promise<boolean> {
  const value = await AsyncStorage.getItem(INVALIDATE_KEY);
  if (!value) return false;
  await AsyncStorage.removeItem(INVALIDATE_KEY);
  return true;
}
