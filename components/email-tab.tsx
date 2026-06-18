import { Ionicons } from '@expo/vector-icons';
import { useEffect, useState } from 'react';
import {
  ActivityIndicator,
  KeyboardAvoidingView,
  Modal,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

const COLORS = {
  background: '#0D0D0D',
  surface: '#161616',
  surfaceElevated: '#1C1C1C',
  surfaceElevated: '#1C1C1C',
  border: '#2A2A2A',
  purple: '#8B7CF7',
  purpleDark: '#2A2050',
  purpleGlow: '#A78BFA',
  purpleMuted: 'rgba(139, 124, 247, 0.15)',
  text: '#F5F5F5',
  textMuted: '#6B6B6B',
};

type Email = {
  id: string;
  from: string;
  fromEmail?: string;
  fromShort: string;
  subject: string;
  preview: string;
  body?: string;
  time: string;
  unread: boolean;
  starred: boolean;
  tag?: string;
};

type EmailListCache = {
  emails: Email[];
  nextPageToken?: string;
};

type FilterId = 'inkorgen' | 'skickade' | 'stjärnmarkerade';

const FILTERS: { id: FilterId; label: string }[] = [
  { id: 'inkorgen', label: 'Inkorg' },
  { id: 'skickade', label: 'Skickade' },
  { id: 'stjärnmarkerade', label: 'Stjärnmarkerade' },
];

const MOCK_EMAILS: Email[] = [
  {
    id: '1',
    from: 'GitHub',
    fromShort: 'GH',
    subject: 'Your pull request was merged',
    preview: 'Congratulations! Your pull request #142 "Add email screen" was merged into main.',
    time: '09:14',
    unread: true,
    starred: false,
    tag: 'Dev',
  },
  {
    id: '2',
    from: 'Anna Lindqvist',
    fromShort: 'AL',
    subject: 'Möte imorgon kl 10',
    preview: 'Hej! Kom ihåg att vi har möte imorgon. Jag har bokat konferensrummet på plan 3.',
    time: '08:42',
    unread: true,
    starred: true,
  },
  {
    id: '3',
    from: 'Figma',
    fromShort: 'FG',
    subject: 'Erik har delat ett projekt med dig',
    preview: 'Erik Svensson delade "My Assistant – Design System" med dig. Klicka för att öppna.',
    time: 'Igår',
    unread: false,
    starred: false,
    tag: 'Design',
  },
  {
    id: '4',
    from: 'Vercel',
    fromShort: 'VC',
    subject: 'Deployment succeeded ✓',
    preview: 'Your latest deployment to production was successful. View the deployment details.',
    time: 'Igår',
    unread: false,
    starred: false,
    tag: 'Dev',
  },
  {
    id: '5',
    from: 'Sara Bergström',
    fromShort: 'SB',
    subject: 'Re: Feedback på prototypen',
    preview: 'Tack för att du skickade prototypen! Jag tittar på den idag och återkommer med kommentarer.',
    time: 'Mån',
    unread: false,
    starred: true,
  },
];

const SENT_MOCK: Email[] = [
  {
    id: 's1',
    from: 'Till: Anna Lindqvist',
    fromShort: 'AL',
    subject: 'Re: Möte imorgon kl 10',
    preview: 'Hej Anna! Ja, jag kommer. Vi ses imorgon!',
    time: '08:55',
    unread: false,
    starred: false,
  },
  {
    id: 's2',
    from: 'Till: Sara Bergström',
    fromShort: 'SB',
    subject: 'Feedback på prototypen',
    preview: 'Hej Sara! Här är länken till den senaste prototypen för My Assistant-appen.',
    time: 'Lör',
    unread: false,
    starred: false,
  },
];

type GmailMessage = {
  id: string;
  labelIds?: string[];
  snippet?: string;
  payload?: GmailPayload;
};

type GmailPayload = {
  mimeType?: string;
  headers?: { name: string; value: string }[];
  body?: { data?: string; size?: number; attachmentId?: string };
  parts?: GmailPayload[];
};

function decodeBase64Url(data: string): string {
  const base64 = data.replace(/-/g, '+').replace(/_/g, '/');
  try {
    const binary = atob(base64);
    const bytes = Uint8Array.from(binary, (char) => char.charCodeAt(0));
    return new TextDecoder('utf-8').decode(bytes);
  } catch {
    try {
      return atob(base64);
    } catch {
      return '';
    }
  }
}

function stripHtml(html: string): string {
  return html
    .replace(/<style[\s\S]*?<\/style>/gi, ' ')
    .replace(/<script[\s\S]*?<\/script>/gi, ' ')
    .replace(/<br\s*\/?>/gi, '\n')
    .replace(/<\/p>/gi, '\n')
    .replace(/<[^>]+>/g, ' ')
    .replace(/&nbsp;/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/\n{3,}/g, '\n\n')
    .replace(/[ \t]+/g, ' ')
    .trim();
}

function decodeBodyContent(raw: string, mimeType?: string): string {
  if (!raw) return '';
  if (mimeType === 'text/html') return stripHtml(raw);
  return raw.trim();
}

async function fetchGmailAttachment(
  accessToken: string,
  messageId: string,
  attachmentId: string,
): Promise<string> {
  const res = await fetch(
    `https://gmail.googleapis.com/gmail/v1/users/me/messages/${messageId}/attachments/${attachmentId}`,
    { headers: { Authorization: `Bearer ${accessToken}` } },
  );
  if (!res.ok) throw new Error(`attachment_fetch_failed_${res.status}`);
  const data = (await res.json()) as { data?: string };
  return decodeBase64Url(data.data || '');
}

async function extractBodyFromPayload(
  accessToken: string,
  messageId: string,
  payload: GmailPayload | undefined,
): Promise<string> {
  if (!payload) return '';

  if (payload.body?.data) {
    const decoded = decodeBase64Url(payload.body.data);
    const text = decodeBodyContent(decoded, payload.mimeType);
    if (text) return text;
  }

  if (payload.body?.attachmentId) {
    try {
      const decoded = await fetchGmailAttachment(
        accessToken,
        messageId,
        payload.body.attachmentId,
      );
      const text = decodeBodyContent(decoded, payload.mimeType);
      if (text) return text;
    } catch {
      // fall through to parts / snippet
    }
  }

  if (payload.parts?.length) {
    const plain = payload.parts.find((part) => part.mimeType === 'text/plain');
    if (plain) {
      const text = await extractBodyFromPayload(accessToken, messageId, plain);
      if (text) return text;
    }

    const html = payload.parts.find((part) => part.mimeType === 'text/html');
    if (html) {
      const text = await extractBodyFromPayload(accessToken, messageId, html);
      if (text) return text;
    }

    for (const part of payload.parts) {
      const nested = await extractBodyFromPayload(accessToken, messageId, part);
      if (nested) return nested;
    }
  }

  return '';
}

function formatEmailDate(date: Date): string {
  const now = new Date();
  const diffDays = Math.floor((now.getTime() - date.getTime()) / 86400000);
  if (diffDays === 0) return date.toLocaleTimeString('sv-SE', { hour: '2-digit', minute: '2-digit' });
  if (diffDays === 1) return 'Igår';
  if (diffDays < 7) return date.toLocaleDateString('sv-SE', { weekday: 'short' });
  return date.toLocaleDateString('sv-SE', { day: 'numeric', month: 'short' });
}

function parseGmailMessage(msg: GmailMessage): Email | null {
  if (!msg.id) return null;

  const headers = msg.payload?.headers || [];
  const getHeader = (name: string) =>
    headers.find((h) => h.name.toLowerCase() === name.toLowerCase())?.value || '';

  const fromRaw = getHeader('From');
  const nameMatch = fromRaw.match(/^"?([^"<]+)"?\s*<?/);
  const fromName = nameMatch?.[1]?.trim() || fromRaw;
  const emailAddrMatch = fromRaw.match(/<([^>]+)>/);
  const fromEmail = emailAddrMatch?.[1]?.trim() || (fromRaw.includes('@') ? fromRaw.trim() : '');
  const initials = fromName
    .split(/\s+/)
    .slice(0, 2)
    .map((w) => w[0] || '')
    .join('')
    .toUpperCase() || '??';

  const dateRaw = getHeader('Date');
  const date = dateRaw ? new Date(dateRaw) : new Date();

  return {
    id: msg.id,
    from: fromName,
    fromEmail,
    fromShort: initials,
    subject: getHeader('Subject') || '(Inget ämne)',
    preview: msg.snippet || '',
    time: formatEmailDate(date),
    unread: msg.labelIds?.includes('UNREAD') ?? false,
    starred: msg.labelIds?.includes('STARRED') ?? false,
  };
}

