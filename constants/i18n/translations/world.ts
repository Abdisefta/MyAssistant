import type { Translations } from '@/constants/i18n/types';
import { en } from '@/constants/i18n/translations/en';

function pick(
  localeName: string,
  geminiLang: string,
  tabs: Partial<Translations['tabs']>,
  partial?: Partial<Omit<Translations, 'localeName' | 'tabs'>>,
): Translations {
  return {
    ...en,
    ...partial,
    localeName,
    tabs: { ...en.tabs, ...tabs },
    common: { ...en.common, ...partial?.common },
    assistant: { ...en.assistant, ...partial?.assistant },
    tasks: { ...en.tasks, ...partial?.tasks },
    settings: { ...en.settings, ...partial?.settings },
    onboarding: { ...en.onboarding, ...partial?.onboarding },
    gmail: { ...en.gmail, ...partial?.gmail },
    welcome: { ...en.welcome, ...partial?.welcome },
    home: { ...en.home, ...partial?.home },
    calendar: { ...en.calendar, ...partial?.calendar },
    notifications: { ...en.notifications, ...partial?.notifications },
    agent: { ...en.agent, ...partial?.agent },
    gemini: {
      ...en.gemini,
      replyLanguage: geminiLang,
      ...(partial?.gemini ?? {}),
    },
  };
}

export const de: Translations = {
  localeName: 'Deutsch',
  tabs: { home: 'Start', email: 'E-Mail', calendar: 'Kalender', assistant: 'Assistent', tasks: 'Aufgaben', settings: 'Einstellungen' },
  common: { loading: 'Laden...', loadingMemory: 'Speicher laden...', you: 'Du', assistant: 'Assistent', thinking: 'Denke...', listening: 'Höre zu...', comingSoon: 'Demnächst' },
  assistant: { writePlaceholder: 'Schreib dem Assistenten...', micHint: 'Mikrofon tippen — sprechen — erneut tippen', micListening: 'Hört zu…', micStop: 'Sendet…', micThinking: 'Gemini denkt...', modelLabel: 'Gemini Flash' },
  tasks: { title: 'Aufgaben', subtitleOpen: '{{count}} offen — sag es dem Assistenten', subtitleEmpty: 'Z.B. „Erinnere mich ans Einkaufen"', empty: 'Noch keine Aufgaben.', reminder: 'Erinnerung', done: 'Erledigt' },
  settings: { title: 'Einstellungen', app: 'App', mode: 'Modus', testMode: 'Test — kein Login', testModeDesc: 'Assistent und Kalender direkt nutzen.', language: 'Sprache', languageAuto: 'Automatisch (vom Handy)', googleMail: 'Google Mail', loggedInAs: 'Angemeldet als', logoutGoogle: 'Bei Google abmelden', clearGoogle: 'Google-Berechtigung löschen', notLoggedInGoogle: 'Nicht bei Google angemeldet', profile: 'Profil', name: 'Name', job: 'Beruf', meetingReminders: 'Terminerinnerungen', remindersOn: 'An — {{minutes}} Min. vorher', remindersOff: 'Aus', enableReminders: 'Erinnerungen aktivieren', disableReminders: 'Erinnerungen deaktivieren', remindersHint: 'Der Assistent erinnert vor Terminen.', preferences: 'Vorlieben', noPreferences: 'Noch keine Vorlieben', personalMemory: 'Persönliches Gedächtnis', noNotes: 'Der Assistent lernt beim Sprechen', conversations: 'Gespräche ({{count}} Nachrichten)', clearHistory: 'Verlauf löschen' },
  onboarding: { title: 'Willkommen bei My Assistant', subtitle: 'Sag Name und Beruf — ich passe mich an.', nameLabel: 'Wie heißt du?', namePlaceholder: 'Dein Name', jobLabel: 'Was machst du?', jobPlaceholder: 'z.B. Lehrer', start: 'Los geht\'s' },
  gmail: { title: 'Gmail kommt bald', subtitle: 'E-Mail später. Assistent und Kalender funktionieren.' },
  welcome: { default: 'Hallo! Sprich wie mit einem Freund — ich helfe im Alltag.' },
  home: {
    greetingMorning: 'Guten Morgen',
    greetingAfternoon: 'Guten Tag',
    greetingEvening: 'Guten Abend',
    greetingNight: 'Gute Nacht',
    greetingName: '{{greeting}}, {{name}}',
    weather: 'Wetter',
    meetingsToday: 'Termine heute',
    noMeetings: 'Keine Termine heute',
    unreadMail: 'Ungelesene Mails',
    openTasks: 'Offene Aufgaben',
    allDay: 'Ganztägig',
    talkToAssistant: 'Mit Assistent sprechen',
    adaptHint: 'Ich passe mich deinen Bedürfnissen an — je mehr wir reden, desto besser verstehe ich dich.',
    weatherUnavailable: 'Wetter nicht verfügbar',
  },
  gemini: {
    replyLanguage: 'Antworte immer auf Deutsch. Natürlich, kurze Sätze für Sprache.',
    adaptToNeeds: 'Du passt dich den Bedürfnissen der Person an — du lernst Gewohnheiten und Wünsche beim Sprechen.',
  },
  calendar: {
    today: 'Heute', tomorrow: 'Morgen', allDay: 'Ganztägig', permissionTitle: 'Kalenderberechtigung nötig',
    permissionText: 'Zugriff erlauben, um Termine anzuzeigen.', allowAccess: 'Kalender erlauben', openSettings: 'Einstellungen öffnen',
    loadError: 'Kalender konnte nicht geladen werden.', emptyDay: 'Nichts geplant. Tippe Termin buchen.', platformHint: 'Termine werden in der App und im Telefonkalender gespeichert.',
    bookedSuccess: 'Termin gespeichert für {{day}}.', meetingSoon: 'Termin bald', meetingBody: '{{title}} beginnt in {{minutes}} Min ({{time}})',
  },
  notifications: { taskTitle: 'Erinnerung', meetingsChannel: 'Termine', tasksChannel: 'Aufgaben' },
  agent: {
    bookingCancelled: 'OK, nichts im Kalender gebucht.', emailCancelled: 'OK, E-Mail nicht gesendet.', pendingBooking: 'Ausstehende Buchung: {{summary}}. Sage "ja" oder "buchen".',
    pendingEmail: 'Ausstehende E-Mail. Sage "senden" oder "abbrechen".', gmailRequiredSend: 'Verbinde zuerst Google Mail.', gmailRequiredEmail: 'Google Mail unter E-Mail verbinden.',
    calendarLoadError: 'Kalenderinfo nicht verfügbar.', gmailLoadError: 'Gmail konnte nicht gelesen werden.', gmailNotConnected: 'Gmail nicht verbunden.', genericError: 'Etwas ist schiefgelaufen.',
  },
};

