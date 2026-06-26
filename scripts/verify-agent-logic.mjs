/**
 * Offline verification of agent routing + calendar/email parsing.
 * Run: node scripts/verify-agent-logic.mjs
 */

// --- Copied/minimal logic mirrors from assistant-actions.ts ---

function normalizeSpeechText(text) {
  return text
    .toLowerCase()
    .replace(/\bimorrg?\b/g, 'imorgon')
    .replace(/\bimorn\b/g, 'imorgon')
    .replace(/\bklokna\b/g, 'klockan')
    .replace(/\bcl\b/g, 'kl')
    .trim();
}

function looksLikeEmailRequest(text) {
  const t = text.toLowerCase();
  return (
    /\b(skriv till|maila|mejla|skicka\s+(?:ett\s+)?(?:mail|mejl|email)|vill skicka|skicka mail|skicka mejl)\b/.test(t) ||
    (t.includes('till') && (t.includes('mail') || t.includes('mejl') || t.includes('email')))
  );
}

function looksLikeCalendarReadQuestion(text) {
  const t = normalizeSpeechText(text);
  return /\b(vad har jag|har jag|har ja|finns det|något inbokat|något planerat|något bokat|visa schema|kolla schema)\b/.test(t);
}

function looksLikeCalendarCancelRequest(text) {
  const t = normalizeSpeechText(text);
  const cancelVerb =
    /\b(avboka|avbokar|avbokat|ställ in|stall in|stryk|stryker|ta bort|radera|remove|cancel|delete)\b/.test(t);
  if (!cancelVerb) return false;
  return (
    /\b(möte|mötes|dejt|träff|kalender|bokning|appointment|event)\b/.test(t) ||
    /\b(imorgon|idag|ikväll|ikvall)\b/.test(t) ||
    /\b\d{1,2}\s*[-–]\s*\d{1,2}\b/.test(t) ||
    /\b(?:kl|klockan)\s*\d/.test(t)
  );
}

function looksLikeCalendarBookingRequest(text) {
  const t = normalizeSpeechText(text);
  if (looksLikeCalendarCancelRequest(text)) return false;
  if (looksLikeEmailRequest(text)) return false;
  if (looksLikeCalendarReadQuestion(text)) return false;
  const hasBookVerb =
    /\b(boka|bokar|boka in|boka en tid|boka tid|lägg in|lägg till|lägg|skapa|sätt in|planera|nytt möte|skapa möte|vill ha|behöver|fixa)\b/.test(t);
  const hasCalendarNoun =
    /\b(kalender|kalendern|möte|mötes|dejt|avtal|tid|schema|träff|appointment)\b/.test(t);
  const hasTimeHint =
    /\b(imorgon|idag|på\s+\w+|kl\s*\d|klockan\s*\d|\d{1,2}[:\.]\d{2}|kväll|morgon|eftermiddag|nästa vecka)\b/.test(t);
  const hasClockTime = /\b(?:kl|klockan)\s*\d|\d{1,2}[:\.]\d{2}\b/.test(t);
  if (hasBookVerb && (hasCalendarNoun || hasTimeHint)) return true;
  if (hasCalendarNoun && hasTimeHint && hasClockTime) return true;
  return false;
}

function shouldAutoConfirmCalendarBooking(text) {
  const t = normalizeSpeechText(text);
  return (
    looksLikeCalendarBookingRequest(text) &&
    /\b(boka|bokar|lägg in|skapa möte|nytt möte)\b/.test(t) &&
    /\b(imorgon|idag|kl\s*\d|klockan\s*\d|\d{1,2}[:\.]\d{2})\b/.test(t)
  );
}

function shouldAutoSendEmail(text) {
  const t = normalizeSpeechText(text);
  if (!looksLikeEmailRequest(text)) return false;
  if (!/\b(skicka|send|maila|mejla)\b/.test(t)) return false;
  return /[^\s@]+@[^\s@]+\.[^\s@]+/.test(t) || /\b(säg|skriv|att|meddelande|hej)\b/.test(t);
}

function parseSimpleEmailRequest(userMessage) {
  const t = userMessage.trim();
  const directEmail = t.match(
    /(?:skicka|maila|mejla|skriv)\s+(?:ett\s+)?(?:mail|mejl|e-?post)?\s*(?:till\s+)?([^\s@]+@[^\s@]+\.[^\s@]+)/i,
  );
  if (directEmail) {
    const intent =
      t.match(/\b(?:och\s+)?(?:säg|skriv|att)\s+(.+)$/i)?.[1]?.trim() ||
      t.match(/\bmed\s+(?:budskap|text|innehåll)\s+(.+)$/i)?.[1]?.trim() ||
      'Hej';
    return { recipientName: directEmail[1], messageIntent: intent };
  }
  const namedRecipient = t.match(
    /(?:skriv|maila|mejla|skicka)\s+(?:ett\s+)?(?:mail|mejl|e-?post)?\s*till\s+([a-zåäöéüA-ZÅÄÖÉÜ][\wåäöéüÅÄÖÉÜ\s-]{1,40})/i,
  );
  if (namedRecipient) {
    const name = namedRecipient[1].replace(/\b(?:och|säg|skriv|att)\b.*$/i, '').trim();
    const intent = t.match(/\b(?:och\s+)?(?:säg|skriv|att)\s+(.+)$/i)?.[1]?.trim() || 'Hej';
    if (name) return { recipientName: name, messageIntent: intent };
  }
  return null;
}

