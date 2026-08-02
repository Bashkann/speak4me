import { useState, type FormEvent } from 'react';
import { useMutation } from '@tanstack/react-query';
import { useNavigate } from 'react-router-dom';
import { Brand } from '../components/Brand';
import { login, register, type RegisterInput } from '../api/auth';
import { getApiErrorMessage } from '../lib/api-error';
import { useAuthStore } from '../store/auth-store';
import type { EnglishLevel } from '../types/api';
import { ThemeToggle } from '../components/ThemeToggle';

type AuthMode = 'login' | 'register';

export function AuthPage() {
  const navigate = useNavigate();
  const setSession = useAuthStore((state) => state.setSession);
  const [mode, setMode] = useState<AuthMode>('login');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [displayName, setDisplayName] = useState('');
  const [englishLevel, setEnglishLevel] = useState<EnglishLevel>('B1');

  const mutation = useMutation({
    mutationFn: () => mode === 'login'
      ? login({ email, password })
      : register({ email, password, displayName, englishLevel } satisfies RegisterInput),
    onSuccess: (session) => {
      setSession(session);
      navigate('/', { replace: true });
    },
  });

  const submit = (event: FormEvent) => {
    event.preventDefault();
    mutation.mutate();
  };

  const changeMode = (nextMode: AuthMode) => {
    mutation.reset();
    setMode(nextMode);
  };

  return (
    <main className="relative min-h-screen overflow-hidden bg-canvas px-4 py-5 sm:px-6 lg:px-8">
      <div className="absolute right-6 top-6 z-20"><ThemeToggle compact /></div>
      <div className="pointer-events-none absolute -left-24 top-24 h-72 w-72 rounded-full bg-brand-200/60 blur-3xl" />
      <div className="pointer-events-none absolute -right-20 bottom-0 h-80 w-80 rounded-full bg-amber-100/80 blur-3xl" />

      <div className="relative mx-auto grid min-h-[calc(100vh-2.5rem)] max-w-6xl overflow-hidden rounded-[2rem] border border-white/80 bg-white shadow-soft lg:grid-cols-[1.08fr_0.92fr]">
        <section className="relative hidden overflow-hidden bg-ink p-12 text-white lg:flex lg:flex-col lg:justify-between">
          <div className="absolute inset-0 opacity-20" style={{ backgroundImage: 'radial-gradient(circle at 2px 2px, #7bd9ad 1px, transparent 0)', backgroundSize: '28px 28px' }} />
          <div className="relative">
            <Brand linked={false} />
          </div>
          <div className="relative max-w-md pb-8">
            <div className="mb-6 flex -space-x-2">
              {['AM', 'JT', 'NL', 'SK'].map((initials, index) => (
                <span key={initials} className="grid h-11 w-11 place-items-center rounded-full border-2 border-ink bg-brand-500 text-xs font-bold" style={{ opacity: 1 - index * 0.12 }}>
                  {initials}
                </span>
              ))}
            </div>
            <p className="mb-3 text-xs font-bold uppercase tracking-[0.22em] text-brand-300">Four people. Two conversations.</p>
            <h1 className="font-display text-5xl font-extrabold leading-[1.05] tracking-tight">Practice speaking. Learn by listening.</h1>
            <p className="mt-6 max-w-sm text-base leading-7 text-slate-300">Join a focused room, speak once, listen once, and build real confidence in English.</p>
          </div>
          <div className="relative flex items-center gap-6 border-t border-white/10 pt-6 text-xs font-semibold text-slate-400">
            <span>Live audio</span><span>•</span><span>Timed rounds</span><span>•</span><span>CEFR matched</span>
          </div>
        </section>

        <section className="flex items-center justify-center px-5 py-10 sm:px-12 lg:px-16">
          <div className="w-full max-w-md">
            <div className="mb-10 lg:hidden"><Brand /></div>
            <p className="text-sm font-bold text-brand-700">Welcome to Speak Four</p>
            <h2 className="mt-2 font-display text-3xl font-extrabold tracking-tight text-ink sm:text-4xl">
              {mode === 'login' ? 'Ready to speak?' : 'Create your account'}
            </h2>
            <p className="mt-3 text-sm leading-6 text-slate-500">
              {mode === 'login' ? 'Sign in and find your next speaking room.' : 'Pick your current English level. You can change it later.'}
            </p>

            <div className="mt-8 grid grid-cols-2 rounded-xl bg-slate-100 p-1" role="tablist" aria-label="Authentication mode">
              {(['login', 'register'] as const).map((tab) => (
                <button key={tab} type="button" role="tab" aria-selected={mode === tab} onClick={() => changeMode(tab)}
                  className={`rounded-lg px-3 py-2.5 text-sm font-bold capitalize transition ${mode === tab ? 'bg-white text-ink shadow-sm' : 'text-slate-500 hover:text-slate-700'}`}>
                  {tab === 'login' ? 'Log in' : 'Register'}
                </button>
              ))}
            </div>

            <form className="mt-7 space-y-4" onSubmit={submit}>
              {mode === 'register' && (
                <div>
                  <label className="label" htmlFor="displayName">Display name</label>
                  <input className="field" id="displayName" autoComplete="name" value={displayName} onChange={(event) => setDisplayName(event.target.value)} minLength={2} maxLength={40} required />
                </div>
              )}
              <div>
                <label className="label" htmlFor="email">Email address</label>
                <input className="field" id="email" type="email" autoComplete="email" value={email} onChange={(event) => setEmail(event.target.value)} placeholder="you@example.com" required />
              </div>
              <div>
                <label className="label" htmlFor="password">Password</label>
                <input className="field" id="password" type="password" autoComplete={mode === 'login' ? 'current-password' : 'new-password'} value={password} onChange={(event) => setPassword(event.target.value)} minLength={mode === 'register' ? 8 : 1} placeholder={mode === 'register' ? 'At least 8 characters' : 'Your password'} required />
              </div>
              {mode === 'register' && (
                <div>
                  <label className="label" htmlFor="englishLevel">English level</label>
                  <select className="field" id="englishLevel" value={englishLevel} onChange={(event) => setEnglishLevel(event.target.value as EnglishLevel)}>
                    <option value="A2">A2 · Elementary</option>
                    <option value="B1">B1 · Intermediate</option>
                    <option value="B2">B2 · Upper intermediate</option>
                    <option value="C1">C1 · Advanced</option>
                  </select>
                </div>
              )}

              {mutation.isError && (
                <div role="alert" className="rounded-xl border border-red-100 bg-red-50 px-4 py-3 text-sm font-medium text-red-700">
                  {getApiErrorMessage(mutation.error, mode === 'login' ? 'Unable to sign in.' : 'Unable to create your account.')}
                </div>
              )}

              <button className="primary-button mt-2 w-full" type="submit" disabled={mutation.isPending}>
                {mutation.isPending ? 'Please wait…' : mode === 'login' ? 'Log in' : 'Create account'}
              </button>
            </form>

            <p className="mt-8 text-center text-xs leading-5 text-slate-400">This is a development test app. Use headphones to prevent audio feedback.</p>
          </div>
        </section>
      </div>
    </main>
  );
}
