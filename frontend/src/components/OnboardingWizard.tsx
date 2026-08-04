import { useMemo, useState } from 'react';
import { useMutation } from '@tanstack/react-query';
import { AnimatePresence, motion, useReducedMotion } from 'framer-motion';
import { register, type RegisterInput } from '../api/auth';
import { getApiErrorMessage } from '../lib/api-error';
import type { AuthResponse, EnglishLevel } from '../types/api';
import { FloatingField } from './FloatingField';
import { CharacterBuddy } from './character/CharacterBuddy';
import type { CharacterMood, CharacterProp } from './character/character-registry';

export const onboardingGoals = [
  ['exam-prep', 'Exam prep', 'IELTS, TOEFL or YDS'],
  ['travel', 'Travel', 'Speak with confidence abroad'],
  ['work-business', 'Work & business', 'Meetings, interviews and networking'],
  ['moving-abroad', 'Moving abroad', 'Prepare for everyday life'],
  ['just-for-fun', 'Just for fun', 'Enjoy relaxed conversations'],
] as const;
const goals = onboardingGoals;

export const onboardingLevels: Array<[EnglishLevel, string, string]> = [
  ['A1', 'Beginner', 'I can use a few familiar words and phrases.'],
  ['A2', 'Elementary', 'I can handle simple everyday exchanges.'],
  ['B1', 'Intermediate', 'I can explain experiences and opinions.'],
  ['B2', 'Upper intermediate', 'I can discuss a wide range of topics.'],
  ['C1', 'Advanced', 'I can express ideas fluently and precisely.'],
  ['C2', 'Proficient', 'I can communicate naturally in complex situations.'],
];
const levels = onboardingLevels;

export const onboardingInterests = ['technology', 'travel', 'movies & series', 'sports', 'business', 'daily life', 'science', 'culture', 'music', 'food'];
const interests = onboardingInterests;
export const onboardingLanguages = ['Arabic', 'Azerbaijani', 'Chinese', 'Dutch', 'English', 'French', 'German', 'Greek', 'Hindi', 'Italian', 'Japanese', 'Korean', 'Kurdish', 'Persian', 'Polish', 'Portuguese', 'Russian', 'Spanish', 'Turkish', 'Ukrainian', 'Vietnamese'];
const languages = onboardingLanguages;
const goalIcons: Record<string, string> = { 'exam-prep': '♟', travel: '✈', 'work-business': '▣', 'moving-abroad': '⌂', 'just-for-fun': '☺' };

interface Draft extends RegisterInput {
  goals: string[];
  interests: string[];
  nativeLanguage: string;
}

const initialDraft: Draft = { email: '', password: '', displayName: '', englishLevel: 'B1', nativeLanguage: '', goals: [], interests: [] };

