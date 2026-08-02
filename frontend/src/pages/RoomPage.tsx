import { useEffect, useRef } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { Link, useNavigate, useParams } from 'react-router-dom';
import type { Socket } from 'socket.io-client';
import { getRoom } from '../api/rooms';
import { Brand } from '../components/Brand';
import { useAbsoluteCountdown } from '../hooks/useAbsoluteCountdown';
import { getApiErrorMessage } from '../lib/api-error';
import { createSocket } from '../lib/socket';
import { useAuthStore } from '../store/auth-store';
import { useRoomStore, type RoundSummary } from '../store/room-store';
import type { Pair, RoomParticipant, RoomStatus } from '../types/rooms';

export function RoomPage() {
  const { roomId } = useParams<{ roomId: string }>();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const user = useAuthStore((state) => state.user);
  const session = useRoomStore();
  const socketRef = useRef<Socket | null>(null);
  const countdown = useAbsoluteCountdown(session.deadline);
  const roomQuery = useQuery({
    queryKey: ['room', roomId],
    queryFn: () => getRoom(roomId!),
    enabled: Boolean(roomId),
    retry: 1,
  });

  useEffect(() => {
    if (roomQuery.data) session.hydrate(roomQuery.data);
  }, [roomQuery.data, session.hydrate]);

  useEffect(() => {
    if (!roomId) return;
    const socket = createSocket('/rooms');
    socketRef.current = socket;
    const refreshRoom = async () => {
      try {
        const snapshot = await queryClient.fetchQuery({ queryKey: ['room', roomId], queryFn: () => getRoom(roomId), staleTime: 0 });
        session.hydrate(snapshot);
      } catch {
        // The socket snapshot remains authoritative if a refetch briefly fails.
      }
    };

    socket.on('connect', () => {
      session.setSocketState('connected');
      socket.emit('join', { roomId });
    });
    socket.on('disconnect', (reason) => {
      if (reason !== 'io client disconnect') session.setSocketState('reconnecting');
    });
    socket.on('connect_error', () => session.setSocketState('reconnecting'));
    socket.on('room_state', session.hydrate);
    socket.on('participant_joined', ({ userId }: { userId: string }) => {
      session.setParticipantConnected(userId, true);
      void refreshRoom();
    });
    socket.on('participant_left', ({ userId }: { userId: string }) => session.setParticipantConnected(userId, false));
    socket.on('room_ready', ({ endsAt }: { endsAt: string }) => session.roomReady(endsAt));
    socket.on('round_started', (event: { round: 1 | 2; speakingPair: Pair; topicText: string; endsAt: string }) => session.roundStarted(event));
    socket.on('round_break', ({ endsAt }: { endsAt: string }) => session.roundBreak(endsAt));
    socket.on('session_finished', ({ rounds }: { rounds: RoundSummary[] }) => {
      session.finish(rounds);
      void queryClient.invalidateQueries({ queryKey: ['session-history'] });
      socket.disconnect();
    });
    socket.on('session_aborted', ({ reason }: { reason: string }) => {
      session.abort(humanizeReason(reason));
      socket.disconnect();
    });
    socket.on('error', (error: { message?: string }) => {
      if (error.message) session.abort(error.message);
    });

    return () => {
      socket.disconnect();
      socketRef.current = null;
    };
  }, [queryClient, roomId, session.abort, session.finish, session.hydrate, session.roundBreak, session.roomReady, session.roundStarted, session.setParticipantConnected, session.setSocketState]);

  useEffect(() => () => session.reset(), [session.reset]);

  const leave = () => {
    socketRef.current?.emit('leave');
    socketRef.current?.disconnect();
    session.reset();
    navigate('/', { replace: true });
  };

  if (roomQuery.isLoading && !session.room) return <RoomLoading />;
  if (roomQuery.isError && !session.room) {
    return <main className="grid min-h-screen place-items-center bg-canvas px-5"><div className="max-w-md text-center"><span className="text-4xl">⚠️</span><h1 className="mt-4 font-display text-2xl font-extrabold">Room unavailable</h1><p className="mt-3 text-sm text-red-600">{getApiErrorMessage(roomQuery.error, 'This room could not be loaded.')}</p><Link className="secondary-button mt-6" to="/">Back home</Link></div></main>;
  }

  const room = session.room;
  if (!room) return <RoomLoading />;
  const me = room.participants.find((participant) => participant.userId === user?.id);
  const myRole = session.speakingPair && me ? (me.pair === session.speakingPair ? 'speaker' : 'listener') : null;

  return (
    <main className="min-h-screen bg-[#eff3ef]">
      <header className="border-b border-slate-200 bg-white/90 backdrop-blur">
        <div className="mx-auto flex max-w-7xl items-center justify-between gap-4 px-5 py-3.5 sm:px-8">
          <Brand />
          <div className="flex items-center gap-3">
            <ConnectionPill state={session.socketState} />
            <button type="button" onClick={leave} className="rounded-xl border border-red-100 bg-red-50 px-3.5 py-2 text-sm font-bold text-red-700 transition hover:bg-red-100">Leave</button>
          </div>
        </div>
      </header>

      <div className="mx-auto max-w-7xl px-5 py-6 sm:px-8 sm:py-8">
        <section className="mb-6 flex flex-col justify-between gap-4 rounded-2xl border border-slate-200 bg-white px-5 py-4 sm:flex-row sm:items-center">
          <div className="flex items-center gap-3">
            <StatusDot status={room.status} />
            <div><p className="text-sm font-extrabold text-ink">{statusTitle(room.status, room.currentRound)}</p><p className="mt-0.5 text-xs font-medium text-slate-400">Room {room.code} · {Math.round(room.roundDurationSec / 60)} minute rounds</p></div>
          </div>
          {countdown !== null && room.status !== 'waiting' && <Timer remainingSec={countdown} label={timerLabel(room.status)} />}
        </section>

        {room.status === 'finished' ? (
          <FinishedPanel summary={session.summary ?? []} />
        ) : room.status === 'aborted' ? (
          <AbortedPanel reason={session.abortReason ?? 'The session ended unexpectedly.'} />
        ) : (
          <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_340px]">
            <section>
              <div className="grid gap-4 sm:grid-cols-2">
                {[1, 2, 3, 4].map((seat) => (
                  <SeatCard key={seat} seat={seat} participant={room.participants.find((item) => item.seat === seat)} speakingPair={session.speakingPair} currentUserId={user?.id} />
                ))}
              </div>
            </section>

            <aside className="space-y-5">
              <section className={`overflow-hidden rounded-3xl p-6 ${myRole === 'speaker' ? 'bg-brand-700 text-white' : myRole === 'listener' ? 'bg-ink text-white' : 'border border-slate-200 bg-white text-ink'}`}>
                {myRole ? (
                  <>
                    <p className={`text-xs font-bold uppercase tracking-[0.18em] ${myRole === 'speaker' ? 'text-brand-200' : 'text-slate-400'}`}>Your role</p>
                    <h2 className="mt-3 font-display text-3xl font-extrabold">You are {myRole === 'speaker' ? 'speaking' : 'listening'}</h2>
                    <p className={`mt-3 text-sm leading-6 ${myRole === 'speaker' ? 'text-brand-100' : 'text-slate-300'}`}>{myRole === 'speaker' ? 'Share the conversation with your pair. Your microphone will be available.' : 'Listen closely. Your microphone stays off for this round.'}</p>
                  </>
                ) : (
                  <><p className="text-xs font-bold uppercase tracking-[0.18em] text-slate-400">Room status</p><h2 className="mt-3 font-display text-2xl font-extrabold">{room.status === 'break' ? 'Roles are switching' : room.status === 'ready' ? 'Get ready' : 'Waiting for all four'}</h2><p className="mt-3 text-sm leading-6 text-slate-500">{room.status === 'break' ? 'Pair B will speak in the next round.' : 'Keep this tab open while everyone connects.'}</p></>
                )}
              </section>

              <section className="rounded-3xl border border-slate-200 bg-white p-6">
                <p className="text-xs font-bold uppercase tracking-[0.18em] text-brand-700">Conversation topic</p>
                {session.topic ? <h2 className="mt-4 font-display text-xl font-extrabold leading-7 text-ink">“{session.topic}”</h2> : <p className="mt-4 text-sm leading-6 text-slate-500">The topic appears when the speaking round begins.</p>}
              </section>

              <section className="rounded-3xl border border-slate-200 bg-white p-5">
                <div className="flex items-start gap-3"><span className="grid h-9 w-9 shrink-0 place-items-center rounded-xl bg-amber-100 text-lg">🎧</span><div><h3 className="text-sm font-extrabold">Audio joins next</h3><p className="mt-1 text-xs leading-5 text-slate-500">Roles and realtime state are live. Microphone controls are added in the next milestone.</p></div></div>
              </section>
            </aside>
          </div>
        )}
      </div>
    </main>
  );
}

