import { useState, type FormEvent } from 'react';
import { useMutation } from '@tanstack/react-query';
import { Link } from 'react-router-dom';
import { Brand } from '../components/Brand';
import { FloatingField } from '../components/FloatingField';
import { CharacterBuddy } from '../components/character/CharacterBuddy';
import { forgotPassword } from '../api/auth';

export function ForgotPasswordPage() {
  const [email, setEmail] = useState('');
  const [error, setError] = useState<string | undefined>();
  const mutation = useMutation({ mutationFn: () => forgotPassword(email) });

  const submit = (event: FormEvent) => {
    event.preventDefault();
    if (!/\S+@\S+\.\S+/.test(email)) {
      setError('Enter a valid email address.');
      return;
    }
    setError(undefined);
    mutation.mutate();
  };

  return (
    <main className="grid min-h-screen place-items-center bg-canvas px-5 py-10">
      <div className="w-full max-w-md">
        <div className="mb-8 text-center">
          <Brand />
        </div>
        <div className="rounded-[2rem] border border-slate-200 bg-white p-8 shadow-soft">
          {mutation.isSuccess ? (
            <div className="text-center">
              <CharacterBuddy mood="happy" size="sm" className="mx-auto" />
              <h1 className="mt-4 font-display text-2xl font-extrabold text-ink">Check your email</h1>
              <p className="mt-3 text-sm leading-6 text-slate-500">If an account exists for <strong>{email}</strong>, we've sent a link to reset your password. It expires in 30 minutes.</p>
              <Link to="/auth" className="secondary-button mt-6 inline-block">Back to sign in</Link>
            </div>
          ) : (
            <>
              <CharacterBuddy mood={error ? 'error' : 'thinking'} size="sm" className="-mb-2" />
              <h1 className="mt-4 font-display text-2xl font-extrabold text-ink">Reset your password</h1>
              <p className="mt-2 text-sm leading-6 text-slate-500">Enter the email on your account and we'll send you a reset link.</p>
              <form noValidate className="mt-6 space-y-1" onSubmit={submit}>
                <FloatingField id="forgot-email" label="Email address" type="email" autoComplete="email" value={email} onChange={(event) => { setEmail(event.target.value); setError(undefined); }} error={error} />
                <button type="submit" className="primary-button mt-3 w-full" disabled={mutation.isPending}>{mutation.isPending ? 'Sending…' : 'Send reset link'}</button>
              </form>
              <Link to="/auth" className="mt-5 block text-center text-sm font-bold text-brand-700">Back to sign in</Link>
            </>
          )}
        </div>
      </div>
    </main>
  );
}
