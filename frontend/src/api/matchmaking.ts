import { http } from '../lib/http';

export type MatchmakingStatus =
  | { state: 'idle' }
  | { state: 'queued' }
  | { state: 'matched'; roomId: string };

export async function enterQueue(): Promise<{ state: 'queued' }> {
  return (await http.post<{ state: 'queued' }>('/matchmaking/queue')).data;
}

export async function leaveQueue(): Promise<void> {
  await http.delete('/matchmaking/queue');
}

export async function getMatchmakingStatus(): Promise<MatchmakingStatus> {
  return (await http.get<MatchmakingStatus>('/matchmaking/status')).data;
}

export async function ensureQueued(): Promise<MatchmakingStatus> {
  const status = await getMatchmakingStatus();
  if (status.state !== 'idle') return status;
  return enterQueue();
}
