import { CloudAlert } from 'lucide-react';
import { errorMessage } from '@/lib/errors';
import { cx } from '@/lib/cx';
import { strings } from '@/strings/en';
import { Button } from './Button';

type ErrorStateProps = {
  error: unknown;
  onRetry?: () => void;
  fullScreen?: boolean;
};

export function ErrorState({ error, onRetry, fullScreen = false }: ErrorStateProps) {
  return (
    <div
      role="alert"
      className={cx('flex flex-col items-center px-6 py-12 text-center', fullScreen && 'min-h-dvh justify-center')}
    >
      <div className="mb-4 grid size-14 place-items-center rounded-full bg-expense-tint text-expense-strong">
        <CloudAlert aria-hidden="true" className="size-7" />
      </div>
      <p className="max-w-sm font-medium">{errorMessage(error)}</p>
      {onRetry ? (
        <Button variant="secondary" className="mt-5" onClick={onRetry}>
          {strings.common.retry}
        </Button>
      ) : null}
    </div>
  );
}
