import { useEffect, useRef, useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { Link, useNavigate, useParams } from 'react-router-dom';
import type { Socket } from 'socket.io-client';
import { getRoom, leaveRoom } from '../api/rooms';
import { Brand } from '../components/Brand';
import { useAbsoluteCountdown } from '../hooks/useAbsoluteCountdown';
import { useLiveKitAudio, type MicrophoneState } from '../hooks/useLiveKitAudio';
import { getApiErrorMessage } from '../lib/api-error';
import { createSocket } from '../lib/socket';
import { useAuthStore } from '../store/auth-store';
import { useRoomStore, type RoundSummary } from '../store/room-store';
import { useToastStore } from '../store/toast-store';
import type { Pair, RoomParticipant, RoomStatus } from '../types/rooms';

export function RoomPage() {
  const { roomId } = useParams<{ roomId: string }>();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const user = useAuthStore((state) => state.user);
  const session = useRoomStore();
  const addToast = useToastStore((state) => state.add);
  const socketRef = useRef<Socket | null>(null);
  const reconnectToastShown = useRef(false);
  const [isLeaving, setIsLeaving] = useState(false);
  const countdown = useAbsoluteCountdown(session.deadline);
  const currentParticipant = session.room?.participants.find((participant) => participant.userId === user?.id);
  const currentRole = session.speakingPair && currentParticipant ? (currentParticipant.pair === session.speakingPair ? 'speaker' : 'listener') : null;
  const audioEnabled = Boolean(session.room && !['finished', 'aborted'].includes(session.room.status));
  const audio = useLiveKitAudio({ roomId, enabled: audioEnabled, shouldPublish: currentRole === 'speaker' });
  const roomQuery = useQuery({
    queryKey: ['room', roomId],
    queryFn: () => getRoom(roomId!),
    enabled: Boolean(roomId),
    retry: 1,
  });

  useEffect(() => {
    // The socket may deliver a newer transition while the initial REST request is
    // still in flight. Never let that older bootstrap snapshot roll state back.
    if (roomQuery.data && !useRoomStore.getState().room) session.hydrate(roomQuery.data);
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
      reconnectToastShown.current = false;
      socket.emit('join', { roomId });
    });
    socket.on('disconnect', (reason) => {
      if (reason !== 'io client disconnect') session.setSocketState('reconnecting');
    });
    socket.on('connect_error', () => {
      session.setSocketState('reconnecting');
      if (!reconnectToastShown.current) {
        reconnectToastShown.current = true;
        addToast('warning', 'Room connection interrupted. Rejoining automatically within the grace period.');
      }
    });
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
    socket.on('error', (error: { message?: string }) => addToast('error', error.message ?? 'A room connection error occurred.'));

    return () => {
      socket.disconnect();
      socketRef.current = null;
    };
  }, [addToast, queryClient, roomId, session.abort, session.finish, session.hydrate, session.roundBreak, session.roomReady, session.roundStarted, session.setParticipantConnected, session.setSocketState]);

  useEffect(() => {
    if (audio.microphoneError) addToast('warning', audio.microphoneError);
  }, [addToast, audio.microphoneError]);

  useEffect(() => () => session.reset(), [session.reset]);

  const leave = async () => {
    if (!roomId || isLeaving) return;
    setIsLeaving(true);
    try {
      // The REST endpoint makes the explicit leave durable even if the socket
      // closes before its fire-and-forget `leave` event reaches the server.
      await leaveRoom(roomId);
    } catch (error) {
      addToast('warning', getApiErrorMessage(error, 'The server could not confirm that you left the room.'));
    } finally {
      socketRef.current?.emit('leave');
      socketRef.current?.disconnect();
      session.reset();
      navigate('/', { replace: true });
    }
  };

  const shareLobby = async () => {
    if (!roomId) return;
    const code = useRoomStore.getState().room?.code;
    if (!code) return;
    if (navigator.share) {
      try {
        await navigator.share({ title: 'Join my Speak Four room', text: `Join my English speaking room with code ${code}.`, url: window.location.origin });
        return;
      } catch (error) {
        if (error instanceof DOMException && error.name === 'AbortError') return;
      }
    }
    try {
      await navigator.clipboard.writeText(code);
      addToast('success', 'Room code copied — share it with your group.');
    } catch {
      addToast('error', `Could not copy automatically. Room code: ${code}`);
    }
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
    <main className="min-h-screen bg-[#eff3ef] pb-28 md:pb-0">
      <header className="border-b border-slate-200 bg-white/90 backdrop-blur">
        <div className="mx-auto flex max-w-7xl items-center justify-between gap-4 px-5 py-3.5 sm:px-8">
          <Brand />
          <div className="flex items-center gap-3">
            <ConnectionPill state={session.socketState} />
            <button type="button" onClick={() => void leave()} disabled={isLeaving} className="hidden rounded-xl border border-red-100 bg-red-50 px-3.5 py-2 text-sm font-bold text-red-700 transition hover:bg-red-100 disabled:cursor-not-allowed disabled:opacity-60 md:inline-flex">{isLeaving ? 'Leaving…' : 'Leave'}</button>
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
              <div className="grid grid-cols-2 gap-2.5 sm:gap-4">
                {[1, 2, 3, 4].map((seat) => (
                  <SeatCard key={seat} seat={seat} participant={room.participants.find((item) => item.seat === seat)} speakingPair={session.speakingPair} currentUserId={user?.id} audioLevel={audio.audioLevels[room.participants.find((item) => item.seat === seat)?.userId ?? ''] ?? 0} microphoneOn={audio.microphoneEnabled[room.participants.find((item) => item.seat === seat)?.userId ?? ''] ?? false} />
                ))}
              </div>
            </section>

            <aside className="space-y-5">
              <AnimatePresence mode="wait" initial={false}>
              <motion.section key={`${room.status}-${myRole ?? 'waiting'}`} initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -6 }} transition={{ duration: 0.2 }} className={`overflow-hidden rounded-3xl p-6 ${myRole === 'speaker' ? 'bg-brand-700 text-white shadow-glow' : myRole === 'listener' ? 'bg-ink text-white' : 'border border-slate-200 bg-white text-ink'}`}>
                {myRole ? (
                  <>
                    <p className={`text-xs font-bold uppercase tracking-[0.18em] ${myRole === 'speaker' ? 'text-brand-200' : 'text-slate-400'}`}>Your role</p>
                    <h2 className="mt-3 font-display text-3xl font-extrabold">You are {myRole === 'speaker' ? 'speaking' : 'listening'}</h2>
                    <p className={`mt-3 text-sm leading-6 ${myRole === 'speaker' ? 'text-brand-100' : 'text-slate-300'}`}>{myRole === 'speaker' ? 'Share the conversation with your pair. Your microphone will be available.' : 'Listen closely. Your microphone stays off for this round.'}</p>
                  </>
                ) : (
                  <><p className="text-xs font-bold uppercase tracking-[0.18em] text-slate-400">Room status</p><h2 className="mt-3 font-display text-2xl font-extrabold">{room.status === 'break' ? 'Roles are switching' : room.status === 'ready' ? 'Get ready' : 'Waiting for all four'}</h2><p className="mt-3 text-sm leading-6 text-slate-500">{room.status === 'break' ? 'Pair B will speak in the next round.' : 'Keep this tab open while everyone connects.'}</p>{room.status === 'waiting' && <div className="mt-5"><div className="flex items-center justify-between text-xs font-bold text-slate-400"><span>Lobby</span><span>{room.participants.length} / 4 joined</span></div><div className="mt-2 grid grid-cols-4 gap-2">{[0, 1, 2, 3].map((index) => <motion.span key={index} initial={{ scale: 0.8 }} animate={{ scale: 1 }} className={`h-2 rounded-full ${index < room.participants.length ? 'bg-brand-500' : 'bg-slate-200'}`} />)}</div>{room.type === 'private' && <button type="button" onClick={() => void shareLobby()} className="secondary-button mt-4 w-full !py-2.5">Share room code · {room.code}</button>}</div>}</>
                )}
              </motion.section>
              </AnimatePresence>

              <section className="rounded-3xl border border-slate-200 bg-white p-6">
                <p className="text-xs font-bold uppercase tracking-[0.18em] text-brand-700">Conversation topic</p>
                {session.topic ? <h2 className="mt-4 font-display text-xl font-extrabold leading-7 text-ink">“{session.topic}”</h2> : <p className="mt-4 text-sm leading-6 text-slate-500">The topic appears when the speaking round begins.</p>}
              </section>

              <div className="hidden md:block"><AudioControls role={myRole} audio={audio} /></div>
            </aside>
          </div>
        )}
      </div>
      {!['finished', 'aborted'].includes(room.status) && (
        <MobileRoomControls role={myRole} audio={audio} isLeaving={isLeaving} onLeave={leave} />
      )}
    </main>
  );
}

