import AsyncStorage from '@react-native-async-storage/async-storage';

export const BOSS_CONTACT_STORAGE_KEY = '@my_assistant_boss_contact';

export type BossContact = {
  name: string;
  email: string;
};

function parseBossContact(raw: string): BossContact | null {
  try {
    const parsed = JSON.parse(raw) as Partial<BossContact>;
    const email = parsed.email?.trim().toLowerCase() ?? '';
    if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return null;
    return {
      name: parsed.name?.trim() ?? '',
      email,
    };
  } catch {
    return null;
  }
}

export async function loadBossContact(): Promise<BossContact | null> {
  const raw = await AsyncStorage.getItem(BOSS_CONTACT_STORAGE_KEY);
  if (!raw) return null;
  return parseBossContact(raw);
}

export async function saveBossContact(contact: BossContact): Promise<void> {
  const name = contact.name.trim();
  const email = contact.email.trim().toLowerCase();
  if (!email) {
    await AsyncStorage.removeItem(BOSS_CONTACT_STORAGE_KEY);
    return;
  }
  await AsyncStorage.setItem(BOSS_CONTACT_STORAGE_KEY, JSON.stringify({ name, email }));
}
