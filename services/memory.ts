import AsyncStorage from '@react-native-async-storage/async-storage';

import {
  DEFAULT_MEMORY,
  MEMORY_STORAGE_KEY,
  type ConversationMessage,
  type UserMemory,
} from '@/types/memory';

export function getMemoryStorageKey(userId?: string): string {
  if (userId) return `${MEMORY_STORAGE_KEY}_${userId}`;
  return MEMORY_STORAGE_KEY;
}

export async function loadMemory(userId?: string): Promise<UserMemory> {
  try {
    const raw = await AsyncStorage.getItem(getMemoryStorageKey(userId));
    if (!raw) return { ...DEFAULT_MEMORY };

    const parsed = JSON.parse(raw) as Partial<UserMemory>;
    return {
      ...DEFAULT_MEMORY,
      ...parsed,
      preferences: parsed.preferences ?? [],
      personalNotes: parsed.personalNotes ?? [],
      conversationHistory: parsed.conversationHistory ?? [],
      meetingRemindersEnabled: parsed.meetingRemindersEnabled ?? true,
      reminderMinutesBefore: parsed.reminderMinutesBefore ?? 15,
    };
  } catch {
    return { ...DEFAULT_MEMORY };
  }
}

export async function saveMemory(memory: UserMemory, userId?: string): Promise<void> {
  await AsyncStorage.setItem(getMemoryStorageKey(userId), JSON.stringify(memory));
}

export async function clearConversationHistory(userId?: string): Promise<UserMemory> {
  const memory = await loadMemory(userId);
  const updated = { ...memory, conversationHistory: [] };
  await saveMemory(updated, userId);
  return updated;
}

export function createMessage(role: 'user' | 'assistant', text: string): ConversationMessage {
  return {
    id: `${Date.now()}-${role}-${Math.random().toString(36).slice(2, 8)}`,
    role,
    text,
    timestamp: Date.now(),
  };
}

export function buildSystemPrompt(memory: UserMemory, meetingContext?: string): string {
  const preferences =
    memory.preferences.length > 0
      ? memory.preferences.join('\n- ')
      : 'Inga sparade preferenser ännu.';

  const notes =
    memory.personalNotes.length > 0
      ? memory.personalNotes.join('\n- ')
      : 'Inga personliga anteckningar ännu.';

  const meetings =
    meetingContext?.trim() || 'Inga möten inlästa från kalendern just nu.';

  return `Du är My Assistant, en personlig AI-assistent för ${memory.name || 'användaren'}.

ANVÄNDARE:
- Namn: ${memory.name || 'Okänd'}
- Yrke/job: ${memory.job || 'Okänt'}

PREFERENSER:
- ${preferences}

PERSONLIGA ANTECKNINGAR (saker du lärt dig om användaren):
- ${notes}

KOMMANDE MÖTEN (från kalendern):
- ${meetings}

INSTRUKTIONER:
- Svara alltid på svenska.
- Var personlig och använd användarens namn när det passar.
- Referera till tidigare konversationer, preferenser och möten när det är relevant.
- Bli mer personlig och hjälpsam ju mer användaren pratar med dig.
- Håll svaren koncisa och naturliga (bra för röstuppläsning, max 2-3 meningar om möjligt).
- Du hjälper med email, kalender, uppgifter och vardagliga frågor.
- Om användaren frågar om möten, använd kalenderinformationen ovan.`;
}