async function fetchGmailEmails(
  accessToken: string,
  labelId: string,
  pageToken?: string,
): Promise<EmailListCache> {
  const params = new URLSearchParams({
    maxResults: '25',
    labelIds: labelId,
  });
  if (pageToken) params.set('pageToken', pageToken);

  const listRes = await fetch(
    `https://gmail.googleapis.com/gmail/v1/users/me/messages?${params.toString()}`,
    { headers: { Authorization: `Bearer ${accessToken}` } },
  );

  if (listRes.status === 401 || listRes.status === 403) {
    throw new Error('auth_failed');
  }
  if (!listRes.ok) throw new Error('list_failed');

  const listData = await listRes.json();
  if (!listData.messages?.length) {
    return { emails: [], nextPageToken: listData.nextPageToken };
  }

  const ids = (listData.messages as { id: string }[]).map((m) => m.id);
  const messages: GmailMessage[] = [];

  for (let i = 0; i < ids.length; i += 6) {
    const chunk = ids.slice(i, i + 6);
    const results = await Promise.allSettled(
      chunk.map(async (id) => {
        const res = await fetch(
          `https://gmail.googleapis.com/gmail/v1/users/me/messages/${id}?format=metadata` +
            `&metadataHeaders=From&metadataHeaders=Subject&metadataHeaders=Date`,
          { headers: { Authorization: `Bearer ${accessToken}` } },
        );
        if (res.status === 401 || res.status === 403) {
          throw new Error('auth_failed');
        }
        if (!res.ok) {
          throw new Error(`metadata_fetch_failed_${res.status}`);
        }
        return res.json() as Promise<GmailMessage>;
      }),
    );

    for (const result of results) {
      if (result.status === 'fulfilled') {
        messages.push(result.value);
      } else if (result.reason?.message === 'auth_failed') {
        throw new Error('auth_failed');
      }
    }
  }

  const emails = messages
    .map(parseGmailMessage)
    .filter((email): email is Email => email !== null);

  return { emails, nextPageToken: listData.nextPageToken };
}