function SeatCard({ seat, participant, speakingPair, currentUserId, audioLevel, microphoneOn }: { seat: number; participant?: RoomParticipant; speakingPair: Pair | null; currentUserId?: string; audioLevel: number; microphoneOn: boolean }) {
  if (!participant) return <motion.div layout initial={{ opacity: 0, scale: 0.96 }} animate={{ opacity: 1, scale: 1 }} className="grid min-h-44 place-items-center rounded-2xl border-2 border-dashed border-slate-300 bg-white/50 p-3 text-center sm:min-h-52 sm:rounded-3xl sm:p-6"><div><motion.span className="mx-auto grid h-11 w-11 place-items-center rounded-full bg-slate-100 text-xs font-bold text-slate-400 sm:h-14 sm:w-14 sm:text-sm" animate={{ opacity: [0.55, 1, 0.55] }} transition={{ duration: 2, repeat: Infinity }}>{seat}</motion.span><p className="mt-3 text-xs font-semibold text-slate-400 sm:text-sm">Waiting for someone…</p></div></motion.div>;
  const isSpeaker = speakingPair === participant.pair;
  const isMe = participant.userId === currentUserId;
  const isActivelySpeaking = audioLevel > 0.05;
  return (
    <motion.article layout initial={{ opacity: 0, scale: 0.96, y: 8 }} animate={{ opacity: 1, scale: 1, y: 0 }} transition={{ duration: 0.22, delay: seat * 0.035 }} className={`relative min-h-44 overflow-hidden rounded-2xl border bg-white p-3 transition sm:min-h-52 sm:rounded-3xl sm:p-6 ${isMe ? 'border-brand-400 ring-2 ring-brand-100 sm:ring-4' : isSpeaker ? 'border-brand-200' : 'border-slate-200'} ${isActivelySpeaking ? 'shadow-glow ring-2 ring-brand-300' : ''}`}>
      {isActivelySpeaking && <motion.span className="pointer-events-none absolute inset-0 rounded-2xl ring-2 ring-brand-400 sm:rounded-3xl" animate={{ opacity: [0.35, 1, 0.35], scale: [0.99, 1.01, 0.99] }} transition={{ duration: 1.2, repeat: Infinity }} />}
      <div className="flex items-start justify-between gap-3">
        <div className="relative"><span className={`grid h-11 w-11 place-items-center rounded-xl font-display text-sm font-extrabold sm:h-16 sm:w-16 sm:rounded-2xl sm:text-lg ${isSpeaker ? 'bg-brand-700 text-white' : 'bg-slate-100 text-slate-600'}`}>{initials(participant.displayName)}</span><span className={`absolute -bottom-1 -right-1 h-4 w-4 rounded-full border-2 border-white ${participant.connected ? 'bg-emerald-500' : 'bg-slate-300'}`} aria-label={participant.connected ? 'Connected' : 'Disconnected'} /></div>
        <span className={`rounded-full px-2 py-1 text-[10px] font-bold sm:px-2.5 sm:text-xs ${isSpeaker ? 'bg-brand-100 text-brand-800' : speakingPair ? 'bg-slate-100 text-slate-500' : 'bg-amber-50 text-amber-700'}`}>{speakingPair ? (isSpeaker ? 'Speaking' : 'Listening') : `Pair ${participant.pair}`}</span>
      </div>
      <h2 className="mt-4 truncate font-display text-sm font-extrabold text-ink sm:mt-5 sm:text-xl">{participant.displayName}{isMe && <span className="ml-1 text-[10px] font-bold text-brand-700 sm:ml-2 sm:text-xs">You</span>}</h2>
      <p className="mt-1 text-[11px] font-medium text-slate-400 sm:text-sm">Level {participant.englishLevel} · Seat {participant.seat}</p>
      <div className="mt-4 flex items-center justify-between border-t border-slate-100 pt-3 sm:mt-5 sm:pt-4"><span className="hidden text-xs font-semibold text-slate-400 sm:inline">{audioLevel > 0.05 ? 'Speaking now' : participant.connected ? 'In the room' : 'Reconnecting…'}</span><div className="ml-auto flex items-center gap-2"><AudioMeter level={audioLevel} /><span className={`grid h-8 w-8 place-items-center rounded-full ${microphoneOn ? 'bg-brand-50 text-brand-700' : 'bg-slate-100 text-slate-400'}`}><MicIcon muted={!microphoneOn} /></span></div></div>
    </motion.article>
  );
}

