import { useEffect, useId, useRef, useState, type FormEvent, type ReactNode } from 'react';
import { useMutation, useQuery } from '@tanstack/react-query';
import { AnimatePresence, motion, useReducedMotion } from 'framer-motion';
import { Link, useNavigate } from 'react-router-dom';
import { getAuthProviders, googleSignInUrl, login } from '../../api/auth';
import { ThemeToggle } from '../../components/ThemeToggle';
import { getApiErrorMessage } from '../../lib/api-error';
import { useAuthStore } from '../../store/auth-store';
import type { AuthResponse } from '../../types/api';
import './auth-preview.css';

export type AuthPreviewDirection = 'liquid' | 'kinetic' | 'warm';

interface PreviewLoginFormProps {
  direction: AuthPreviewDirection;
  eyebrow: string;
  title: string;
  description: string;
  footer?: ReactNode;
}

const directionLinks: Array<{ direction: AuthPreviewDirection; short: string; label: string }> = [
  { direction: 'liquid', short: 'A', label: 'Liquid' },
  { direction: 'kinetic', short: 'B', label: 'Kinetic' },
  { direction: 'warm', short: 'C', label: 'Warm' },
];

export function PreviewToolbar({ current }: { current: AuthPreviewDirection }) {
  return (
    <header className="art-preview-toolbar">
      <Link to="/auth" className="art-preview-wordmark" aria-label="Open the current production auth screen">
        <span aria-hidden="true">S4</span>
        <span>Speak Four</span>
      </Link>
      <nav className="art-preview-switcher" aria-label="Art direction previews">
        {directionLinks.map((item) => (
          <Link
            key={item.direction}
            to={`/auth-preview/${item.direction}`}
            className={item.direction === current ? 'is-active' : undefined}
            aria-current={item.direction === current ? 'page' : undefined}
            title={`Direction ${item.short}: ${item.label}`}
          >
            <span>{item.short}</span>
            <span className="art-preview-switcher-label">{item.label}</span>
          </Link>
        ))}
      </nav>
      <ThemeToggle compact />
    </header>
  );
}

export function PreviewLoginForm({ direction, eyebrow, title, description, footer }: PreviewLoginFormProps) {
  const navigate = useNavigate();
  const setSession = useAuthStore((state) => state.setSession);
  const reducedMotion = useReducedMotion();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [errors, setErrors] = useState<{ email?: string; password?: string }>({});
  const [authComplete, setAuthComplete] = useState(false);
  const redirectTimer = useRef<number | null>(null);
  const generatedId = useId().replace(/:/g, '');
  const emailId = `${direction}-${generatedId}-email`;
  const passwordId = `${direction}-${generatedId}-password`;
  const providersQuery = useQuery({ queryKey: ['auth-providers'], queryFn: getAuthProviders, staleTime: Infinity });

  const mutation = useMutation({
    mutationFn: () => login({ email, password }),
    onSuccess: (session: AuthResponse) => {
      setSession(session);
      setAuthComplete(true);
      const destination = session.user.needsOnboarding ? '/onboarding' : '/';
      redirectTimer.current = window.setTimeout(() => navigate(destination, { replace: true }), reducedMotion ? 80 : 260);
    },
  });

  useEffect(() => () => {
    if (redirectTimer.current) window.clearTimeout(redirectTimer.current);
  }, []);

  const submit = (event: FormEvent) => {
    event.preventDefault();
    const nextErrors = {
      ...(!/\S+@\S+\.\S+/.test(email) ? { email: 'Enter a valid email address.' } : {}),
      ...(password.length < 8 ? { password: 'Password must be at least 8 characters.' } : {}),
    };
    setErrors(nextErrors);
    if (Object.keys(nextErrors).length) return;
    mutation.mutate();
  };

  return (
    <motion.section
      className={`preview-login-card preview-login-card--${direction}`}
      aria-labelledby={`${direction}-preview-title`}
      initial={{ opacity: 0, y: reducedMotion ? 0 : 18, scale: reducedMotion ? 1 : 0.985 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      transition={{ duration: reducedMotion ? 0 : 0.48, delay: reducedMotion ? 0 : 0.12, ease: [0.22, 1, 0.36, 1] }}
    >
      <div className="preview-login-heading">
        <p>{eyebrow}</p>
        <h2 id={`${direction}-preview-title`}>{title}</h2>
        <span>{description}</span>
      </div>

      {providersQuery.data?.google && (
        <>
          <a href={googleSignInUrl()} className="preview-google-button">
            <GoogleMark />
            Continue with Google
          </a>
          <div className="preview-divider"><span />or<span /></div>
        </>
      )}

      <form noValidate onSubmit={submit} className="preview-login-form">
        <label htmlFor={emailId}>Email address</label>
        <input
          id={emailId}
          type="email"
          autoComplete="email"
          value={email}
          onChange={(event) => {
            setEmail(event.target.value);
            setErrors((current) => ({ ...current, email: undefined }));
            mutation.reset();
          }}
          aria-invalid={Boolean(errors.email)}
          aria-describedby={errors.email ? `${emailId}-error` : undefined}
          placeholder="you@example.com"
        />
        <div className="preview-field-message">
          {errors.email && <span id={`${emailId}-error`} role="alert">{errors.email}</span>}
        </div>

        <div className="preview-label-row">
          <label htmlFor={passwordId}>Password</label>
          <Link to="/auth/forgot-password">Forgot password?</Link>
        </div>
        <div className="preview-password-field">
          <input
            id={passwordId}
            type={showPassword ? 'text' : 'password'}
            autoComplete="current-password"
            value={password}
            onChange={(event) => {
              setPassword(event.target.value);
              setErrors((current) => ({ ...current, password: undefined }));
              mutation.reset();
            }}
            aria-invalid={Boolean(errors.password)}
            aria-describedby={errors.password ? `${passwordId}-error` : undefined}
            placeholder="8+ characters"
          />
          <button type="button" onClick={() => setShowPassword((value) => !value)} aria-label={showPassword ? 'Hide password' : 'Show password'}>
            {showPassword ? 'Hide' : 'Show'}
          </button>
        </div>
        <div className="preview-field-message">
          {errors.password && <span id={`${passwordId}-error`} role="alert">{errors.password}</span>}
        </div>

        <div className="preview-server-message">
          <AnimatePresence initial={false}>
            {mutation.isError && (
              <motion.p role="alert" initial={{ opacity: 0, y: reducedMotion ? 0 : -4 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }}>
                {getApiErrorMessage(mutation.error, 'Unable to sign in.')}
              </motion.p>
            )}
          </AnimatePresence>
        </div>

        <motion.button
          className="preview-submit-button"
          type="submit"
          disabled={mutation.isPending || authComplete}
          whileTap={reducedMotion ? undefined : { scale: 0.985 }}
        >
          {authComplete ? 'Welcome back ✓' : mutation.isPending ? 'Signing in…' : 'Enter Speak Four'}
        </motion.button>
      </form>

      <p className="preview-register-link">New here? <Link to="/auth">Create an account</Link></p>
      {footer}
    </motion.section>
  );
}

function GoogleMark() {
  return <span className="preview-google-mark" aria-hidden="true">G</span>;
}
