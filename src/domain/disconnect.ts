import type { RoomStatus } from '@prisma/client';

export type DisconnectAction = 'free_seat' | 'start_grace' | 'ignore';

export function disconnectAction(status: RoomStatus): DisconnectAction {
  if (status === 'waiting' || status === 'ready') return 'free_seat';
  if (status === 'round1' || status === 'break' || status === 'round2') return 'start_grace';
  return 'ignore';
}