function parseSimpleCalendarBooking(userMessage) {
  const t = normalizeSpeechText(userMessage);
  if (!looksLikeCalendarBookingRequest(userMessage)) return null;
  const day = new Date();
  if (/\bimorgon\b/.test(t)) day.setDate(day.getDate() + 1);
  else if (!/\bidag\b/.test(t)) return null;
  let hours = 15;
  let minutes = 0;
  const klMatch = t.match(/\b(?:kl|klockan)\s*(\d{1,2})(?:[:\.](\d{2}))?\b/);
  if (klMatch) {
    hours = Number(klMatch[1]);
    minutes = klMatch[2] ? Number(klMatch[2]) : 0;
  } else return null;
  const start = new Date(day);
  start.setHours(hours, minutes, 0, 0);
  const end = new Date(start);
  end.setHours(end.getHours() + 1);
  return { title: 'Möte', start, end };
}

// --- Tests ---

const tests = [
  {
    name: 'calendar booking with boka',
    input: 'boka möte imorgon kl 15',
    expect: {
      isBooking: true,
      autoBook: true,
      parsedHour: 15,
    },
  },
  {
    name: 'calendar booking without boka (needs confirm)',
    input: 'möte imorgon kl 15',
    expect: { isBooking: true, autoBook: false, parsedHour: 15 },
  },
  {
    name: 'calendar read not booking',
    input: 'vad har jag imorgon',
    expect: { isBooking: false },
  },
  {
    name: 'email request',
    input: 'skriv till Magnus och säg att jag kommer sent',
    expect: { isEmail: true, autoSend: false, recipient: 'Magnus' },
  },
  {
    name: 'email auto send with address',
    input: 'skicka mail till test@example.com och säg hej',
    expect: { isEmail: true, autoSend: true, recipient: 'test@example.com' },
  },
  {
    name: 'booking not confused with email',
    input: 'boka möte imorgon kl 15',
    expect: { isEmail: false },
  },
  {
    name: 'cancel not treated as booking',
    input: 'avboka möte imorgon kl 14',
    expect: { isBooking: false, isCancel: true },
  },
  {
    name: 'cancel with time range not booking',
    input: 'avboka möte imorgon 14-15',
    expect: { isBooking: false, isCancel: true },
  },
];

let passed = 0;
let failed = 0;

for (const test of tests) {
  const errors = [];
  const isBooking = looksLikeCalendarBookingRequest(test.input);
  const isCancel = looksLikeCalendarCancelRequest(test.input);
  const isEmail = looksLikeEmailRequest(test.input);
  const autoBook = shouldAutoConfirmCalendarBooking(test.input);
  const autoSend = shouldAutoSendEmail(test.input);
  const emailParsed = parseSimpleEmailRequest(test.input);
  const calParsed = parseSimpleCalendarBooking(test.input);

  if (test.expect.isBooking !== undefined && isBooking !== test.expect.isBooking) {
    errors.push(`isBooking: got ${isBooking}, want ${test.expect.isBooking}`);
  }
  if (test.expect.isCancel !== undefined && isCancel !== test.expect.isCancel) {
    errors.push(`isCancel: got ${isCancel}, want ${test.expect.isCancel}`);
  }
  if (test.expect.isEmail !== undefined && isEmail !== test.expect.isEmail) {
    errors.push(`isEmail: got ${isEmail}, want ${test.expect.isEmail}`);
  }
  if (test.expect.autoBook !== undefined && autoBook !== test.expect.autoBook) {
    errors.push(`autoBook: got ${autoBook}, want ${test.expect.autoBook}`);
  }
  if (test.expect.autoSend !== undefined && autoSend !== test.expect.autoSend) {
    errors.push(`autoSend: got ${autoSend}, want ${test.expect.autoSend}`);
  }
  if (test.expect.parsedHour !== undefined) {
    const h = calParsed?.start?.getHours();
    if (h !== test.expect.parsedHour) errors.push(`parsedHour: got ${h}, want ${test.expect.parsedHour}`);
  }
  if (test.expect.recipient !== undefined) {
    const r = emailParsed?.recipientName;
    if (r !== test.expect.recipient) errors.push(`recipient: got ${r}, want ${test.expect.recipient}`);
  }

  if (errors.length === 0) {
    console.log(`PASS: ${test.name}`);
    passed++;
  } else {
    console.log(`FAIL: ${test.name}`);
    errors.forEach((e) => console.log(`  - ${e}`));
    failed++;
  }
}

// Firebase config sanity
const fs = await import('fs');
const firebaseTs = fs.readFileSync('constants/firebase.ts', 'utf8');
const apiKeyMatch = firebaseTs.match(/apiKey:\s*'([^']+)'/);
if (apiKeyMatch?.[1]?.startsWith('AIzaSy') && apiKeyMatch[1].length > 30) {
  console.log('PASS: Firebase apiKey format looks valid');
  passed++;
} else {
  console.log('FAIL: Firebase apiKey missing or malformed');
  failed++;
}

// Voice hook wired
const voiceTs = fs.readFileSync('hooks/use-voice-input.ts', 'utf8');
if (voiceTs.includes('ExpoSpeechRecognitionModule.start') && voiceTs.includes('sv-SE')) {
  console.log('PASS: Voice input uses expo-speech-recognition');
  passed++;
} else {
  console.log('FAIL: Voice input not wired');
  failed++;
}

// device-calendar native resolution
const hasNative = fs.existsSync('services/device-calendar.native.ts');
const hasExpo = fs.existsSync('services/device-calendar.expo.ts');
if (hasNative && hasExpo) {
  console.log('PASS: Calendar platform files exist (native + expo)');
  passed++;
} else {
  console.log('FAIL: Calendar platform files missing');
  failed++;
}

console.log(`\n=== RESULT: ${passed} passed, ${failed} failed ===`);
process.exit(failed > 0 ? 1 : 0);
