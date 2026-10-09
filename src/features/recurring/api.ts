import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { queryKeys } from '@/lib/queryClient';
import { supabase, type Enums, type Tables } from '@/lib/supabase';
import type { TransactionType } from '@/features/transactions/kinds';

export type RecurringRule = Tables<'recurring_rules'>;
export type Frequency = Enums<'recurrence_frequency'>;

/** The user's recurring rules: active first, then by next date. */
export function useRecurringRules() {
  return useQuery({
    queryKey: queryKeys.recurring,
    queryFn: async (): Promise<RecurringRule[]> => {
      const { data, error } = await supabase
        .from('recurring_rules')
        .select('*')
        .is('deleted_at', null)
        .order('is_active', { ascending: false })
        .order('next_due_date');
      if (error) throw error;
      return data;
    },
  });
}

function useInvalidate() {
  const queryClient = useQueryClient();
  return () => {
    void queryClient.invalidateQueries({ queryKey: queryKeys.recurring });
    void queryClient.invalidateQueries({ queryKey: queryKeys.transactions.all });
  };
}

export type RuleInput = {
  type: TransactionType;
  categoryId: string;
  amountMinor: number;
  currency: string;
  frequency: Frequency;
  nextDueDate: string;
  payee: string;
  note: string;
};

/** Changes apply to occurrences generated from now on (past ones are separate rows). */
export function useUpdateRecurringRule() {
  const invalidate = useInvalidate();
  return useMutation({
    mutationFn: async ({ id, input }: { id: string; input: RuleInput }) => {
      const { error } = await supabase.rpc('update_recurring_rule', {
        p_id: id,
        p_type: input.type,
        p_category_id: input.categoryId,
        p_amount_minor: input.amountMinor,
        p_currency: input.currency,
        p_frequency: input.frequency,
        p_next_due_date: input.nextDueDate,
        p_payee: input.payee,
        p_note: input.note,
      });
      if (error) throw error;
    },
    onSettled: invalidate,
  });
}

/** Pausing stops new occurrences; resuming skips the paused period (in SQL). */
export function useSetRecurringRuleActive() {
  const invalidate = useInvalidate();
  return useMutation({
    mutationFn: async ({ id, active }: { id: string; active: boolean }) => {
      const { error } = await supabase.rpc('set_recurring_rule_active', { p_id: id, p_active: active });
      if (error) throw error;
    },
    onSettled: invalidate,
  });
}

export function useDeleteRecurringRule() {
  const invalidate = useInvalidate();
  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.rpc('delete_recurring_rule', { p_id: id });
      if (error) throw error;
    },
    onSettled: invalidate,
  });
}
