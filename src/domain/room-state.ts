import type { RoomStatus } from '@prisma/client';

const transitions: Record<RoomStatus, RoomStatus[]> = {
  waiting: ['ready', 'aborted'],
  ready: ['waiting', 'round1', 'aborted'],
  round1: ['break', 'aborted'],
  break: ['round2', 'aborted'],
  round2: ['finished', 'aborted'],
  finished: [],
  aborted: [],
};

export function canTransition(from: RoomStatus, to: RoomStatus): boolean {
  return transitions[from].includes(to);
}

export function assertTransition(from: RoomStatus, to: RoomStatus): void {
  if (!canTransition(from, to)) throw new Error(`Illegal room transition: ${from} -> ${to}`);
}

export type TimedRoomStatus = 'ready' | 'round1' | 'break' | 'round2';

export function nextTimedStatus(status: TimedRoomStatus): RoomStatus {
  return { ready: 'round1', round1: 'break', break: 'round2', round2: 'finished' }[status] as RoomStatus;
}