function encodeBase64Url(str: string): string {
  const bytes = new TextEncoder().encode(str);
  let binary = '';
  bytes.forEach((byte) => {
    binary += String.fromCharCode(byte);
  });
  const base64 = btoa(binary);
  return base64.replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

function buildRawEmail(to: string, subject: string, body: string): string {
  return [
    `To: ${to}`,
    `Subject: ${subject}`,
    'Content-Type: text/plain; charset="UTF-8"',
    'MIME-Version: 1.0',
    '',
    body,
  ].join('\r\n');
}

function replySubject(subject: string): string {
  return subject.toLowerCase().startsWith('re:') ? subject : `Re: ${subject}`;
}

async function sendGmailMessage(
  accessToken: string,
  to: string,
  subject: string,
  body: string,
): Promise<void> {
  const raw = buildRawEmail(to, subject, body);
  const encoded = encodeBase64Url(raw);

  const res = await fetch('https://gmail.googleapis.com/gmail/v1/users/me/messages/send', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${accessToken}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ raw: encoded }),
  });

  if (!res.ok) {
    throw new Error(`send_failed_${res.status}`);
  }
}

async function fetchGmailMessageBody(accessToken: string, messageId: string): Promise<string> {
  const res = await fetch(
    `https://gmail.googleapis.com/gmail/v1/users/me/messages/${messageId}?format=full`,
    { headers: { Authorization: `Bearer ${accessToken}` } },
  );

  if (!res.ok) {
    throw new Error(`message_fetch_failed_${res.status}`);
  }

  const msg = (await res.json()) as GmailMessage;
  const body = await extractBodyFromPayload(accessToken, messageId, msg.payload);
  if (body) return body;

  if (msg.snippet) return msg.snippet;

  return '';
}

const AVATAR_COLORS: Record<string, string> = {
  GH: '#24292e',
  AL: '#3a5a8c',
  FG: '#a259ff',
  VC: '#000000',
  SB: '#2a6049',
  NO: '#373530',
  AN: '#c96442',
};

function AvatarCircle({ initials, color }: { initials: string; color?: string }) {
  return (
    <View style={[styles.avatar, color ? { backgroundColor: color } : {}]}>
      <Text style={styles.avatarText}>{initials}</Text>
    </View>
  );
}

function ComposeEmailModal({
  visible,
  defaultTo,
  defaultSubject,
  isSending,
  onClose,
  onSend,
}: {
  visible: boolean;
  defaultTo?: string;
  defaultSubject?: string;
  isSending: boolean;
  onClose: () => void;
  onSend: (to: string, subject: string, body: string) => Promise<void>;
}) {
  const [to, setTo] = useState('');
  const [subject, setSubject] = useState('');
  const [message, setMessage] = useState('');
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (visible) {
      setTo(defaultTo || '');
      setSubject(defaultSubject || '');
      setMessage('');
      setError(null);
    }
  }, [visible, defaultTo, defaultSubject]);

  const handleSend = async () => {
    if (!to.trim() || !subject.trim() || !message.trim()) {
      setError('Fyll i till, ämne och meddelande.');
      return;
    }
    setError(null);
    try {
      await onSend(to.trim(), subject.trim(), message.trim());
      onClose();
    } catch {
      setError('Kunde inte skicka mejlet. Logga ut och in igen.');
    }
  };

  return (
    <Modal visible={visible} animationType="slide" transparent statusBarTranslucent>
      <KeyboardAvoidingView
        style={styles.composeOverlay}
        behavior={Platform.OS === 'ios' ? 'padding' : 'padding'}
      >
        <Pressable style={styles.composeBackdrop} onPress={onClose} />
        <SafeAreaView edges={['bottom']} style={styles.composeSafe}>
          <View style={styles.composeCard}>
            <View style={styles.composeHeader}>
              <Text style={styles.composeTitle}>Skriv mejl</Text>
              <Pressable onPress={onClose} hitSlop={12}>
                <Ionicons name="close" size={24} color={COLORS.textMuted} />
              </Pressable>
            </View>

            <ScrollView
              style={styles.composeScroll}
              contentContainerStyle={styles.composeScrollContent}
              keyboardShouldPersistTaps="handled"
              showsVerticalScrollIndicator={false}
            >
              <Text style={styles.composeLabel}>Till</Text>
              <TextInput
                style={styles.composeInput}
                value={to}
                onChangeText={setTo}
                placeholder="namn@example.com"
                placeholderTextColor={COLORS.textMuted}
                keyboardType="email-address"
                autoCapitalize="none"
                editable={!isSending}
                cursorColor={COLORS.purple}
                selectionColor={COLORS.purpleMuted}
                keyboardAppearance="dark"
              />

              <Text style={styles.composeLabel}>Ämne</Text>
              <TextInput
                style={styles.composeInput}
                value={subject}
                onChangeText={setSubject}
                placeholder="Ämne"
                placeholderTextColor={COLORS.textMuted}
                editable={!isSending}
                cursorColor={COLORS.purple}
                selectionColor={COLORS.purpleMuted}
                keyboardAppearance="dark"
              />

              <Text style={styles.composeLabel}>Meddelande</Text>
              <TextInput
                style={[styles.composeInput, styles.composeMessageInput]}
                value={message}
                onChangeText={setMessage}
                placeholder="Skriv ditt mejl här..."
                placeholderTextColor={COLORS.textMuted}
                multiline
                textAlignVertical="top"
                editable={!isSending}
                cursorColor={COLORS.purple}
                selectionColor={COLORS.purpleMuted}
                keyboardAppearance="dark"
              />

              {error ? <Text style={styles.composeError}>{error}</Text> : null}
            </ScrollView>

            <Pressable
              style={[styles.composeSendButton, isSending && styles.composeSendDisabled]}
              onPress={handleSend}
              disabled={isSending}
            >
              {isSending ? (
                <ActivityIndicator color={COLORS.text} />
              ) : (
                <>
                  <Ionicons name="send" size={18} color={COLORS.text} />
                  <Text style={styles.composeSendText}>Skicka</Text>
                </>
              )}
            </Pressable>
          </View>
        </SafeAreaView>
      </KeyboardAvoidingView>
    </Modal>
  );
}

