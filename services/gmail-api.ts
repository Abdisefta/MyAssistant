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

function extractEmailAddress(raw: string): string | null {
  const match = raw.match(/<([^>]+@[^>]+)>/);
  if (match?.[1]) return match[1].trim().toLowerCase();
  const plain = raw.trim();
  if (/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(plain)) return plain.toLowerCase();
  return null;
}

function nameMatchesHeader(name: string, headerValue: string): boolean {
  const needle = name.trim().toLowerCase();
  if (!needle) return false;
  return headerValue.toLowerCase().includes(needle);
}

export type InboxEmailSummary = {
  id: string;
  from: string;
  fromEmail: string;
  subject: string;
  preview: string;
  timeLabel: string;
  unread: boolean;
};

type GmailMessageMeta = {
  id: string;
  labelIds?: string[];
  snippet?: string;
  payload?: {
    headers?: { name: string; value: string }[];
  };
};

function headerValue(msg: GmailMessageMeta, name: string): string {
  const header = msg.payload?.headers?.find(
    (h) => h.name.toLowerCase() === name.toLowerCase(),
  );
  return header?.value?.trim() ?? '';
}

export async function sendGmailMessage(
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
    if (res.status === 401) {
      throw new Error('gmail_token_expired');
    }
    if (res.status === 403) {
      throw new Error('gmail_send_denied');
    }
    throw new Error(`send_failed_${res.status}`);
  }
}

export async function findContactEmailByName(
  accessToken: string,
  name: string,
): Promise<{ email: string; displayName: string } | null> {
  const trimmed = name.trim();
  if (!trimmed) return null;

  if (/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(trimmed)) {
    return { email: trimmed.toLowerCase(), displayName: trimmed };
  }

  const query = encodeURIComponent(`from:${trimmed} OR to:${trimmed}`);
  const listRes = await fetch(
    `https://gmail.googleapis.com/gmail/v1/users/me/messages?q=${query}&maxResults=15`,
    { headers: { Authorization: `Bearer ${accessToken}` } },
  );

  if (!listRes.ok) return null;

  const listData = (await listRes.json()) as { messages?: { id: string }[] };
  const ids = listData.messages?.map((m) => m.id) ?? [];
  if (!ids.length) return null;

  const counts = new Map<string, { email: string; displayName: string; score: number }>();

  for (const id of ids.slice(0, 10)) {
    const msgRes = await fetch(
      `https://gmail.googleapis.com/gmail/v1/users/me/messages/${id}?format=metadata&metadataHeaders=From&metadataHeaders=To`,
      { headers: { Authorization: `Bearer ${accessToken}` } },
    );
    if (!msgRes.ok) continue;

    const msg = (await msgRes.json()) as GmailMessageMeta;
    for (const headerName of ['From', 'To'] as const) {
      const value = headerValue(msg, headerName);
      if (!nameMatchesHeader(trimmed, value)) continue;

      const email = extractEmailAddress(value);
      if (!email) continue;

      const existing = counts.get(email);
      const displayName = value.replace(/<[^>]+>/, '').trim() || trimmed;
      counts.set(email, {
        email,
        displayName,
        score: (existing?.score ?? 0) + 1,
      });
    }
  }

  const best = [...counts.values()].sort((a, b) => b.score - a.score)[0];
  return best ? { email: best.email, displayName: best.displayName } : null;
}

function formatEmailTime(date: Date): string {
  const now = new Date();
  const diffDays = Math.floor((now.getTime() - date.getTime()) / 86400000);
  if (diffDays === 0) {
    return date.toLocaleTimeString('sv-SE', { hour: '2-digit', minute: '2-digit' });
  }
  if (diffDays === 1) return 'Igår';
  if (diffDays < 7) return date.toLocaleDateString('sv-SE', { weekday: 'short' });
  return date.toLocaleDateString('sv-SE', { day: 'numeric', month: 'short' });
}

function parseInboxMessage(msg: GmailMessageMeta): InboxEmailSummary | null {
  if (!msg.id) return null;

  const fromRaw = headerValue(msg, 'From');
  const nameMatch = fromRaw.match(/^"?([^"<]+)"?\s*<?/);
  const fromName = nameMatch?.[1]?.trim() || fromRaw;
  const emailAddrMatch = fromRaw.match(/<([^>]+)>/);
  const fromEmail =
    emailAddrMatch?.[1]?.trim() || (fromRaw.includes('@') ? fromRaw.trim() : '');

  const dateRaw = headerValue(msg, 'Date');
  const date = dateRaw ? new Date(dateRaw) : new Date();

  return {
    id: msg.id,
    from: fromName,
    fromEmail,
    subject: headerValue(msg, 'Subject') || '(Inget ämne)',
    preview: msg.snippet?.trim() || '',
    timeLabel: formatEmailTime(date),
    unread: msg.labelIds?.includes('UNREAD') ?? false,
  };
}

export async function fetchInboxSummaries(
  accessToken: string,
  options: { maxResults?: number; query?: string; labelId?: string } = {},
): Promise<InboxEmailSummary[]> {
  const maxResults = options.maxResults ?? 10;
  const params = new URLSearchParams({ maxResults: String(maxResults) });
  if (options.labelId) params.set('labelIds', options.labelId);
  if (options.query) params.set('q', options.query);

  const listRes = await fetch(
    `https://gmail.googleapis.com/gmail/v1/users/me/messages?${params.toString()}`,
    { headers: { Authorization: `Bearer ${accessToken}` } },
  );

  if (listRes.status === 401 || listRes.status === 403) {
    throw new Error('auth_failed');
  }
  if (!listRes.ok) return [];

  const listData = (await listRes.json()) as { messages?: { id: string }[] };
  const ids = listData.messages?.map((m) => m.id) ?? [];
  if (!ids.length) return [];

  const messages: GmailMessageMeta[] = [];
  for (let i = 0; i < ids.length; i += 6) {
    const chunk = ids.slice(i, i + 6);
    const results = await Promise.allSettled(
      chunk.map(async (id) => {
        const res = await fetch(
          `https://gmail.googleapis.com/gmail/v1/users/me/messages/${id}?format=metadata` +
            `&metadataHeaders=From&metadataHeaders=Subject&metadataHeaders=Date`,
          { headers: { Authorization: `Bearer ${accessToken}` } },
        );
        if (res.status === 401 || res.status === 403) throw new Error('auth_failed');
        if (!res.ok) throw new Error(`metadata_fetch_failed_${res.status}`);
        return res.json() as Promise<GmailMessageMeta>;
      }),
    );

    for (const result of results) {
      if (result.status === 'fulfilled') messages.push(result.value);
      else if (result.reason?.message === 'auth_failed') throw new Error('auth_failed');
    }
  }

  return messages
    .map(parseInboxMessage)
    .filter((email): email is InboxEmailSummary => email !== null);
}

export function formatInboxForAgent(emails: InboxEmailSummary[]): string {
  if (!emails.length) return 'Inkorgen är tom.';

  return emails
    .slice(0, 10)
    .map((e) => {
      const unread = e.unread ? ' [oläst]' : '';
      const preview = e.preview ? ` — ${e.preview.slice(0, 80)}` : '';
      return `${e.timeLabel}: ${e.from} — "${e.subject}"${unread}${preview}`;
    })
    .join('\n- ');
}
