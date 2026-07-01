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

function stripTrailingNumbers(raw: string): string {
  return raw.trim().replace(/\d+\s*$/, '').trim();
}

function capitalizeWord(word: string): string {
  if (!word) return word;
  return word.charAt(0).toUpperCase() + word.slice(1).toLowerCase();
}

function splitConcatenatedName(raw: string): string[] {
  const stripped = stripTrailingNumbers(raw).replace(/\s+/g, ' ');
  if (!stripped) return [];

  const results = new Set<string>([stripped, stripped.toLowerCase()]);

  const spaceParts = stripped.split(/\s+/).filter(Boolean);
  if (spaceParts.length >= 2) {
    results.add(spaceParts.join(' '));
    results.add(`${spaceParts[spaceParts.length - 1]} ${spaceParts[0]}`);
    for (const part of spaceParts) {
      if (part.length > 2) {
        results.add(part);
        results.add(part.toLowerCase());
      }
    }
  }

  const camelParts = stripped.split(/(?=[A-ZÅÄÖ])/).filter(Boolean);
  if (camelParts.length >= 2) {
    const joined = camelParts.map(capitalizeWord).join(' ');
    results.add(joined);
    results.add(joined.toLowerCase());
    for (const part of camelParts) {
      if (part.length > 2) {
        results.add(capitalizeWord(part));
        results.add(part.toLowerCase());
      }
    }
  }

  if (!/\s/.test(stripped) && stripped.length > 6) {
    const lower = stripped.toLowerCase();
    const surnameEndings = ['sson', 'ström', 'strom', 'berg', 'qvist', 'lund', 'gren', 'stedt', 'holm', 'ström'];
    for (const ending of surnameEndings) {
      const idx = lower.indexOf(ending);
      if (idx > 2 && idx + ending.length < lower.length) {
        const first = capitalizeWord(stripped.slice(0, idx + ending.length));
        const second = capitalizeWord(stripped.slice(idx + ending.length));
        if (second.length >= 3) {
          results.add(`${first} ${second}`);
          results.add(`${second} ${first}`);
          results.add(first);
          results.add(second);
          results.add(first.toLowerCase());
          results.add(second.toLowerCase());
        }
      }
    }
  }

  return [...results].filter((v) => v.length > 1);
}

function nameMatchesHeader(name: string, headerValue: string): boolean {
  const hay = headerValue.toLowerCase();
  const needle = stripTrailingNumbers(name).toLowerCase();
  if (!needle) return false;
  if (hay.includes(needle)) return true;

  for (const variant of splitConcatenatedName(name)) {
    const v = variant.toLowerCase();
    if (v.length > 2 && hay.includes(v)) return true;
  }

  const parts = needle.split(/\s+/).filter((p) => p.length > 1);
  if (parts.length >= 2) {
    return parts.every((part) => hay.includes(part));
  }

  const splitParts = splitConcatenatedName(name);
  if (splitParts.length >= 2) {
    const meaningful = splitParts.filter((p) => p.length > 2 && p.includes(' '));
    for (const combo of meaningful) {
      const comboParts = combo.toLowerCase().split(/\s+/).filter((p) => p.length > 2);
      if (comboParts.length >= 2 && comboParts.every((part) => hay.includes(part))) {
        return true;
      }
    }
  }

  return false;
}

export function contactNameVariants(raw: string): string[] {
  const cleaned = stripTrailingNumbers(raw).replace(/\s+/g, ' ');
  if (!cleaned) return [];

  const variants = new Set<string>();
  for (const variant of splitConcatenatedName(cleaned)) {
    variants.add(variant);
    variants.add(stripTrailingNumbers(variant));
  }

  return [...variants].filter((v) => v.length > 1);
}

async function searchContactByQuery(
  accessToken: string,
  searchName: string,
): Promise<{ email: string; displayName: string; score: number } | null> {
  const query = encodeURIComponent(`from:"${searchName}" OR to:"${searchName}"`);
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
      if (!nameMatchesHeader(searchName, value)) continue;

      const email = extractEmailAddress(value);
      if (!email) continue;

      const existing = counts.get(email);
      const displayName = value.replace(/<[^>]+>/, '').trim() || searchName;
      counts.set(email, {
        email,
        displayName,
        score: (existing?.score ?? 0) + 1,
      });
    }
  }

  const best = [...counts.values()].sort((a, b) => b.score - a.score)[0];
  return best ?? null;
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

  let best: { email: string; displayName: string; score: number } | null = null;

  for (const variant of contactNameVariants(trimmed)) {
    const found = await searchContactByQuery(accessToken, variant);
    if (found && (!best || found.score > best.score)) {
      best = found;
    }
  }

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
