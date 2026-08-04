import { useMemo, useState } from 'react';
import { useMutation } from '@tanstack/react-query';
import { AnimatePresence, motion, useReducedMotion } from 'framer-motion';
import { updateMe } from '../api/me';
import { getApiErrorMessage } from '../lib/api-error';
import type { User } from '../types/api';
import {
  ChipStep,
  ChoiceCards,
  LanguageStep,
  LevelStep,
  onboardingGoals,
  onboardingInterests,
  onboardingLanguages,
  toggle,
} from './OnboardingWizard';
import { CharacterBuddy } from './character/CharacterBuddy';
import type { CharacterMood } from './character/character-registry';

interface Draft {
  goals: string[];
  nativeLanguage: string;
  interests: string[];
  englishLevel: User['englishLevel'];
}

export function GoogleOnboardingWizard({ user, onSuccess }: { user: User; onSuccess: (user: User) => void }) {
  const reducedMotion = useReducedMotion();
  const [step, setStep] = useState(0);
  const [direction, setDirection] = useState(1);
  const [draft, setDraft] = useState<Draft>({ goals: user.goals, nativeLanguage: user.nativeLanguage ?? '', interests: user.interests, englishLevel: user.englishLevel });
  const [languageSearch, setLanguageSearch] = useState('');
  const mutation = useMutation({ mutationFn: () => updateMe(draft), onSuccess });
  const filteredLanguages = useMemo(() => onboardingLanguages.filter((language) => language.toLowerCase().includes(languageSearch.toLowerCase())), [languageSearch]);
  const titles = ['Why are you here?', 'Choose your level', 'Native language', 'Conversation interests'];
  const canContinue = [draft.goals.length > 0, Boolean(draft.englishLevel), Boolean(draft.nativeLanguage), draft.interests.length > 0][step];
  const buddyMood: CharacterMood = mutation.isError ? 'error' : mutation.isPending || mutation.isSuccess ? 'celebrating' : 'encouraging';

  const go = (next: number) => {
    setDirection(next > step ? 1 : -1);
    setStep(next);
    mutation.reset();
  };

  return (
    <div className="mx-auto w-full max-w-md">
      <div className="mb-5 flex items-end justify-between gap-4">
        <div>
          <p className="text-xs font-bold uppercase tracking-[0.18em] text-brand-700">Step {step + 1} of {titles.length}</p>
          <h3 className="mt-2 font-display text-2xl font-extrabold text-ink">{titles[step]}</h3>
        </div>
        <CharacterBuddy mood={buddyMood} size="sm" className="-mb-2" />
      </div>

      <div className="min-h-[21rem] overflow-hidden sm:min-h-[23rem]">
        <AnimatePresence mode="wait" initial={false} custom={direction}>
          <motion.div key={step} custom={direction} variants={{ enter: (value: number) => ({ opacity: 0, x: reducedMotion ? 0 : value * 24 }), center: { opacity: 1, x: 0 }, exit: (value: number) => ({ opacity: 0, x: reducedMotion ? 0 : value * -16 }) }} initial="enter" animate="center" exit="exit" transition={{ duration: reducedMotion ? 0.08 : 0.2 }}>
            {step === 0 && <ChoiceCards options={onboardingGoals} selected={draft.goals} onToggle={(value) => setDraft((current) => ({ ...current, goals: toggle(current.goals, value) }))} reducedMotion={Boolean(reducedMotion)} />}
            {step === 1 && <LevelStep value={draft.englishLevel} onChange={(englishLevel) => setDraft((current) => ({ ...current, englishLevel }))} reducedMotion={Boolean(reducedMotion)} />}
            {step === 2 && <LanguageStep search={languageSearch} setSearch={setLanguageSearch} filtered={filteredLanguages} value={draft.nativeLanguage} onChange={(nativeLanguage) => setDraft((current) => ({ ...current, nativeLanguage }))} reducedMotion={Boolean(reducedMotion)} />}
            {step === 3 && <ChipStep options={onboardingInterests} selected={draft.interests} onToggle={(value) => setDraft((current) => ({ ...current, interests: toggle(current.interests, value) }))} reducedMotion={Boolean(reducedMotion)} />}
          </motion.div>
        </AnimatePresence>
      </div>

      <AnimatePresence initial={false}>{mutation.isError && <motion.div role="alert" initial={{ opacity: 0, y: -4 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }} className="mb-4 rounded-xl border border-red-100 bg-red-50 px-4 py-3 text-sm font-semibold text-red-700">{getApiErrorMessage(mutation.error, 'Unable to save your profile.')}</motion.div>}</AnimatePresence>
      <div className="flex gap-3">
        {step > 0 && <button type="button" className="secondary-button flex-1" onClick={() => go(step - 1)} disabled={mutation.isPending}>Back</button>}
        <motion.button whileTap={{ scale: reducedMotion ? 1 : 0.98 }} type="button" className="primary-button flex-[1.4]" disabled={!canContinue || mutation.isPending || mutation.isSuccess} onClick={() => step === titles.length - 1 ? mutation.mutate() : go(step + 1)}>
          {mutation.isSuccess ? 'All set' : mutation.isPending ? 'Saving…' : step === titles.length - 1 ? 'Finish setup' : 'Continue'}
        </motion.button>
      </div>
    </div>
  );
}
