import { useEffect, useRef, useState } from 'react';
import { AnimatePresence, motion, useReducedMotion } from 'framer-motion';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Link, useNavigate, useParams } from 'react-router-dom';
import type { Socket } from 'socket.io-client';
import { getRoom, leaveRoom } from '../api/rooms';
import { Brand } from '../components/Brand';
import { Skeleton } from '../components/LoadingSkeleton';
import { useAbsoluteCountdown } from '../hooks/useAbsoluteCountdown';
import { useLiveKitAudio, type MicrophoneState } from '../hooks/useLiveKitAudio';
import { getApiErrorMessage } from '../lib/api-error';
import { createSocket } from '../lib/socket';
import { useAuthStore } from '../store/auth-store';
import { useRoomStore, type RoundSummary } from '../store/room-store';
import { useToastStore } from '../store/toast-store';
import type { RoomParticipant, RoomStatus, RoundStartedEvent, TopicOffer } from '../types/rooms';
import { CharacterBuddy } from '../components/character/CharacterBuddy';
import { sendFriendRequest } from '../api/social';

export function RoomPage() {
  const reducedMotion = useReducedMotion();
  const { roomId } = useParams<{ roomId: string }>();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const user = useAuthStore((state) => state.user);
  const session = useRoomStore();
  const addToast = useToastStore((state) => state.add);
  const socketRef = useRef<Socket | null>(null);
  const reconnectToastShown = useRef(false);
  const handoffTimerRef = useRef<number | null>(null);
  const finishTimerRef = useRef<number | null>(null);
  const [isLeaving, setIsLeaving] = useState(false);
  const [lockFeedback, setLockFeedback] = useState(false);
  const countdown = useAbsoluteCountdown(session.deadline);
  const currentRole = session.speakerUserId === user?.id ? 'speaker' : session.listenerUserId === user?.id ? 'listener' : null;
  const audioEnabled = Boolean(session.room && !['finished', 'aborted'].includes(session.room.status));
  const audio = useLiveKitAudio({ roomId, enabled: audioEnabled, shouldPublish: currentRole === 'speaker' });
  const roomQuery = useQuery({ queryKey: ['room', roomId], queryFn: () => getRoom(roomId!), enabled: Boolean(roomId), retry: 1 });

  useEffect(() => {
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
      } catch { /* Socket state remains authoritative during a brief REST failure. */ }
    };
    socket.on('connect', () => { session.setSocketState('connected'); reconnectToastShown.current = false; socket.emit('join', { roomId }); });
    socket.on('disconnect', (reason) => { if (reason !== 'io client disconnect') session.setSocketState('reconnecting'); });
    socket.on('connect_error', () => {
      session.setSocketState('reconnecting');
      if (!reconnectToastShown.current) { reconnectToastShown.current = true; addToast('warning', 'Room connection interrupted. Rejoining automatically.'); }
    });
    socket.on('room_state', session.hydrate);
    socket.on('participant_joined', ({ userId }: { userId: string }) => { session.setParticipantConnected(userId, true); void refreshRoom(); });
    socket.on('participant_left', ({ userId }: { userId: string }) => session.setParticipantConnected(userId, false));
    socket.on('room_ready', ({ endsAt }: { endsAt: string }) => session.roomReady(endsAt));
    socket.on('round_started', (event: RoundStartedEvent) => session.roundStarted(event));
    const triggerTopicLock = () => {
      if (useRoomStore.getState().speakerUserId === useAuthStore.getState().user?.id) navigator.vibrate?.(35);
      setLockFeedback(true);
      window.setTimeout(() => setLockFeedback(false), 650);
    };
    socket.on('topic_updated', (event: { topic: TopicOffer; swapsRemaining: number; topicLocked: boolean; continuedPrevious?: boolean }) => {
      session.topicUpdated(event);
      if (event.topicLocked) triggerTopicLock();
    });
    socket.on('topic_locked', () => { session.topicLockedByServer(); triggerTopicLock(); });
    socket.on('role_swap', (event: { nextSpeakerUserId: string; nextListenerUserId: string }) => {
      session.roleSwap(event);
      if (handoffTimerRef.current) window.clearTimeout(handoffTimerRef.current);
      handoffTimerRef.current = window.setTimeout(session.clearHandoff, reducedMotion ? 700 : 1_900);
    });
    socket.on('round_break', ({ endsAt }: { endsAt: string }) => session.roundBreak(endsAt));
    socket.on('session_finished', ({ rounds }: { rounds: RoundSummary[] }) => {
      session.finish(rounds); void queryClient.invalidateQueries({ queryKey: ['session-history'] }); socket.disconnect();
    });
    socket.on('session_aborted', ({ reason }: { reason: string }) => { session.abort(humanizeReason(reason)); socket.disconnect(); });
    socket.on('error', (error: { message?: string }) => addToast('error', error.message ?? 'A room connection error occurred.'));
    return () => { socket.disconnect(); socketRef.current = null; };
  }, [addToast, navigate, queryClient, reducedMotion, roomId, session.abort, session.clearHandoff, session.finish, session.hydrate, session.roleSwap, session.roomReady, session.roundBreak, session.roundStarted, session.setParticipantConnected, session.setSocketState, session.topicLockedByServer, session.topicUpdated]);

  useEffect(() => { if (audio.microphoneError) addToast('warning', audio.microphoneError); }, [addToast, audio.microphoneError]);
  useEffect(() => () => session.reset(), [session.reset]);
  useEffect(() => () => {
    if (handoffTimerRef.current) window.clearTimeout(handoffTimerRef.current);
    if (finishTimerRef.current) window.clearTimeout(finishTimerRef.current);
  }, []);

  const leave = async () => {
    if (!roomId || isLeaving) return;
    setIsLeaving(true);
    try { await leaveRoom(roomId); }
    catch (error) { addToast('warning', getApiErrorMessage(error, 'The server could not confirm that you left the room.')); }
    finally { socketRef.current?.emit('leave'); socketRef.current?.disconnect(); session.reset(); navigate('/', { replace: true }); }
  };
  const swapTopic = () => { if (roomId && currentRole === 'speaker' && !session.topicLocked) socketRef.current?.emit('topic_swap', { roomId }); };
  const choosePrevious = () => { if (roomId && currentRole === 'speaker') socketRef.current?.emit('topic_choose_previous', { roomId }); };

  if (roomQuery.isLoading && !session.room) return <RoomLoading />;
  if (roomQuery.isError && !session.room) return <main className="grid min-h-screen place-items-center bg-canvas px-5"><div className="max-w-md text-center"><span className="text-4xl">⚠️</span><h1 className="mt-4 font-display text-2xl font-extrabold">Room unavailable</h1><p className="mt-3 text-sm text-red-600">{getApiErrorMessage(roomQuery.error, 'This room could not be loaded.')}</p><Link className="secondary-button mt-6" to="/">Back home</Link></div></main>;
  const room = session.room;
  if (!room) return <RoomLoading />;

  return (
    <main className="min-h-screen bg-[#eff3ef] pb-28 md:pb-0">
      <header className="border-b border-slate-200 bg-white/90 backdrop-blur"><div className="mx-auto flex max-w-6xl items-center justify-between px-5 py-3.5 sm:px-8"><Brand /><div className="flex items-center gap-3"><ConnectionPill state={session.socketState} /><button type="button" onClick={() => void leave()} disabled={isLeaving} className="hidden rounded-xl border border-red-100 bg-red-50 px-3.5 py-2 text-sm font-bold text-red-700 md:inline-flex">{isLeaving ? 'Leaving…' : 'Leave'}</button></div></div></header>
      <AnimatePresence>{session.handoff && <HandoffBanner isNextSpeaker={session.handoff.nextSpeakerUserId === user?.id} reducedMotion={Boolean(reducedMotion)} />}</AnimatePresence>
      <div className="mx-auto max-w-6xl px-5 py-6 sm:px-8 sm:py-8">
        <section className="mb-6 flex flex-col justify-between gap-4 rounded-2xl border border-slate-200 bg-white px-5 py-4 sm:flex-row sm:items-center"><div className="flex items-center gap-3"><CharacterBuddy mood={room.status === 'break' ? 'excited' : room.status === 'round1' || room.status === 'round2' ? 'encouraging' : 'thinking'} size="xs" /><StatusDot status={room.status} /><div><p className="text-sm font-extrabold text-ink">{statusTitle(room.status, room.currentRound)}</p><p className="mt-0.5 text-xs font-medium text-slate-400">Room {room.code} · 2 people · {Math.round(room.roundDurationSec / 60)} minute rounds</p></div></div>{countdown !== null && room.status !== 'waiting' && <Timer remainingSec={countdown} label={timerLabel(room.status)} />}</section>
        {room.status === 'finished' ? <FinishedPanel summary={session.summary ?? []} partner={room.participants.find((participant) => participant.userId !== user?.id)} /> : room.status === 'aborted' ? <AbortedPanel reason={session.abortReason ?? 'The session ended unexpectedly.'} /> : (
          <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_360px]">
            <section className="grid gap-3 sm:grid-cols-2 sm:gap-4">{[1, 2].map((seat) => { const participant = room.participants.find((item) => item.seat === seat); return <SeatCard key={seat} seat={seat} participant={participant} speakerUserId={session.speakerUserId} currentUserId={user?.id} audioLevel={audio.audioLevels[participant?.userId ?? ''] ?? 0} microphoneOn={audio.microphoneEnabled[participant?.userId ?? ''] ?? false} reducedMotion={Boolean(reducedMotion)} />; })}</section>
            <aside className="space-y-5">
              <RolePanel role={currentRole} status={room.status} participants={room.participants.length} />
              <TopicPanel role={currentRole} topic={session.topic} swapsRemaining={session.swapsRemaining} locked={session.topicLocked} lockFeedback={lockFeedback} canContinuePrevious={session.canContinuePrevious} previousTopic={session.previousTopic} continuedPrevious={session.continuedPrevious} onSwap={swapTopic} onChoosePrevious={choosePrevious} reducedMotion={Boolean(reducedMotion)} />
              <div className="hidden md:block"><AudioControls role={currentRole} audio={audio} /></div>
            </aside>
          </div>
        )}
      </div>
      {!['finished', 'aborted'].includes(room.status) && <MobileRoomControls role={currentRole} audio={audio} isLeaving={isLeaving} onLeave={leave} />}
    </main>
  );
}

