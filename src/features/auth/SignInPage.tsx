import { useState, type FormEvent } from 'react';
import { Link, useSearchParams } from 'react-router';
import { Alert } from '@/components/ui/Alert';
import { Button } from '@/components/ui/Button';
import { TextField } from '@/components/ui/Field';
import { errorMessage } from '@/lib/errors';
import { supabase } from '@/lib/supabase';
import { strings } from '@/strings/en';
import { AuthLayout } from './AuthLayout';

export function SignInPage() {
  const [params] = useSearchParams();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<unknown>(null);
  const [submitting, setSubmitting] = useState(false);

  // Supabase redirects back with ?error_code=... when an email link is expired or invalid.
  const urlErrorCode = params.get('error_code');
  const urlError = urlErrorCode ? (strings.errors.byCode[urlErrorCode] ?? strings.errors.generic) : null;
  const confirmed = params.get('confirmed') === '1' && !urlError;
  const accountDeleted = params.get('deleted') === '1';

  async function onSubmit(event: FormEvent) {
    event.preventDefault();
    setSubmitting(true);
    setError(null);
    const { error: signInError } = await supabase.auth.signInWithPassword({ email: email.trim(), password });
    // On success the auth state changes and GuestOnly redirects into the app.
    if (signInError) {
      setError(signInError);
      setSubmitting(false);
    }
  }

  const s = strings.auth.signIn;
  return (
    <AuthLayout title={s.title} subtitle={s.subtitle}>
      <div className="flex flex-col gap-5">
        {confirmed ? <Alert tone="success">{s.emailConfirmed}</Alert> : null}
        {accountDeleted ? <Alert tone="success">{strings.auth.accountDeleted}</Alert> : null}
        {urlError ? <Alert tone="error">{urlError}</Alert> : null}
        {error ? <Alert tone="error">{errorMessage(error)}</Alert> : null}

        <form className="flex flex-col gap-4" onSubmit={(e) => void onSubmit(e)}>
          <TextField
            label={strings.auth.email}
            type="email"
            inputMode="email"
            autoComplete="email"
            required
            value={email}
            onChange={(e) => setEmail(e.target.value)}
          />
          <TextField
            label={strings.auth.password}
            type="password"
            autoComplete="current-password"
            required
            value={password}
            onChange={(e) => setPassword(e.target.value)}
          />
          <div className="-mt-1 text-right">
            <Link to="/forgot-password" className="text-sm font-semibold text-accent-strong hover:underline">
              {s.forgot}
            </Link>
          </div>
          <Button type="submit" size="lg" fullWidth loading={submitting}>
            {s.submit}
          </Button>
        </form>

        <p className="text-center text-sm text-fg-muted">
          {s.noAccount}{' '}
          <Link to="/sign-up" className="font-semibold text-accent-strong hover:underline">
            {s.toSignUp}
          </Link>
        </p>
      </div>
    </AuthLayout>
  );
}
