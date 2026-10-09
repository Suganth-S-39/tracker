/**
 * Loads the main tabs' code once the app is idle, so the first tap on each tab switches at once
 * instead of waiting for that screen's chunk (the same modules router.tsx loads lazily). A failed
 * preload (offline, say) changes nothing: the screen then loads on demand as before.
 */
export function preloadMainRoutes(): void {
  const load = () => {
    for (const preload of [
      () => import('@/features/home/HomePage'),
      () => import('@/features/transactions/TransactionsPage'),
      () => import('@/features/budgets/BudgetsPage'),
      () => import('@/features/reports/ReportsPage'),
      () => import('@/features/settings/SettingsPage'),
    ]) {
      preload().catch(() => {});
    }
  };
  // Safari has no requestIdleCallback.
  if (typeof window.requestIdleCallback === 'function') window.requestIdleCallback(load, { timeout: 4000 });
  else setTimeout(load, 2000);
}
