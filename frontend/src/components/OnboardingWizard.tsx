import { useMemo, useState } from 'react';
import { useMutation } from '@tanstack/react-query';
import { AnimatePresence, motion } from 'framer-motion';
import { register, type RegisterInput } from '../api/auth';
import { getApiErrorMessage } from '../lib/api-error';
import type { AuthResponse, EnglishLevel } from '../types/api';

const goals = [
  ['exam-prep', 'Exam prep', 'IELTS, TOEFL or YDS'],
  ['travel', 'Travel', 'Speak with confidence abroad'],
  ['work-business', 'Work & business', 'Meetings, interviews and networking'],
  ['moving-abroad', 'Moving abroad', 'Prepare for everyday life'],
  ['just-for-fun', 'Just for fun', 'Enjoy relaxed conversations'],
] as const;

const levels: Array<[EnglishLevel, string, string]> = [
  ['A1', 'Beginner', 'I can use a few familiar words and phrases.'],
  ['A2', 'Elementary', 'I can handle simple everyday exchanges.'],
  ['B1', 'Intermediate', 'I can explain experiences and opinions.'],
  ['B2', 'Upper intermediate', 'I can discuss a wide range of topics.'],
  ['C1', 'Advanced', 'I can express ideas fluently and precisely.'],
  ['C2', 'Proficient', 'I can communicate naturally in complex situations.'],
];

const interests = ['technology', 'travel', 'movies & series', 'sports', 'business', 'daily life', 'science', 'culture', 'music', 'food'];
const languages = ['Arabic', 'Azerbaijani', 'Chinese', 'Dutch', 'English', 'French', 'German', 'Greek', 'Hindi', 'Italian', 'Japanese', 'Korean', 'Kurdish', 'Persian', 'Polish', 'Portuguese', 'Russian', 'Spanish', 'Turkish', 'Ukrainian', 'Vietnamese'];

interface Draft extends RegisterInput {
  goals: string[];
  interests: string[];
  nativeLanguage: string;
}

const initialDraft: Draft = { email: '', password: '', displayName: '', englishLevel: 'B1', nativeLanguage: '', goals: [], interests: [] };

export function OnboardingWizard({ onSuccess }: { onSuccess: (session: AuthResponse) => void }) {
  const [step, setStep] = useState(0);
  const [direction, setDirection] = useState(1);
  const [draft, setDraft] = useState<Draft>(initialDraft);
  const [languageSearch, setLanguageSearch] = useState('');
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

  const go = (next: number) => {
    setDirection(next > step ? 1 : -1);
    setStep(next);
    mutation.reset();
  };

  return (
    <div className="mt-7">
      <div className="mb-6 flex items-center gap-2" aria-label={`Step ${step + 1} of ${titles.length}`}>
        {titles.map((title, index) => <span key={title} className={`h-1.5 flex-1 rounded-full transition-colors ${index <= step ? 'bg-brand-500' : 'bg-slate-200'}`} />)}
      </div>
      <div className="mb-5">
        <p className="text-xs font-bold uppercase tracking-[0.18em] text-brand-700">Step {step + 1} of {titles.length}</p>
        <h3 className="mt-2 font-display text-2xl font-extrabold text-ink">{titles[step]}</h3>
      </div>

      <div className="min-h-[21rem] overflow-hidden sm:min-h-[23rem]">
        <AnimatePresence mode="wait" initial={false} custom={direction}>
          <motion.div key={step} custom={direction} variants={{ enter: (value: number) => ({ opacity: 0, x: value * 28 }), center: { opacity: 1, x: 0 }, exit: (value: number) => ({ opacity: 0, x: value * -20 }) }} initial="enter" animate="center" exit="exit" transition={{ duration: 0.22 }}>
            {step === 0 && <AccountStep draft={draft} setDraft={setDraft} />}
            {step === 1 && <ChoiceCards options={goals} selected={draft.goals} onToggle={(value) => setDraft((current) => ({ ...current, goals: toggle(current.goals, value) }))} />}
            {step === 2 && <LevelStep value={draft.englishLevel} onChange={(englishLevel) => setDraft((current) => ({ ...current, englishLevel }))} />}
            {step === 3 && <LanguageStep search={languageSearch} setSearch={setLanguageSearch} filtered={filteredLanguages} value={draft.nativeLanguage} onChange={(nativeLanguage) => setDraft((current) => ({ ...current, nativeLanguage }))} />}
            {step === 4 && <ChipStep options={interests} selected={draft.interests} onToggle={(value) => setDraft((current) => ({ ...current, interests: toggle(current.interests, value) }))} />}
            {step === 5 && <ReviewStep draft={draft} />}
          </motion.div>
        </AnimatePresence>
      </div>

      {mutation.isError && <div role="alert" className="mb-4 rounded-xl border border-red-100 bg-red-50 px-4 py-3 text-sm font-semibold text-red-700">{getApiErrorMessage(mutation.error, 'Unable to create your account.')}</div>}
      <div className="flex gap-3">
        {step > 0 && <button type="button" className="secondary-button flex-1" onClick={() => go(step - 1)} disabled={mutation.isPending}>Back</button>}
        <motion.button whileTap={{ scale: 0.98 }} type="button" className="primary-button flex-[1.4]" disabled={!canContinue || mutation.isPending} onClick={() => step === titles.length - 1 ? mutation.mutate() : go(step + 1)}>
          {mutation.isPending ? 'Creating account…' : step === titles.length - 1 ? 'Create my account' : 'Continue'}
        </motion.button>
      </div>
    </div>
  );
}

