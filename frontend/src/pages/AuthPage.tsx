import { useEffect, useRef, useState, type FormEvent } from 'react';
import { useMutation, useQuery } from '@tanstack/react-query';
import { AnimatePresence, motion, useReducedMotion } from 'framer-motion';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { Brand } from '../components/Brand';
import { getAuthProviders, googleSignInUrl, login } from '../api/auth';
import { getApiErrorMessage } from '../lib/api-error';
import { useAuthStore } from '../store/auth-store';
import { useToastStore } from '../store/toast-store';
import { ThemeToggle } from '../components/ThemeToggle';
import { OnboardingWizard } from '../components/OnboardingWizard';
import { FloatingField } from '../components/FloatingField';
import type { AuthResponse } from '../types/api';
import { CharacterBuddy } from '../components/character/CharacterBuddy';
import type { CharacterMood } from '../components/character/character-registry';

type AuthMode = 'login' | 'register';

export function AuthPage() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const addToast = useToastStore((state) => state.add);
  const setSession = useAuthStore((state) => state.setSession);
  const reducedMotion = useReducedMotion();
  const [mode, setMode] = useState<AuthMode>('login');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [loginErrors, setLoginErrors] = useState<{ email?: string; password?: string }>({});
  const [authComplete, setAuthComplete] = useState(false);
  const [passwordFocused, setPasswordFocused] = useState(false);
  const redirectTimer = useRef<number | null>(null);
  const providersQuery = useQuery({ queryKey: ['auth-providers'], queryFn: getAuthProviders, staleTime: Infinity });

  const mutation = useMutation({
    mutationFn: () => login({ email, password }),
    onSuccess: completeAuth,
  });

  function completeAuth(session: AuthResponse) {
    setSession(session);
    setAuthComplete(true);
    const destination = session.user.needsOnboarding ? '/onboarding' : '/';
    redirectTimer.current = window.setTimeout(() => navigate(destination, { replace: true }), reducedMotion ? 80 : 260);
  }

  useEffect(() => () => { if (redirectTimer.current) window.clearTimeout(redirectTimer.current); }, []);
  useEffect(() => {
    if (searchParams.get('error') === 'google_failed') addToast('error', 'Google sign-in did not complete. Please try again.');
  }, [addToast, searchParams]);

  const submit = (event: FormEvent) => {
    event.preventDefault();
    const nextErrors = {
      ...(!/\S+@\S+\.\S+/.test(email) ? { email: 'Enter a valid email address.' } : {}),
      ...(password.length < 8 ? { password: 'Password must be at least 8 characters.' } : {}),
    };
    setLoginErrors(nextErrors);
    if (Object.keys(nextErrors).length) return;
    mutation.mutate();
  };

  const changeMode = (nextMode: AuthMode) => {
    mutation.reset();
    setLoginErrors({});
    setAuthComplete(false);
    setPasswordFocused(false);
    setMode(nextMode);
  };

  const loginMood: CharacterMood = authComplete
    ? 'happy'
    : mutation.isError || Boolean(loginErrors.email || loginErrors.password)
      ? 'error'
      : passwordFocused
        ? 'peek'
        : 'wave';

  return (
    <main className="relative min-h-screen overflow-hidden bg-canvas px-4 py-5 sm:px-6 lg:px-8">
      <div className="absolute right-6 top-6 z-20"><ThemeToggle compact /></div>
      <motion.div aria-hidden="true" className="pointer-events-none absolute -left-24 top-24 h-72 w-72 rounded-full bg-brand-200/55 blur-3xl" animate={reducedMotion ? undefined : { x: [0, 24, -8, 0], y: [0, -18, 12, 0], scale: [1, 1.06, 0.98, 1] }} transition={{ duration: 18, repeat: Infinity, ease: 'easeInOut' }} />
      <motion.div aria-hidden="true" className="pointer-events-none absolute -right-20 bottom-0 h-80 w-80 rounded-full bg-amber-100/70 blur-3xl" animate={reducedMotion ? undefined : { x: [0, -28, 10, 0], y: [0, 16, -12, 0], scale: [1, 0.96, 1.05, 1] }} transition={{ duration: 20, repeat: Infinity, ease: 'easeInOut' }} />
      <motion.div aria-hidden="true" className="pointer-events-none absolute left-[42%] top-[-8rem] h-64 w-64 rounded-full bg-sky-100/50 blur-3xl" animate={reducedMotion ? undefined : { x: [0, 18, -12, 0], y: [0, 26, 4, 0] }} transition={{ duration: 16, repeat: Infinity, ease: 'easeInOut' }} />

      <div className="relative mx-auto grid min-h-[calc(100vh-2.5rem)] max-w-6xl overflow-hidden rounded-[2rem] border border-white/80 bg-white shadow-soft lg:grid-cols-[1.08fr_0.92fr]">
        <section className="relative hidden overflow-hidden bg-ink p-12 text-white lg:flex lg:flex-col lg:justify-between">
          <div className="absolute inset-0 opacity-20" style={{ backgroundImage: 'radial-gradient(circle at 2px 2px, #7bd9ad 1px, transparent 0)', backgroundSize: '28px 28px' }} />
          <div className="relative [&>span]:!text-white">
            <Brand linked={false} />
          </div>
          <div className="relative max-w-md pb-8">
            <div className="mb-6 flex -space-x-2">
              {['AM', 'JT', 'NL', 'SK'].map((initials, index) => (
                <motion.span key={initials} initial={{ opacity: 0, x: -8 }} animate={{ opacity: 1 - index * 0.12, x: 0 }} transition={{ delay: reducedMotion ? 0 : index * 0.04 }} className="grid h-11 w-11 place-items-center rounded-full border-2 border-ink bg-brand-500 text-xs font-bold">
                  {initials}
                </motion.span>
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
            <div className="flex items-end justify-between gap-4">
              <div>
                <p className="text-sm font-bold text-brand-700">Welcome to Speak Four</p>
                <h2 className="mt-2 font-display text-3xl font-extrabold tracking-tight text-ink sm:text-4xl">
                  {mode === 'login' ? 'Ready to speak?' : 'Create your account'}
                </h2>
                <p className="mt-3 text-sm leading-6 text-slate-500">
                  {mode === 'login' ? 'Sign in and find your next speaking room.' : 'Pick your current English level. You can change it later.'}
                </p>
              </div>
              {mode === 'login' && <CharacterBuddy mood={loginMood} size="sm" className="-mb-2" />}
            </div>

            <div className="relative mt-8 grid grid-cols-2 rounded-xl bg-slate-100 p-1" role="tablist" aria-label="Authentication mode">
              {(['login', 'register'] as const).map((tab) => (
                <button key={tab} type="button" role="tab" aria-selected={mode === tab} onClick={() => changeMode(tab)}
                  className={`relative z-10 rounded-lg px-3 py-2.5 text-sm font-bold capitalize transition-colors ${mode === tab ? 'text-ink' : 'text-slate-500 hover:text-slate-700'}`}>
                  {mode === tab && <motion.span layoutId="auth-tab-indicator" className="absolute inset-0 -z-10 rounded-lg bg-white shadow-sm" transition={reducedMotion ? { duration: 0 } : { type: 'spring', stiffness: 520, damping: 38 }} />}
                  <span>{tab === 'login' ? 'Log in' : 'Register'}</span>
                </button>
              ))}
            </div>

            {providersQuery.data?.google && (
              <div className="mt-7">
                <a
                  href={googleSignInUrl()}
                  className="secondary-button flex w-full items-center justify-center gap-2.5"
                >
                  <GoogleIcon />
                  Continue with Google
                </a>
                <div className="my-5 flex items-center gap-3 text-xs font-bold uppercase tracking-wider text-slate-400">
                  <span className="h-px flex-1 bg-slate-200" />or<span className="h-px flex-1 bg-slate-200" />
                </div>
              </div>
            )}

            {mode === 'login' ? (
                <motion.form key="login" noValidate initial={{ opacity: 0, x: reducedMotion ? 0 : -12 }} animate={{ opacity: 1, x: 0 }} transition={{ duration: reducedMotion ? 0.08 : 0.18 }} className="mt-7 space-y-1" onSubmit={submit}>
                  <motion.div animate={loginErrors.email ? { x: [0, -5, 4, -3, 0] } : { x: 0 }} transition={{ duration: reducedMotion ? 0 : 0.28 }}>
                    <FloatingField id="email" label="Email address" type="email" autoComplete="email" value={email} onChange={(event) => { setEmail(event.target.value); setLoginErrors((current) => ({ ...current, email: undefined })); mutation.reset(); }} error={loginErrors.email} />
                  </motion.div>
                  <motion.div animate={loginErrors.password ? { x: [0, -5, 4, -3, 0] } : { x: 0 }} transition={{ duration: reducedMotion ? 0 : 0.28 }}>
                    <FloatingField id="password" label="Password" type={showPassword ? 'text' : 'password'} autoComplete="current-password" value={password} onFocus={() => setPasswordFocused(true)} onBlur={() => setPasswordFocused(false)} onChange={(event) => { setPassword(event.target.value); setLoginErrors((current) => ({ ...current, password: undefined })); mutation.reset(); }} error={loginErrors.password} endAdornment={<motion.button whileTap={{ scale: 0.9 }} type="button" onClick={() => setShowPassword((value) => !value)} className="min-w-14 rounded-lg px-2 py-1.5 text-xs font-bold text-brand-700" aria-label={showPassword ? 'Hide password' : 'Show password'}><AnimatePresence mode="wait" initial={false}><motion.span key={showPassword ? 'hide' : 'show'} initial={{ opacity: 0, y: reducedMotion ? 0 : 3 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: reducedMotion ? 0 : -3 }} transition={{ duration: 0.12 }}>{showPassword ? 'Hide' : 'Show'}</motion.span></AnimatePresence></motion.button>} />
                  </motion.div>
                  <div className="min-h-[3.6rem] pt-1">
                    <AnimatePresence initial={false}>{mutation.isError && <motion.div role="alert" initial={{ opacity: 0, y: -4 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }} className="rounded-xl border border-red-100 bg-red-50 px-4 py-3 text-sm font-medium text-red-700">{getApiErrorMessage(mutation.error, 'Unable to sign in.')}</motion.div>}</AnimatePresence>
                  </div>
                  <motion.button whileTap={{ scale: reducedMotion ? 1 : 0.98 }} className="primary-button w-full" type="submit" disabled={mutation.isPending || authComplete}>
                    <AnimatePresence mode="wait" initial={false}>
                      <motion.span key={authComplete ? 'success' : mutation.isPending ? 'pending' : 'idle'} initial={{ opacity: 0, scale: 0.92 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0, scale: 0.92 }} className="inline-flex items-center gap-2">
                        {authComplete ? <><span className="grid h-5 w-5 place-items-center rounded-full bg-white text-xs text-brand-700">✓</span>Welcome back</> : mutation.isPending ? <><span className="inline-spinner" />Signing in…</> : 'Log in'}
                      </motion.span>
                    </AnimatePresence>
                  </motion.button>
                </motion.form>
              ) : <motion.div key="register" initial={{ opacity: 0, x: reducedMotion ? 0 : 12 }} animate={{ opacity: 1, x: 0 }} transition={{ duration: reducedMotion ? 0.08 : 0.18 }}><OnboardingWizard onSuccess={completeAuth} /></motion.div>}

            <p className="mt-8 text-center text-xs leading-5 text-slate-400">This is a development test app. Use headphones to prevent audio feedback.</p>
          </div>
        </section>
      </div>
    </main>
  );
}

function GoogleIcon() {
  return (
    <svg className="h-4 w-4" viewBox="0 0 48 48" aria-hidden="true">
      <path fill="#FFC107" d="M43.611 20.083H42V20H24v8h11.303c-1.649 4.657-6.08 8-11.303 8-6.627 0-12-5.373-12-12s5.373-12 12-12c3.059 0 5.842 1.154 7.961 3.039l5.657-5.657C34.046 6.053 29.268 4 24 4 12.955 4 4 12.955 4 24s8.955 20 20 20 20-8.955 20-20c0-1.341-.138-2.65-.389-3.917z" />
      <path fill="#FF3D00" d="M6.306 14.691l6.571 4.819C14.655 15.108 18.961 12 24 12c3.059 0 5.842 1.154 7.961 3.039l5.657-5.657C34.046 6.053 29.268 4 24 4 16.318 4 9.656 8.337 6.306 14.691z" />
      <path fill="#4CAF50" d="M24 44c5.166 0 9.86-1.977 13.409-5.192l-6.19-5.238C29.211 35.091 26.715 36 24 36c-5.202 0-9.619-3.317-11.283-7.946l-6.522 5.025C9.505 39.556 16.227 44 24 44z" />
      <path fill="#1976D2" d="M43.611 20.083H42V20H24v8h11.303a12.04 12.04 0 0 1-4.087 5.571l.003-.002 6.19 5.238C36.971 39.205 44 34 44 24c0-1.341-.138-2.65-.389-3.917z" />
    </svg>
  );
}
