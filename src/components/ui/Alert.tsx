import { CircleAlert, CircleCheck } from 'lucide-react';
import type { ReactNode } from 'react';
import { cx } from '@/lib/cx';

type Tone = 'error' | 'success';

/** Inline message. Errors are announced immediately (role=alert); success politely. */
export function Alert({ tone, children, className }: { tone: Tone; children: ReactNode; className?: string }) {
  const Icon = tone === 'error' ? CircleAlert : CircleCheck;
  return (
    <div
      role={tone === 'error' ? 'alert' : 'status'}
      className={cx(
        'flex items-start gap-2.5 rounded-control px-3.5 py-3 text-sm font-medium',
        tone === 'error' ? 'bg-expense-tint text-expense-strong' : 'bg-accent-tint text-accent-strong',
        className,
      )}
    >
      <Icon aria-hidden="true" className="mt-px size-4.5 shrink-0" />
      <div className="text-fg">{children}</div>
    </div>
  );
}