function HandoffBanner({ isNextSpeaker, reducedMotion }: { isNextSpeaker: boolean; reducedMotion: boolean }) {
  return <motion.div initial={{ opacity: 0, y: reducedMotion ? 0 : -18, scale: reducedMotion ? 1 : 0.96 }} animate={{ opacity: 1, y: 0, scale: 1 }} exit={{ opacity: 0, y: reducedMotion ? 0 : -10 }} className="pointer-events-none fixed inset-x-4 top-20 z-40 mx-auto flex max-w-md items-center justify-center gap-3 rounded-2xl border border-brand-200 bg-white/95 px-5 py-3 text-left shadow-soft backdrop-blur"><CharacterBuddy mood={isNextSpeaker ? 'excited' : 'happy'} size="xs" /><div><p className="text-xs font-bold uppercase tracking-[0.18em] text-brand-700">Role hand-off</p><p className="mt-1 font-display text-xl font-extrabold text-ink">{isNextSpeaker ? "Now it's your turn to speak" : 'Now you listen'}</p></div></motion.div>;
}

function RolePanel({ role, status, participants }: { role: 'speaker' | 'listener' | null; status: RoomStatus; participants: number }) {
  return <AnimatePresence mode="wait" initial={false}><motion.section key={`${status}-${role ?? 'waiting'}`} initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -5 }} className={`rounded-3xl p-6 ${role === 'speaker' ? 'bg-brand-700 text-white shadow-glow' : role === 'listener' ? 'bg-ink text-white' : 'border border-slate-200 bg-white text-ink'}`}><p className={`text-xs font-bold uppercase tracking-[0.18em] ${role ? 'text-brand-200' : 'text-slate-400'}`}>{role ? 'Your role' : 'Room status'}</p><h2 className="mt-3 font-display text-3xl font-extrabold">{role === 'speaker' ? "You're speaking" : role === 'listener' ? "You're listening" : status === 'break' ? 'Roles are switching' : status === 'ready' ? 'Get ready' : 'Waiting for your partner'}</h2><p className={`mt-3 text-sm leading-6 ${role ? 'text-slate-200' : 'text-slate-500'}`}>{role === 'speaker' ? 'Your microphone is available. Guide the conversation from the topic below.' : role === 'listener' ? 'Listen closely. Publishing is disabled until your turn.' : `${participants} / 2 people joined.`}</p></motion.section></AnimatePresence>;
}