function Timer({ remainingSec, label }: { remainingSec: number; label: string }) {
  return <div className="flex items-center gap-3"><div className="text-right"><p className="text-xs font-semibold text-slate-400">{label}</p><motion.p key={remainingSec} initial={{ opacity: 0.55, y: -2 }} animate={{ opacity: 1, y: 0 }} className="font-display text-xl font-extrabold tabular-nums text-ink">{formatTime(remainingSec)}</motion.p></div><span className={`h-2.5 w-2.5 rounded-full ${remainingSec <= 10 ? 'animate-pulse bg-amber-500' : 'bg-brand-500'}`} /></div>;
}

function MobileRoomControls({ role, audio, isLeaving, onLeave }: { role: 'speaker' | 'listener' | null; audio: ReturnType<typeof useLiveKitAudio>; isLeaving: boolean; onLeave: () => Promise<void> }) {
  const connected = audio.connectionState === 'connected';
  return (
    <div className="safe-bottom fixed inset-x-3 bottom-2 z-50 flex items-center gap-3 rounded-2xl border border-slate-200 bg-white/90 p-2.5 shadow-soft backdrop-blur-xl md:hidden">
      <button type="button" onClick={() => void onLeave()} disabled={isLeaving} className="min-h-14 flex-1 rounded-xl bg-red-50 px-4 text-sm font-extrabold text-red-700 disabled:opacity-50">{isLeaving ? 'Leaving…' : 'Leave room'}</button>
      <motion.button whileTap={{ scale: 0.92 }} type="button" onClick={() => void audio.toggleMicrophone()} disabled={role !== 'speaker' || !connected || audio.microphoneState === 'starting'} className={`grid h-14 w-14 shrink-0 place-items-center rounded-xl ${role === 'speaker' && audio.microphoneState === 'on' ? 'bg-brand-700 text-white' : 'bg-slate-100 text-slate-400'}`} aria-label={audio.microphoneState === 'on' ? 'Mute microphone' : 'Unmute microphone'}><MicIcon muted={audio.microphoneState !== 'on'} /></motion.button>
    </div>
  );
}

