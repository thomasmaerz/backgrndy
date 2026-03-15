import { createHash } from 'crypto';

export function normalizeBullet(text: string): string {
  return text
    .toLowerCase()
    .replace(/[^\w\s]/g, '')
    .replace(/\s+/g, ' ')
    .trim();
}

export function bulletHash(text: string): string {
  const normalized = normalizeBullet(text);
  return createHash('sha256').update(normalized).digest('hex');
}
