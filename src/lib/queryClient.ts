import { QueryClient } from '@tanstack/react-query';

// Cached server data makes switching tabs instant; stale data refetches in the background.
// Queries pause while offline (cached data stays on screen under the offline banner).
// Mutations use networkMode 'always': TanStack's default would pause a write made offline and
// replay it on reconnect, which is queueing, and the app must never queue writes (spec section 5).
// Offline writes fail at once; write buttons are disabled while offline anyway.
export const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 30_000,
      retry: 1,
      refetchOnWindowFocus: true,
    },
    mutations: {
      retry: 0,
      networkMode: 'always',
    },
  },
});

export const queryKeys = {
  profile: (userId: string | undefined) => ['profile', userId] as const,
  currencies: ['currencies'] as const,
  categories: ['categories'] as const,
  rate: (from: string, to: string) => ['rate', from, to] as const,
  recurring: ['recurring'] as const,
  ious: {
    all: ['ious'] as const,
    list: ['ious', 'list'] as const,
    detail: (id: string) => ['ious', 'detail', id] as const,
    repayments: (id: string) => ['ious', 'repayments', id] as const,
    totals: ['ious', 'totals'] as const,
  },
  // Everything derived from transactions shares the 'tx' prefix, so one invalidation after a
  // write refreshes lists, totals and payee suggestions.
  transactions: {
    all: ['tx'] as const,
    list: (filters: object) => ['tx', 'list', filters] as const,
    recent: (month: string) => ['tx', 'recent', month] as const,
    any: ['tx', 'any'] as const,
    summary: (month: string) => ['tx', 'summary', month] as const,
    payees: ['tx', 'payees'] as const,
    // Budget usage and reports are derived from transactions too.
    budgets: (month: string) => ['tx', 'budgets', month] as const,
    allBudgets: ['tx', 'budgets'] as const,
    byCategory: (month: string, excludeIou: boolean) => ['tx', 'byCategory', month, excludeIou] as const,
    monthly: (from: string, to: string, excludeIou: boolean) => ['tx', 'monthly', from, to, excludeIou] as const,
  },
};