export const es: Translations = {
  localeName: 'Español',
  tabs: { home: 'Inicio', email: 'Correo', calendar: 'Calendario', assistant: 'Asistente', tasks: 'Tareas', settings: 'Ajustes' },
  common: { loading: 'Cargando...', loadingMemory: 'Cargando memoria...', you: 'Tú', assistant: 'Asistente', thinking: 'Pensando...', listening: 'Escuchando...', comingSoon: 'Próximamente' },
  assistant: { writePlaceholder: 'Escribe al asistente...', micHint: 'Toca el micrófono — habla — toca otra vez', micListening: 'Escuchando…', micStop: 'Enviando…', micThinking: 'Gemini piensa...', modelLabel: 'Gemini Flash' },
  tasks: { title: 'Tareas', subtitleOpen: '{{count}} por hacer', subtitleEmpty: 'Ej.: "recuérdame comprar"', empty: 'Sin tareas aún.', reminder: 'Recordatorio', done: 'Hecho' },
  settings: { title: 'Ajustes', app: 'App', mode: 'Modo', testMode: 'Prueba — sin inicio de sesión', testModeDesc: 'Usa Asistente y Calendario directamente.', language: 'Idioma', languageAuto: 'Automático (del teléfono)', googleMail: 'Google Mail', loggedInAs: 'Conectado como', logoutGoogle: 'Cerrar sesión Google', clearGoogle: 'Borrar permiso Google', notLoggedInGoogle: 'Sin Google', profile: 'Perfil', name: 'Nombre', job: 'Trabajo', meetingReminders: 'Avisos de reuniones', remindersOn: 'On — {{minutes}} min antes', remindersOff: 'Off', enableReminders: 'Activar avisos', disableReminders: 'Desactivar avisos', remindersHint: 'El asistente avisa antes de reuniones.', preferences: 'Preferencias', noPreferences: 'Sin preferencias', personalMemory: 'Memoria personal', noNotes: 'Aprende mientras hablas', conversations: 'Conversaciones ({{count}})', clearHistory: 'Borrar historial' },
  onboarding: { title: 'Bienvenido a My Assistant', subtitle: 'Di tu nombre y trabajo — me adapto a ti.', nameLabel: '¿Cómo te llamas?', namePlaceholder: 'Tu nombre', jobLabel: '¿A qué te dedicas?', jobPlaceholder: 'ej. profesor', start: 'Empezar' },
  gmail: { title: 'Gmail pronto', subtitle: 'Correo más tarde. Asistente y Calendario funcionan.' },
  welcome: { default: '¡Hola! Habla como con un amigo — te ayudo en el día a día.' },
  home: {
    greetingMorning: 'Buenos días',
    greetingAfternoon: 'Buenas tardes',
    greetingEvening: 'Buenas noches',
    greetingNight: 'Buenas noches',
    greetingName: '{{greeting}}, {{name}}',
    weather: 'Tiempo',
    meetingsToday: 'Reuniones hoy',
    noMeetings: 'Sin reuniones hoy',
    unreadMail: 'Correo sin leer',
    openTasks: 'Tareas pendientes',
    allDay: 'Todo el día',
    talkToAssistant: 'Hablar con el asistente',
    adaptHint: 'Me adapto a tus necesidades — cuanto más hablamos, mejor te entiendo.',
    weatherUnavailable: 'Tiempo no disponible',
  },
  gemini: {
    replyLanguage: 'Responde siempre en español. Natural, frases cortas para voz.',
    adaptToNeeds: 'Te adaptas a las necesidades de la persona — aprendes hábitos y deseos al hablar.',
  },
  calendar: {
    today: 'Hoy', tomorrow: 'Mañana', allDay: 'Todo el día', permissionTitle: 'Permiso de calendario',
    permissionText: 'Permite acceso para ver reuniones.', allowAccess: 'Permitir calendario', openSettings: 'Abrir ajustes',
    loadError: 'No se pudo cargar el calendario.', emptyDay: 'Nada planeado. Toca Reservar reunión.', platformHint: 'Las reuniones se guardan en la app y en el teléfono.',
    bookedSuccess: 'Reunión guardada para {{day}}.', meetingSoon: 'Reunión pronto', meetingBody: '{{title}} empieza en {{minutes}} min ({{time}})',
  },
  notifications: { taskTitle: 'Recordatorio', meetingsChannel: 'Reuniones', tasksChannel: 'Tareas' },
  agent: {
    bookingCancelled: 'OK, no reservé en el calendario.', emailCancelled: 'OK, no envié el correo.', pendingBooking: 'Reserva pendiente: {{summary}}. Di "sí" o "reservar".',
    pendingEmail: 'Correo pendiente. Di "enviar" o "cancelar".', gmailRequiredSend: 'Conecta Google Mail primero.', gmailRequiredEmail: 'Conecta Google Mail en Email.',
    calendarLoadError: 'Info del calendario no disponible.', gmailLoadError: 'Gmail no se pudo leer.', gmailNotConnected: 'Gmail no conectado.', genericError: 'Algo salió mal.',
  },
};