function ReplyEmailModal({
  visible,
  toName,
  subject,
  time,
  originalBody,
  isLoadingOriginal,
  replyText,
  onChangeText,
  isSending,
  sendError,
  onClose,
  onSend,
}: {
  visible: boolean;
  toName: string;
  subject: string;
  time: string;
  originalBody: string;
  isLoadingOriginal: boolean;
  replyText: string;
  onChangeText: (text: string) => void;
  isSending: boolean;
  sendError: string | null;
  onClose: () => void;
  onSend: () => void;
}) {
  return (
    <Modal visible={visible} animationType="slide" transparent statusBarTranslucent>
      <KeyboardAvoidingView
        style={styles.replyModalOverlay}
        behavior={Platform.OS === 'ios' ? 'padding' : 'padding'}
      >
        <SafeAreaView edges={['top', 'bottom']} style={styles.replyModalSafe}>
          <View style={styles.replyModalCard}>
            <View style={styles.composeHeader}>
              <Text style={styles.composeTitle}>Svar till {toName}</Text>
              <Pressable onPress={onClose} hitSlop={12} disabled={isSending}>
                <Ionicons name="close" size={24} color={COLORS.textMuted} />
              </Pressable>
            </View>

            <Text style={styles.replyModalSubject} numberOfLines={2}>
              Re: {subject}
            </Text>

            <Text style={styles.composeLabel}>Ditt svar</Text>
            <TextInput
              style={styles.replyModalInput}
              value={replyText}
              onChangeText={onChangeText}
              placeholder="Skriv ditt svar här..."
              placeholderTextColor={COLORS.textMuted}
              multiline
              textAlignVertical="top"
              editable={!isSending}
              cursorColor={COLORS.purple}
              selectionColor={COLORS.purpleMuted}
              keyboardAppearance="dark"
              autoFocus
              autoCorrect
            />

            <Text style={styles.composeLabel}>Tidigare mejl · {time}</Text>
            <ScrollView
              style={styles.originalMessageScroll}
              contentContainerStyle={styles.originalMessageContent}
              showsVerticalScrollIndicator
              nestedScrollEnabled
              keyboardShouldPersistTaps="handled"
            >
              {isLoadingOriginal ? (
                <View style={styles.detailLoading}>
                  <ActivityIndicator size="small" color={COLORS.purple} />
                  <Text style={styles.detailLoadingText}>Hämtar tidigare mejl...</Text>
                </View>
              ) : (
                <Text style={styles.originalMessageText}>
                  {originalBody || 'Inget tidigare innehåll att visa.'}
                </Text>
              )}
            </ScrollView>

            {sendError ? <Text style={styles.composeError}>{sendError}</Text> : null}

            <Pressable
              style={[styles.composeSendButton, isSending && styles.composeSendDisabled]}
              onPress={onSend}
              disabled={isSending || !replyText.trim()}
            >
              {isSending ? (
                <ActivityIndicator color={COLORS.text} />
              ) : (
                <>
                  <Ionicons name="send" size={18} color={COLORS.text} />
                  <Text style={styles.composeSendText}>Skicka svar</Text>
                </>
              )}
            </Pressable>
          </View>
        </SafeAreaView>
      </KeyboardAvoidingView>
    </Modal>
  );
}

