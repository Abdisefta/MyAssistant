/** Text helpers shared by Alma speech service and hook. */

export function normalizeForSpeech(text: string): string {
  return text
    .replace(/\*\*|__|\*|_/g, '')
    .replace(/[#>`[\]()]/g, ' ')
    .replace(/[•·▪]/g, ', ')
    .replace(/\bkl\.?\s*/gi, 'klockan ')
    .replace(/\b(t\.ex\.|d\.v\.s\.|osv\.)\b/gi, ' ')
    .replace(/\s+([,.!?])/g, '$1')
    .replace(/[!?]{2,}/g, '!')
    .replace(/\.\.\./g, '.')
    .replace(/\s+/g, ' ')
    .trim();
}

export function splitTextForSpeech(text: string): string[] {
  const normalized = normalizeForSpeech(text);
  if (!normalized) return [];

  const parts = normalized.split(/(?<=[.!?…])\s+|,\s+(?=\w)/);
  const chunks: string[] = [];
  let buffer = '';

  for (const part of parts) {
    const piece = part.trim();
    if (!piece) continue;

    const candidate = buffer ? `${buffer} ${piece}` : piece;
    if (candidate.length <= 320) {
      buffer = candidate;
      continue;
    }

    if (buffer) chunks.push(buffer);
    buffer = piece.length <= 360 ? piece : `${piece.slice(0, 357).trim()}…`;
  }

  if (buffer) chunks.push(buffer);
  return chunks.length ? chunks : [normalized];
}
