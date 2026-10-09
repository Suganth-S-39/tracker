import { useState, type FormEvent } from 'react';
import { Link } from 'react-router';
import { Alert } from '@/components/ui/Alert';
import { Button } from '@/components/ui/Button';
import { TextField } from '@/components/ui/Field';
import { errorMessage } from '@/lib/errors';
import { supabase } from '@/lib/supabase';
import { strings } from '@/strings/en';
import { AuthLayout } from './AuthLayout';
import { redirectUrls } from './authRedirects';

export function ForgotPasswordPage() {
  const [email, setEmail] = useState('');
  const [error, setError] = useState<unknown>(null);
  const [submitting, setSubmitting] = useState(false);
  const [sentTo, setSentTo] = useState<string | null>(null);

  async function onSubmit(event: FormEvent) {
    event.preventDefault();
    setSubmitting(true);
    setError(null);
    const trimmed = email.trim();
    const { error: resetError } = await supabase.auth.resetPasswordForEmail(trimmed, {
      redirectTo: redirectUrls.passwordReset(),
    });
    setSubmitting(false);
    if (resetError) setError(resetError);
    else setSentTo(trimmed);
  }

  const s = strings.auth.forgot;
  return (
    <AuthLayout title={sentTo ? s.sentTitle : s.title} subtitle={sentTo ? undefined : s.subtitle}>
      {sentTo ? (
        <div className="flex flex-col gap-5">
          <p role="status">{s.sentBody(sentTo)}</p>
          <Link to="/sign-in" className="font-semibold text-accent-strong hover:underline">
            {strings.common.backToSignIn}
          </Link>
        </div>
      ) : (
        <form className="flex flex-col gap-4" onSubmit={(e) => void onSubmit(e)}>
          {error ? <Alert tone="error">{errorMessage(error)}</Alert> : null}
          <TextField
            label={strings.auth.email}
            type="email"
            inputMode="email"
            autoComplete="email"
            required
            value={email}
            onChange={(e) => setEmail(e.target.value)}
          />
          <Button type="submit" size="lg" fullWidth loading={submitting}>
            {s.submit}
          </Button>
          <Link to="/sign-in" className="text-center text-sm font-semibold text-accent-strong hover:underline">
            {strings.common.backToSignIn}
          </Link>
        </form>
      )}
    </AuthLayout>
  );
}
