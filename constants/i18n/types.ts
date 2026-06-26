/** Top 20 world languages + sv, fi, da, no */
export const APP_LOCALES = [
  'en',
  'zh',
  'hi',
  'es',
  'fr',
  'ar',
  'bn',
  'pt',
  'ru',
  'ur',
  'id',
  'de',
  'ja',
  'sw',
  'mr',
  'te',
  'tr',
  'ta',
  'vi',
  'ko',
  'sv',
  'fi',
  'da',
  'no',
] as const;

export type AppLocale = (typeof APP_LOCALES)[number];

export type Translations = {
  localeName: string;
  tabs: {
    home: string;
    email: string;
    calendar: string;
    assistant: string;
    tasks: string;
    settings: string;
  };
  common: {
    loading: string;
    loadingMemory: string;
    you: string;
    assistant: string;
    thinking: string;
    listening: string;
    comingSoon: string;
  };
  assistant: {
    writePlaceholder: string;
    micHint: string;
    micListening: string;
    micStop: string;
    micThinking: string;
    modelLabel: string;
  };
  tasks: {
    title: string;
    subtitleOpen: string;
    subtitleEmpty: string;
    empty: string;
    reminder: string;
    done: string;
  };
  settings: {
    title: string;
    app: string;
    mode: string;
    testMode: string;
    testModeDesc: string;
    language: string;
    languageAuto: string;
    googleMail: string;
    loggedInAs: string;
    logoutGoogle: string;
    clearGoogle: string;
    notLoggedInGoogle: string;
    profile: string;
    name: string;
    job: string;
    meetingReminders: string;
    remindersOn: string;
    remindersOff: string;
    enableReminders: string;
    disableReminders: string;
    remindersHint: string;
    notificationStyle: string;
    notificationSound: string;
    notificationVibration: string;
    notificationSilent: string;
    notificationStyleHint: string;
    preferences: string;
    noPreferences: string;
    personalMemory: string;
    noNotes: string;
    conversations: string;
    clearHistory: string;
  };
  onboarding: {
    title: string;
    subtitle: string;
    nameLabel: string;
    namePlaceholder: string;
    jobLabel: string;
    jobPlaceholder: string;
    start: string;
  };
  gmail: {
    title: string;
    subtitle: string;
  };
  welcome: {
    default: string;
  };
  gemini: {
    replyLanguage: string;
    adaptToNeeds: string;
  };
  home: {
    greetingMorning: string;
    greetingAfternoon: string;
    greetingEvening: string;
    greetingNight: string;
    greetingName: string;
    weather: string;
    meetingsToday: string;
    noMeetings: string;
    unreadMail: string;
    openTasks: string;
    allDay: string;
    talkToAssistant: string;
    adaptHint: string;
    weatherUnavailable: string;
    briefingMorning: string;
    briefingEvening: string;
    meetingPrep: string;
    meetingPrepNext: string;
    meetingPrepNone: string;
    meetingPrepAsk: string;
    calendarFamily: string;
    calendarWork: string;
    calendarColleagues: string;
    calendarOther: string;
    calendarGrouped: string;
    usageTitle: string;
    usageOpens: string;
    usageMinutes: string;
    usageSessionsToday: string;
    usageChats: string;
  };
  calendar: {
    today: string;
    tomorrow: string;
    allDay: string;
    permissionTitle: string;
    permissionText: string;
    allowAccess: string;
    openSettings: string;
    loadError: string;
    emptyDay: string;
    platformHint: string;
    bookedSuccess: string;
    meetingSoon: string;
    meetingBody: string;
  };
  notifications: {
    taskTitle: string;
    meetingsChannel: string;
    tasksChannel: string;
  };
  agent: {
    bookingCancelled: string;
    emailCancelled: string;
    pendingBooking: string;
    pendingEmail: string;
    gmailRequiredSend: string;
    gmailRequiredEmail: string;
    calendarLoadError: string;
    gmailLoadError: string;
    gmailNotConnected: string;
    genericError: string;
  };
};

export type TranslationKey = keyof Translations;
