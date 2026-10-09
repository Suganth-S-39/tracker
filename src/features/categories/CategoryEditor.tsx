import { useId, useState, type FormEvent } from 'react';
import { Alert } from '@/components/ui/Alert';
import { Button } from '@/components/ui/Button';
import { TextField } from '@/components/ui/Field';
import { SegmentedControl } from '@/components/ui/SegmentedControl';
import { errorMessage } from '@/lib/errors';
import { useOnlineStatus } from '@/lib/hooks';
import { cx } from '@/lib/cx';
import { strings } from '@/strings/en';
import { useSaveCategory, type Category, type TransactionType } from './api';
import { CategoryGlyph } from './CategoryIcon';
import { PICKABLE_ICON_KEYS } from './icons';

const s = strings.categories;

/** Form for a new or existing category: name, type (new only; it can't change later) and icon. */
export function CategoryEditor({ category, onDone }: { category?: Category | undefined; onDone: () => void }) {
  const [name, setName] = useState(category?.name ?? '');
  const [kind, setKind] = useState<TransactionType>(category?.kind ?? 'expense');
  const [icon, setIcon] = useState(category?.icon ?? 'tag');
  const [showErrors, setShowErrors] = useState(false);
  const save = useSaveCategory();
  const online = useOnlineStatus();
  const iconGroup = useId();

  const nameError = name.trim().length === 0 || name.trim().length > 40 ? s.errors.name : undefined;

  function onSubmit(event: FormEvent) {
    event.preventDefault();
    setShowErrors(true);
    if (nameError) return;
    save.mutate({ ...(category ? { id: category.id } : {}), name, icon, kind }, { onSuccess: onDone });
  }

  return (
    <form noValidate onSubmit={onSubmit} className="flex flex-col gap-5">
      <TextField
        label={s.editor.name}
        data-autofocus
        maxLength={40}
        value={name}
        onChange={(e) => setName(e.target.value)}
        error={showErrors ? nameError : undefined}
      />
      {category ? null : (
        <SegmentedControl
          label={s.editor.kind}
          value={kind}
          onChange={setKind}
          options={[
            { value: 'expense', label: strings.form.kindTabs.expense },
            { value: 'income', label: strings.form.kindTabs.income },
            { value: 'savings', label: strings.form.kindTabs.savings },
            { value: 'investment', label: strings.form.kindTabs.investment },
          ]}
        />
      )}
      <fieldset>
        <legend className="mb-2 text-sm font-medium">{s.editor.icon}</legend>
        <div className="grid grid-cols-6 gap-2 wide:grid-cols-8">
          {PICKABLE_ICON_KEYS.map((key) => {
            return (
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
                  aria-label={s.icons[key] ?? key}
                  className="sr-only"
                />
                <CategoryGlyph icon={key} className="size-5" />
              </label>
            );
          })}
        </div>
      </fieldset>
      {save.isError ? <Alert tone="error">{errorMessage(save.error)}</Alert> : null}
      <Button type="submit" size="lg" fullWidth loading={save.isPending} disabled={!online}>
        {s.editor.save}
      </Button>
    </form>
  );
}
