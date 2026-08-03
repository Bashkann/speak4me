import { useEffect, useRef, useState } from 'react';
import { motion, useReducedMotion } from 'framer-motion';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useNavigate } from 'react-router-dom';
import { ensureQueued, getMatchmakingStatus, leaveQueue } from '../api/matchmaking';
import { getApiErrorMessage } from '../lib/api-error';
import { createSocket } from '../lib/socket';
import { useAuthStore } from '../store/auth-store';
import { useToastStore } from '../store/toast-store';
import { Skeleton } from '../components/LoadingSkeleton';

export function WaitingPage() {
  const reducedMotion = useReducedMotion();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const user = useAuthStore((state) => state.user);
  const addToast = useToastStore((state) => state.add);
  const [elapsedSec, setElapsedSec] = useState(0);
  const [socketState, setSocketState] = useState<'connecting' | 'connected' | 'reconnecting'>('connecting');
  const [socketError, setSocketError] = useState<string | null>(null);
  const reconnectToastShown = useRef(false);
  const searchWidened = elapsedSec >= 120;

  const queueQuery = useQuery({
    queryKey: ['ensure-queued', user?.id],
    queryFn: ensureQueued,
    staleTime: Infinity,
    retry: false,
  });
  const cancelMutation = useMutation({
    mutationFn: leaveQueue,
    onSuccess: () => {
      queryClient.removeQueries({ queryKey: ['ensure-queued', user?.id] });
      navigate('/', { replace: true });
    },
  });

  useEffect(() => {
    const matched = queueQuery.data;
    if (matched?.state === 'matched') navigate(`/rooms/${matched.roomId}`, { replace: true });
  }, [navigate, queueQuery.data]);

  useEffect(() => {
    if (queueQuery.data?.state !== 'queued') return;
    const timer = window.setInterval(() => setElapsedSec((value) => value + 1), 1_000);
    return () => window.clearInterval(timer);
  }, [queueQuery.data?.state]);

  useEffect(() => {
    if (queueQuery.data?.state !== 'queued') return;
    const socket = createSocket('/me');
    let active = true;
    const openRoom = (roomId: string) => {
      if (!active) return;
      queryClient.removeQueries({ queryKey: ['ensure-queued', user?.id] });
      navigate(`/rooms/${roomId}`, { replace: true });
    };
    socket.on('connect', () => {
      setSocketState('connected');
      setSocketError(null);
      reconnectToastShown.current = false;
      // A match can be committed between the queue REST response and this socket
      // subscribing. Re-checking on every connection closes that event-loss window.
      void getMatchmakingStatus()
        .then((status) => {
          if (status.state === 'matched') openRoom(status.roomId);
        })
        .catch(() => {
          if (active) addToast('warning', 'Could not confirm matchmaking status. Still listening for a match.');
        });
    });
    socket.on('disconnect', (reason) => {
      if (reason !== 'io client disconnect') setSocketState('reconnecting');
    });
    socket.on('connect_error', (error) => {
      setSocketState('reconnecting');
      setSocketError(error.message);
      if (!reconnectToastShown.current) {
        reconnectToastShown.current = true;
        addToast('warning', 'Realtime matchmaking was interrupted. Reconnecting automatically.');
      }
    });
    socket.on('matched', ({ roomId }: { roomId: string }) => openRoom(roomId));
    return () => {
      active = false;
      socket.disconnect();
    };
  }, [addToast, navigate, queryClient, queueQuery.data?.state, user?.id]);

  return (
    <main className="relative grid min-h-[calc(100vh-7rem)] place-items-center overflow-hidden px-5 py-12">
      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_center,rgba(175,234,204,0.35),transparent_48%)]" />
      <section className="relative w-full max-w-lg rounded-[2rem] border border-white bg-white/90 p-7 text-center shadow-soft backdrop-blur sm:p-10">
        {queueQuery.isLoading ? (
          <div className="py-10" aria-label="Joining the matchmaking queue"><Skeleton className="mx-auto h-36 w-36 rounded-full" /><Skeleton className="mx-auto mt-7 h-3 w-36" /><Skeleton className="mx-auto mt-4 h-8 w-64" /><Skeleton className="mx-auto mt-4 h-4 w-72" /><p className="sr-only">Joining the queue…</p></div>
        ) : queueQuery.isError ? (
          <div className="py-8">
            <span className="mx-auto grid h-14 w-14 place-items-center rounded-2xl bg-red-50 text-2xl">!</span>
            <h1 className="mt-5 font-display text-2xl font-extrabold">Couldn’t start matchmaking</h1>
            <p className="mt-3 text-sm text-red-600">{getApiErrorMessage(queueQuery.error, 'Please try again.')}</p>
            <div className="mt-7 flex justify-center gap-3"><button className="secondary-button" onClick={() => navigate('/')}>Back home</button><button className="primary-button" onClick={() => void queueQuery.refetch()}>Try again</button></div>
          </div>
        ) : (
          <>
            <div className="relative mx-auto h-48 w-48" aria-hidden="true">
              <motion.span className="absolute inset-5 rounded-full border border-brand-300/60" animate={reducedMotion ? { opacity: 0.55 } : { scale: [0.92, 1.08, 0.92], opacity: [0.35, 0.8, 0.35] }} transition={{ duration: 2.4, repeat: reducedMotion ? 0 : Infinity, ease: 'easeInOut' }} />
              <motion.div className="absolute inset-0" animate={reducedMotion ? undefined : { rotate: 360 }} transition={{ duration: 9, repeat: Infinity, ease: 'linear' }}>
                {['A', 'B', 'C', 'D'].map((label, index) => {
                  const positions = ['left-1/2 top-0 -translate-x-1/2', 'right-0 top-1/2 -translate-y-1/2', 'bottom-0 left-1/2 -translate-x-1/2', 'left-0 top-1/2 -translate-y-1/2'];
                  return <motion.span key={label} className={`absolute grid h-10 w-10 place-items-center rounded-full border-2 border-white bg-brand-100 font-display text-xs font-extrabold text-brand-800 shadow-md ${positions[index]}`} animate={reducedMotion ? undefined : { rotate: -360 }} transition={{ duration: 9, repeat: Infinity, ease: 'linear' }}>{label}</motion.span>;
                })}
              </motion.div>
              <motion.span className="absolute inset-12 grid place-items-center rounded-full bg-ink shadow-xl" animate={reducedMotion ? undefined : { scale: [1, 1.045, 1] }} transition={{ duration: 1.8, repeat: Infinity, ease: 'easeInOut' }}>
                <svg className="h-10 w-10 text-brand-300" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8"><path d="M8 9v6M12 6v12M16 9v6M5 12h14" strokeLinecap="round" /></svg>
              </motion.span>
            </div>
            <motion.p key={searchWidened ? 'wide' : 'nearby'} initial={{ opacity: 0, y: 5 }} animate={{ opacity: 1, y: 0 }} className={`mt-7 text-xs font-bold uppercase tracking-[0.2em] ${searchWidened ? 'text-amber-700' : 'text-brand-700'}`}>{searchWidened ? 'Widening search…' : 'Searching nearby levels'}</motion.p>
            <h1 className="mt-3 font-display text-3xl font-extrabold tracking-tight">Finding your room…</h1>
            <p className="mx-auto mt-3 max-w-sm text-sm leading-6 text-slate-500">{searchWidened ? 'We expanded the level range to find your room sooner.' : <>We’re looking for three learners around level <strong className="text-ink">{user?.englishLevel}</strong>.</>} Keep this page open.</p>

            <div className="mt-7 grid grid-cols-2 gap-3">
              <div className="rounded-2xl bg-slate-50 px-4 py-4"><p className="text-xs font-semibold text-slate-400">Elapsed</p><p className="mt-1 font-display text-xl font-extrabold tabular-nums">{formatElapsed(elapsedSec)}</p></div>
              <div className="rounded-2xl bg-slate-50 px-4 py-4"><p className="text-xs font-semibold text-slate-400">Connection</p><p className={`mt-1 text-sm font-bold ${socketState === 'connected' ? 'text-brand-700' : 'text-amber-600'}`}>{socketState === 'connected' ? 'Listening' : socketState === 'connecting' ? 'Connecting' : 'Reconnecting'}</p></div>
            </div>
            {socketError && <p role="status" className="mt-3 text-xs font-medium text-amber-700">Realtime connection interrupted. Retrying automatically.</p>}
            <button type="button" className="secondary-button mt-7 w-full" onClick={() => cancelMutation.mutate()} disabled={cancelMutation.isPending}>{cancelMutation.isPending ? 'Cancelling…' : 'Cancel search'}</button>
            <p className="mt-4 text-xs text-slate-400">{searchWidened ? 'The wider level range is now active.' : 'After 2 minutes, the level range widens automatically.'}</p>
          </>
        )}
      </section>
    </main>
  );
}

function formatElapsed(seconds: number): string {
  return `${String(Math.floor(seconds / 60)).padStart(2, '0')}:${String(seconds % 60).padStart(2, '0')}`;
}
