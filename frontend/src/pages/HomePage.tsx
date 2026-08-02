import { useState, type FormEvent } from 'react';
import { useMutation } from '@tanstack/react-query';
import { Link, useNavigate } from 'react-router-dom';
import { createPrivateRoom, joinPrivateRoom } from '../api/rooms';
import { getApiErrorMessage } from '../lib/api-error';
import { useAuthStore } from '../store/auth-store';

export function HomePage() {
  const navigate = useNavigate();
  const user = useAuthStore((state) => state.user);
  const [code, setCode] = useState('');
  const [roundDurationSec, setRoundDurationSec] = useState(420);
  const [createdRoom, setCreatedRoom] = useState<{ id: string; code: string } | null>(null);
  const [copied, setCopied] = useState(false);

  const createMutation = useMutation({
    mutationFn: () => createPrivateRoom(roundDurationSec),
    onSuccess: (room) => setCreatedRoom({ id: room.id, code: room.code }),
  });
  const joinMutation = useMutation({
    mutationFn: () => joinPrivateRoom(code.trim().toUpperCase()),
    onSuccess: (room) => navigate(`/rooms/${room.id}`),
  });

  const submitJoin = (event: FormEvent) => {
    event.preventDefault();
    if (code.trim().length === 6) joinMutation.mutate();
  };

  const copyCode = async () => {
    if (!createdRoom) return;
    await navigator.clipboard.writeText(createdRoom.code);
    setCopied(true);
    window.setTimeout(() => setCopied(false), 1500);
  };

  return (
    <main className="px-5 py-10 sm:px-8 sm:py-14">
      <div className="mx-auto max-w-6xl">
        <section className="relative overflow-hidden rounded-[2rem] bg-ink px-6 py-9 text-white sm:px-10 sm:py-12">
          <div className="absolute -right-20 -top-28 h-80 w-80 rounded-full border-[52px] border-brand-500/20" />
          <div className="absolute bottom-0 right-24 h-36 w-36 rounded-full bg-brand-400/10 blur-2xl" />
          <div className="relative flex flex-col justify-between gap-8 md:flex-row md:items-end">
            <div>
              <span className="inline-flex items-center gap-2 rounded-full bg-white/10 px-3 py-1.5 text-xs font-bold text-brand-200 ring-1 ring-white/10">
                <span className="h-2 w-2 rounded-full bg-brand-300" /> Level {user?.englishLevel}
              </span>
              <h1 className="mt-5 font-display text-4xl font-extrabold tracking-tight sm:text-5xl">Good to see you, {user?.displayName?.split(' ')[0]}.</h1>
              <p className="mt-3 max-w-xl text-sm leading-6 text-slate-300 sm:text-base">Choose how you want to practice today. Every room gives you one speaking round and one listening round.</p>
            </div>
            <Link to="/history" className="inline-flex w-fit items-center gap-2 text-sm font-bold text-brand-200 transition hover:text-white">
              View session history <span aria-hidden="true">→</span>
            </Link>
          </div>
        </section>

        <section className="mt-7 grid gap-6 lg:grid-cols-2">
          <article className="group relative overflow-hidden rounded-3xl border border-slate-200 bg-white p-7 shadow-sm transition hover:-translate-y-0.5 hover:shadow-soft sm:p-8">
            <span className="grid h-12 w-12 place-items-center rounded-2xl bg-brand-100 text-brand-700" aria-hidden="true">
              <svg className="h-6 w-6" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2M9 11a4 4 0 1 0 0-8M22 21v-2a4 4 0 0 0-3-3.87M16 3.13a4 4 0 0 1 0 7.75" strokeLinecap="round" /></svg>
            </span>
            <p className="mt-6 text-xs font-bold uppercase tracking-[0.18em] text-brand-700">Matchmaking</p>
            <h2 className="mt-2 font-display text-2xl font-extrabold text-ink">Find a speaking room</h2>
            <p className="mt-3 min-h-12 text-sm leading-6 text-slate-500">We’ll match you with three learners near your CEFR level.</p>
            <button type="button" className="primary-button mt-7 w-full" onClick={() => navigate('/waiting')}>Find a partner</button>
            <p className="mt-3 text-center text-xs text-slate-400">Usually takes less than two minutes</p>
          </article>

          <article className="rounded-3xl border border-slate-200 bg-white p-7 shadow-sm sm:p-8">
            <span className="grid h-12 w-12 place-items-center rounded-2xl bg-amber-100 text-amber-700" aria-hidden="true">
              <svg className="h-6 w-6" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M3 11l9-8 9 8M5 10v10h14V10M9 20v-6h6v6" strokeLinecap="round" strokeLinejoin="round" /></svg>
            </span>
            <p className="mt-6 text-xs font-bold uppercase tracking-[0.18em] text-amber-700">Private room</p>
            <h2 className="mt-2 font-display text-2xl font-extrabold text-ink">Practice with invited people</h2>

            {createdRoom ? (
              <div className="mt-6 rounded-2xl border border-brand-200 bg-brand-50 p-5">
                <p className="text-xs font-bold uppercase tracking-wider text-brand-700">Share this room code</p>
                <button type="button" onClick={() => void copyCode()} className="mt-2 flex w-full items-center justify-between rounded-xl bg-white px-4 py-3 text-left ring-1 ring-brand-200">
                  <span className="font-display text-2xl font-extrabold tracking-[0.18em] text-ink">{createdRoom.code}</span>
                  <span className="text-xs font-bold text-brand-700">{copied ? 'Copied!' : 'Copy'}</span>
                </button>
                <button type="button" onClick={() => navigate(`/rooms/${createdRoom.id}`)} className="primary-button mt-4 w-full">Enter room</button>
              </div>
            ) : (
              <>
                <div className="mt-6 flex gap-2">
                  <select className="field !w-auto flex-1" aria-label="Round duration" value={roundDurationSec} onChange={(event) => setRoundDurationSec(Number(event.target.value))}>
                    <option value={300}>5 minute rounds</option>
                    <option value={420}>7 minute rounds</option>
                    <option value={600}>10 minute rounds</option>
                  </select>
                  <button type="button" onClick={() => createMutation.mutate()} disabled={createMutation.isPending} className="secondary-button whitespace-nowrap">
                    {createMutation.isPending ? 'Creating…' : 'Create'}
                  </button>
                </div>
                {createMutation.isError && <p role="alert" className="mt-2 text-xs font-semibold text-red-600">{getApiErrorMessage(createMutation.error, 'Could not create a private room.')}</p>}
              </>
            )}

            <div className="my-5 flex items-center gap-3 text-xs font-semibold text-slate-300"><span className="h-px flex-1 bg-slate-200" />or join a room<span className="h-px flex-1 bg-slate-200" /></div>
            <form onSubmit={submitJoin} className="flex gap-2">
              <input className="field uppercase tracking-[0.16em]" aria-label="Private room code" value={code} onChange={(event) => setCode(event.target.value.replace(/[^a-zA-Z0-9]/g, '').slice(0, 6))} placeholder="ABC123" minLength={6} maxLength={6} required />
              <button type="submit" className="secondary-button" disabled={joinMutation.isPending || code.length !== 6}>{joinMutation.isPending ? 'Joining…' : 'Join'}</button>
            </form>
            {joinMutation.isError && <p role="alert" className="mt-2 text-xs font-semibold text-red-600">{getApiErrorMessage(joinMutation.error, 'Could not join that room.')}</p>}
          </article>
        </section>

        <section className="mt-7 flex flex-col gap-4 rounded-3xl border border-slate-200 bg-white p-6 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-center gap-4">
            <span className="grid h-11 w-11 place-items-center rounded-2xl bg-slate-100 text-xl" aria-hidden="true">🎧</span>
            <div><h2 className="font-display text-base font-extrabold">Before you join</h2><p className="mt-1 text-sm text-slate-500">Use headphones and check that your browser can access the microphone.</p></div>
          </div>
          <span className="w-fit rounded-full bg-slate-100 px-3 py-1.5 text-xs font-bold text-slate-500">4 people · 2 rounds</span>
        </section>
      </div>
    </main>
  );
}
