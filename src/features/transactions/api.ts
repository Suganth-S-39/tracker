import {
  useInfiniteQuery,
  useMutation,
  useQuery,
  useQueryClient,
  type InfiniteData,
} from '@tanstack/react-query';
import { monthRange, type IsoDate, type MonthKey } from '@/domain/dates';
import { queryKeys } from '@/lib/queryClient';
import { supabase, type Database } from '@/lib/supabase';

type ListRow = Database['public']['Functions']['list_transactions']['Returns'][number];

/** A transaction as listed. Rates are exact decimal strings. */
export type Transaction = Omit<ListRow, 'payee' | 'note' | 'iou_id' | 'recurring_rule_id'> & {
  // The generated types don't know which RETURNS TABLE columns are nullable.
  payee: string | null;
  note: string | null;
  iou_id: string | null;
  recurring_rule_id: string | null;
};

export type TransactionFilters = {
  type?: 'expense' | 'income';
  categoryId?: string;
  from?: IsoDate;
  to?: IsoDate;
  search?: string;
};

type Cursor = { date: string; createdAt: string; id: string };

export const PAGE_SIZE = 50;

async function listTransactions(filters: TransactionFilters, limit: number, cursor: Cursor | null): Promise<Transaction[]> {
  const { data, error } = await supabase.rpc('list_transactions', {
    p_limit: limit,
    p_cursor_date: cursor?.date,
    p_cursor_created_at: cursor?.createdAt,
    p_cursor_id: cursor?.id,
    p_type: filters.type,
    p_category_id: filters.categoryId,
    p_from: filters.from,
    p_to: filters.to,
    p_search: filters.search?.trim() || undefined,
  });
  if (error) throw error;
  return data;
}

/** The Transactions page: pages of 50, newest first, loaded as the user scrolls. */
export function useTransactionPages(filters: TransactionFilters) {
  return useInfiniteQuery({
    queryKey: queryKeys.transactions.list(filters),
    initialPageParam: null as Cursor | null,
    queryFn: ({ pageParam }) => listTransactions(filters, PAGE_SIZE, pageParam),
    getNextPageParam: (lastPage): Cursor | undefined => {
      const last = lastPage.at(-1);
      if (lastPage.length < PAGE_SIZE || !last) return undefined;
      return { date: last.date, createdAt: last.created_at, id: last.id };
    },
  });
}

/** The latest few transactions in a month (Home). */
export function useRecentTransactions(month: MonthKey, limit = 5) {
  return useQuery({
    queryKey: queryKeys.transactions.recent(month),
    queryFn: () => {
      const { first, last } = monthRange(month);
      return listTransactions({ from: first, to: last }, limit, null);
    },
  });
}

/** Whether the user has any transactions at all (for the first-run welcome). */
export function useHasAnyTransactions() {
  return useQuery({
    queryKey: queryKeys.transactions.any,
    queryFn: async () => (await listTransactions({}, 1, null)).length > 0,
  });
}

export type MonthSummary = { income_minor: number; expense_minor: number; net_minor: number };

/** Income, expense and net for a month, in base minor units (IOU-linked excluded, in SQL). */
export function useMonthSummary(month: MonthKey) {
  return useQuery({
    queryKey: queryKeys.transactions.summary(month),
    queryFn: async (): Promise<MonthSummary> => {
      const { data, error } = await supabase.rpc('month_summary', { p_month: `${month}-01` });
      if (error) throw error;
      return data[0] ?? { income_minor: 0, expense_minor: 0, net_minor: 0 };
    },
  });
}

export function useRecentPayees() {
  return useQuery({
    queryKey: queryKeys.transactions.payees,
    staleTime: 5 * 60_000,
    queryFn: async (): Promise<string[]> => {
      const { data, error } = await supabase.rpc('recent_payees', {});
      if (error) throw error;
      return data.map((row) => row.payee);
    },
  });
}

export type TransactionInput = {
  type: 'expense' | 'income';
  categoryId: string;
  date: IsoDate;
  originalAmountMinor: number;
  originalCurrency: string;
  exchangeRate: string;
  baseAmountMinor: number;
  payee: string;
  note: string;
  /** Repeat (new transactions only): creates the recurring rule with this as its first entry. */
  repeat?: 'daily' | 'weekly' | 'monthly' | 'yearly' | undefined;
};

export function useSaveTransaction() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, input }: { id?: string; input: TransactionInput }) => {
      const args = {
        p_type: input.type,
        p_category_id: input.categoryId,
        p_date: input.date,
        p_original_amount_minor: input.originalAmountMinor,
        p_original_currency: input.originalCurrency,
        p_exchange_rate: input.exchangeRate,
        p_base_amount_minor: input.baseAmountMinor,
        p_payee: input.payee,
        p_note: input.note,
      };
      const { data, error } = id
        ? await supabase.rpc('update_transaction', { p_id: id, ...args })
        : await supabase.rpc('create_transaction', { ...args, ...(input.repeat ? { p_repeat: input.repeat } : {}) });
      if (error) throw error;
      return data;
    },
    onSettled: () => {
      void queryClient.invalidateQueries({ queryKey: queryKeys.transactions.all });
      void queryClient.invalidateQueries({ queryKey: queryKeys.recurring });
    },
  });
}

/** Removes a transaction from every cached list immediately, so deletes feel instant. */
function removeFromCaches(queryClient: ReturnType<typeof useQueryClient>, id: string) {
  queryClient.setQueriesData<InfiniteData<Transaction[]>>({ queryKey: ['tx', 'list'] }, (old) =>
    old ? { ...old, pages: old.pages.map((page) => page.filter((t) => t.id !== id)) } : old,
  );
  queryClient.setQueriesData<Transaction[]>({ queryKey: ['tx', 'recent'] }, (old) => old?.filter((t) => t.id !== id));
}

/** Soft delete (sets deleted_at), so it can be undone. */
export function useDeleteTransaction() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase
        .from('transactions')
        .update({ deleted_at: new Date().toISOString() })
        .eq('id', id);
      if (error) throw error;
    },
    onMutate: async (id) => {
      await queryClient.cancelQueries({ queryKey: queryKeys.transactions.all });
      removeFromCaches(queryClient, id);
    },
    onSettled: () => queryClient.invalidateQueries({ queryKey: queryKeys.transactions.all }),
  });
}

export function useRestoreTransaction() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from('transactions').update({ deleted_at: null }).eq('id', id);
      if (error) throw error;
    },
    onSettled: () => queryClient.invalidateQueries({ queryKey: queryKeys.transactions.all }),
  });
}
