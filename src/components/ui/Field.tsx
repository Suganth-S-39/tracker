import { useId, type InputHTMLAttributes, type ReactNode, type SelectHTMLAttributes } from 'react';
import { cx } from '@/lib/cx';

const controlClass =
  'block w-full rounded-control border border-control-border bg-surface px-3.5 text-base text-fg ' +
  'placeholder:text-fg-muted aria-invalid:border-expense-strong disabled:opacity-60';

type FieldShellProps = {
  id: string;
  label: string;
  hint?: string | undefined;
  error?: string | undefined;
  children: ReactNode;
};

function FieldShell({ id, label, hint, error, children }: FieldShellProps) {
  return (
    <div className="flex flex-col gap-1.5">
      <label htmlFor={id} className="text-sm font-medium text-fg">
        {label}
      </label>
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

type SelectFieldProps = SelectHTMLAttributes<HTMLSelectElement> & {
  label: string;
  hint?: string | undefined;
  error?: string | undefined;
};

export function SelectField({ label, hint, error, className, id: idProp, children, ...rest }: SelectFieldProps) {
  const generated = useId();
  const id = idProp ?? generated;
  return (
    <FieldShell id={id} label={label} hint={hint} error={error}>
      <select
        id={id}
        aria-invalid={error ? true : undefined}
        aria-describedby={describedBy(id, hint, error)}
        className={cx(controlClass, 'h-12', className)}
        {...rest}
      >
        {children}
      </select>
    </FieldShell>
  );
}