function AccountStep({ draft, setDraft }: { draft: Draft; setDraft: React.Dispatch<React.SetStateAction<Draft>> }) {
  return <div className="space-y-4"><Field label="Display name"><input className="field" autoComplete="name" value={draft.displayName} onChange={(event) => setDraft((current) => ({ ...current, displayName: event.target.value }))} /></Field><Field label="Email address"><input className="field" type="email" autoComplete="email" value={draft.email} onChange={(event) => setDraft((current) => ({ ...current, email: event.target.value }))} /></Field><Field label="Password"><input className="field" type="password" autoComplete="new-password" minLength={8} value={draft.password} onChange={(event) => setDraft((current) => ({ ...current, password: event.target.value }))} placeholder="At least 8 characters" /></Field></div>;
}

function ChoiceCards({ options, selected, onToggle }: { options: ReadonlyArray<readonly [string, string, string]>; selected: string[]; onToggle: (value: string) => void }) {
  return <div className="grid gap-2 sm:grid-cols-2">{options.map(([value, label, detail]) => <button key={value} type="button" aria-pressed={selected.includes(value)} onClick={() => onToggle(value)} className={`rounded-2xl border p-3.5 text-left transition ${selected.includes(value) ? 'border-brand-400 bg-brand-50 ring-2 ring-brand-100' : 'border-slate-200 bg-white hover:border-brand-200'}`}><span className="block text-sm font-extrabold text-ink">{label}</span><span className="mt-1 block text-xs leading-5 text-slate-500">{detail}</span></button>)}</div>;
}

function LevelStep({ value, onChange }: { value: EnglishLevel; onChange: (value: EnglishLevel) => void }) {
  return <div className="grid gap-2 sm:grid-cols-2">{levels.map(([level, label, detail]) => <button key={level} type="button" onClick={() => onChange(level)} className={`rounded-2xl border p-3 text-left transition ${value === level ? 'border-brand-400 bg-brand-50 ring-2 ring-brand-100' : 'border-slate-200 bg-white'}`}><span className="font-display text-lg font-extrabold text-brand-700">{level}</span><span className="ml-2 text-sm font-bold text-ink">{label}</span><span className="mt-1 block text-xs leading-4 text-slate-500">{detail}</span></button>)}<button type="button" className="rounded-xl border border-dashed border-slate-300 p-2 text-xs font-bold text-slate-500 sm:col-span-2" onClick={() => onChange('B1')}>Not sure? Start with B1</button></div>;
}

function LanguageStep({ search, setSearch, filtered, value, onChange }: { search: string; setSearch: (value: string) => void; filtered: string[]; value: string; onChange: (value: string) => void }) {
  return <div><Field label="Search languages"><input className="field" value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Type to search…" /></Field><div className="mt-3 grid max-h-64 grid-cols-2 gap-2 overflow-y-auto pr-1">{filtered.map((language) => <button key={language} type="button" onClick={() => onChange(language)} className={`rounded-xl border px-3 py-2.5 text-sm font-bold ${value === language ? 'border-brand-400 bg-brand-50 text-brand-800' : 'border-slate-200 bg-white text-slate-600'}`}>{language}</button>)}</div></div>;
}

function ChipStep({ options, selected, onToggle }: { options: string[]; selected: string[]; onToggle: (value: string) => void }) {
  return <div><p className="mb-4 text-sm leading-6 text-slate-500">Pick at least one. These help shape your profile and future conversation recommendations.</p><div className="flex flex-wrap gap-2">{options.map((option) => <button key={option} type="button" aria-pressed={selected.includes(option)} onClick={() => onToggle(option)} className={`rounded-full border px-4 py-2.5 text-sm font-bold capitalize transition ${selected.includes(option) ? 'border-brand-500 bg-brand-600 text-white shadow-sm' : 'border-slate-200 bg-white text-slate-600'}`}>{option}</button>)}</div></div>;
}

function ReviewStep({ draft }: { draft: Draft }) {
  return <div className="space-y-3 rounded-2xl border border-slate-200 bg-white p-5"><Review label="Account" value={`${draft.displayName} · ${draft.email}`} /><Review label="Level" value={draft.englishLevel} /><Review label="Native language" value={draft.nativeLanguage} /><Review label="Goals" value={draft.goals.map(labelize).join(', ')} /><Review label="Interests" value={draft.interests.map(labelize).join(', ')} /></div>;
}

function Field({ label, children }: React.PropsWithChildren<{ label: string }>) { return <label className="block"><span className="label">{label}</span>{children}</label>; }
function Review({ label, value }: { label: string; value: string }) { return <div><p className="text-xs font-bold uppercase tracking-wider text-slate-400">{label}</p><p className="mt-1 text-sm font-semibold text-ink">{value}</p></div>; }
function toggle(values: string[], value: string): string[] { return values.includes(value) ? values.filter((item) => item !== value) : [...values, value]; }
function labelize(value: string): string { return value.replaceAll('-', ' ').replace(/\b\w/g, (letter) => letter.toUpperCase()); }
