import { createElement, useId, useRef, useState, type FormEvent } from 'react';
import { Alert } from '@/components/ui/Alert';
import { Button } from '@/components/ui/Button';
import { TextField } from '@/components/ui/Field';
import { useToast } from '@/components/ui/toast-context';
import { AmountField } from '@/features/money/AmountField';
import type { MoneyContext } from '@/features/money/useMoney';
import { avatarFromFile } from '@/features/profile/avatarImage';
import { isIsoDate } from '@/domain/dates';
import { amountInputValue, parseAmount } from '@/domain/money';
import { cx } from '@/lib/cx';
import { errorMessage } from '@/lib/errors';
import { useOnlineStatus } from '@/lib/hooks';
import { strings } from '@/strings/en';
import { useSaveGoal, type Goal } from './api';
import { GOAL_ICON_KEYS, goalIcon } from './goalIcons';
import { GoalBadge } from './GoalVisuals';

const s = strings.goals.form;

type GoalFormProps = {
  money: MoneyContext;
  goal?: Goal | undefined;
  /** The goal's current photo, when editing one that has a photo. */
  photo?: string | undefined;
  onSaved: (id: string) => void;
};

/** New goal or edit: what it is, what it costs, an optional date, and an icon or a photo. */
export function GoalForm({ money, goal, photo: currentPhoto, onSaved }: GoalFormProps) {
  const { baseCurrency, exponentOf } = money;
  const exponent = exponentOf(baseCurrency);
  const [name, setName] = useState(goal?.name ?? '');
  const [amountText, setAmountText] = useState(goal ? amountInputValue(goal.target_minor, exponent) : '');
  const [targetDate, setTargetDate] = useState(goal?.target_date ?? '');
  const [icon, setIcon] = useState(goal?.icon ?? 'target');
  // undefined: unchanged; null: removed; a data URL: newly chosen.
  const [photo, setPhoto] = useState<string | null | undefined>(undefined);
  const [photoState, setPhotoState] = useState<{ busy: boolean; error: unknown }>({ busy: false, error: null });
  const [showErrors, setShowErrors] = useState(false);
  const photoInput = useRef<HTMLInputElement>(null);
  const iconGroup = useId();
  const save = useSaveGoal();
  const toast = useToast();
  const online = useOnlineStatus();

  const shownPhoto = photo === undefined ? currentPhoto : (photo ?? undefined);
  const targetMinor = parseAmount(amountText, exponent);
  const errors = {
    name: name.trim().length === 0 || name.trim().length > 60 ? s.errors.name : undefined,
    target:
      amountText.trim() !== '' && targetMinor === null
        ? strings.form.errors.amountFormat(exponent)
        : !targetMinor
          ? s.errors.target
          : undefined,
    date: targetDate !== '' && !isIsoDate(targetDate) ? s.errors.date : undefined,
  };
  const valid = Object.values(errors).every((e) => e === undefined);
  const shown = (error: string | undefined) => (showErrors ? error : undefined);

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
    if (!valid || !targetMinor) return;
    save.mutate(
      {
        ...(goal ? { id: goal.id } : {}),
        input: { name, targetMinor, targetDate: targetDate || null, icon, photoDataUrl: photo },
      },
      {
        onSuccess: (id) => {
          toast({ message: goal ? strings.goals.updated : strings.goals.created });
          onSaved(id);
        },
      },
    );
  }

  return (
    <form noValidate onSubmit={onSubmit} className="flex flex-col gap-5">
      <TextField
        label={s.name}
        data-autofocus
        maxLength={60}
        autoComplete="off"
        value={name}
        onChange={(e) => setName(e.target.value)}
        error={shown(errors.name)}
      />

      <AmountField
        label={s.target}
        amountText={amountText}
        onAmountChange={setAmountText}
        currency={baseCurrency}
        onCurrencyChange={() => {}}
        currencyLocked
        money={money}
        tone="savings"
        error={shown(errors.target)}
      />

      <TextField
        label={s.targetDate}
        hint={strings.common.optional}
        type="date"
        value={targetDate}
        onChange={(e) => setTargetDate(e.target.value)}
        error={shown(errors.date)}
      />

      <div className="flex items-center gap-4">
        <GoalBadge icon={icon} photo={shownPhoto} size="lg" />
        <div className="flex min-w-0 flex-col gap-1.5">
          <div className="flex flex-wrap gap-2">
            <Button variant="secondary" loading={photoState.busy} onClick={() => photoInput.current?.click()}>
              {shownPhoto ? s.changePhoto : s.addPhoto}
            </Button>
            {shownPhoto ? (
              <Button variant="ghost" onClick={() => setPhoto(null)}>
                {s.removePhoto}
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

      {shownPhoto ? null : (
        <fieldset>
          <legend className="mb-2 text-sm font-medium">{s.icon}</legend>
          <div className="grid grid-cols-6 gap-2 wide:grid-cols-9">
            {GOAL_ICON_KEYS.map((key) => (
              <label
                key={key}
                className={cx(
                  'relative grid aspect-square cursor-pointer place-items-center rounded-control bg-control text-fg-muted hover:bg-hover',
                  'has-checked:bg-accent-strong has-checked:text-on-accent',
                  'has-focus-visible:outline-2 has-focus-visible:outline-offset-2 has-focus-visible:outline-accent-strong',
                )}
              >
                <input
                  type="radio"
                  name={iconGroup}
                  value={key}
                  checked={icon === key}
                  onChange={() => setIcon(key)}
                  aria-label={strings.goals.icons[key] ?? key}
                  className="sr-only"
                />
                {createElement(goalIcon(key), { 'aria-hidden': true, className: 'size-5' })}
              </label>
            ))}
          </div>
        </fieldset>
      )}

      {save.isError ? <Alert tone="error">{errorMessage(save.error)}</Alert> : null}
      {online ? null : <Alert tone="error">{strings.offline.cantSave}</Alert>}
      <Button type="submit" size="lg" fullWidth loading={save.isPending} disabled={!online}>
        {goal ? s.save : s.create}
      </Button>
    </form>
  );
}
