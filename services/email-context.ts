import {
  fetchInboxSummaries,
  formatInboxForAgent,
  type InboxEmailSummary,
} from '@/services/gmail-api';
import { summarizeEmailForVoice } from '@/services/gemini';

export async function getInboxSummaryForAgent(accessToken: string): Promise<string> {
  try {
    const emails = await fetchInboxSummaries(accessToken, { maxResults: 8, labelId: 'INBOX' });
    if (!emails.length) return 'Inga mail i inkorgen just nu.';

    const unread = emails.filter((e) => e.unread).length;
    const header =
      unread > 0
        ? `${unread} olästa av ${emails.length} senaste i inkorgen:`
        : `${emails.length} senaste i inkorgen:`;

    return `${header}\n- ${formatInboxForAgent(emails)}`;
  } catch (error) {
    if (error instanceof Error && error.message === 'auth_failed') {
      return 'Gmail inte kopplat — gå till Email-fliken och koppla Google Mail.';
    }
    return 'Kunde inte läsa inkorgen just nu.';
  }
}

export function looksLikeEmailReadRequest(text: string): boolean {
  const t = text.toLowerCase();

  if (/\b(skriv till|maila|mejla|skicka\s+(?:ett\s+)?(?:mail|mejl|email))\b/.test(t)) {
    return false;
  }

  return (
    /\b(inkorg|inbox|oläst|olästa|mejl|mail|email|gmail)\b/.test(t) ||
    /\b(har jag fått|fått något|något från|mail från|mejl från|senaste mejl|senaste mail|läs mejl|läs mail|vad står|vem skrev)\b/.test(
      t,
    )
  );
}

function extractSenderQuery(text: string): string | null {
  const patterns = [
    /(?:mail|mejl|email)\s+från\s+([a-zåäöA-ZÅÄÖ0-9@.\s-]+)/i,
    /från\s+([a-zåäöA-ZÅÄÖ0-9@.\s-]+?)(?:\?|$|\.|,)/i,
    /(?:har|fått).+från\s+([a-zåäöA-ZÅÄÖ0-9@.\s-]+)/i,
  ];

  for (const pattern of patterns) {
    const match = text.match(pattern);
    const name = match?.[1]?.trim();
    if (name && name.length > 1 && name.length < 60) return name;
  }
  return null;
}

function formatEmailList(emails: InboxEmailSummary[], intro: string): string {
  if (!emails.length) return intro;

  const lines = emails.slice(0, 5).map((e) => {
    const unread = e.unread ? ' (oläst)' : '';
    return `${e.from}: "${e.subject}"${unread} — ${e.preview.slice(0, 100)}`;
  });

  return `${intro}\n${lines.join('\n')}`;
}

export async function answerEmailQuestion(
  userMessage: string,
  accessToken: string,
): Promise<string> {
  const lower = userMessage.toLowerCase();

  try {
    if (/\boläst|olästa\b/.test(lower) && !extractSenderQuery(userMessage)) {
      const unread = await fetchInboxSummaries(accessToken, {
        maxResults: 10,
        query: 'is:unread in:inbox',
      });
      if (!unread.length) return 'Du har inga olästa mail i inkorgen. Skönt!';
      const intro = `Du har ${unread.length} olästa mail:`;
      const spoken = await summarizeEmailForVoice(userMessage, formatEmailList(unread, intro));
      return spoken;
    }

    const sender = extractSenderQuery(userMessage);
    if (sender) {
      const fromSender = await fetchInboxSummaries(accessToken, {
        maxResults: 5,
        query: `from:${sender}`,
      });
      if (!fromSender.length) {
        return `Jag hittar inget mail från ${sender} i din inkorg.`;
      }
      const intro = `Mail från ${sender}:`;
      return summarizeEmailForVoice(userMessage, formatEmailList(fromSender, intro));
    }

    if (/\b(senaste|senast|nyaste|nytt)\b/.test(lower)) {
      const latest = await fetchInboxSummaries(accessToken, { maxResults: 3, labelId: 'INBOX' });
      if (!latest.length) return 'Inkorgen är tom.';
      const intro = 'Det senaste mailet:';
      return summarizeEmailForVoice(userMessage, formatEmailList(latest, intro));
    }

    const inbox = await fetchInboxSummaries(accessToken, { maxResults: 6, labelId: 'INBOX' });
    if (!inbox.length) return 'Inkorgen är tom just nu.';

    const unreadCount = inbox.filter((e) => e.unread).length;
    const intro =
      unreadCount > 0
        ? `Du har ${unreadCount} olästa. Här är inkorgen:`
        : 'Här är dina senaste mail:';

    return summarizeEmailForVoice(userMessage, formatEmailList(inbox, intro));
  } catch (error) {
    if (error instanceof Error && error.message === 'auth_failed') {
      return 'Jag kan inte läsa mail just nu. Gå till Email-fliken och koppla Google Mail igen.';
    }
    return 'Kunde inte hämta mail just nu. Försök igen om en stund.';
  }
}
