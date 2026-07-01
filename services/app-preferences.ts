import AsyncStorage from '@react-native-async-storage/async-storage';

const LAST_SEEN_VERSION_KEY = '@myassistant/last-seen-version';
const ASSISTANT_TIP_SEEN_KEY = '@myassistant/assistant-tip-seen';

export async function getLastSeenVersion(): Promise<string | null> {
  return AsyncStorage.getItem(LAST_SEEN_VERSION_KEY);
}

export async function setLastSeenVersion(version: string): Promise<void> {
  await AsyncStorage.setItem(LAST_SEEN_VERSION_KEY, version);
}

export async function hasSeenAssistantTip(): Promise<boolean> {
  return (await AsyncStorage.getItem(ASSISTANT_TIP_SEEN_KEY)) === '1';
}

export async function markAssistantTipSeen(): Promise<void> {
  await AsyncStorage.setItem(ASSISTANT_TIP_SEEN_KEY, '1');
}
