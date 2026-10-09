import { keepPreviousData, useQuery } from '@tanstack/react-query';
import type { MonthKey } from '@/domain/dates';
import { queryKeys } from '@/lib/queryClient';
import { supabase } from '@/lib/supabase';

export type CategorySpending = { categoryId: string; spentMinor: number };
export type MonthTotals = { month: MonthKey; incomeMinor: number; expenseMinor: number };

/** Expense totals per category for a month, largest first (base currency, SQL). */
export function useSpendingByCategory(month: MonthKey, excludeIou: boolean) {
  return useQuery({
    queryKey: queryKeys.transactions.byCategory(month, excludeIou),
    // Switching month keeps the current content on screen (dimmed) until the new month loads,
    // instead of flashing loading placeholders.
    placeholderData: keepPreviousData,
    queryFn: async (): Promise<CategorySpending[]> => {
      const { data, error } = await supabase.rpc('spending_by_category', {
        p_month: `${month}-01`,
        p_exclude_iou: excludeIou,
      });
      if (error) throw error;
      return data.map((row) => ({ categoryId: row.category_id, spentMinor: row.spent_minor }));
    },
  });
}

/** Income and expense per month for a range of months, oldest first, empty months included. */
export function useMonthlyTotals(from: MonthKey, to: MonthKey, excludeIou: boolean) {
  return useQuery({
    queryKey: queryKeys.transactions.monthly(from, to, excludeIou),
    // Switching month keeps the current content on screen (dimmed) until the new month loads,
    // instead of flashing loading placeholders.
    placeholderData: keepPreviousData,
    queryFn: async (): Promise<MonthTotals[]> => {
      const { data, error } = await supabase.rpc('monthly_totals', {
        p_from_month: `${from}-01`,
        p_to_month: `${to}-01`,
        p_exclude_iou: excludeIou,
      });
      if (error) throw error;
      return data.map((row) => ({
        month: row.month.slice(0, 7),
        incomeMinor: row.income_minor,
        expenseMinor: row.expense_minor,
      }));
    },
  });
}