export function OnboardingWizard({ onSuccess }: { onSuccess: (session: AuthResponse) => void }) {
  const reducedMotion = useReducedMotion();
  const [step, setStep] = useState(0);
  const [direction, setDirection] = useState(1);
  const [draft, setDraft] = useState<Draft>(initialDraft);
  const [languageSearch, setLanguageSearch] = useState('');
  const [passwordFocused, setPasswordFocused] = useState(false);
  const mutation = useMutation({ mutationFn: () => register(draft), onSuccess });
  const filteredLanguages = useMemo(() => languages.filter((language) => language.toLowerCase().includes(languageSearch.toLowerCase())), [languageSearch]);
  const titles = ['Your account', 'Why are you here?', 'Choose your level', 'Native language', 'Conversation interests', 'Review your profile'];
  const canContinue = [
    draft.displayName.trim().length >= 2 && /\S+@\S+\.\S+/.test(draft.email) && draft.password.length >= 8,
    draft.goals.length > 0,
    Boolean(draft.englishLevel),
    Boolean(draft.nativeLanguage),
    draft.interests.length > 0,
    true,
  ][step];
  const accountCompleteCount = [draft.displayName.trim().length >= 2, /\S+@\S+\.\S+/.test(draft.email), draft.password.length >= 8].filter(Boolean).length;
  const selectedGoal = draft.goals.at(-1);
  const buddyMood: CharacterMood = mutation.isError
    ? 'error'
    : mutation.isPending || mutation.isSuccess
      ? 'celebrating'
      : step === 0
        ? passwordFocused ? 'peek' : accountCompleteCount > 0 ? 'encouraging' : 'thinking'
        : step === 1
          ? selectedGoal ? 'happy' : 'thinking'
          : step === 2
            ? 'encouraging'
            : step === 3
              ? draft.nativeLanguage ? 'happy' : 'thinking'
              : step === 4
                ? draft.interests.length > 0 ? 'excited' : 'thinking'
                : 'encouraging';
  const buddyProp = selectedGoal ? goalBuddyProp(selectedGoal) : undefined;

  const go = (next: number) => {
    setDirection(next > step ? 1 : -1);
    setStep(next);
    mutation.reset();
  };

  return (
    <div className="mt-7">
      <div className="mb-6 flex items-center gap-2" aria-label={`Step ${step + 1} of ${titles.length}`}>
        {titles.map((title, index) => <span key={title} className="h-1.5 flex-1 overflow-hidden rounded-full bg-slate-200"><motion.span className="block h-full origin-left rounded-full bg-brand-500" initial={false} animate={{ scaleX: index <= step ? 1 : 0 }} transition={reducedMotion ? { duration: 0 } : { type: 'spring', stiffness: 440, damping: 38 }} /></span>)}
      </div>
      <div className="mb-5 flex items-end justify-between gap-4">
        <div>
          <p className="text-xs font-bold uppercase tracking-[0.18em] text-brand-700">Step {step + 1} of {titles.length}</p>
          <h3 className="mt-2 font-display text-2xl font-extrabold text-ink">{titles[step]}</h3>
        </div>
        <CharacterBuddy mood={buddyMood} prop={step === 1 ? buddyProp : undefined} size="sm" className="-mb-2" />
      </div>

      <div className="min-h-[21rem] overflow-hidden sm:min-h-[23rem]">
        <AnimatePresence mode="wait" initial={false} custom={direction}>
          <motion.div key={step} custom={direction} variants={{ enter: (value: number) => ({ opacity: 0, x: reducedMotion ? 0 : value * 24 }), center: { opacity: 1, x: 0 }, exit: (value: number) => ({ opacity: 0, x: reducedMotion ? 0 : value * -16 }) }} initial="enter" animate="center" exit="exit" transition={{ duration: reducedMotion ? 0.08 : 0.2 }}>
            {step === 0 && <AccountStep draft={draft} setDraft={setDraft} reducedMotion={Boolean(reducedMotion)} onPasswordFocus={setPasswordFocused} />}
            {step === 1 && <ChoiceCards options={goals} selected={draft.goals} onToggle={(value) => setDraft((current) => ({ ...current, goals: toggle(current.goals, value) }))} reducedMotion={Boolean(reducedMotion)} />}
            {step === 2 && <LevelStep value={draft.englishLevel} onChange={(englishLevel) => setDraft((current) => ({ ...current, englishLevel }))} reducedMotion={Boolean(reducedMotion)} />}
            {step === 3 && <LanguageStep search={languageSearch} setSearch={setLanguageSearch} filtered={filteredLanguages} value={draft.nativeLanguage} onChange={(nativeLanguage) => setDraft((current) => ({ ...current, nativeLanguage }))} reducedMotion={Boolean(reducedMotion)} />}
            {step === 4 && <ChipStep options={interests} selected={draft.interests} onToggle={(value) => setDraft((current) => ({ ...current, interests: toggle(current.interests, value) }))} reducedMotion={Boolean(reducedMotion)} />}
            {step === 5 && <ReviewStep draft={draft} reducedMotion={Boolean(reducedMotion)} />}
          </motion.div>
        </AnimatePresence>
      </div>

      <AnimatePresence initial={false}>{mutation.isError && <motion.div role="alert" initial={{ opacity: 0, y: -4 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }} className="mb-4 rounded-xl border border-red-100 bg-red-50 px-4 py-3 text-sm font-semibold text-red-700">{getApiErrorMessage(mutation.error, 'Unable to create your account.')}</motion.div>}</AnimatePresence>
      <div className="flex gap-3">
        {step > 0 && <button type="button" className="secondary-button flex-1" onClick={() => go(step - 1)} disabled={mutation.isPending}>Back</button>}
        <motion.button whileTap={{ scale: reducedMotion ? 1 : 0.98 }} type="button" className="primary-button flex-[1.4]" disabled={!canContinue || mutation.isPending || mutation.isSuccess} onClick={() => step === titles.length - 1 ? mutation.mutate() : go(step + 1)}>
          <AnimatePresence mode="wait" initial={false}><motion.span key={mutation.isSuccess ? 'success' : mutation.isPending ? 'pending' : 'idle'} initial={{ opacity: 0, scale: 0.94 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0, scale: 0.94 }} className="inline-flex items-center gap-2">{mutation.isSuccess ? <><span className="grid h-5 w-5 place-items-center rounded-full bg-white text-xs text-brand-700">✓</span>Account ready</> : mutation.isPending ? <><span className="inline-spinner" />Creating account…</> : step === titles.length - 1 ? 'Create my account' : 'Continue'}</motion.span></AnimatePresence>
        </motion.button>
      </div>
    </div>
  );
}