export const fr: Translations = {
  localeName: 'Français',
  tabs: { home: 'Accueil', email: 'E-mail', calendar: 'Calendrier', assistant: 'Assistant', tasks: 'Tâches', settings: 'Réglages' },
  common: { loading: 'Chargement...', loadingMemory: 'Chargement mémoire...', you: 'Vous', assistant: 'Assistant', thinking: 'Réflexion...', listening: 'Écoute...', comingSoon: 'Bientôt' },
  assistant: { writePlaceholder: 'Écrire à l\'assistant...', micHint: 'Appuyez sur le micro — parlez — réappuyez', micListening: 'Écoute…', micStop: 'Envoi…', micThinking: 'Gemini réfléchit...', modelLabel: 'Gemini Flash' },
  tasks: { title: 'Tâches', subtitleOpen: '{{count}} à faire', subtitleEmpty: 'Ex. « rappelle-moi d\'acheter »', empty: 'Pas encore de tâches.', reminder: 'Rappel', done: 'Fait' },
  settings: { title: 'Réglages', app: 'App', mode: 'Mode', testMode: 'Test — sans connexion', testModeDesc: 'Utilisez Assistant et Calendrier directement.', language: 'Langue', languageAuto: 'Automatique (téléphone)', googleMail: 'Google Mail', loggedInAs: 'Connecté en tant que', logoutGoogle: 'Déconnexion Google', clearGoogle: 'Effacer permission Google', notLoggedInGoogle: 'Non connecté Google', profile: 'Profil', name: 'Nom', job: 'Métier', meetingReminders: 'Rappels de réunion', remindersOn: 'On — {{minutes}} min avant', remindersOff: 'Off', enableReminders: 'Activer rappels', disableReminders: 'Désactiver rappels', remindersHint: 'L\'assistant rappelle avant les réunions.', preferences: 'Préférences', noPreferences: 'Aucune préférence', personalMemory: 'Mémoire personnelle', noNotes: 'Apprend en parlant', conversations: 'Conversations ({{count}})', clearHistory: 'Effacer l\'historique' },
  onboarding: { title: 'Bienvenue sur My Assistant', subtitle: 'Dites votre nom et métier — je m\'adapte.', nameLabel: 'Comment vous appelez-vous ?', namePlaceholder: 'Votre nom', jobLabel: 'Que faites-vous ?', jobPlaceholder: 'ex. enseignant', start: 'Commencer' },
  gmail: { title: 'Gmail bientôt', subtitle: 'E-mail plus tard. Assistant et Calendrier marchent.' },
  welcome: { default: 'Bonjour ! Parlez comme à un ami — j\'aide au quotidien.' },
  home: {
    greetingMorning: 'Bonjour',
    greetingAfternoon: 'Bon après-midi',
    greetingEvening: 'Bonsoir',
    greetingNight: 'Bonne nuit',
    greetingName: '{{greeting}}, {{name}}',
    weather: 'Météo',
    meetingsToday: 'Réunions aujourd\'hui',
    noMeetings: 'Pas de réunion aujourd\'hui',
    unreadMail: 'Mails non lus',
    openTasks: 'Tâches à faire',
    allDay: 'Toute la journée',
    talkToAssistant: 'Parler à l\'assistant',
    adaptHint: 'Je m\'adapte à vos besoins — plus nous parlons, mieux je vous comprends.',
    weatherUnavailable: 'Météo indisponible',
  },
  gemini: {
    replyLanguage: 'Réponds toujours en français. Naturel, phrases courtes pour la voix.',
    adaptToNeeds: 'Tu t\'adaptes aux besoins de la personne — tu apprends ses habitudes en parlant.',
  },
  calendar: {
    today: 'Aujourd\'hui', tomorrow: 'Demain', allDay: 'Toute la journée', permissionTitle: 'Autorisation calendrier',
    permissionText: 'Autorisez l\'accès pour voir les réunions.', allowAccess: 'Autoriser calendrier', openSettings: 'Ouvrir réglages',
    loadError: 'Impossible de charger le calendrier.', emptyDay: 'Rien de prévu. Appuyez sur Réserver.', platformHint: 'Les réunions sont enregistrées dans l\'app et le téléphone.',
    bookedSuccess: 'Réunion enregistrée pour {{day}}.', meetingSoon: 'Réunion bientôt', meetingBody: '{{title}} commence dans {{minutes}} min ({{time}})',
  },
  notifications: { taskTitle: 'Rappel', meetingsChannel: 'Réunions', tasksChannel: 'Tâches' },
  agent: {
    bookingCancelled: 'OK, rien réservé au calendrier.', emailCancelled: 'OK, e-mail non envoyé.', pendingBooking: 'Réservation en attente : {{summary}}. Dites "oui" ou "réserver".',
    pendingEmail: 'E-mail en attente. Dites "envoyer" ou "annuler".', gmailRequiredSend: 'Connectez Google Mail d\'abord.', gmailRequiredEmail: 'Connectez Google Mail dans E-mail.',
    calendarLoadError: 'Info calendrier indisponible.', gmailLoadError: 'Gmail illisible.', gmailNotConnected: 'Gmail non connecté.', genericError: 'Une erreur s\'est produite.',
  },
};

