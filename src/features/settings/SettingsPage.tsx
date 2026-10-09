import { Check, ChevronRight, Download, LogOut, Trash2 } from 'lucide-react';
import { useRef, useState, type FormEvent, type ReactNode } from 'react';
import { Link } from 'react-router';
import { PageHeader } from '@/components/layout/PageHeader';
import { Alert } from '@/components/ui/Alert';
import { Button } from '@/components/ui/Button';
import { Card } from '@/components/ui/Card';
import { TextField } from '@/components/ui/Field';
import { SegmentedControl } from '@/components/ui/SegmentedControl';
import { useToast } from '@/components/ui/toast-context';
import { redirectUrls } from '@/features/auth/authRedirects';
import { useProfile, useUpdateProfile } from '@/features/profile/api';
import { Avatar } from '@/features/profile/Avatar';
import { avatarFromFile } from '@/features/profile/avatarImage';
import { cx } from '@/lib/cx';
import { errorMessage } from '@/lib/errors';
import { useOnlineStatus } from '@/lib/hooks';
import { isIos, isStandalone, useInstallPrompt } from '@/lib/install';
import { supabase } from '@/lib/supabase';
import { strings } from '@/strings/en';
import { ACCENT_THEMES, THEME_MODES, type AccentTheme, type ThemeMode } from '@/theme/theme';
import { useTheme } from '@/theme/theme-context';
import { DeleteAccountDialog } from './DeleteAccountDialog';

const s = strings.settings;

function AccentPicker({ value, onChange, disabled }: { value: AccentTheme; onChange: (accent: AccentTheme) => void; disabled: boolean }) {
  return (
    <fieldset disabled={disabled}>
      <legend className="mb-2 text-sm font-medium">{s.accent}</legend>
      <div className="flex flex-wrap gap-3">
        {ACCENT_THEMES.map((accent) => {
          const selected = accent === value;
          return (
            // Each swatch previews its accent by scoping data-accent to the swatch.
            <label key={accent} data-accent={accent} className="relative cursor-pointer">
              <input
                type="radio"
                name="accent"
                value={accent}
                checked={selected}
                onChange={() => onChange(accent)}
                className="peer sr-only"
                aria-label={s.accents[accent]}
              />
              <span
                aria-hidden="true"
                className={cx(
                  'grid size-11 place-items-center rounded-full bg-accent-strong text-on-accent',
                  'ring-offset-2 ring-offset-surface peer-focus-visible:ring-2 peer-focus-visible:ring-fg',
                  selected && 'ring-2 ring-fg',
                )}
              >
                {selected ? <Check className="size-5" strokeWidth={3} /> : null}
              </span>
            </label>
          );
        })}
      </div>
    </fieldset>
  );
}

function LinkRow({ to, children }: { to: string; children: ReactNode }) {
  return (
    <Link to={to} className="flex h-12 items-center justify-between rounded-control px-1 font-medium hover:bg-hover">
      {children}
      <ChevronRight aria-hidden="true" className="size-4 text-fg-muted" />
    </Link>
  );
}

function AccountSection() {
  const profile = useProfile();
  const updateProfile = useUpdateProfile();
  const toast = useToast();
  const online = useOnlineStatus();
  const [name, setName] = useState<string | null>(null);
  const [resetState, setResetState] = useState<'idle' | 'sending' | 'sent' | 'failed'>('idle');
  const [photoState, setPhotoState] = useState<{ busy: boolean; error: unknown }>({ busy: false, error: null });
  const photoInput = useRef<HTMLInputElement>(null);
  const email = profile.data?.email ?? '';
  const hasPhoto = Boolean(profile.data?.avatar_data_url);
  const nameValue = name ?? profile.data?.display_name ?? '';

  function saveName(event: FormEvent) {
    event.preventDefault();
    updateProfile.mutate(
      { display_name: nameValue.trim() || null },
      {
        onSuccess: () => {
          setName(null);
          toast({ message: s.nameSaved });
        },
      },
    );
  }

  async function choosePhoto(file: File | undefined) {
    if (!file) return;
    setPhotoState({ busy: true, error: null });
    try {
      const photo = await avatarFromFile(file);
      updateProfile.mutate(
        { avatar_data_url: photo },
        {
          onSuccess: () => toast({ message: s.photo.saved }),
          onSettled: () => setPhotoState((state) => ({ ...state, busy: false })),
        },
      );
    } catch (error) {
      setPhotoState({ busy: false, error });
    }
  }

  function removePhoto() {
    updateProfile.mutate({ avatar_data_url: null }, { onSuccess: () => toast({ message: s.photo.removed }) });
  }

  async function sendPasswordReset() {
    setResetState('sending');
    const { error } = await supabase.auth.resetPasswordForEmail(email, { redirectTo: redirectUrls.passwordReset() });
    setResetState(error ? 'failed' : 'sent');
  }

  return (
    <Card className="p-5">
      <h2 className="text-lg font-bold">{s.account}</h2>
      <div className="mt-4 flex items-center gap-4">
        <Avatar profile={profile.data} size="lg" />
        <div className="flex flex-wrap gap-2">
          <Button variant="secondary" loading={photoState.busy} disabled={!online} onClick={() => photoInput.current?.click()}>
            {hasPhoto ? s.photo.change : s.photo.add}
          </Button>
          {hasPhoto ? (
            <Button variant="ghost" disabled={!online || photoState.busy} onClick={removePhoto}>
              {s.photo.remove}
            </Button>
          ) : null}
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
      <p className="mt-2 text-sm text-fg-muted">{s.photo.hint}</p>
      {photoState.error ? (
        <Alert tone="error" className="mt-2">
          {errorMessage(photoState.error)}
        </Alert>
      ) : null}
      <form onSubmit={saveName} className="mt-4 flex items-end gap-2">
        <div className="flex-1">
          <TextField label={s.displayName} hint={s.displayNameHint} maxLength={80} value={nameValue} onChange={(e) => setName(e.target.value)} />
        </div>
        {name !== null ? (
          <Button type="submit" className="mb-6.5" loading={updateProfile.isPending} disabled={!online}>
            {s.saveName}
          </Button>
        ) : null}
      </form>
      <dl className="mt-4 flex flex-col gap-3 text-sm">
        <div>
          <dt className="text-fg-muted">{s.email}</dt>
          <dd className="font-medium break-all">{email}</dd>
        </div>
        <div>
          <dt className="text-fg-muted">{s.baseCurrency}</dt>
          <dd className="font-medium">{profile.data?.base_currency}</dd>
          <dd className="text-fg-muted">{s.baseCurrencyHint}</dd>
        </div>
      </dl>
      <div className="mt-4">
        <p className="text-sm text-fg-muted">{s.password}</p>
        {resetState === 'sent' ? (
          <Alert tone="success" className="mt-2">
            {s.passwordEmailSent(email)}
          </Alert>
        ) : (
          <Button variant="secondary" className="mt-2" loading={resetState === 'sending'} disabled={!online || !email} onClick={() => void sendPasswordReset()}>
            {s.changePassword}
          </Button>
        )}
        {resetState === 'failed' ? (
          <Alert tone="error" className="mt-2">
            {strings.errors.generic}
          </Alert>
        ) : null}
      </div>
      {updateProfile.isError ? (
        <Alert tone="error" className="mt-3">
          {errorMessage(updateProfile.error)}
        </Alert>
      ) : null}
    </Card>
  );
}

