import { useEffect } from 'react';
import { Outlet } from 'react-router';
import { preloadMainRoutes } from '@/app/preloadRoutes';
import { ToastProvider } from '@/components/ui/ToastProvider';
import { useTimezoneSync } from '@/features/profile/useTimezoneSync';
import { MonthProvider } from '@/features/month/MonthProvider';
import { ThemeProfileSync } from '@/features/settings/ThemeProfileSync';
import { TransactionEditorProvider } from '@/features/transactions/TransactionEditorProvider';
import { useTransactionEditor } from '@/features/transactions/editor-context';
import { useOnlineStatus } from '@/lib/hooks';
import { strings } from '@/strings/en';
import { BottomNav } from './BottomNav';
import { OfflineBanner } from './OfflineBanner';
import { RouteAnnouncer } from './RouteAnnouncer';
import { Sidebar } from './Sidebar';

function ShellLayout() {
  const online = useOnlineStatus();
  const editor = useTransactionEditor();
  useTimezoneSync();
  useEffect(preloadMainRoutes, []);

  return (
    <div className="min-h-dvh">
      <ThemeProfileSync />
      <RouteAnnouncer />
      <a
        href="#main"
        className="sr-only focus:not-sr-only focus:fixed focus:top-3 focus:left-3 focus:z-50 focus:rounded-control focus:bg-surface focus:px-4 focus:py-2 focus:shadow-raised"
      >
        {strings.app.skipToContent}
      </a>
      <Sidebar onAdd={() => editor.openCreate()} addDisabled={!online} />
      <div className="wide:pl-60">
        <OfflineBanner />
        <main id="main" tabIndex={-1} className="mx-auto w-full max-w-5xl px-4 pt-page pb-28 outline-none wide:px-8 wide:pb-12">
          <Outlet />
        </main>
      </div>
      <BottomNav onAdd={() => editor.openCreate()} addDisabled={!online} />
    </div>
  );
}

/** Signed-in, onboarded layout: bottom bar on phones, sidebar on wide screens. */
export function AppShell() {
  return (
    <MonthProvider>
      <ToastProvider>
        <TransactionEditorProvider>
          <ShellLayout />
        </TransactionEditorProvider>
      </ToastProvider>
    </MonthProvider>
  );
}
