import { MailCheck } from 'lucide-react';
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

export function SignUpPage() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<unknown>(null);
  const [submitting, setSubmitting] = useState(false);
  const [sentTo, setSentTo] = useState<string | null>(null);

  async function onSubmit(event: FormEvent) {
    event.preventDefault();
    setSubmitting(true);
    setError(null);
    const trimmed = email.trim();
    const { data, error: signUpError } = await supabase.auth.signUp({
      email: trimmed,
      password,
      options: { emailRedirectTo: redirectUrls.emailConfirmed() },
    });
    setSubmitting(false);
    if (signUpError) {
      setError(signUpError);
      return;
    }
    // With email confirmation on, there is no session until the link is opened.
    if (!data.session) setSentTo(trimmed);
  }

  const s = strings.auth.signUp;

  if (sentTo) {
    return (
      <AuthLayout title={s.checkEmailTitle}>
        <div className="flex flex-col items-center gap-5 text-center">
          <div className="grid size-14 place-items-center rounded-full bg-accent-tint text-accent-strong">
            <MailCheck aria-hidden="true" className="size-7" />
          </div>
          <p role="status">{s.checkEmailBody(sentTo)}</p>
          <Link to="/sign-in" className="font-semibold text-accent-strong hover:underline">
            {strings.common.backToSignIn}
          </Link>
        </div>
      </AuthLayout>
    );
  }

  return (
    <AuthLayout title={s.title} subtitle={s.subtitle}>
      <div className="flex flex-col gap-5">
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
            autoComplete="new-password"
            required
            minLength={8}
            hint={strings.auth.passwordHint}
            value={password}
            onChange={(e) => setPassword(e.target.value)}
          />
          <Button type="submit" size="lg" fullWidth loading={submitting}>
            {s.submit}
          </Button>
        </form>

        <p className="text-center text-sm text-fg-muted">
          {s.haveAccount}{' '}
          <Link to="/sign-in" className="font-semibold text-accent-strong hover:underline">
            {s.toSignIn}
          </Link>
        </p>
        <Link to="/privacy" className="self-center text-sm text-fg-muted underline hover:text-fg">
          {strings.pages.privacy.title}
        </Link>
      </div>
    </AuthLayout>
  );
}
