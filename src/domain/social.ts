import crypto from 'node:crypto';

export function friendshipPairKey(firstUserId: string, secondUserId: string): string {
  return [firstUserId, secondUserId].sort().join(':');
}

export function createHandle(displayName: string): string {
  const base = displayName
    .normalize('NFKD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '_')
    .replace(/^_+|_+$/g, '')
    .slice(0, 23) || 'speaker';
  return `${base}_${crypto.randomBytes(3).toString('hex')}`;
}

export function publicProfile(user: { id: string; handle: string; displayName: string }) {
  return { id: user.id, handle: user.handle, displayName: user.displayName };
}
