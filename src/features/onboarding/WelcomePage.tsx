import { Camera } from 'lucide-react';
import { useMemo, useRef, useState, type FormEvent } from 'react';
import { Navigate } from 'react-router';
import { Alert } from '@/components/ui/Alert';
import { Button } from '@/components/ui/Button';
import { ErrorState } from '@/components/ui/ErrorState';
import { SelectField, TextField } from '@/components/ui/Field';
import { Splash } from '@/components/ui/Splash';
import { AuthLayout } from '@/features/auth/AuthLayout';
import { browserTimezone, useCompleteOnboarding, useCurrencies, useProfile } from '@/features/profile/api';
import { avatarFromFile } from '@/features/profile/avatarImage';
import { defaultCurrencyForLocale } from '@/domain/regionCurrency';
import { errorMessage } from '@/lib/errors';
import { useOnlineStatus } from '@/lib/hooks';
import { strings } from '@/strings/en';

/**
 * First run (owner request, 2026-10-10: ask for the name up front): the person's name (required),
 * an optional profile photo, and the base currency (defaulting from the browser locale). Saved in
 * one call, which also creates the starter categories.
 */
export function WelcomePage() {
  const profile = useProfile();
  const currencies = useCurrencies();
  const onboarding = useCompleteOnboarding();
  const online = useOnlineStatus();
  const [selected, setSelected] = useState<string | null>(null);
  const [name, setName] = useState<string | null>(null);
  const [photo, setPhoto] = useState<string | null>(null);
  const [photoState, setPhotoState] = useState<{ busy: boolean; error: unknown }>({ busy: false, error: null });
  const [showErrors, setShowErrors] = useState(false);
  const photoInput = useRef<HTMLInputElement>(null);

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

  const s = strings.onboarding;
  const value = selected ?? defaultCode ?? '';
  const nameValue = name ?? profile.data.display_name ?? '';
  const nameError = nameValue.trim() === '' ? s.nameRequired : undefined;

  async function choosePhoto(file: File | undefined) {
    if (!file) return;
    setPhotoState({ busy: true, error: null });
    try {
      setPhoto(await avatarFromFile(file));
      setPhotoState({ busy: false, error: null });
    } catch (error) {
      setPhotoState({ busy: false, error });
    }
  }

  function onSubmit(event: FormEvent) {
    event.preventDefault();
    setShowErrors(true);
    if (nameError) {
      document.getElementById('onboarding-name')?.focus();
      return;
    }
    onboarding.mutate({ baseCurrency: value, timezone: browserTimezone(), displayName: nameValue.trim(), avatarDataUrl: photo });
  }

  return (
    <AuthLayout title={s.title} subtitle={s.subtitle}>
      <form noValidate className="flex flex-col gap-5" onSubmit={onSubmit}>
        {onboarding.isError ? <Alert tone="error">{errorMessage(onboarding.error)}</Alert> : null}

        <div className="flex items-center gap-4">
          {photo ? (
            <img src={photo} alt="" className="size-16 shrink-0 rounded-full object-cover" />
          ) : (
            <span aria-hidden="true" className="grid size-16 shrink-0 place-items-center rounded-full bg-accent-tint text-accent-strong">
              <Camera className="size-6" />
            </span>
          )}
          <div className="flex min-w-0 flex-col gap-1.5">
            <div className="flex flex-wrap gap-2">
              <Button variant="secondary" loading={photoState.busy} onClick={() => photoInput.current?.click()}>
                {photo ? s.photoChange : s.photoAdd}
              </Button>
              {photo ? (
                <Button variant="ghost" onClick={() => setPhoto(null)}>
                  {s.photoRemove}
                </Button>
              ) : null}
            </div>
            <p className="text-sm text-fg-muted">{s.photoHint}</p>
          </div>
          {/* Opened by the button above (phones offer the camera or the photo library). */}
          <input
            ref={photoInput}
            type="file"
            accept="image/*"
            tabIndex={-1}
            aria-hidden="true"
            className="sr-only"
            onChange={(event) => {
              void choosePhoto(event.target.files?.[0]);
              event.target.value = '';
            }}
          />
        </div>
        {photoState.error ? <Alert tone="error">{errorMessage(photoState.error)}</Alert> : null}

        <TextField
          id="onboarding-name"
          label={s.nameLabel}
          hint={s.nameHint}
          autoComplete="name"
          required
          maxLength={80}
          value={nameValue}
          onChange={(e) => setName(e.target.value)}
          error={showErrors ? nameError : undefined}
        />
        <SelectField
          label={s.currencyLabel}
          hint={s.currencyHint}
          value={value}
          onChange={setSelected}
          items={currencies.data.map((currency) => ({ value: currency.code, label: `${currency.code} · ${currency.name}` }))}
        />
        <Button type="submit" size="lg" fullWidth loading={onboarding.isPending} disabled={!online || photoState.busy}>
          {s.submit}
        </Button>
      </form>
    </AuthLayout>
  );
}
