import { useEffect, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useNavigate } from 'react-router-dom';
import { ensureQueued, leaveQueue } from '../api/matchmaking';
import { getApiErrorMessage } from '../lib/api-error';
import { createSocket } from '../lib/socket';
import { useAuthStore } from '../store/auth-store';

export function WaitingPage() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const user = useAuthStore((state) => state.user);
  const [elapsedSec, setElapsedSec] = useState(0);
  const [socketState, setSocketState] = useState<'connecting' | 'connected' | 'reconnecting'>('connecting');
  const [socketError, setSocketError] = useState<string | null>(null);

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
    socket.on('connect', () => {
      setSocketState('connected');
      setSocketError(null);
    });
    socket.on('disconnect', (reason) => {
      if (reason !== 'io client disconnect') setSocketState('reconnecting');
    });
    socket.on('connect_error', (error) => {
      setSocketState('reconnecting');
      setSocketError(error.message);
    });
    socket.on('matched', ({ roomId }: { roomId: string }) => {
      queryClient.removeQueries({ queryKey: ['ensure-queued', user?.id] });
      navigate(`/rooms/${roomId}`, { replace: true });
    });
    return () => {
      socket.disconnect();
    };
  }, [navigate, queryClient, queueQuery.data?.state, user?.id]);

  return (
    <main className="relative grid min-h-[calc(100vh-7rem)] place-items-center overflow-hidden px-5 py-12">
      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_center,rgba(175,234,204,0.35),transparent_48%)]" />
      <section className="relative w-full max-w-lg rounded-[2rem] border border-white bg-white/90 p-7 text-center shadow-soft backdrop-blur sm:p-10">
        {queueQuery.isLoading ? (
          <div className="py-16"><span className="mx-auto block h-10 w-10 animate-spin rounded-full border-4 border-brand-100 border-t-brand-600" /><p className="mt-5 text-sm font-semibold text-slate-500">Joining the queue…</p></div>
        ) : queueQuery.isError ? (
          <div className="py-8">
            <span className="mx-auto grid h-14 w-14 place-items-center rounded-2xl bg-red-50 text-2xl">!</span>
            <h1 className="mt-5 font-display text-2xl font-extrabold">Couldn’t start matchmaking</h1>
            <p className="mt-3 text-sm text-red-600">{getApiErrorMessage(queueQuery.error, 'Please try again.')}</p>
            <div className="mt-7 flex justify-center gap-3"><button className="secondary-button" onClick={() => navigate('/')}>Back home</button><button className="primary-button" onClick={() => void queueQuery.refetch()}>Try again</button></div>
          </div>
        ) : (
          <>
            <div className="relative mx-auto h-44 w-44" aria-hidden="true">
              <span className="absolute inset-0 animate-ping rounded-full border border-brand-300/50 [animation-duration:2.6s]" />
              <span className="absolute inset-5 animate-ping rounded-full border border-brand-400/50 [animation-delay:500ms] [animation-duration:2.6s]" />
              <span className="absolute inset-10 grid place-items-center rounded-full bg-ink shadow-xl">
                <svg className="h-10 w-10 text-brand-300" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8"><path d="M8 9v6M12 6v12M16 9v6M5 12h14" strokeLinecap="round" /></svg>
              </span>
            </div>
            <p className="mt-7 text-xs font-bold uppercase tracking-[0.2em] text-brand-700">Searching nearby levels</p>
            <h1 className="mt-3 font-display text-3xl font-extrabold tracking-tight">Finding your room…</h1>
            <p className="mx-auto mt-3 max-w-sm text-sm leading-6 text-slate-500">We’re looking for three learners around level <strong className="text-ink">{user?.englishLevel}</strong>. Keep this page open.</p>

            <div className="mt-7 grid grid-cols-2 gap-3">
              <div className="rounded-2xl bg-slate-50 px-4 py-4"><p className="text-xs font-semibold text-slate-400">Elapsed</p><p className="mt-1 font-display text-xl font-extrabold tabular-nums">{formatElapsed(elapsedSec)}</p></div>
              <div className="rounded-2xl bg-slate-50 px-4 py-4"><p className="text-xs font-semibold text-slate-400">Connection</p><p className={`mt-1 text-sm font-bold ${socketState === 'connected' ? 'text-brand-700' : 'text-amber-600'}`}>{socketState === 'connected' ? 'Listening' : socketState === 'connecting' ? 'Connecting' : 'Reconnecting'}</p></div>
            </div>
            {socketError && <p role="status" className="mt-3 text-xs font-medium text-amber-700">Realtime connection interrupted. Retrying automatically.</p>}
            <button type="button" className="secondary-button mt-7 w-full" onClick={() => cancelMutation.mutate()} disabled={cancelMutation.isPending}>{cancelMutation.isPending ? 'Cancelling…' : 'Cancel search'}</button>
            <p className="mt-4 text-xs text-slate-400">After 2 minutes, the level range widens automatically.</p>
          </>
        )}
      </section>
    </main>
  );
}

function formatElapsed(seconds: number): string {
  return `${String(Math.floor(seconds / 60)).padStart(2, '0')}:${String(seconds % 60).padStart(2, '0')}`;
}
