import { useState, type FormEvent } from 'react';
import { useMutation } from '@tanstack/react-query';
import { AnimatePresence, motion, useReducedMotion } from 'framer-motion';
import { Link, useNavigate } from 'react-router-dom';
import { createPrivateRoom, joinPrivateRoom } from '../api/rooms';
import { getApiErrorMessage } from '../lib/api-error';
import { useAuthStore } from '../store/auth-store';
import { useToastStore } from '../store/toast-store';
import { CharacterBuddy } from '../components/character/CharacterBuddy';

export function HomePage() {
  const navigate = useNavigate();
  const reducedMotion = useReducedMotion();
  const user = useAuthStore((state) => state.user);
  const addToast = useToastStore((state) => state.add);
  const [code, setCode] = useState('');
  const [roundDurationSec, setRoundDurationSec] = useState(420);
  const [createdRoom, setCreatedRoom] = useState<{ id: string; code: string } | null>(null);
  const [copied, setCopied] = useState(false);
  const [joinTouched, setJoinTouched] = useState(false);
  const [primaryHovered, setPrimaryHovered] = useState(false);

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
    setJoinTouched(true);
    if (code.trim().length === 6) joinMutation.mutate();
  };

  const copyCode = async () => {
    if (!createdRoom) return false;
    try {
      await navigator.clipboard.writeText(createdRoom.code);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 1500);
      return true;
    } catch {
      addToast('error', 'Could not copy the room code. Select it and copy manually.');
      return false;
    }
  };

  const shareRoom = async () => {
    if (!createdRoom) return;
    if (navigator.share) {
      try {
        await navigator.share({ title: 'Join my Speak Four room', text: `Join my English speaking room with code ${createdRoom.code}.`, url: window.location.origin });
        return;
      } catch (error) {
        if (error instanceof DOMException && error.name === 'AbortError') return;
      }
    }
    if (await copyCode()) addToast('success', 'Room code copied — share it with your group.');
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
            <div className="flex items-end gap-4">
              <CharacterBuddy mood={primaryHovered ? 'wave' : 'idle'} size="md" className="-mb-3" />
              <Link to="/history" className="mb-1 inline-flex w-fit items-center gap-2 text-sm font-bold text-brand-200 transition hover:text-white">
                View session history <span aria-hidden="true">→</span>
              </Link>
            </div>
          </div>
        </section>

        <section className="mt-7 grid gap-6 lg:grid-cols-2">
          <motion.article whileHover={reducedMotion ? undefined : { y: -4, scale: 1.005 }} whileTap={reducedMotion ? undefined : { scale: 0.995 }} transition={{ duration: 0.18 }} className="group relative overflow-hidden rounded-3xl border border-slate-200 bg-white p-7 shadow-sm transition-shadow hover:shadow-soft sm:p-8">
            <motion.span whileHover={reducedMotion ? undefined : { scale: 1.08, rotate: -3 }} className="grid h-12 w-12 place-items-center rounded-2xl bg-brand-100 text-brand-700" aria-hidden="true">
              <svg className="h-6 w-6" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2M9 11a4 4 0 1 0 0-8M22 21v-2a4 4 0 0 0-3-3.87M16 3.13a4 4 0 0 1 0 7.75" strokeLinecap="round" /></svg>
            </motion.span>
            <p className="mt-6 text-xs font-bold uppercase tracking-[0.18em] text-brand-700">Matchmaking</p>
            <h2 className="mt-2 font-display text-2xl font-extrabold text-ink">Find a speaking room</h2>
            <p className="mt-3 min-h-12 text-sm leading-6 text-slate-500">We’ll gather four compatible learners, then split everyone into two focused conversation pairs.</p>
            <motion.button whileTap={{ scale: reducedMotion ? 1 : 0.98 }} type="button" className="primary-button mt-7 w-full" onHoverStart={() => setPrimaryHovered(true)} onHoverEnd={() => setPrimaryHovered(false)} onFocus={() => setPrimaryHovered(true)} onBlur={() => setPrimaryHovered(false)} onClick={() => navigate('/waiting')}>Find a partner <motion.span aria-hidden="true" className="inline-block" animate={reducedMotion ? undefined : { x: [0, 3, 0] }} transition={{ duration: 1.4, repeat: Infinity, repeatDelay: 1.5 }}>→</motion.span></motion.button>
            <p className="mt-3 text-center text-xs text-slate-400">Usually takes less than two minutes</p>
          </motion.article>

          <motion.article whileHover={reducedMotion ? undefined : { y: -4, scale: 1.005 }} transition={{ duration: 0.18 }} className="rounded-3xl border border-slate-200 bg-white p-7 shadow-sm transition-shadow hover:shadow-soft sm:p-8">
            <motion.span whileHover={reducedMotion ? undefined : { scale: 1.08, rotate: 3 }} className="grid h-12 w-12 place-items-center rounded-2xl bg-amber-100 text-amber-700" aria-hidden="true">
              <svg className="h-6 w-6" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M3 11l9-8 9 8M5 10v10h14V10M9 20v-6h6v6" strokeLinecap="round" strokeLinejoin="round" /></svg>
            </motion.span>
            <p className="mt-6 text-xs font-bold uppercase tracking-[0.18em] text-amber-700">Private room</p>
            <h2 className="mt-2 font-display text-2xl font-extrabold text-ink">Practice with an invited partner</h2>

            <AnimatePresence mode="wait" initial={false}>
            {createdRoom ? (
              <motion.div key="created" initial={{ opacity: 0, scale: 0.97, y: 8 }} animate={{ opacity: 1, scale: 1, y: 0 }} exit={{ opacity: 0, y: -6 }} className="mt-6 rounded-2xl border border-brand-200 bg-brand-50 p-5">
                <p className="text-xs font-bold uppercase tracking-wider text-brand-700">Share this room code</p>
                <button type="button" onClick={() => void copyCode()} className="mt-2 flex w-full items-center justify-between rounded-xl bg-white px-4 py-3 text-left ring-1 ring-brand-200">
                  <span className="font-display text-2xl font-extrabold tracking-[0.18em] text-ink">{createdRoom.code}</span>
                  <span className="text-xs font-bold text-brand-700">{copied ? 'Copied!' : 'Copy'}</span>
                </button>
                <div className="mt-4 grid grid-cols-2 gap-2"><button type="button" onClick={() => void shareRoom()} className="secondary-button">Share</button><button type="button" onClick={() => navigate(`/rooms/${createdRoom.id}`)} className="primary-button">Enter lobby</button></div>
              </motion.div>
            ) : (
              <motion.div key="create" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
                <div className="mt-6 flex gap-2">
                  <select className="field !w-auto flex-1" aria-label="Round duration" value={roundDurationSec} onChange={(event) => setRoundDurationSec(Number(event.target.value))}>
                    <option value={300}>5 minute rounds</option>
                    <option value={420}>7 minute rounds</option>
                    <option value={600}>10 minute rounds</option>
                  </select>
                  <button type="button" onClick={() => createMutation.mutate()} disabled={createMutation.isPending} className="secondary-button whitespace-nowrap">
                    {createMutation.isPending && <span className="inline-spinner" />}{createMutation.isPending ? 'Creating…' : 'Create'}
                  </button>
                </div>
                {createMutation.isError && <p role="alert" className="mt-2 text-xs font-semibold text-red-600">{getApiErrorMessage(createMutation.error, 'Could not create a private room.')}</p>}
              </motion.div>
            )}
            </AnimatePresence>

            <div className="my-5 flex items-center gap-3 text-xs font-semibold text-slate-300"><span className="h-px flex-1 bg-slate-200" />or join a room<span className="h-px flex-1 bg-slate-200" /></div>
            <form onSubmit={submitJoin} className="flex gap-2">
              <input className="field uppercase tracking-[0.16em]" aria-label="Private room code" aria-describedby="room-code-help" value={code} onBlur={() => setJoinTouched(true)} onChange={(event) => { setCode(event.target.value.replace(/[^a-zA-Z0-9]/g, '').toUpperCase().slice(0, 6)); joinMutation.reset(); }} placeholder="ABC123" minLength={6} maxLength={6} pattern="[A-Za-z0-9]{6}" required />
              <button type="submit" className="secondary-button" disabled={joinMutation.isPending || code.length !== 6}>{joinMutation.isPending && <span className="inline-spinner" />}{joinMutation.isPending ? 'Joining…' : 'Join'}</button>
            </form>
            <p id="room-code-help" className={`mt-2 text-xs font-medium ${joinTouched && code.length > 0 && code.length !== 6 ? 'text-amber-700' : 'text-slate-400'}`}>{joinTouched && code.length > 0 && code.length !== 6 ? `Enter ${6 - code.length} more character${6 - code.length === 1 ? '' : 's'}.` : 'Room codes contain exactly six letters or numbers.'}</p>
            {joinMutation.isError && <p role="alert" className="mt-2 text-xs font-semibold text-red-600">{getApiErrorMessage(joinMutation.error, 'Could not join that room.')}</p>}
          </motion.article>
        </section>

        <section className="mt-7 flex flex-col gap-4 rounded-3xl border border-slate-200 bg-white p-6 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-center gap-4">
            <span className="grid h-11 w-11 place-items-center rounded-2xl bg-slate-100 text-xl" aria-hidden="true">🎧</span>
            <div><h2 className="font-display text-base font-extrabold">Before you join</h2><p className="mt-1 text-sm text-slate-500">Use headphones and check that your browser can access the microphone.</p></div>
          </div>
          <span className="w-fit rounded-full bg-slate-100 px-3 py-1.5 text-xs font-bold text-slate-500">4 matched → 2-person rooms</span>
        </section>
      </div>
    </main>
  );
}