function AccountStep({ draft, setDraft, reducedMotion, onPasswordFocus }: { draft: Draft; setDraft: React.Dispatch<React.SetStateAction<Draft>>; reducedMotion: boolean; onPasswordFocus: (focused: boolean) => void }) {
  const [showPassword, setShowPassword] = useState(false);
  const completeCount = [draft.displayName.trim().length >= 2, /\S+@\S+\.\S+/.test(draft.email), draft.password.length >= 8].filter(Boolean).length;
  return <div><div className="mb-3 flex items-center gap-3 rounded-2xl bg-brand-50 px-3 py-2.5"><motion.span aria-hidden="true" className="grid h-9 w-9 shrink-0 place-items-center rounded-xl bg-brand-600 text-sm font-extrabold text-white shadow-sm" animate={{ rotate: reducedMotion ? 0 : completeCount === 3 ? [0, -5, 5, 0] : 0, scale: 1 + completeCount * 0.025 }} transition={{ duration: 0.28 }}>{completeCount}/3</motion.span><div><p className="text-xs font-extrabold text-brand-800">Your buddy is following along</p><p className="mt-0.5 text-[11px] text-brand-700">{completeCount} of 3 account details ready</p></div></div><div className="space-y-0"><FloatingField id="onboarding-name" label="Display name" autoComplete="name" value={draft.displayName} onChange={(event) => setDraft((current) => ({ ...current, displayName: event.target.value }))} /><FloatingField id="onboarding-email" label="Email address" type="email" autoComplete="email" value={draft.email} onChange={(event) => setDraft((current) => ({ ...current, email: event.target.value }))} /><FloatingField id="onboarding-password" label="Password" type={showPassword ? 'text' : 'password'} autoComplete="new-password" minLength={8} value={draft.password} onFocus={() => onPasswordFocus(true)} onBlur={() => onPasswordFocus(false)} onChange={(event) => setDraft((current) => ({ ...current, password: event.target.value }))} endAdornment={<button type="button" onClick={() => setShowPassword((current) => !current)} className="rounded-lg px-2 py-1.5 text-xs font-bold text-brand-700" aria-label={showPassword ? 'Hide password' : 'Show password'}>{showPassword ? 'Hide' : 'Show'}</button>} /></div></div>;
}

export function ChoiceCards({ options, selected, onToggle, reducedMotion }: { options: ReadonlyArray<readonly [string, string, string]>; selected: string[]; onToggle: (value: string) => void; reducedMotion: boolean }) {
  return <div className="grid gap-2 sm:grid-cols-2">{options.map(([value, label, detail], index) => { const active = selected.includes(value); return <motion.button key={value} type="button" aria-pressed={active} onClick={() => onToggle(value)} initial={{ opacity: 0, y: reducedMotion ? 0 : 6 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: reducedMotion ? 0 : index * 0.025 }} whileHover={reducedMotion ? undefined : { y: -2 }} whileTap={reducedMotion ? undefined : { scale: 0.985 }} className={`relative rounded-2xl border p-3.5 text-left transition-colors ${active ? 'border-brand-400 bg-brand-50 ring-2 ring-brand-100' : 'border-slate-200 bg-white hover:border-brand-200'}`}><div className="flex items-start gap-3"><motion.span aria-hidden="true" className={`grid h-9 w-9 shrink-0 place-items-center rounded-xl text-base ${active ? 'bg-brand-600 text-white' : 'bg-slate-100 text-slate-500'}`} animate={active && !reducedMotion ? goalIconAnimation(value) : { x: 0, y: 0, rotate: 0, scale: 1 }} transition={{ duration: 0.24 }}>{goalIcons[value]}</motion.span><span><span className="block text-sm font-extrabold text-ink">{label}</span><span className="mt-1 block text-xs leading-5 text-slate-500">{detail}</span></span></div><AnimatePresence>{active && <motion.span initial={{ opacity: 0, scale: 0.6 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0, scale: 0.6 }} className="absolute right-2.5 top-2.5 grid h-5 w-5 place-items-center rounded-full bg-brand-600 text-[10px] font-bold text-white">✓</motion.span>}</AnimatePresence></motion.button>; })}</div>;
}

