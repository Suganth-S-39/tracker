import { keepPreviousData, useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import type { MonthKey } from '@/domain/dates';
import { queryKeys } from '@/lib/queryClient';
import { supabase } from '@/lib/supabase';

export type BudgetStatus = {
  /** Null for the overall budget. */
  categoryId: string | null;
  amountMinor: number;
  spentMinor: number;
  /** The month the budget was set in (it carries forward from there). */
  setForMonth: MonthKey;
};

/** Effective budgets for a month and what has been spent against them (carry-forward in SQL). */
export function useBudgetStatus(month: MonthKey) {
  return useQuery({
    queryKey: queryKeys.transactions.budgets(month),
    // Switching month keeps the current content on screen (dimmed) until the new month loads,
    // instead of flashing loading placeholders.
    placeholderData: keepPreviousData,
    queryFn: async (): Promise<BudgetStatus[]> => {
      const { data, error } = await supabase.rpc('budget_status', { p_month: `${month}-01` });
      if (error) throw error;
      return data.map((row) => ({
        categoryId: (row.category_id as string | null) ?? null,
        amountMinor: row.amount_minor,
        spentMinor: row.spent_minor,
        setForMonth: row.set_for_month.slice(0, 7),
      }));
    },
  });
}

/** Sets (or, with 0, clears) a budget from `month` onward. */
export function useSetBudget() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (input: { month: MonthKey; categoryId: string | null; amountMinor: number }) => {
      const { error } = await supabase.rpc('set_budget', {
        p_month: `${input.month}-01`,
        // The generated types don't know this parameter accepts null (overall budget).
        p_category_id: input.categoryId as string,
        p_amount_minor: input.amountMinor,
      });
      if (error) throw error;
    },
    onSettled: () => queryClient.invalidateQueries({ queryKey: queryKeys.transactions.allBudgets }),
  });
}
