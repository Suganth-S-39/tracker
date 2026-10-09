import { useState, type FormEvent } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router';
import { Alert } from '@/components/ui/Alert';
import { Button } from '@/components/ui/Button';
import { TextField } from '@/components/ui/Field';
import { Splash } from '@/components/ui/Splash';
import { errorMessage } from '@/lib/errors';
import { supabase } from '@/lib/supabase';
import { strings } from '@/strings/en';
import { useAuth } from './auth-context';
import { AuthLayout } from './AuthLayout';

/**
 * Landing page for the password-reset email. The client exchanges the ?code= for a session
 * (same browser only); with a session the user can choose a new password.
 */
export function ResetPasswordPage() {
  const auth = useAuth();
  const navigate = useNavigate();
  const [params] = useSearchParams();
  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [error, setError] = useState<unknown>(null);
  const [mismatch, setMismatch] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  const s = strings.auth.reset;

  if (auth.status === 'loading') return <Splash />;

  if (auth.status === 'signedOut' || params.get('error_code')) {
    return (
      <AuthLayout title={s.title}>
        <div className="flex flex-col gap-5">
          <Alert tone="error">{s.expired}</Alert>
          <Link to="/forgot-password" className="font-semibold text-accent-strong hover:underline">
            {s.requestNew}
          </Link>
        </div>
      </AuthLayout>
    );
  }

  async function onSubmit(event: FormEvent) {
    event.preventDefault();
    if (password !== confirm) {
      setMismatch(true);
      return;
    }
    setMismatch(false);
    setSubmitting(true);
    setError(null);
    const { error: updateError } = await supabase.auth.updateUser({ password });
    setSubmitting(false);
    if (updateError) setError(updateError);
    else void navigate('/', { replace: true });
  }

  return (
    <AuthLayout title={s.title}>
      <form className="flex flex-col gap-4" onSubmit={(e) => void onSubmit(e)}>
        {error ? <Alert tone="error">{errorMessage(error)}</Alert> : null}
        <TextField
          label={strings.auth.newPassword}
          type="password"
          autoComplete="new-password"
          required
          minLength={8}
          hint={strings.auth.passwordHint}
          value={password}
          onChange={(e) => setPassword(e.target.value)}
        />
        <TextField
          label={strings.auth.confirmPassword}
          type="password"
          autoComplete="new-password"
          required
          error={mismatch ? s.mismatch : undefined}
          value={confirm}
          onChange={(e) => setConfirm(e.target.value)}
        />
        <Button type="submit" size="lg" fullWidth loading={submitting}>
          {s.submit}
        </Button>
      </form>
    </AuthLayout>
  );
}