function TopicPanel({ role, topic, swapsRemaining, locked, lockFeedback, canContinuePrevious, previousTopic, continuedPrevious, onSwap, onChoosePrevious, reducedMotion }: { role: 'speaker' | 'listener' | null; topic: TopicOffer | null; swapsRemaining: number; locked: boolean; lockFeedback: boolean; canContinuePrevious: boolean; previousTopic: TopicOffer | null; continuedPrevious: boolean; onSwap: () => void; onChoosePrevious: () => void; reducedMotion: boolean }) {
  return <motion.section animate={lockFeedback && !reducedMotion ? { x: [0, -6, 6, -4, 4, 0] } : { x: 0 }} transition={{ duration: 0.42 }} className="rounded-3xl border border-slate-200 bg-white p-6"><div className="flex items-center justify-between gap-3"><p className="text-xs font-bold uppercase tracking-[0.18em] text-brand-700">Conversation topic</p>{topic && <div className="flex gap-1" aria-label={`${swapsRemaining} topic swaps remaining`}>{[0, 1, 2].map((dot) => <motion.span key={dot} animate={{ scale: dot < swapsRemaining + 1 ? 1 : 0.72, opacity: dot < swapsRemaining + 1 ? 1 : 0.45 }} className={`h-2 w-2 rounded-full ${dot < swapsRemaining + 1 ? 'bg-brand-500' : 'bg-slate-200'}`} />)}</div>}</div><AnimatePresence mode="wait">{topic ? <motion.div key={topic.id} initial={{ opacity: 0, rotateY: reducedMotion ? 0 : -72, y: reducedMotion ? 0 : 8 }} animate={{ opacity: 1, rotateY: 0, y: 0 }} exit={{ opacity: 0, rotateY: reducedMotion ? 0 : 72 }} transition={{ duration: reducedMotion ? 0.08 : 0.34 }} className="mt-4 rounded-2xl bg-brand-50 p-4"><h2 className="font-display text-xl font-extrabold leading-7 text-ink">“{topic.textEn}”</h2></motion.div> : <motion.p initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="mt-4 text-sm leading-6 text-slate-500">The topic appears when the speaking round begins.</motion.p>}</AnimatePresence>{role === 'speaker' && topic && <div className="mt-4 space-y-2"><AnimatePresence>{canContinuePrevious && previousTopic && !continuedPrevious && <motion.button initial={{ opacity: 0, y: reducedMotion ? 0 : 7 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }} type="button" onClick={onChoosePrevious} className="secondary-button w-full !py-2.5">Continue previous topic</motion.button>}</AnimatePresence><motion.button whileTap={reducedMotion ? undefined : { rotate: -1.5, scale: 0.98 }} type="button" onClick={onSwap} disabled={locked || swapsRemaining === 0} className="primary-button w-full !py-2.5">{locked || swapsRemaining === 0 ? <><span aria-hidden="true">🔒</span>No more topic changes</> : <><span aria-hidden="true">↻</span>Swap topic · {swapsRemaining} left</>}</motion.button><AnimatePresence>{locked && <motion.p initial={{ opacity: 0, y: reducedMotion ? 0 : -4 }} animate={{ opacity: 1, y: 0 }} role="status" className="text-center text-xs font-bold text-amber-700">That’s your last topic.</motion.p>}</AnimatePresence></div>}</motion.section>;
}