function SeatCard({ seat, participant, speakingPair, currentUserId }: { seat: number; participant?: RoomParticipant; speakingPair: Pair | null; currentUserId?: string }) {
  if (!participant) return <div className="grid min-h-52 place-items-center rounded-3xl border-2 border-dashed border-slate-300 bg-white/50 p-6 text-center"><div><span className="mx-auto grid h-14 w-14 place-items-center rounded-full bg-slate-100 text-sm font-bold text-slate-400">{seat}</span><p className="mt-3 text-sm font-semibold text-slate-400">Waiting for someone…</p></div></div>;
  const isSpeaker = speakingPair === participant.pair;
  const isMe = participant.userId === currentUserId;
  return (
    <article className={`relative min-h-52 overflow-hidden rounded-3xl border bg-white p-6 transition ${isMe ? 'border-brand-400 ring-4 ring-brand-100' : isSpeaker ? 'border-brand-200' : 'border-slate-200'}`}>
      <div className="flex items-start justify-between gap-3">
        <div className="relative"><span className={`grid h-16 w-16 place-items-center rounded-2xl font-display text-lg font-extrabold ${isSpeaker ? 'bg-brand-700 text-white' : 'bg-slate-100 text-slate-600'}`}>{initials(participant.displayName)}</span><span className={`absolute -bottom-1 -right-1 h-4 w-4 rounded-full border-2 border-white ${participant.connected ? 'bg-emerald-500' : 'bg-slate-300'}`} aria-label={participant.connected ? 'Connected' : 'Disconnected'} /></div>
        <span className={`rounded-full px-2.5 py-1 text-xs font-bold ${isSpeaker ? 'bg-brand-100 text-brand-800' : speakingPair ? 'bg-slate-100 text-slate-500' : 'bg-amber-50 text-amber-700'}`}>{speakingPair ? (isSpeaker ? 'Speaking' : 'Listening') : `Pair ${participant.pair}`}</span>
      </div>
      <h2 className="mt-5 font-display text-xl font-extrabold text-ink">{participant.displayName}{isMe && <span className="ml-2 text-xs font-bold text-brand-700">You</span>}</h2>
      <p className="mt-1 text-sm font-medium text-slate-400">Level {participant.englishLevel} · Seat {participant.seat}</p>
      <div className="mt-5 flex items-center justify-between border-t border-slate-100 pt-4"><span className="text-xs font-semibold text-slate-400">{participant.connected ? 'In the room' : 'Reconnecting…'}</span><span className={`grid h-8 w-8 place-items-center rounded-full ${isSpeaker ? 'bg-brand-50 text-brand-700' : 'bg-slate-100 text-slate-400'}`}><MicIcon muted={!isSpeaker} /></span></div>
    </article>
  );
}