export const zh: Translations = pick('中文', '请始终用简体中文回答。自然、简短，适合语音。', { email: '邮件', calendar: '日历', assistant: '助手', tasks: '任务', settings: '设置' }, {
  common: { loading: '加载中...', loadingMemory: '加载记忆...', you: '你', assistant: '助手', thinking: '思考中...', listening: '聆听中...', comingSoon: '即将推出' },
  assistant: { writePlaceholder: '写给助手...', micHint: '点击麦克风 — 说话 — 再点发送', micListening: '聆听中…', micStop: '发送中…', micThinking: 'Gemini 思考中...', modelLabel: 'Gemini Flash' },
  welcome: { default: '你好！像和朋友聊天一样 — 我帮你管理日程和生活。' },
});

export const hi: Translations = pick('हिन्दी', 'हमेशा हिन्दी में जवाब दें। प्राकृतिक, छोटे वाक्य।', { email: 'ईमेल', calendar: 'कैलेंडर', assistant: 'सहायक', tasks: 'कार्य', settings: 'सेटिंग्स' }, {
  common: { loading: 'लोड हो रहा...', loadingMemory: 'मेमोरी...', you: 'आप', assistant: 'सहायक', thinking: 'सोच रहा...', listening: 'सुन रहा...', comingSoon: 'जल्द' },
  welcome: { default: 'नमस्ते! दोस्त की तरह बात करें — मैं मदद करूँगा।' },
});

