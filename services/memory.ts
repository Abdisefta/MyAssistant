import AsyncStorage from '@react-native-async-storage/async-storage';

import {
  DEFAULT_MEMORY,
  MEMORY_STORAGE_KEY,
  type ConversationMessage,
  type UserMemory,
} from '@/types/memory';

export async function loadMemory(): Promise<UserMemory> {
  try {
    const raw = await AsyncStorage.getItem(MEMORY_STORAGE_KEY);
    if (!raw) return { ...DEFAULT_MEMORY };

    const parsed = JSON.parse(raw) as Partial<UserMemory>;
    return {
      ...DEFAULT_MEMORY,
      ...parsed,
      preferences: parsed.preferences ?? [],
      personalNotes: parsed.personalNotes ?? [],
      conversationHistory: parsed.conversationHistory ?? [],
    };
  } catch {
    return { ...DEFAULT_MEMORY };
  }
}

export async function saveMemory(memory: UserMemory): Promise<void> {
  await AsyncStorage.setItem(MEMORY_STORAGE_KEY, JSON.stringify(memory));
}

export async function clearConversationHistory(): Promise<UserMemory> {
  const memory = await loadMemory();
  const updated = { ...memory, conversationHistory: [] };
  await saveMemory(updated);
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

export function buildSystemPrompt(memory: UserMemory): string {
  const preferences =
    memory.preferences.length > 0
      ? memory.preferences.join('\n- ')
      : 'Inga sparade preferenser ännu.';

  const notes =
    memory.personalNotes.length > 0
      ? memory.personalNotes.join('\n- ')
      : 'Inga personliga anteckningar ännu.';

  return `Du är My Assistant, en personlig AI-assistent.

ANVÄNDARE:
- Namn: ${memory.name || 'Okänd'}
- Yrke/job: ${memory.job || 'Okänt'}

PREFERENSER:
- ${preferences}

PERSONLIGA ANTECKNINGAR (saker du lärt dig om användaren):
- ${notes}

INSTRUKTIONER:
- Svara alltid på svenska.
- Var personlig och använd användarens namn när det passar.
- Referera till tidigare konversationer och preferenser när det är relevant.
- Bli mer personlig och hjälpsam ju mer användaren pratar med dig.
- Håll svaren koncisa och naturliga (bra för röstuppläsning, max 2-3 meningar om möjligt).
- Du hjälper med email, kalender, uppgifter och vardagliga frågor.`;
}
