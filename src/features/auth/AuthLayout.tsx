import type { ReactNode } from 'react';
import { BrandMark } from '@/components/layout/BrandMark';
import { Card } from '@/components/ui/Card';
import { usePageTitle } from '@/lib/usePageTitle';

/** Centered card used by the sign-in, sign-up, password and onboarding screens. */
export function AuthLayout({ title, subtitle, children }: { title: string; subtitle?: string; children: ReactNode }) {
  usePageTitle(title);
  return (
    <div className="flex min-h-dvh flex-col items-center px-4 pt-safe pb-safe">
      <div className="mt-10 mb-8 wide:mt-16">
        <BrandMark />
      </div>
      <main className="w-full max-w-md">
        <Card className="p-6 wide:p-8">
          <h1 className="text-[1.75rem] leading-tight font-bold">{title}</h1>
          {subtitle ? <p className="mt-1.5 text-fg-muted">{subtitle}</p> : null}
          <div className="mt-6">{children}</div>
        </Card>
      </main>
    </div>
  );
}
