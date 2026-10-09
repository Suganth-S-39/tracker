import type { LucideIcon } from 'lucide-react';
import type { ReactNode } from 'react';

type EmptyStateProps = {
  icon: LucideIcon;
  title: string;
  body?: string;
  action?: ReactNode;
};

export function EmptyState({ icon: Icon, title, body, action }: EmptyStateProps) {
  return (
    <div className="flex flex-col items-center px-6 py-12 text-center">
      <div className="mb-4 grid size-14 place-items-center rounded-full bg-accent-tint text-accent-strong">
        <Icon aria-hidden="true" className="size-7" />
      </div>
      <h2 className="text-lg font-bold">{title}</h2>
      {body ? <p className="mt-1 max-w-sm text-fg-muted">{body}</p> : null}
      {action ? <div className="mt-5">{action}</div> : null}
    </div>
  );
}