function SeatCard({ seat, participant, speakerUserId, currentUserId, audioLevel, microphoneOn, reducedMotion }: { seat: number; participant?: RoomParticipant; speakerUserId: string | null; currentUserId?: string; audioLevel: number; microphoneOn: boolean; reducedMotion: boolean }) {
  if (!participant) return <div className="grid min-h-52 place-items-center rounded-3xl border-2 border-dashed border-slate-300 bg-white/50 p-6 text-center"><div><span className="mx-auto grid h-14 w-14 place-items-center rounded-full bg-slate-100 font-bold text-slate-400">{seat}</span><p className="mt-3 text-sm font-semibold text-slate-400">Waiting for someone…</p></div></div>;
  const isSpeaker = speakerUserId === participant.userId; const isMe = participant.userId === currentUserId; const active = audioLevel > 0.05;
  return <motion.article layout animate={{ opacity: participant.connected ? (speakerUserId && !isSpeaker ? 0.78 : 1) : 0.48 }} className={`relative min-h-52 overflow-hidden rounded-3xl border bg-white p-5 sm:p-6 ${isMe ? 'border-brand-400 ring-4 ring-brand-100' : isSpeaker ? 'border-brand-200' : 'border-slate-200'} ${active ? 'shadow-glow ring-2 ring-brand-300' : ''}`}>{active && <motion.span className="pointer-events-none absolute inset-0 rounded-3xl ring-2 ring-brand-400" animate={{ opacity: Math.min(0.9, 0.25 + audioLevel * 3), scale: reducedMotion ? 1 : 1.006 }} />}<div className="flex items-start justify-between"><div className="relative"><span className={`grid h-16 w-16 place-items-center rounded-2xl font-display text-lg font-extrabold ${isSpeaker ? 'bg-brand-700 text-white' : 'bg-slate-100 text-slate-600'}`}>{initials(participant.displayName)}</span><span className={`absolute -bottom-1 -right-1 h-4 w-4 rounded-full border-2 border-white ${participant.connected ? 'bg-emerald-500' : 'bg-slate-300'}`} /></div><span className={`rounded-full px-2.5 py-1 text-xs font-bold ${isSpeaker ? 'bg-brand-100 text-brand-800' : speakerUserId ? 'bg-slate-100 text-slate-500' : 'bg-amber-50 text-amber-700'}`}>{speakerUserId ? (isSpeaker ? 'Speaking' : 'Listening') : 'Waiting'}</span></div><h2 className="mt-5 truncate font-display text-xl font-extrabold text-ink">{participant.displayName}{isMe && <span className="ml-2 text-xs text-brand-700">You</span>}</h2><p className="mt-1 text-sm font-medium text-slate-400">Level {participant.englishLevel}</p><div className="mt-5 flex items-center justify-between border-t border-slate-100 pt-4"><span className="text-xs font-semibold text-slate-400">{active ? 'Speaking now' : participant.connected ? 'In the room' : 'Reconnecting…'}</span><div className="flex items-center gap-2"><AudioMeter level={audioLevel} /><span className={`grid h-8 w-8 place-items-center rounded-full ${microphoneOn ? 'bg-brand-50 text-brand-700' : 'bg-slate-100 text-slate-400'}`}><MicIcon muted={!microphoneOn} /></span></div></div></motion.article>;
}

