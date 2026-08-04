import { useState, type FormEvent } from 'react';
import { useMutation } from '@tanstack/react-query';
import { Link, useSearchParams } from 'react-router-dom';
import { Brand } from '../components/Brand';
import { FloatingField } from '../components/FloatingField';
import { CharacterBuddy } from '../components/character/CharacterBuddy';
import { getApiErrorMessage } from '../lib/api-error';
import { resetPassword } from '../api/auth';

export function ResetPasswordPage() {
  const [searchParams] = useSearchParams();
  const token = searchParams.get('token') ?? '';
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [fieldError, setFieldError] = useState<string | undefined>();
  const mutation = useMutation({ mutationFn: () => resetPassword(token, password) });

  const submit = (event: FormEvent) => {
    event.preventDefault();
    if (password.length < 8) {
      setFieldError('Password must be at least 8 characters.');
      return;
    }
    if (password !== confirmPassword) {
      setFieldError('Passwords do not match.');
      return;
    }
    setFieldError(undefined);
    mutation.mutate();
  };

  return (
    <main className="grid min-h-screen place-items-center bg-canvas px-5 py-10">
      <div className="w-full max-w-md">
        <div className="mb-8 text-center">
          <Brand />
        </div>
        <div className="rounded-[2rem] border border-slate-200 bg-white p-8 shadow-soft">
          {!token ? (
            <div className="text-center">
              <span className="text-4xl">⚠️</span>
              <h1 className="mt-4 font-display text-2xl font-extrabold text-ink">Invalid reset link</h1>
              <p className="mt-3 text-sm leading-6 text-slate-500">This password reset link is missing its token. Request a new one to continue.</p>
              <Link to="/auth/forgot-password" className="secondary-button mt-6 inline-block">Request a new link</Link>
            </div>
          ) : mutation.isSuccess ? (
            <div className="text-center">
              <CharacterBuddy mood="celebrating" size="sm" className="mx-auto" />
              <h1 className="mt-4 font-display text-2xl font-extrabold text-ink">Password updated</h1>
              <p className="mt-3 text-sm leading-6 text-slate-500">You can now sign in with your new password. You've been signed out everywhere else.</p>
              <Link to="/auth" className="primary-button mt-6 inline-block">Back to sign in</Link>
            </div>
          ) : (
            <>
              <CharacterBuddy mood={mutation.isError || fieldError ? 'error' : 'thinking'} size="sm" className="-mb-2" />
              <h1 className="mt-4 font-display text-2xl font-extrabold text-ink">Set a new password</h1>
              <p className="mt-2 text-sm leading-6 text-slate-500">Choose a new password for your account.</p>
              <form noValidate className="mt-6 space-y-1" onSubmit={submit}>
                <FloatingField id="reset-password" label="New password" type="password" autoComplete="new-password" minLength={8} value={password} onChange={(event) => { setPassword(event.target.value); setFieldError(undefined); }} />
                <FloatingField id="reset-password-confirm" label="Confirm password" type="password" autoComplete="new-password" minLength={8} value={confirmPassword} onChange={(event) => { setConfirmPassword(event.target.value); setFieldError(undefined); }} error={fieldError} />
                <div className="min-h-[3.6rem] pt-1">
                  {mutation.isError && <div role="alert" className="rounded-xl border border-red-100 bg-red-50 px-4 py-3 text-sm font-medium text-red-700">{getApiErrorMessage(mutation.error, 'This link may have expired. Request a new one.')}</div>}
                </div>
                <button type="submit" className="primary-button w-full" disabled={mutation.isPending}>{mutation.isPending ? 'Saving…' : 'Set new password'}</button>
              </form>
              <Link to="/auth" className="mt-5 block text-center text-sm font-bold text-brand-700">Back to sign in</Link>
            </>
          )}
        </div>
      </div>
    </main>
  );
}