function AppearanceSection() {
  const theme = useTheme();
  const updateProfile = useUpdateProfile();
  const online = useOnlineStatus();

  function changeMode(mode: ThemeMode) {
    theme.setPreferences({ mode });
    updateProfile.mutate({ theme_mode: mode });
  }
  function changeAccent(accent: AccentTheme) {
    theme.setPreferences({ accent });
    updateProfile.mutate({ accent_theme: accent });
  }

  return (
    <Card className="p-5">
      <h2 className="text-lg font-bold">{s.appearance}</h2>
      {/* Preferences are saved to the profile, so they're writes: offline, they wait. */}
      <fieldset disabled={!online} className="mt-4 flex flex-col gap-5">
        <SegmentedControl
          label={s.mode}
          value={theme.mode}
          onChange={changeMode}
          options={THEME_MODES.map((mode) => ({ value: mode, label: s.modes[mode] }))}
        />
        <AccentPicker value={theme.accent} onChange={changeAccent} disabled={!online} />
      </fieldset>
    </Card>
  );
}

function AppSection() {
  const install = useInstallPrompt();
  const [signingOut, setSigningOut] = useState(false);
  const standalone = isStandalone();

  return (
    <Card className="p-5">
      <h2 className="text-lg font-bold">{s.app}</h2>
      <div className="mt-3">
        {standalone ? (
          <p className="text-sm text-fg-muted">{s.installed}</p>
        ) : install.available ? (
          <div>
            <p className="text-sm text-fg-muted">{s.installHint}</p>
            <Button variant="secondary" className="mt-2" icon={<Download aria-hidden="true" className="size-4" />} onClick={() => void install.install()}>
              {s.install}
            </Button>
          </div>
        ) : isIos() ? (
          <p className="text-sm text-fg-muted">{s.installIos}</p>
        ) : null}
      </div>
      <div className="mt-3">
        <LinkRow to="/privacy">{s.privacy}</LinkRow>
      </div>
      <Button
        variant="secondary"
        fullWidth
        className="mt-3"
        loading={signingOut}
        onClick={() => {
          setSigningOut(true);
          void supabase.auth.signOut();
        }}
        icon={<LogOut aria-hidden="true" className="size-4" />}
      >
        {strings.auth.signOut}
      </Button>
    </Card>
  );
}

/** Settings (spec section 8). */
export function SettingsPage() {
  const [deleting, setDeleting] = useState(false);
  const online = useOnlineStatus();

  return (
    <>
      <PageHeader title={strings.pages.settings.title} />
      <div className="mt-4 grid gap-4 wide:grid-cols-2 wide:items-start">
        <div className="flex flex-col gap-4">
          <AccountSection />
          <Card className="p-5">
            <h2 className="text-lg font-bold">{s.data}</h2>
            <div className="mt-2">
              <LinkRow to="/settings/categories">{s.categories}</LinkRow>
              <LinkRow to="/settings/recurring">{s.recurring}</LinkRow>
            </div>
          </Card>
        </div>
        <div className="flex flex-col gap-4">
          <AppearanceSection />
          <AppSection />
          <Card className="p-5">
            <h2 className="text-lg font-bold">{s.deleteAccount.title}</h2>
            <p className="mt-1 text-sm text-fg-muted">{s.deleteAccount.description}</p>
            <Button
              variant="ghost"
              className="mt-3 -ml-2 text-expense-strong"
              disabled={!online}
              icon={<Trash2 aria-hidden="true" className="size-4" />}
              onClick={() => setDeleting(true)}
            >
              {s.deleteAccount.button}
            </Button>
          </Card>
        </div>
      </div>
      <DeleteAccountDialog open={deleting} onOpenChange={setDeleting} />
    </>
  );
}