function EmailDetailView({
  email,
  accessToken,
  onBack,
  onSent,
}: {
  email: Email;
  accessToken?: string;
  onBack: () => void;
  onSent?: () => void;
}) {
  const [body, setBody] = useState(email.body || email.preview || '');
  const [isLoadingBody, setIsLoadingBody] = useState(Boolean(accessToken && !email.body));
  const [bodyError, setBodyError] = useState<string | null>(null);
  const [showReply, setShowReply] = useState(false);
  const [replyText, setReplyText] = useState('');
  const [isSending, setIsSending] = useState(false);
  const [sendError, setSendError] = useState<string | null>(null);

  useEffect(() => {
    if (!accessToken) return;

    let cancelled = false;
    setIsLoadingBody(true);
    setBodyError(null);

    fetchGmailMessageBody(accessToken, email.id)
      .then((fullBody) => {
        if (!cancelled) {
          const text = fullBody || email.preview || '';
          setBody(text);
          if (!text) {
            setBodyError('Mejlet verkar vara tomt.');
          }
        }
      })
      .catch(() => {
        if (!cancelled) {
          const fallback = email.preview || '';
          setBody(fallback);
          setBodyError(
            fallback
              ? 'Visar förhandsvisning. Fulltext kunde inte hämtas.'
              : 'Kunde inte hämta mejlets innehåll. Logga ut och in igen.',
          );
        }
      })
      .finally(() => {
        if (!cancelled) setIsLoadingBody(false);
      });

    return () => {
      cancelled = true;
    };
  }, [accessToken, email.id, email.preview]);

  const handleSendReply = async () => {
    if (!accessToken || !replyText.trim()) return;
    if (!email.fromEmail) {
      setSendError('Kan inte svara – saknar avsändaradress.');
      return;
    }

    setIsSending(true);
    setSendError(null);
    try {
      await sendGmailMessage(
        accessToken,
        email.fromEmail,
        replySubject(email.subject),
        replyText.trim(),
      );
      setReplyText('');
      setShowReply(false);
      onSent?.();
    } catch {
      setSendError('Kunde inte skicka svaret. Logga ut och in igen.');
    } finally {
      setIsSending(false);
    }
  };

  return (
    <View style={styles.detailContainer}>
      <Pressable style={styles.backButton} onPress={onBack}>
        <Ionicons name="chevron-back" size={20} color={COLORS.purple} />
        <Text style={styles.backText}>Inkorg</Text>
      </Pressable>

      <ScrollView
        style={styles.detailScroll}
        contentContainerStyle={styles.detailScrollContent}
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
      >
        <Text style={styles.detailSubject}>{email.subject}</Text>

        <View style={styles.detailMeta}>
          <AvatarCircle initials={email.fromShort} color={AVATAR_COLORS[email.fromShort]} />
          <View style={styles.detailMetaText}>
            <Text style={styles.detailFrom}>{email.from}</Text>
            <Text style={styles.detailTime}>{email.time}</Text>
          </View>
          {email.starred && (
            <Ionicons name="star" size={16} color="#F5C518" style={{ marginLeft: 'auto' }} />
          )}
        </View>

        <View style={styles.detailDivider} />

        <View style={styles.detailBodyBox}>
          {isLoadingBody ? (
            <View style={styles.detailLoading}>
              <ActivityIndicator size="small" color={COLORS.purple} />
              <Text style={styles.detailLoadingText}>Hämtar innehåll...</Text>
            </View>
          ) : (
            <>
              {bodyError ? <Text style={styles.detailError}>{bodyError}</Text> : null}
              <Text style={styles.detailBody}>
                {body || 'Inget innehåll att visa.'}
              </Text>
            </>
          )}
        </View>

        <View style={styles.replyBar}>
          <Pressable
            style={styles.replyButton}
            onPress={() => {
              setSendError(null);
              setShowReply(true);
            }}
          >
            <Ionicons name="arrow-undo-outline" size={16} color={COLORS.purple} />
            <Text style={styles.replyButtonText}>Svara</Text>
          </Pressable>
        </View>
      </ScrollView>

      <ReplyEmailModal
        visible={showReply}
        toName={email.from}
        subject={email.subject}
        time={email.time}
        originalBody={body}
        isLoadingOriginal={isLoadingBody}
        replyText={replyText}
        onChangeText={setReplyText}
        isSending={isSending}
        sendError={sendError}
        onClose={() => {
          if (!isSending) {
            setShowReply(false);
            setSendError(null);
          }
        }}
        onSend={handleSendReply}
      />
    </View>
  );
}

function getEmailFetchErrorMessage(error: unknown): string {
  if (error instanceof Error && error.message === 'auth_failed') {
    return 'Mail-behörighet saknas eller har gått ut. Logga ut och in igen — tryck Tillåt när Google frågar om mail.';
  }
  return 'Kunde inte hämta mail. Kolla internet och försök igen.';
}

