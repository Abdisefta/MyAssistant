export type ConversationMessage = {
  id: string;
  role: 'user' | 'assistant';
  text: string;
  timestamp: number;
};

/** Uppgift agenten minns — visas diskret, inte som massa list-UI. */
export type AgentTask = {
  id: string;
  text: string;
  createdAt: number;
  remindAt?: number;
  done: boolean;
};

export type UserMemory = {
  name: string;
  job: string;
  preferences: string[];
  personalNotes: string[];
  tasks: AgentTask[];
  onboardingComplete: boolean;
  conversationHistory: ConversationMessage[];
  meetingRemindersEnabled: boolean;
  reminderMinutesBefore: number;
  /** Slut på sjukanmäld period (epoch ms), om användaren sagt att hen är sjuk. */
  sickUntil?: number;
  /** Hur mötes- och påminnelsenotiser ska bete sig. */
  notificationAlertStyle?: NotificationAlertStyle;
  /** Profilbild på Hem (lokal fil-URI). */
  profilePhotoUri?: string;
};

export type NotificationAlertStyle = 'sound' | 'vibration' | 'silent';

export const MEMORY_STORAGE_KEY = '@my_assistant_memory';

export const DEFAULT_MEMORY: UserMemory = {
  name: '',
  job: '',
  preferences: [],
  personalNotes: [],
  tasks: [],
  onboardingComplete: false,
  conversationHistory: [],
  meetingRemindersEnabled: true,
  reminderMinutesBefore: 15,
  notificationAlertStyle: 'sound',
};