function Timer({ remainingSec, label }: { remainingSec: number; label: string }) {
  return <div className="flex items-center gap-3"><div className="text-right"><p className="text-xs font-semibold text-slate-400">{label}</p><p className="font-display text-xl font-extrabold tabular-nums text-ink">{formatTime(remainingSec)}</p></div><span className={`h-2.5 w-2.5 rounded-full ${remainingSec <= 10 ? 'animate-pulse bg-amber-500' : 'bg-brand-500'}`} /></div>;
}

function ConnectionPill({ state }: { state: 'connecting' | 'connected' | 'reconnecting' }) {
  return <span className={`hidden items-center gap-2 rounded-full px-3 py-1.5 text-xs font-bold sm:inline-flex ${state === 'connected' ? 'bg-brand-50 text-brand-800' : 'bg-amber-50 text-amber-700'}`}><span className={`h-2 w-2 rounded-full ${state === 'connected' ? 'bg-brand-500' : 'animate-pulse bg-amber-500'}`} />{state === 'connected' ? 'Live' : 'Reconnecting'}</span>;
}

function FinishedPanel({ summary }: { summary: RoundSummary[] }) {
  return <section className="mx-auto max-w-2xl rounded-[2rem] border border-brand-200 bg-white p-7 text-center shadow-soft sm:p-10"><span className="mx-auto grid h-16 w-16 place-items-center rounded-2xl bg-brand-100 text-3xl">✓</span><p className="mt-6 text-xs font-bold uppercase tracking-[0.2em] text-brand-700">Session complete</p><h1 className="mt-3 font-display text-4xl font-extrabold">Well spoken.</h1><p className="mx-auto mt-3 max-w-md text-sm leading-6 text-slate-500">You completed both roles. This session is now saved to your history.</p>{summary.length > 0 && <div className="mt-7 space-y-2 text-left">{summary.map((round) => <div key={round.round} className="rounded-xl bg-slate-50 px-4 py-3 text-sm text-slate-600"><strong className="mr-2 text-ink">Round {round.round}</strong>{round.topicText}</div>)}</div>}<div className="mt-8 flex flex-col justify-center gap-3 sm:flex-row"><Link to="/history" className="secondary-button">View history</Link><Link to="/" className="primary-button">Back to home</Link></div></section>;
}

