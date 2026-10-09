import type { ReactNode } from 'react';
import { usePageTitle } from '@/lib/usePageTitle';

export function PageHeader({ title, actions }: { title: string; actions?: ReactNode }) {
  usePageTitle(title);
  return (
    <header className="flex min-h-14 items-center justify-between gap-3 pt-safe">
      <h1 className="text-[2rem] leading-tight font-bold">{title}</h1>
      {actions ? <div className="flex items-center gap-2">{actions}</div> : null}
    </header>
  );
}
