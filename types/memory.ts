export type ConversationMessage = {
  id: string;
  role: 'user' | 'assistant';
  text: string;
  timestamp: number;
};

export type UserMemory = {
  name: string;
  job: string;
  preferences: string[];
  personalNotes: string[];
  onboardingComplete: boolean;
  conversationHistory: ConversationMessage[];
  meetingRemindersEnabled: boolean;
  reminderMinutesBefore: number;
};

export const MEMORY_STORAGE_KEY = '@my_assistant_memory';

export const DEFAULT_MEMORY: UserMemory = {
  name: '',
  job: '',
  preferences: [],
  personalNotes: [],
  onboardingComplete: false,
  conversationHistory: [],
  meetingRemindersEnabled: true,
  reminderMinutesBefore: 15,
};
