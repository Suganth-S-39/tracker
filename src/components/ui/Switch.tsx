import { useId } from 'react';
import { cx } from '@/lib/cx';

type SwitchProps = {
  label: string;
  hint?: string;
  checked: boolean;
  onChange: (checked: boolean) => void;
};

/** An Apple-style on/off switch (role="switch"). Only the knob's transform animates. */
export function Switch({ label, hint, checked, onChange }: SwitchProps) {
  const id = useId();
  return (
    <div className="flex items-center justify-between gap-4">
      <div className="min-w-0">
        <label htmlFor={id} className="font-medium">
          {label}
        </label>
        {hint ? (
          <p id={`${id}-hint`} className="text-sm text-fg-muted">
            {hint}
          </p>
        ) : null}
      </div>
      <button
        id={id}
        type="button"
        role="switch"
        aria-checked={checked}
        aria-describedby={hint ? `${id}-hint` : undefined}
        onClick={() => onChange(!checked)}
        className={cx(
          'relative inline-flex h-8 w-13 shrink-0 items-center rounded-full p-0.5',
          checked ? 'bg-accent-strong' : 'bg-control-border',
        )}
      >
        <span
          aria-hidden="true"
          className={cx(
            'size-7 rounded-full bg-surface shadow-card transition-transform duration-200',
            checked ? 'translate-x-5' : 'translate-x-0',
          )}
        />
      </button>
    </div>
  );
}