export function LevelStep({ value, onChange, reducedMotion }: { value: EnglishLevel; onChange: (value: EnglishLevel) => void; reducedMotion: boolean }) {
  const [hovered, setHovered] = useState<EnglishLevel | null>(null);
  const preview = hovered ?? value;
  const previewIndex = levels.findIndex(([level]) => level === preview);
  const previewMeta = levels[previewIndex]!;
  return <div><div className="rounded-2xl bg-slate-50 p-3"><div className="flex gap-1.5" aria-hidden="true">{levels.map(([level], index) => <span key={level} className="h-2 flex-1 overflow-hidden rounded-full bg-slate-200"><motion.span className="block h-full origin-left rounded-full bg-brand-500" animate={{ scaleX: index <= previewIndex ? 1 : 0 }} transition={reducedMotion ? { duration: 0 } : { type: 'spring', stiffness: 480, damping: 40 }} /></span>)}</div><div className="mt-3 min-h-11"><AnimatePresence mode="wait" initial={false}><motion.div key={preview} initial={{ opacity: 0, x: reducedMotion ? 0 : 5 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0 }} transition={{ duration: reducedMotion ? 0.06 : 0.15 }}><p className="text-xs font-extrabold text-brand-800">{preview} · {previewMeta[1]}</p><p className="mt-1 text-xs text-slate-500">{previewMeta[2]}</p></motion.div></AnimatePresence></div></div><div className="mt-3 grid grid-cols-3 gap-2">{levels.map(([level, label]) => <motion.button key={level} type="button" aria-pressed={value === level} onHoverStart={() => setHovered(level)} onHoverEnd={() => setHovered(null)} onFocus={() => setHovered(level)} onBlur={() => setHovered(null)} onClick={() => onChange(level)} whileTap={reducedMotion ? undefined : { scale: 0.96 }} className={`rounded-xl border px-2 py-2.5 text-center transition-colors ${value === level ? 'border-brand-500 bg-brand-600 text-white shadow-sm' : 'border-slate-200 bg-white text-slate-600 hover:border-brand-300'}`}><span className="block font-display text-base font-extrabold">{level}</span><span className={`mt-0.5 block truncate text-[9px] font-bold ${value === level ? 'text-brand-100' : 'text-slate-400'}`}>{label}</span></motion.button>)}</div><motion.button type="button" animate={!reducedMotion && value !== 'B1' ? { scale: [1, 1.015, 1] } : undefined} transition={{ duration: 1.8, repeat: Infinity, repeatDelay: 2 }} className="mt-3 w-full rounded-xl border border-dashed border-brand-300 bg-brand-50 p-2 text-xs font-bold text-brand-800" onClick={() => onChange('B1')}>Not sure? Start with B1 · recommended</motion.button></div>;
}

export function LanguageStep({ search, setSearch, filtered, value, onChange, reducedMotion }: { search: string; setSearch: (value: string) => void; filtered: string[]; value: string; onChange: (value: string) => void; reducedMotion: boolean }) {
  return <div><div className="flex items-start gap-3"><motion.span aria-hidden="true" className="mt-1 grid h-12 w-12 shrink-0 place-items-center rounded-2xl bg-sky-50 text-xl" animate={reducedMotion ? undefined : { rotate: value ? [0, -8, 8, 0] : 0 }} transition={{ duration: 0.28 }}>◎</motion.span><div className="flex-1"><FloatingField id="language-search" label="Search languages" value={search} onChange={(event) => setSearch(event.target.value)} /></div></div><div className="grid max-h-60 grid-cols-2 gap-2 overflow-y-auto pr-1">{filtered.map((language, index) => <motion.button key={language} type="button" onClick={() => onChange(language)} initial={{ opacity: 0, y: reducedMotion ? 0 : 4 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: reducedMotion ? 0 : Math.min(index, 9) * 0.018 }} whileTap={reducedMotion ? undefined : { scale: 0.97 }} className={`rounded-xl border px-3 py-2.5 text-sm font-bold transition-colors ${value === language ? 'border-brand-400 bg-brand-50 text-brand-800 ring-2 ring-brand-100' : 'border-slate-200 bg-white text-slate-600'}`}><span aria-hidden="true" className="mr-1.5 text-brand-500">•</span>{language}</motion.button>)}{filtered.length === 0 && <div className="col-span-2 flex items-center justify-center gap-3 py-5 text-left"><CharacterBuddy mood="searching" size="xs" /><p className="text-sm text-slate-400">No language matches that search.</p></div>}</div></div>;
}