function ConnectionPill({ state }: { state: 'connecting' | 'connected' | 'reconnecting' }) {
  return <span className={`hidden items-center gap-2 rounded-full px-3 py-1.5 text-xs font-bold sm:inline-flex ${state === 'connected' ? 'bg-brand-50 text-brand-800' : 'bg-amber-50 text-amber-700'}`}><span className={`h-2 w-2 rounded-full ${state === 'connected' ? 'bg-brand-500' : 'animate-pulse bg-amber-500'}`} />{state === 'connected' ? 'Live' : 'Reconnecting'}</span>;
}

function AudioControls({ role, audio }: { role: 'speaker' | 'listener' | null; audio: ReturnType<typeof useLiveKitAudio> }) {
  const connected = audio.connectionState === 'connected';
  return (
    <section className="rounded-3xl border border-slate-200 bg-white p-5">
      <div className="flex items-center justify-between gap-3">
        <div><p className="text-xs font-bold uppercase tracking-[0.15em] text-slate-400">Live audio</p><p className={`mt-1 text-sm font-extrabold ${connected ? 'text-brand-700' : 'text-amber-700'}`}>{connected ? 'Connected' : audio.connectionState === 'connecting' ? 'Connecting…' : 'Disconnected'}</p></div>
        {role === 'speaker' ? (
          <button type="button" onClick={() => void audio.toggleMicrophone()} disabled={!connected || audio.microphoneState === 'starting'} aria-label={audio.microphoneState === 'on' ? 'Mute microphone' : 'Unmute microphone'}
            className={`grid h-12 w-12 place-items-center rounded-full transition ${audio.microphoneState === 'on' ? 'bg-brand-700 text-white hover:bg-brand-800' : 'bg-red-50 text-red-700 hover:bg-red-100'}`}>
            <MicIcon muted={audio.microphoneState !== 'on'} />
          </button>
        ) : <span className="grid h-12 w-12 place-items-center rounded-full bg-slate-100 text-slate-400"><MicIcon muted /></span>}
      </div>
      <p className="mt-3 text-xs leading-5 text-slate-500">{microphoneHint(role, audio.microphoneState)}</p>
      {audio.microphoneError && <div role="alert" className="mt-3 rounded-xl bg-amber-50 px-3 py-2.5 text-xs font-semibold leading-5 text-amber-800">{audio.microphoneError}</div>}
      {audio.playbackBlocked && <button type="button" className="secondary-button mt-3 w-full !py-2 text-xs" onClick={() => void audio.resumeAudio()}>Enable audio playback</button>}
    </section>
  );
}

function AudioMeter({ level }: { level: number }) {
  return <span className="flex h-6 items-end gap-0.5" aria-label={level > 0.05 ? 'Speaking' : 'Silent'}>{[0.15, 0.35, 0.6].map((threshold, index) => <span key={threshold} className={`w-1 rounded-full transition-all ${level > threshold ? 'bg-brand-500' : 'bg-slate-200'}`} style={{ height: `${8 + index * 5}px` }} />)}</span>;
}

