import { useId, type InputHTMLAttributes, type ReactNode } from 'react';
import { cx } from '@/lib/cx';
import { Select, type SelectItems } from './Select';

const controlClass =
  'block w-full rounded-control border border-control-border bg-surface px-3.5 text-base text-fg ' +
  'placeholder:text-fg-muted aria-invalid:border-expense-strong disabled:opacity-60';

type FieldShellProps = {
  id: string;
  /** For controls that aren't form elements (Select): the label gets this id, and focuses the control when clicked. */
  labelId?: string;
  label: string;
  hint?: string | undefined;
  error?: string | undefined;
  children: ReactNode;
};

function FieldShell({ id, labelId, label, hint, error, children }: FieldShellProps) {
  return (
    <div className="flex flex-col gap-1.5">
      {labelId ? (
        <label id={labelId} onClick={() => document.getElementById(id)?.focus()} className="text-sm font-medium text-fg">
          {label}
        </label>
      ) : (
        <label htmlFor={id} className="text-sm font-medium text-fg">
          {label}
        </label>
      )}
      {children}
      {hint && !error && (
        <p id={`${id}-hint`} className="text-sm text-fg-muted">
          {hint}
        </p>
      )}
      {error && (
        <p id={`${id}-error`} className="text-sm font-medium text-expense-strong">
          {error}
        </p>
      )}
    </div>
  );
}

function describedBy(id: string, hint?: string, error?: string) {
  return error ? `${id}-error` : hint ? `${id}-hint` : undefined;
}

type TextFieldProps = InputHTMLAttributes<HTMLInputElement> & {
  label: string;
  hint?: string | undefined;
  error?: string | undefined;
};

export function TextField({ label, hint, error, className, id: idProp, ...rest }: TextFieldProps) {
  const generated = useId();
  const id = idProp ?? generated;
  return (
    <FieldShell id={id} label={label} hint={hint} error={error}>
      <input
        id={id}
        aria-invalid={error ? true : undefined}
        aria-describedby={describedBy(id, hint, error)}
        className={cx(controlClass, 'h-12', className)}
        {...rest}
      />
    </FieldShell>
  );
}

type SelectFieldProps = {
  label: string;
  hint?: string | undefined;
  error?: string | undefined;
  value: string;
  onChange: (value: string) => void;
  items: SelectItems;
  /** Shown while no option is chosen. */
  placeholder?: string | undefined;
  disabled?: boolean;
  className?: string;
  id?: string;
};

/** A labelled field with the app's own dropdown (see Select). */
export function SelectField({ label, hint, error, value, onChange, items, placeholder, disabled, className, id: idProp }: SelectFieldProps) {
  const generated = useId();
  const id = idProp ?? `select${generated}`;
  const labelId = `${id}-label`;
  return (
    <FieldShell id={id} labelId={labelId} label={label} hint={hint} error={error}>
      <Select
        id={id}
        labelledBy={labelId}
        describedBy={describedBy(id, hint, error)}
        invalid={Boolean(error)}
        value={value}
        onChange={onChange}
        items={items}
        placeholder={placeholder}
        disabled={disabled ?? false}
        triggerClassName={cx(controlClass, 'h-12', className)}
      />
    </FieldShell>
  );
}