export const ar: Translations = pick('العربية', 'أجب دائماً بالعربية. أسلوب طبيعي وجمل قصيرة.', { email: 'البريد', calendar: 'التقويم', assistant: 'المساعد', tasks: 'المهام', settings: 'الإعدادات' }, {
  common: { loading: 'جاري التحميل...', loadingMemory: 'تحميل الذاكرة...', you: 'أنت', assistant: 'المساعد', thinking: 'أفكر...', listening: 'أستمع...', comingSoon: 'قريباً' },
  welcome: { default: 'مرحباً! تحدث كما مع صديق — أساعدك في يومك.' },
});

export const bn: Translations = pick('বাংলা', 'সবসময় বাংলায় উত্তর দিন।', { email: 'ইমেইল', calendar: 'ক্যালেন্ডার', assistant: 'সহকারী', tasks: 'কাজ', settings: 'সেটিংস' }, {
  welcome: { default: 'হ্যালো! বন্ধুর মতো কথা বলুন।' },
});

export const pt: Translations = pick('Português', 'Responda sempre em português. Natural e frases curtas.', { email: 'E-mail', calendar: 'Calendário', assistant: 'Assistente', tasks: 'Tarefas', settings: 'Configurações' }, {
  common: { loading: 'Carregando...', loadingMemory: 'Carregando memória...', you: 'Você', assistant: 'Assistente', thinking: 'Pensando...', listening: 'Ouvindo...', comingSoon: 'Em breve' },
  welcome: { default: 'Olá! Fale como com um amigo — ajudo no dia a dia.' },
});

export const ru: Translations = pick('Русский', 'Всегда отвечай на русском. Естественно, короткие фразы.', { email: 'Почта', calendar: 'Календарь', assistant: 'Ассистент', tasks: 'Задачи', settings: 'Настройки' }, {
  common: { loading: 'Загрузка...', loadingMemory: 'Загрузка памяти...', you: 'Вы', assistant: 'Ассистент', thinking: 'Думаю...', listening: 'Слушаю...', comingSoon: 'Скоро' },
  welcome: { default: 'Привет! Говорите как с другом — помогу в быту.' },
});

export const ur: Translations = pick('اردو', 'ہمیشہ اردو میں جواب دیں۔', { email: 'ای میل', calendar: 'کیلنڈر', assistant: 'معاون', tasks: 'کام', settings: 'ترتیبات' }, {
  welcome: { default: 'سلام! دوست کی طرح بات کریں۔' },
});

export const id: Translations = pick('Indonesia', 'Selalu jawab dalam Bahasa Indonesia. Natural, kalimat pendek.', { email: 'Email', calendar: 'Kalender', assistant: 'Asisten', tasks: 'Tugas', settings: 'Pengaturan' }, {
  common: { loading: 'Memuat...', loadingMemory: 'Memuat memori...', you: 'Anda', assistant: 'Asisten', thinking: 'Berpikir...', listening: 'Mendengarkan...', comingSoon: 'Segera' },
  welcome: { default: 'Halo! Bicara seperti ke teman — saya bantu sehari-hari.' },
});