export function EmailTab({
  accessToken,
  onSessionExpired,
  onRefreshToken,
}: {
  accessToken?: string;
  onSessionExpired?: () => void;
  onRefreshToken?: () => Promise<string | null>;
}) {
  const [activeFilter, setActiveFilter] = useState<FilterId>('inkorgen');
  const [selectedEmail, setSelectedEmail] = useState<Email | null>(null);
  const [emailCache, setEmailCache] = useState<Partial<Record<FilterId, EmailListCache>>>({});
  const [isLoadingEmails, setIsLoadingEmails] = useState(false);
  const [isLoadingMore, setIsLoadingMore] = useState(false);
  const [emailError, setEmailError] = useState<string | null>(null);
  const [composeVisible, setComposeVisible] = useState(false);
  const [composeDefaults, setComposeDefaults] = useState<{ to?: string; subject?: string }>({});
  const [isSendingEmail, setIsSendingEmail] = useState(false);
  const [starred, setStarred] = useState<Set<string>>(
    new Set(MOCK_EMAILS.filter((e) => e.starred).map((e) => e.id)),
  );

  const getLabelId = (filter: FilterId) =>
    filter === 'skickade' ? 'SENT' :
    filter === 'stjärnmarkerade' ? 'STARRED' : 'INBOX';

  const handleAuthFailure = async () => {
    if (onRefreshToken) {
      const newToken = await onRefreshToken();
      if (newToken) {
        loadEmails(activeFilter, true);
        return;
      }
    }
    onSessionExpired?.();
  };

  const loadEmails = (filter: FilterId, replace = true) => {
    if (!accessToken) return;

    setIsLoadingEmails(true);
    setEmailError(null);

    fetchGmailEmails(accessToken, getLabelId(filter))
      .then((result) => {
        setEmailCache((prev) => ({ ...prev, [filter]: result }));
        if (filter === 'inkorgen') {
          setStarred(new Set(result.emails.filter((e) => e.starred).map((e) => e.id)));
        }
      })
      .catch((error) => {
        const message = getEmailFetchErrorMessage(error);
        setEmailError(message);
        if (error instanceof Error && error.message === 'auth_failed') {
          handleAuthFailure();
        }
        if (replace) {
          setEmailCache((prev) => ({ ...prev, [filter]: { emails: [] } }));
        }
      })
      .finally(() => setIsLoadingEmails(false));
  };

  useEffect(() => {
    if (!accessToken || emailCache[activeFilter] !== undefined) return;
    loadEmails(activeFilter);
  }, [accessToken, activeFilter, emailCache]);

  const loadMoreEmails = async () => {
    if (!accessToken || isLoadingMore) return;
    const cache = emailCache[activeFilter];
    if (!cache?.nextPageToken) return;

    setIsLoadingMore(true);
    try {
      const result = await fetchGmailEmails(
        accessToken,
        getLabelId(activeFilter),
        cache.nextPageToken,
      );
      setEmailCache((prev) => ({
        ...prev,
        [activeFilter]: {
          emails: [...(prev[activeFilter]?.emails ?? []), ...result.emails],
          nextPageToken: result.nextPageToken,
        },
      }));
    } catch (error) {
      setEmailError(getEmailFetchErrorMessage(error));
      if (error instanceof Error && error.message === 'auth_failed') {
        await handleAuthFailure();
      }
    } finally {
      setIsLoadingMore(false);
    }
  };

  const handleSendEmail = async (to: string, subject: string, body: string) => {
    if (!accessToken) throw new Error('no_token');
    setIsSendingEmail(true);
    try {
      await sendGmailMessage(accessToken, to, subject, body);
      setEmailCache((prev) => {
        const next = { ...prev };
        delete next.skickade;
        return next;
      });
    } finally {
      setIsSendingEmail(false);
    }
  };

  const openCompose = (defaults?: { to?: string; subject?: string }) => {
    setComposeDefaults(defaults ?? {});
    setComposeVisible(true);
  };

  if (selectedEmail) {
    return (
      <>
        <EmailDetailView
          email={selectedEmail}
          accessToken={accessToken}
          onBack={() => setSelectedEmail(null)}
          onSent={() => {
            setEmailCache((prev) => {
              const next = { ...prev };
              delete next.skickade;
              return next;
            });
          }}
        />
        <ComposeEmailModal
          visible={composeVisible}
          defaultTo={composeDefaults.to}
          defaultSubject={composeDefaults.subject}
          isSending={isSendingEmail}
          onClose={() => setComposeVisible(false)}
          onSend={handleSendEmail}
        />
      </>
    );
  }

  const getEmails = (): Email[] => {
    if (accessToken) {
      return emailCache[activeFilter]?.emails ?? [];
    }
    if (activeFilter === 'skickade') return SENT_MOCK;
    if (activeFilter === 'stjärnmarkerade') return MOCK_EMAILS.filter((e) => starred.has(e.id));
    return MOCK_EMAILS;
  };

  const emails = getEmails();
  const unreadCount = emails.filter((e) => e.unread).length;
  const hasMoreEmails = Boolean(accessToken && emailCache[activeFilter]?.nextPageToken);

  const toggleStar = (id: string) => {
    setStarred((prev) => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });
  };

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <View>
          <Text style={styles.headerTitle}>Email</Text>
          {unreadCount > 0 && <Text style={styles.headerSub}>{unreadCount} olästa</Text>}
        </View>
        <TouchableOpacity
          style={styles.composeButton}
          onPress={() => openCompose()}
          disabled={!accessToken}
        >
          <Ionicons name="create-outline" size={20} color={COLORS.text} />
        </TouchableOpacity>
      </View>

      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        style={styles.filterRow}
        contentContainerStyle={styles.filterContent}
      >
        {FILTERS.map((f) => (
          <Pressable
            key={f.id}
            style={[styles.filterChip, activeFilter === f.id && styles.filterChipActive]}
            onPress={() => setActiveFilter(f.id)}
          >
            <Text style={[styles.filterText, activeFilter === f.id && styles.filterTextActive]}>
              {f.label}
            </Text>
          </Pressable>
        ))}
      </ScrollView>

      {isLoadingEmails ? (
        <View style={styles.loadingWrap}>
          <ActivityIndicator size="large" color={COLORS.purple} />
          <Text style={styles.loadingText}>Hämtar mail...</Text>
        </View>
      ) : emailError ? (
        <View style={styles.empty}>
          <Ionicons name="cloud-offline-outline" size={40} color={COLORS.textMuted} />
          <Text style={styles.emptyText}>{emailError}</Text>
          {accessToken ? (
            <Pressable style={styles.loadMoreButton} onPress={() => loadEmails(activeFilter)}>
              <Text style={styles.loadMoreText}>Försök igen</Text>
            </Pressable>
          ) : null}
        </View>
      ) : (
        <ScrollView style={styles.list} showsVerticalScrollIndicator={false}>
          {emails.length === 0 ? (
            <View style={styles.empty}>
              <Ionicons name="mail-open-outline" size={40} color={COLORS.textMuted} />
              <Text style={styles.emptyText}>Inga mail här</Text>
            </View>
          ) : (
            emails.map((email, index) => (
              <Pressable
                key={email.id}
                style={({ pressed }) => [
                  styles.emailRow,
                  index === emails.length - 1 && { borderBottomWidth: 0 },
                  pressed && styles.emailRowPressed,
                ]}
                onPress={() => setSelectedEmail(email)}
              >
                <View style={styles.emailLeft}>
                  <AvatarCircle
                    initials={email.fromShort}
                    color={AVATAR_COLORS[email.fromShort]}
                  />
                  {email.unread && <View style={styles.unreadDot} />}
                </View>

                <View style={styles.emailBody}>
                  <View style={styles.emailTopRow}>
                    <Text
                      style={[styles.emailFrom, email.unread && styles.emailFromBold]}
                      numberOfLines={1}
                    >
                      {email.from}
                    </Text>
                    <Text style={styles.emailTime}>{email.time}</Text>
                  </View>
                  <Text
                    style={[styles.emailSubject, email.unread && styles.emailSubjectBold]}
                    numberOfLines={1}
                  >
                    {email.subject}
                  </Text>
                  <View style={styles.emailBottomRow}>
                    <Text style={styles.emailPreview} numberOfLines={1}>
                      {email.preview}
                    </Text>
                    {email.tag && (
                      <View style={styles.tag}>
                        <Text style={styles.tagText}>{email.tag}</Text>
                      </View>
                    )}
                  </View>
                </View>

                <Pressable
                  style={styles.starButton}
                  onPress={() => toggleStar(email.id)}
                  hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                >
                  <Ionicons
                    name={starred.has(email.id) ? 'star' : 'star-outline'}
                    size={16}
                    color={starred.has(email.id) ? '#F5C518' : COLORS.textMuted}
                  />
                </Pressable>
              </Pressable>
            ))
          )}
          {hasMoreEmails && (
            <Pressable
              style={styles.loadMoreButton}
              onPress={loadMoreEmails}
              disabled={isLoadingMore}
            >
              {isLoadingMore ? (
                <ActivityIndicator size="small" color={COLORS.purple} />
              ) : (
                <Text style={styles.loadMoreText}>Visa fler mejl</Text>
              )}
            </Pressable>
          )}
          <View style={{ height: 20 }} />
        </ScrollView>
      )}

      <ComposeEmailModal
        visible={composeVisible}
        defaultTo={composeDefaults.to}
        defaultSubject={composeDefaults.subject}
        isSending={isSendingEmail}
        onClose={() => setComposeVisible(false)}
        onSend={handleSendEmail}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: COLORS.background },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingTop: 8,
    paddingBottom: 12,
  },
  headerTitle: { fontSize: 22, fontWeight: '600', color: COLORS.text },
  headerSub: { fontSize: 12, color: COLORS.purple, marginTop: 2 },
  composeButton: {
    width: 38,
    height: 38,
    borderRadius: 12,
    backgroundColor: COLORS.purpleMuted,
    borderWidth: 1,
    borderColor: 'rgba(139, 124, 247, 0.25)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  filterRow: { maxHeight: 40, marginBottom: 4 },
  filterContent: { paddingHorizontal: 16, gap: 8, flexDirection: 'row' },
  filterChip: {
    paddingHorizontal: 14,
    paddingVertical: 6,
    borderRadius: 20,
    backgroundColor: COLORS.surface,
    borderWidth: 1,
    borderColor: COLORS.border,
  },
  filterChipActive: {
    backgroundColor: COLORS.purpleMuted,
    borderColor: 'rgba(139, 124, 247, 0.4)',
  },
  filterText: { fontSize: 13, color: COLORS.textMuted, fontWeight: '500' },
  filterTextActive: { color: COLORS.purple },
  loadingWrap: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 12, marginTop: 60 },
  loadingText: { color: COLORS.textMuted, fontSize: 14 },
  list: { flex: 1, marginTop: 8 },
  emailRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.border,
    gap: 12,
  },
  emailRowPressed: {
    backgroundColor: COLORS.surface,
  },
  emailLeft: { position: 'relative' },
  avatar: {
    width: 42,
    height: 42,
    borderRadius: 21,
    backgroundColor: COLORS.purpleDark,
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarText: { fontSize: 14, fontWeight: '600', color: COLORS.text },
  unreadDot: {
    position: 'absolute',
    bottom: 1,
    right: 1,
    width: 10,
    height: 10,
    borderRadius: 5,
    backgroundColor: COLORS.purple,
    borderWidth: 2,
    borderColor: COLORS.background,
  },
  emailBody: { flex: 1, gap: 2 },
  emailTopRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  emailFrom: { fontSize: 14, color: COLORS.textMuted, flex: 1 },
  emailFromBold: { color: COLORS.text, fontWeight: '600' },
  emailTime: { fontSize: 12, color: COLORS.textMuted, marginLeft: 8 },
  emailSubject: { fontSize: 14, color: COLORS.textMuted },
  emailSubjectBold: { color: COLORS.text, fontWeight: '500' },
  emailBottomRow: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  emailPreview: { fontSize: 13, color: COLORS.textMuted, flex: 1 },
  tag: {
    paddingHorizontal: 7,
    paddingVertical: 2,
    borderRadius: 6,
    backgroundColor: COLORS.purpleMuted,
  },
  tagText: { fontSize: 10, color: COLORS.purple, fontWeight: '500' },
  starButton: { paddingTop: 2 },
  empty: { alignItems: 'center', justifyContent: 'center', paddingTop: 80, gap: 12 },
  emptyText: { fontSize: 14, color: COLORS.textMuted },
  detailContainer: { flex: 1, backgroundColor: COLORS.background },
  backButton: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 10,
    gap: 4,
  },
  backText: { fontSize: 16, color: COLORS.purple },
  detailScroll: { flex: 1 },
  detailScrollContent: { paddingHorizontal: 20, paddingBottom: 32 },
  detailSubject: {
    fontSize: 20,
    fontWeight: '600',
    color: COLORS.text,
    marginBottom: 16,
    marginTop: 4,
  },
  detailMeta: { flexDirection: 'row', alignItems: 'center', gap: 12, marginBottom: 16 },
  detailMetaText: { flex: 1 },
  detailFrom: { fontSize: 15, fontWeight: '500', color: COLORS.text },
  detailTime: { fontSize: 12, color: COLORS.textMuted, marginTop: 2 },
  detailDivider: { height: 1, backgroundColor: COLORS.border, marginBottom: 20 },
  detailLoading: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingVertical: 20,
  },
  detailLoadingText: {
    fontSize: 14,
    color: COLORS.textMuted,
  },
  detailError: {
    fontSize: 13,
    color: '#FF8A8A',
    marginBottom: 12,
  },
  detailBodyBox: {
    backgroundColor: COLORS.surface,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: COLORS.border,
    padding: 16,
    minHeight: 120,
    marginBottom: 20,
  },
  detailBody: { fontSize: 15, color: COLORS.text, lineHeight: 24 },
  replyBar: {
    flexDirection: 'row',
    gap: 12,
    paddingTop: 16,
    paddingBottom: 32,
    borderTopWidth: 1,
    borderTopColor: COLORS.border,
  },
  replyButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: COLORS.border,
    backgroundColor: COLORS.surface,
  },
  replyButtonText: { fontSize: 14, color: COLORS.purple, fontWeight: '500' },
  replyModalOverlay: {
    flex: 1,
    backgroundColor: COLORS.background,
  },
  replyModalSafe: {
    flex: 1,
  },
  replyModalCard: {
    flex: 1,
    paddingHorizontal: 20,
    paddingBottom: 12,
    gap: 12,
  },
  replyModalInput: {
    minHeight: 96,
    maxHeight: 120,
    backgroundColor: COLORS.surfaceElevated,
    borderWidth: 1,
    borderColor: COLORS.border,
    borderRadius: 14,
    paddingHorizontal: 16,
    paddingVertical: 12,
    color: '#FFFFFF',
    fontSize: 17,
    lineHeight: 24,
  },
  replyModalSubject: {
    fontSize: 14,
    color: COLORS.textMuted,
    marginBottom: 4,
  },
  originalMessageScroll: {
    flex: 1,
    backgroundColor: COLORS.surface,
    borderWidth: 1,
    borderColor: COLORS.border,
    borderRadius: 14,
    marginBottom: 8,
  },
  originalMessageContent: {
    padding: 14,
  },
  originalMessageText: {
    fontSize: 14,
    color: COLORS.text,
    lineHeight: 22,
  },
  composeOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.75)',
  },
  composeBackdrop: {
    flex: 1,
  },
  composeSafe: {
    maxHeight: '85%',
  },
  composeScroll: {
    flexGrow: 0,
  },
  composeScrollContent: {
    paddingBottom: 4,
  },
  composeCard: {
    backgroundColor: COLORS.surface,
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    padding: 20,
    paddingBottom: 32,
    borderWidth: 1,
    borderColor: COLORS.border,
    gap: 4,
  },
  composeHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  composeTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: COLORS.text,
  },
  composeLabel: {
    fontSize: 12,
    fontWeight: '600',
    color: COLORS.purple,
    marginTop: 8,
    marginBottom: 6,
  },
  composeInput: {
    backgroundColor: COLORS.surfaceElevated,
    borderWidth: 1,
    borderColor: COLORS.border,
    borderRadius: 12,
    paddingHorizontal: 14,
    paddingVertical: 12,
    color: '#FFFFFF',
    fontSize: 16,
    lineHeight: 22,
  },
  composeMessageInput: {
    minHeight: 100,
    maxHeight: 180,
  },
  composeError: {
    fontSize: 13,
    color: '#FF8A8A',
    marginTop: 8,
  },
  composeSendButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    backgroundColor: COLORS.purple,
    borderRadius: 12,
    paddingVertical: 14,
    marginTop: 12,
  },
  composeSendDisabled: {
    opacity: 0.6,
  },
  composeSendText: {
    color: COLORS.text,
    fontSize: 16,
    fontWeight: '600',
  },
  loadMoreButton: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 16,
    marginHorizontal: 16,
    marginTop: 8,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: 'rgba(139, 124, 247, 0.35)',
    backgroundColor: COLORS.purpleMuted,
  },
  loadMoreText: {
    color: COLORS.purple,
    fontSize: 14,
    fontWeight: '600',
  },
});