function AbortedPanel({ reason }: { reason: string }) {
  return <section className="mx-auto max-w-xl rounded-[2rem] border border-amber-200 bg-white p-8 text-center shadow-soft"><span className="text-4xl">⚠️</span><h1 className="mt-5 font-display text-3xl font-extrabold">Session ended early</h1><p className="mt-3 text-sm leading-6 text-slate-500">{reason}</p><div className="mt-7 flex justify-center gap-3"><Link to="/" className="secondary-button">Home</Link><Link to="/waiting" className="primary-button">Find another room</Link></div></section>;
}

function RoomLoading() { return <main className="grid min-h-screen place-items-center bg-canvas"><div className="text-center"><span className="mx-auto block h-11 w-11 animate-spin rounded-full border-4 border-brand-100 border-t-brand-600" /><p className="mt-4 text-sm font-semibold text-slate-500">Joining room…</p></div></main>; }
function MicIcon({ muted }: { muted: boolean }) { return <svg className="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M12 2a3 3 0 0 0-3 3v7a3 3 0 0 0 5.5 1.7M5 10v2a7 7 0 0 0 11.6 5.3M12 19v3M8 22h8M3 3l18 18" strokeLinecap="round" />{!muted && <path d="M15 10V5a3 3 0 0 0-5.6-1.5M19 10v2a7 7 0 0 1-.5 2.6" strokeLinecap="round" />}</svg>; }
function StatusDot({ status }: { status: RoomStatus }) { const active = ['round1', 'round2'].includes(status); return <span className={`h-3 w-3 rounded-full ${active ? 'animate-pulse bg-brand-500' : status === 'aborted' ? 'bg-red-500' : status === 'finished' ? 'bg-brand-500' : 'bg-amber-400'}`} />; }
function statusTitle(status: RoomStatus, round: number | null): string { return ({ waiting: 'Waiting for the room', ready: 'Everyone is ready', round1: `Round ${round ?? 1} in progress`, break: 'Round break', round2: `Round ${round ?? 2} in progress`, finished: 'Session complete', aborted: 'Session aborted' })[status]; }
function timerLabel(status: RoomStatus): string { return status === 'ready' ? 'Starts in' : status === 'break' ? 'Next round in' : 'Time left'; }
function formatTime(seconds: number): string { return `${String(Math.floor(seconds / 60)).padStart(2, '0')}:${String(seconds % 60).padStart(2, '0')}`; }
function initials(name: string): string { return name.split(/\s+/).filter(Boolean).slice(0, 2).map((part) => part[0]?.toUpperCase()).join(''); }
function humanizeReason(reason: string): string { return ({ participant_reconnect_timeout: 'A participant did not reconnect within the grace period.', no_active_topics: 'No suitable conversation topics were available.' } as Record<string, string>)[reason] ?? reason.replaceAll('_', ' '); }