function Timer({ remainingSec, label }: { remainingSec: number; label: string }) { const urgent = remainingSec <= 10; return <div className={`flex items-center gap-3 rounded-xl px-2 py-1 ${urgent ? 'bg-amber-50' : ''}`}><div className="text-right"><p className="text-xs font-semibold text-slate-400">{label}</p><motion.p key={remainingSec} initial={{ opacity: 0.7, scale: urgent ? 1.08 : 1.02 }} animate={{ opacity: 1, scale: 1 }} className={`min-w-[4.2rem] font-display text-xl font-extrabold tabular-nums ${urgent ? 'text-amber-700' : 'text-ink'}`}>{formatTime(remainingSec)}</motion.p></div><span className={`h-2.5 w-2.5 rounded-full ${urgent ? 'bg-amber-500' : 'bg-brand-500'}`} /></div>; }
function MobileRoomControls({ role, audio, isLeaving, onLeave }: { role: 'speaker' | 'listener' | null; audio: ReturnType<typeof useLiveKitAudio>; isLeaving: boolean; onLeave: () => Promise<void> }) { const connected = audio.connectionState === 'connected'; return <div className="safe-bottom fixed inset-x-3 bottom-2 z-50 flex items-center gap-3 rounded-2xl border border-slate-200 bg-white/90 p-2.5 shadow-soft backdrop-blur-xl md:hidden"><button type="button" onClick={() => void onLeave()} disabled={isLeaving} className="min-h-14 flex-1 rounded-xl bg-red-50 px-4 text-sm font-extrabold text-red-700">{isLeaving ? 'Leaving…' : 'Leave room'}</button><button type="button" onClick={() => void audio.toggleMicrophone()} disabled={role !== 'speaker' || !connected || audio.microphoneState === 'starting'} className={`grid h-14 w-14 place-items-center rounded-xl ${role === 'speaker' && audio.microphoneState === 'on' ? 'bg-brand-700 text-white' : 'bg-slate-100 text-slate-400'}`} aria-label={audio.microphoneState === 'on' ? 'Mute microphone' : 'Unmute microphone'}><MicIcon muted={audio.microphoneState !== 'on'} /></button></div>; }
function AudioControls({ role, audio }: { role: 'speaker' | 'listener' | null; audio: ReturnType<typeof useLiveKitAudio> }) { const connected = audio.connectionState === 'connected'; return <section className="rounded-3xl border border-slate-200 bg-white p-5"><div className="flex items-center justify-between"><div><p className="text-xs font-bold uppercase tracking-[0.15em] text-slate-400">Live audio</p><p className={`mt-1 text-sm font-extrabold ${connected ? 'text-brand-700' : 'text-amber-700'}`}>{connected ? 'Connected' : audio.connectionState === 'connecting' ? 'Connecting…' : 'Disconnected'}</p></div>{role === 'speaker' ? <button type="button" onClick={() => void audio.toggleMicrophone()} disabled={!connected || audio.microphoneState === 'starting'} className={`grid h-12 w-12 place-items-center rounded-full ${audio.microphoneState === 'on' ? 'bg-brand-700 text-white' : 'bg-red-50 text-red-700'}`}><MicIcon muted={audio.microphoneState !== 'on'} /></button> : <span className="grid h-12 w-12 place-items-center rounded-full bg-slate-100 text-slate-400"><MicIcon muted /></span>}</div><p className="mt-3 text-xs leading-5 text-slate-500">{microphoneHint(role, audio.microphoneState)}</p>{audio.microphoneError && <div role="alert" className="mt-3 rounded-xl bg-amber-50 px-3 py-2.5 text-xs font-semibold text-amber-800">{audio.microphoneError}</div>}{audio.playbackBlocked && <button type="button" className="secondary-button mt-3 w-full !py-2 text-xs" onClick={() => void audio.resumeAudio()}>Enable audio playback</button>}</section>; }
function ConnectionPill({ state }: { state: 'connecting' | 'connected' | 'reconnecting' }) { return <span className={`hidden items-center gap-2 rounded-full px-3 py-1.5 text-xs font-bold sm:inline-flex ${state === 'connected' ? 'bg-brand-50 text-brand-800' : 'bg-amber-50 text-amber-700'}`}><span className={`h-2 w-2 rounded-full ${state === 'connected' ? 'bg-brand-500' : 'animate-pulse bg-amber-500'}`} />{state === 'connected' ? 'Live' : 'Reconnecting'}</span>; }
function AudioMeter({ level }: { level: number }) { return <span className="flex h-6 items-end gap-0.5">{[0.15, 0.35, 0.6].map((threshold, index) => <span key={threshold} className={`w-1 rounded-full ${level > threshold ? 'bg-brand-500' : 'bg-slate-200'}`} style={{ height: `${8 + index * 5}px` }} />)}</span>; }
function FinishedPanel({ summary, partner }: { summary: RoundSummary[]; partner?: RoomParticipant }) { const queryClient = useQueryClient(); const toast = useToastStore((state) => state.add); const addFriend = useMutation({ mutationFn: sendFriendRequest, onSuccess: async () => { toast('success', 'Friend request sent.'); await queryClient.invalidateQueries({ queryKey: ['friend-requests'] }); }, onError: (error) => toast('error', getApiErrorMessage(error, 'Could not send that friend request.')) }); return <section className="mx-auto max-w-2xl rounded-[2rem] border border-brand-200 bg-white p-8 text-center shadow-soft"><CharacterBuddy mood="celebrating" size="lg" className="mx-auto -mb-2" /><p className="mt-3 text-xs font-bold uppercase tracking-[0.2em] text-brand-700">Session complete</p><h1 className="mt-3 font-display text-4xl font-extrabold">Well spoken.</h1><p className="mt-3 text-sm text-slate-500">Both people completed a speaking round.</p>{partner && <div className="mt-6 rounded-2xl bg-brand-50 p-4"><p className="text-sm font-bold text-ink">Keep practising with {partner.displayName}</p><p className="mt-1 text-xs text-slate-500">@{partner.handle}</p><button type="button" onClick={() => addFriend.mutate(partner.userId)} disabled={addFriend.isPending || addFriend.isSuccess} className="primary-button mt-3 !py-2">{addFriend.isSuccess ? 'Request sent' : addFriend.isPending ? 'Sending…' : 'Add friend'}</button></div>}{summary.length > 0 && <div className="mt-7 space-y-2 text-left">{summary.map((round) => <div key={round.roundNo} className="rounded-xl bg-slate-50 px-4 py-3 text-sm text-slate-600"><strong className="mr-2 text-ink">Round {round.roundNo}</strong>{round.topicText}</div>)}</div>}<div className="mt-8 flex justify-center gap-3"><Link to="/history" className="secondary-button">View history</Link><Link to="/" className="primary-button">Home</Link></div></section>; }
function AbortedPanel({ reason }: { reason: string }) { return <section className="mx-auto max-w-xl rounded-[2rem] border border-amber-200 bg-white p-8 text-center shadow-soft"><span className="text-4xl">⚠️</span><h1 className="mt-5 font-display text-3xl font-extrabold">Session ended early</h1><p className="mt-3 text-sm text-slate-500">{reason}</p><div className="mt-7 flex justify-center gap-3"><Link to="/" className="secondary-button">Home</Link><Link to="/waiting" className="primary-button">Find another room</Link></div></section>; }
function RoomLoading() { return <main className="min-h-screen bg-canvas px-5 py-6"><div className="mx-auto max-w-6xl"><div className="flex items-center gap-3 rounded-2xl border border-slate-200 bg-white px-5 py-3"><CharacterBuddy mood="loading" size="xs" /><div className="flex-1"><Skeleton className="h-4 w-36" /><Skeleton className="mt-2 h-3 w-56" /></div></div><div className="mt-6 grid gap-6 lg:grid-cols-[1fr_360px]"><div className="grid gap-4 sm:grid-cols-2">{[1, 2].map((seat) => <Skeleton key={seat} className="h-52 rounded-3xl" />)}</div><Skeleton className="h-72 rounded-3xl" /></div></div></main>; }
function MicIcon({ muted }: { muted: boolean }) { return <svg className="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M12 2a3 3 0 0 0-3 3v7a3 3 0 0 0 6 0V5a3 3 0 0 0-3-3ZM5 10v2a7 7 0 0 0 14 0v-2M12 19v3M8 22h8" strokeLinecap="round" />{muted && <path d="m3 3 18 18" />}</svg>; }
function StatusDot({ status }: { status: RoomStatus }) { const active = ['round1', 'round2'].includes(status); return <span className={`h-3 w-3 rounded-full ${active ? 'animate-pulse bg-brand-500' : status === 'aborted' ? 'bg-red-500' : status === 'finished' ? 'bg-brand-500' : 'bg-amber-400'}`} />; }
function statusTitle(status: RoomStatus, round: number | null): string { return ({ waiting: 'Waiting for your partner', ready: 'Both people are ready', round1: `Round ${round ?? 1} in progress`, break: 'Role swap', round2: `Round ${round ?? 2} in progress`, finished: 'Session complete', aborted: 'Session aborted' })[status]; }
function timerLabel(status: RoomStatus): string { return status === 'ready' ? 'Starts in' : status === 'break' ? 'Your turn in' : 'Time left'; }
function formatTime(seconds: number): string { return `${String(Math.floor(seconds / 60)).padStart(2, '0')}:${String(seconds % 60).padStart(2, '0')}`; }
function initials(name: string): string { return name.split(/\s+/).filter(Boolean).slice(0, 2).map((part) => part[0]?.toUpperCase()).join(''); }
function humanizeReason(reason: string): string { return ({ participant_reconnect_timeout: 'Your partner did not reconnect within the grace period.', participant_left_before_start: 'Your match left before the session started.', no_active_topics: 'No suitable conversation topics were available.' } as Record<string, string>)[reason] ?? reason.replaceAll('_', ' '); }
function microphoneHint(role: 'speaker' | 'listener' | null, state: MicrophoneState): string { if (role === 'listener') return 'Listen-only mode. The server prevents microphone publishing for this round.'; if (role !== 'speaker') return 'Your microphone stays untouched until your speaking turn begins.'; return ({ off: 'Your microphone is off. Select the button to try again.', starting: 'Requesting microphone access…', on: 'Your microphone is live. Select the button to mute.', muted: 'You are muted. Select the button to speak.', denied: 'Microphone access is blocked. Update browser permissions and retry.' })[state]; }
