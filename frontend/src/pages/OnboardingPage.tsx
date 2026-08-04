import { useNavigate } from 'react-router-dom';
import { Brand } from '../components/Brand';
import { GoogleOnboardingWizard } from '../components/GoogleOnboardingWizard';
import { useAuthStore } from '../store/auth-store';

export function OnboardingPage() {
  const navigate = useNavigate();
  const user = useAuthStore((state) => state.user);
  const updateUser = useAuthStore((state) => state.updateUser);

  if (!user) return null;

  return (
    <main className="grid min-h-screen place-items-center bg-canvas px-5 py-10">
      <div className="w-full max-w-md">
        <div className="mb-8 text-center">
          <Brand />
          <h1 className="mt-4 font-display text-3xl font-extrabold text-ink">Finish setting up your profile</h1>
          <p className="mt-2 text-sm leading-6 text-slate-500">A few quick details so we can match you with the right conversations.</p>
        </div>
        <GoogleOnboardingWizard
          user={user}
          onSuccess={(updated) => {
            updateUser(updated);
            navigate('/', { replace: true });
          }}
        />
      </div>
    </main>
  );
}