function FinishedPanel({ summary }: { summary: RoundSummary[] }) {
  return <section className="mx-auto max-w-2xl rounded-[2rem] border border-brand-200 bg-white p-7 text-center shadow-soft sm:p-10"><span className="mx-auto grid h-16 w-16 place-items-center rounded-2xl bg-brand-100 text-3xl">✓</span><p className="mt-6 text-xs font-bold uppercase tracking-[0.2em] text-brand-700">Session complete</p><h1 className="mt-3 font-display text-4xl font-extrabold">Well spoken.</h1><p className="mx-auto mt-3 max-w-md text-sm leading-6 text-slate-500">You completed both roles. This session is now saved to your history.</p>{summary.length > 0 && <div className="mt-7 space-y-2 text-left">{summary.map((round) => <div key={round.round} className="rounded-xl bg-slate-50 px-4 py-3 text-sm text-slate-600"><strong className="mr-2 text-ink">Round {round.round}</strong>{round.topicText}</div>)}</div>}<div className="mt-8 flex flex-col justify-center gap-3 sm:flex-row"><Link to="/history" className="secondary-button">View history</Link><Link to="/" className="primary-button">Back to home</Link></div></section>;
}

function AbortedPanel({ reason }: { reason: string }) {
  return <section className="mx-auto max-w-xl rounded-[2rem] border border-amber-200 bg-white p-8 text-center shadow-soft"><span className="text-4xl">⚠️</span><h1 className="mt-5 font-display text-3xl font-extrabold">Session ended early</h1><p className="mt-3 text-sm leading-6 text-slate-500">{reason}</p><div className="mt-7 flex justify-center gap-3"><Link to="/" className="secondary-button">Home</Link><Link to="/waiting" className="primary-button">Find another room</Link></div></section>;
}

function RoomLoading() { return <main className="grid min-h-screen place-items-center bg-canvas"><div className="text-center"><span className="mx-auto block h-11 w-11 animate-spin rounded-full border-4 border-brand-100 border-t-brand-600" /><p className="mt-4 text-sm font-semibold text-slate-500">Joining room…</p></div></main>; }
function MicIcon({ muted }: { muted: boolean }) { return <svg className="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M12 2a3 3 0 0 0-3 3v7a3 3 0 0 0 6 0V5a3 3 0 0 0-3-3ZM5 10v2a7 7 0 0 0 14 0v-2M12 19v3M8 22h8" strokeLinecap="round" strokeLinejoin="round" />{muted && <path d="m3 3 18 18" strokeLinecap="round" />}</svg>; }
function StatusDot({ status }: { status: RoomStatus }) { const active = ['round1', 'round2'].includes(status); return <span className={`h-3 w-3 rounded-full ${active ? 'animate-pulse bg-brand-500' : status === 'aborted' ? 'bg-red-500' : status === 'finished' ? 'bg-brand-500' : 'bg-amber-400'}`} />; }
function statusTitle(status: RoomStatus, round: number | null): string { return ({ waiting: 'Waiting for the room', ready: 'Everyone is ready', round1: `Round ${round ?? 1} in progress`, break: 'Round break', round2: `Round ${round ?? 2} in progress`, finished: 'Session complete', aborted: 'Session aborted' })[status]; }
function timerLabel(status: RoomStatus): string { return status === 'ready' ? 'Starts in' : status === 'break' ? 'Next round in' : 'Time left'; }
function formatTime(seconds: number): string { return `${String(Math.floor(seconds / 60)).padStart(2, '0')}:${String(seconds % 60).padStart(2, '0')}`; }
function initials(name: string): string { return name.split(/\s+/).filter(Boolean).slice(0, 2).map((part) => part[0]?.toUpperCase()).join(''); }
function humanizeReason(reason: string): string { return ({ participant_reconnect_timeout: 'A participant did not reconnect within the grace period.', no_active_topics: 'No suitable conversation topics were available.' } as Record<string, string>)[reason] ?? reason.replaceAll('_', ' '); }
function microphoneHint(role: 'speaker' | 'listener' | null, state: MicrophoneState): string { if (role === 'listener') return 'Listen-only mode. The server prevents microphone publishing for this round.'; if (role !== 'speaker') return 'Your microphone stays untouched until your speaking turn begins.'; return ({ off: 'Your microphone is off. Select the button to try again.', starting: 'Requesting microphone access…', on: 'Your microphone is live. Select the button to mute.', muted: 'You are muted. Select the button to speak.', denied: 'Microphone access is blocked. Update browser permissions and retry.' })[state]; }
