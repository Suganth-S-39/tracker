import { useMemo, useState, type FormEvent } from 'react';
import { Navigate } from 'react-router';
import { Alert } from '@/components/ui/Alert';
import { Button } from '@/components/ui/Button';
import { ErrorState } from '@/components/ui/ErrorState';
import { SelectField } from '@/components/ui/Field';
import { Splash } from '@/components/ui/Splash';
import { AuthLayout } from '@/features/auth/AuthLayout';
import { browserTimezone, useCompleteOnboarding, useCurrencies, useProfile } from '@/features/profile/api';
import { defaultCurrencyForLocale } from '@/domain/regionCurrency';
import { errorMessage } from '@/lib/errors';
import { useOnlineStatus } from '@/lib/hooks';
import { strings } from '@/strings/en';

/** First run: pick the base currency (defaulting from the browser locale), then create starter categories. */
export function WelcomePage() {
  const profile = useProfile();
  const currencies = useCurrencies();
  const onboarding = useCompleteOnboarding();
  const online = useOnlineStatus();
  const [selected, setSelected] = useState<string | null>(null);

  const defaultCode = useMemo(() => {
    if (!currencies.data) return null;
    const supported = new Set(currencies.data.map((c) => c.code));
    return defaultCurrencyForLocale(navigator.language, supported);
  }, [currencies.data]);

  if (profile.isPending || currencies.isPending) return <Splash />;
  if (profile.isError && profile.data === undefined) return <ErrorState error={profile.error} onRetry={() => void profile.refetch()} fullScreen />;
  if (currencies.isError && currencies.data === undefined) {
    return <ErrorState error={currencies.error} onRetry={() => void currencies.refetch()} fullScreen />;
  }
  if (profile.data.base_currency) return <Navigate to="/" replace />;

  const value = selected ?? defaultCode ?? '';

  function onSubmit(event: FormEvent) {
    event.preventDefault();
    onboarding.mutate({ baseCurrency: value, timezone: browserTimezone() });
  }

  const s = strings.onboarding;
  return (
    <AuthLayout title={s.title} subtitle={s.subtitle}>
      <form className="flex flex-col gap-5" onSubmit={onSubmit}>
        {onboarding.isError ? <Alert tone="error">{errorMessage(onboarding.error)}</Alert> : null}
        <SelectField
          label={s.currencyLabel}
          hint={s.currencyHint}
          value={value}
          onChange={(e) => setSelected(e.target.value)}
          required
        >
          {currencies.data.map((currency) => (
            <option key={currency.code} value={currency.code}>
              {currency.code} · {currency.name}
            </option>
          ))}
        </SelectField>
        <Button type="submit" size="lg" fullWidth loading={onboarding.isPending} disabled={!online}>
          {s.submit}
        </Button>
      </form>
    </AuthLayout>
  );
}