export function ChipStep({ options, selected, onToggle, reducedMotion }: { options: string[]; selected: string[]; onToggle: (value: string) => void; reducedMotion: boolean }) {
  return <div><p className="mb-4 text-sm leading-6 text-slate-500">Pick at least one. These help shape your profile and future conversation recommendations.</p><div className="relative flex flex-wrap gap-2">{options.map((option) => { const active = selected.includes(option); return <motion.button key={option} type="button" aria-pressed={active} onClick={() => onToggle(option)} animate={{ scale: 1 }} whileTap={reducedMotion ? undefined : { scale: 0.9 }} transition={{ type: 'spring', stiffness: 520, damping: 28 }} className={`rounded-full border px-4 py-2.5 text-sm font-bold capitalize transition-colors ${active ? 'border-brand-500 bg-brand-600 text-white shadow-sm' : 'border-slate-200 bg-white text-slate-600 hover:border-brand-300'}`}>{active && <motion.span initial={{ opacity: 0, scale: 0.4 }} animate={{ opacity: 1, scale: 1 }} className="mr-1.5 inline-block">✓</motion.span>}{option}</motion.button>; })}<AnimatePresence>{selected.length > 0 && <motion.div aria-hidden="true" initial={{ opacity: 0, scale: 0.6 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0 }} className="pointer-events-none absolute -right-1 -top-6 flex gap-1">{[0, 1, 2].map((item) => <motion.span key={item} className="h-1.5 w-1.5 rounded-full bg-brand-400" animate={reducedMotion ? undefined : { x: [0, item - 1, 0], y: [0, -4 - item, 0], opacity: [0.4, 1, 0.4] }} transition={{ duration: 0.45, delay: item * 0.05 }} />)}</motion.div>}</AnimatePresence></div><motion.p initial={false} animate={{ opacity: selected.length ? 1 : 0 }} className="mt-5 text-xs font-bold text-brand-700">{selected.length ? `${selected.length} topic${selected.length === 1 ? '' : 's'} selected · nice choice` : ''}</motion.p></div>;
}

function ReviewStep({ draft, reducedMotion }: { draft: Draft; reducedMotion: boolean }) {
  const rows = [['Account', `${draft.displayName} · ${draft.email}`], ['Level', draft.englishLevel], ['Native language', draft.nativeLanguage], ['Goals', draft.goals.map(labelize).join(', ')], ['Interests', draft.interests.map(labelize).join(', ')]];
  return <div className="space-y-1 rounded-2xl border border-slate-200 bg-white p-3">{rows.map(([label, value], index) => <motion.div key={label} initial={{ opacity: 0, x: reducedMotion ? 0 : -6 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: reducedMotion ? 0 : index * 0.035 }} className="rounded-xl px-3 py-2.5 odd:bg-slate-50"><p className="text-[10px] font-bold uppercase tracking-wider text-slate-400">{label}</p><p className="mt-1 text-sm font-semibold text-ink">{value}</p></motion.div>)}</div>;
}

function goalIconAnimation(value: string) {
  if (value === 'travel') return { x: [0, 5, 0], y: [0, -3, 0], rotate: [0, -8, 0], scale: 1 };
  if (value === 'exam-prep') return { x: 0, y: [0, -4, 0], rotate: 0, scale: 1 };
  if (value === 'work-business') return { x: 0, y: 0, rotate: [0, -5, 5, 0], scale: [1, 0.94, 1] };
  return { x: 0, y: 0, rotate: 0, scale: [1, 1.12, 1] };
}
export function toggle(values: string[], value: string): string[] { return values.includes(value) ? values.filter((item) => item !== value) : [...values, value]; }
export function labelize(value: string): string { return value.replaceAll('-', ' ').replace(/\b\w/g, (letter) => letter.toUpperCase()); }
export function goalBuddyProp(value: string): CharacterProp {
  if (value === 'travel') return 'travel';
  if (value === 'exam-prep') return 'exam';
  if (value === 'work-business') return 'work';
  if (value === 'moving-abroad') return 'home';
  return 'fun';
}
