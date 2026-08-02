import { useEffect, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { motion } from 'framer-motion';
import { Link } from 'react-router-dom';
import { logout } from '../api/auth';
import { getMe, getMyStats, updateMe, type ProfileUpdate } from '../api/me';
import { getApiErrorMessage } from '../lib/api-error';
import { useAuthStore } from '../store/auth-store';
import { useToastStore } from '../store/toast-store';
import { ThemeToggle } from '../components/ThemeToggle';
import type { EnglishLevel } from '../types/api';

const goalOptions = ['exam-prep', 'travel', 'work-business', 'moving-abroad', 'just-for-fun'];
const interestOptions = ['technology', 'travel', 'movies & series', 'sports', 'business', 'daily life', 'science', 'culture', 'music', 'food'];
const levels: EnglishLevel[] = ['A1', 'A2', 'B1', 'B2', 'C1', 'C2'];

export function ProfilePage() {
  const queryClient = useQueryClient();
  const storedUser = useAuthStore((state) => state.user);
  const updateStoredUser = useAuthStore((state) => state.updateUser);
  const clearSession = useAuthStore((state) => state.clearSession);
  const refreshToken = useAuthStore((state) => state.refreshToken);
  const addToast = useToastStore((state) => state.add);
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState<ProfileUpdate>({});
  const profile = useQuery({ queryKey: ['me'], queryFn: getMe });
  const stats = useQuery({ queryKey: ['me-stats'], queryFn: getMyStats });
  const user = profile.data ?? storedUser;

  useEffect(() => {
    if (!user) return;
    setDraft({ displayName: user.displayName, englishLevel: user.englishLevel, nativeLanguage: user.nativeLanguage ?? '', goals: user.goals ?? [], interests: user.interests ?? [] });
  }, [user]);

  const save = useMutation({
    mutationFn: () => updateMe({ ...draft, nativeLanguage: draft.nativeLanguage?.trim() || null }),
    onSuccess: (nextUser) => {
      updateStoredUser(nextUser);
      queryClient.setQueryData(['me'], nextUser);
      setEditing(false);
      addToast('success', 'Profile updated.');
    },
  });
  const signOut = useMutation({
    mutationFn: async () => { if (refreshToken) await logout(refreshToken); },
    onSettled: clearSession,
  });

  if (!user) return <main className="grid min-h-[60vh] place-items-center"><span className="h-10 w-10 animate-spin rounded-full border-4 border-brand-100 border-t-brand-600" /></main>;

  return (
    <main className="px-5 py-8 sm:px-8 sm:py-12">
      <div className="mx-auto max-w-5xl">
        <section className="relative overflow-hidden rounded-[2rem] bg-ink p-6 text-white shadow-soft sm:p-9">
          <div className="absolute -right-16 -top-20 h-64 w-64 rounded-full border-[42px] border-brand-500/20" />
          <div className="relative flex flex-col justify-between gap-6 sm:flex-row sm:items-center">
            <div className="flex items-center gap-5">
              <motion.span initial={{ scale: 0.9 }} animate={{ scale: 1 }} className="grid h-20 w-20 place-items-center rounded-3xl bg-brand-500 font-display text-2xl font-extrabold shadow-glow">{initials(user.displayName)}</motion.span>
              <div><p className="text-xs font-bold uppercase tracking-[0.18em] text-brand-200">Your profile</p><h1 className="mt-2 font-display text-3xl font-extrabold sm:text-4xl">{user.displayName}</h1><p className="mt-1 text-sm text-slate-300">{user.email} · Level {user.englishLevel}</p></div>
            </div>
            <button type="button" onClick={() => setEditing((value) => !value)} className="rounded-xl bg-white/10 px-4 py-3 text-sm font-bold ring-1 ring-white/15 transition hover:bg-white/15">{editing ? 'Cancel editing' : 'Edit profile'}</button>
          </div>
        </section>

        <section className="mt-6 grid grid-cols-3 gap-2.5 sm:gap-4">
          <StatCard label="Sessions" value={stats.data?.sessionsCompleted ?? 0} delay={0} />
          <StatCard label="Minutes" value={stats.data?.totalPracticeMinutes ?? 0} delay={0.05} />
          <StatCard label="Last session" value={stats.data?.lastSessionDate ? shortDate(stats.data.lastSessionDate) : '—'} delay={0.1} />
        </section>

        <div className="mt-6 grid gap-6 lg:grid-cols-[1fr_300px]">
          <section className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm sm:p-7">
            <div className="flex items-center justify-between"><h2 className="font-display text-xl font-extrabold text-ink">Learning profile</h2>{user.role === 'ADMIN' && <span className="rounded-full bg-amber-100 px-3 py-1 text-xs font-extrabold text-amber-800">Administrator</span>}</div>
            {editing ? (
              <div className="mt-6 space-y-5">
                <div className="grid gap-4 sm:grid-cols-2"><Field label="Display name"><input className="field" value={draft.displayName ?? ''} onChange={(event) => setDraft((current) => ({ ...current, displayName: event.target.value }))} /></Field><Field label="English level"><select className="field" value={draft.englishLevel} onChange={(event) => setDraft((current) => ({ ...current, englishLevel: event.target.value as EnglishLevel }))}>{levels.map((level) => <option key={level}>{level}</option>)}</select></Field></div>
                <Field label="Native language"><input className="field" value={draft.nativeLanguage ?? ''} onChange={(event) => setDraft((current) => ({ ...current, nativeLanguage: event.target.value }))} /></Field>
                <ChoiceEditor label="Goals" options={goalOptions} selected={draft.goals ?? []} onToggle={(value) => setDraft((current) => ({ ...current, goals: toggle(current.goals ?? [], value) }))} />
                <ChoiceEditor label="Interests" options={interestOptions} selected={draft.interests ?? []} onToggle={(value) => setDraft((current) => ({ ...current, interests: toggle(current.interests ?? [], value) }))} />
                {save.isError && <p role="alert" className="text-sm font-semibold text-red-600">{getApiErrorMessage(save.error, 'Could not update your profile.')}</p>}
                <button type="button" onClick={() => save.mutate()} disabled={save.isPending || !(draft.goals?.length && draft.interests?.length)} className="primary-button w-full">{save.isPending ? 'Saving…' : 'Save changes'}</button>
              </div>
            ) : (
              <div className="mt-6 space-y-6"><ProfileRow label="Native language" value={user.nativeLanguage || 'Not set'} /><ProfileChips label="Goals" values={user.goals ?? []} /><ProfileChips label="Interests" values={user.interests ?? []} /></div>
            )}
          </section>

          <aside className="space-y-4">
            <section className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm"><h2 className="font-display text-lg font-extrabold text-ink">Appearance</h2><p className="mt-2 text-sm leading-6 text-slate-500">Choose the theme that feels best on this device.</p><div className="mt-4"><ThemeToggle /></div></section>
            <Link to="/history" className="flex items-center justify-between rounded-2xl border border-slate-200 bg-white p-5 text-sm font-extrabold text-ink shadow-sm transition hover:border-brand-300"><span>Session history</span><span aria-hidden="true">→</span></Link>
            <button type="button" onClick={() => signOut.mutate()} disabled={signOut.isPending} className="w-full rounded-2xl border border-red-100 bg-red-50 p-4 text-left text-sm font-extrabold text-red-700">Log out</button>
          </aside>
        </div>
      </div>
    </main>
  );
}

function StatCard({ label, value, delay }: { label: string; value: string | number; delay: number }) { return <motion.article initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay }} className="rounded-2xl border border-slate-200 bg-white p-3 text-center shadow-sm sm:p-5"><p className="font-display text-xl font-extrabold text-ink sm:text-3xl">{value}</p><p className="mt-1 text-[10px] font-bold uppercase tracking-wider text-slate-400 sm:text-xs">{label}</p></motion.article>; }
function Field({ label, children }: React.PropsWithChildren<{ label: string }>) { return <label className="block"><span className="label">{label}</span>{children}</label>; }
function ChoiceEditor({ label, options, selected, onToggle }: { label: string; options: string[]; selected: string[]; onToggle: (value: string) => void }) { return <div><p className="label">{label}</p><div className="flex flex-wrap gap-2">{options.map((option) => <button key={option} type="button" aria-pressed={selected.includes(option)} onClick={() => onToggle(option)} className={`rounded-full border px-3 py-2 text-xs font-bold capitalize ${selected.includes(option) ? 'border-brand-500 bg-brand-600 text-white' : 'border-slate-200 text-slate-600'}`}>{labelize(option)}</button>)}</div></div>; }
function ProfileRow({ label, value }: { label: string; value: string }) { return <div><p className="text-xs font-bold uppercase tracking-wider text-slate-400">{label}</p><p className="mt-2 font-semibold text-ink">{value}</p></div>; }
function ProfileChips({ label, values }: { label: string; values: string[] }) { return <div><p className="text-xs font-bold uppercase tracking-wider text-slate-400">{label}</p><div className="mt-2 flex flex-wrap gap-2">{values.length ? values.map((value) => <span key={value} className="rounded-full bg-brand-50 px-3 py-1.5 text-xs font-bold capitalize text-brand-800">{labelize(value)}</span>) : <span className="text-sm text-slate-400">Not set</span>}</div></div>; }
function toggle(values: string[], value: string): string[] { return values.includes(value) ? values.filter((item) => item !== value) : [...values, value]; }
function labelize(value: string): string { return value.replaceAll('-', ' '); }
function initials(name: string): string { return name.split(/\s+/).filter(Boolean).slice(0, 2).map((part) => part[0]?.toUpperCase()).join(''); }
function shortDate(value: string): string { return new Intl.DateTimeFormat(undefined, { month: 'short', day: 'numeric' }).format(new Date(value)); }
