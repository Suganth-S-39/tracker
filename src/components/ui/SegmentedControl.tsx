import { useId } from 'react';
import { cx } from '@/lib/cx';

type Option<T extends string> = { value: T; label: string };

type SegmentedControlProps<T extends string> = {
  label: string;
  /** Keep the label for screen readers only (when the options speak for themselves). */
  hideLabel?: boolean;
  value: T;
  options: ReadonlyArray<Option<T>>;
  onChange: (value: T) => void;
};

/** A row of mutually exclusive choices, built on native radios for keyboard and screen readers. */
export function SegmentedControl<T extends string>({ label, hideLabel = false, value, options, onChange }: SegmentedControlProps<T>) {
  const name = useId();
  return (
    <fieldset>
      <legend className={hideLabel ? 'sr-only' : 'mb-2 text-sm font-medium'}>{label}</legend>
      <div className="grid auto-cols-fr grid-flow-col gap-1 rounded-full bg-control p-1">
        {options.map((option) => (
          <label
            key={option.value}
            className={cx(
              'relative flex h-9 cursor-pointer items-center justify-center rounded-full text-sm font-semibold',
              'has-focus-visible:outline-2 has-focus-visible:outline-accent-strong',
              option.value === value ? 'bg-surface text-fg shadow-card' : 'text-fg-muted hover:text-fg',
            )}
          >
            <input
              type="radio"
              name={name}
              value={option.value}
              checked={option.value === value}
              onChange={() => onChange(option.value)}
              className="sr-only"
            />
            {option.label}
          </label>
        ))}
      </div>
    </fieldset>
  );
}