export const ja: Translations = pick('日本語', '常に日本語で答えてください。自然で短い文。', { email: 'メール', calendar: 'カレンダー', assistant: 'アシスタント', tasks: 'タスク', settings: '設定' }, {
  common: { loading: '読み込み中...', loadingMemory: 'メモリ読み込み...', you: 'あなた', assistant: 'アシスタント', thinking: '考え中...', listening: '聞いています...', comingSoon: '近日公開' },
  welcome: { default: 'こんにちは！友達のように話してください。' },
});

export const sw: Translations = pick('Kiswahili', 'Jibu kila wakati kwa Kiswahili.', { email: 'Barua pepe', calendar: 'Kalenda', assistant: 'Msaidizi', tasks: 'Kazi', settings: 'Mipangilio' }, {
  welcome: { default: 'Habari! Ongea kama na rafiki — ninasaidia kila siku.' },
});

export const mr: Translations = pick('मराठी', 'नेहमी मराठीत उत्तर द्या.', { email: 'ईमेल', calendar: 'दिनदर्शिका', assistant: 'सहाय्यक', tasks: 'कार्ये', settings: 'सेटिंग्ज' }, {
  welcome: { default: 'नमस्कार! मित्रासारखे बोला.' },
});

export const te: Translations = pick('తెలుగు', 'ఎప్పుడూ తెలుగులో సమాధానం ఇవ్వండి.', { email: 'ఈమెయిల్', calendar: 'క్యాలెండర్', assistant: 'సహాయకుడు', tasks: 'పనులు', settings: 'అమరికలు' }, {
  welcome: { default: 'నమస్కారం! స్నేహితుడిలా మాట్లాడండి.' },
});

export const tr: Translations = pick('Türkçe', 'Her zaman Türkçe yanıt ver. Doğal, kısa cümleler.', { email: 'E-posta', calendar: 'Takvim', assistant: 'Asistan', tasks: 'Görevler', settings: 'Ayarlar' }, {
  common: { loading: 'Yükleniyor...', loadingMemory: 'Bellek yükleniyor...', you: 'Sen', assistant: 'Asistan', thinking: 'Düşünüyor...', listening: 'Dinliyor...', comingSoon: 'Yakında' },
  welcome: { default: 'Merhaba! Bir arkadaş gibi konuş — günlük hayatta yardım ederim.' },
});

export const ta: Translations = pick('தமிழ்', 'எப்போதும் தமிழில் பதிலளிக்கவும்.', { email: 'மின்னஞ்சல்', calendar: 'நாள்காட்டி', assistant: 'உதவியாளர்', tasks: 'பணிகள்', settings: 'அமைப்புகள்' }, {
  welcome: { default: 'வணக்கம்! நண்பரிடம் பேசுவது போல பேசுங்கள்.' },
});

export const vi: Translations = pick('Tiếng Việt', 'Luôn trả lời bằng tiếng Việt. Tự nhiên, câu ngắn.', { email: 'Email', calendar: 'Lịch', assistant: 'Trợ lý', tasks: 'Việc', settings: 'Cài đặt' }, {
  common: { loading: 'Đang tải...', loadingMemory: 'Đang tải bộ nhớ...', you: 'Bạn', assistant: 'Trợ lý', thinking: 'Đang suy nghĩ...', listening: 'Đang nghe...', comingSoon: 'Sắp có' },
  welcome: { default: 'Xin chào! Nói như với bạn bè — tôi giúp cuộc sống hàng ngày.' },
});

export const ko: Translations = pick('한국어', '항상 한국어로 답하세요. 자연스럽고 짧은 문장.', { email: '이메일', calendar: '캘린더', assistant: '어시스턴트', tasks: '할 일', settings: '설정' }, {
  common: { loading: '로딩 중...', loadingMemory: '메모리 로딩...', you: '나', assistant: '어시스턴트', thinking: '생각 중...', listening: '듣는 중...', comingSoon: '곧 제공' },
  welcome: { default: '안녕! 친구처럼 말해 — 일상을 도와줄게.' },
});
