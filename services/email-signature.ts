/** Professional Swedish email sign-off from user profile. */

export function buildEmailSignature(senderName: string, senderJob?: string): string {
  const name = senderName.trim();
  const lines = ['', 'Med vänlig hälsning,'];
  if (name) lines.push(name);
  if (senderJob?.trim()) lines.push(senderJob.trim());
  return lines.join('\n');
}

export function ensureEmailSignature(
  body: string,
  senderName: string,
  senderJob?: string,
): string {
  const trimmed = body.trim();
  if (!trimmed) return buildEmailSignature(senderName, senderJob).trim();

  const nameLower = senderName.trim().toLowerCase();
  const tail = trimmed.slice(-160).toLowerCase();
  const hasClosing =
    /vänliga hälsningar|med vänlig hälsning|mv\/h|mvh|hälsningar,?/i.test(tail);
  const hasName = nameLower.length > 0 && tail.includes(nameLower);

  if (hasClosing || hasName) {
    if (senderJob?.trim() && !trimmed.includes(senderJob.trim())) {
      return `${trimmed}\n${senderJob.trim()}`;
    }
    return trimmed;
  }

  return `${trimmed}${buildEmailSignature(senderName, senderJob)}`;
}
