import { keepPreviousData, useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { todayLocal, type IsoDate } from '@/domain/dates';
import { queryKeys } from '@/lib/queryClient';
import { supabase, type Database } from '@/lib/supabase';

type GoalRow = Database['public']['Functions']['goal_list']['Returns'][number];

/** A goal with its progress (public.goal_list). Amounts are base-currency minor units. */
export type Goal = Omit<
  GoalRow,
  'target_date' | 'bought_on' | 'purchase_transaction_id' | 'closing_transaction_id' | 'first_added_on'
> & {
  // The generated types don't know which RETURNS TABLE columns are nullable.
  target_date: IsoDate | null;
  bought_on: IsoDate | null;
  purchase_transaction_id: string | null;
  closing_transaction_id: string | null;
  first_added_on: IsoDate | null;
};

/** Every goal, open ones first (soonest date first), then bought ones. */
export function useGoals({ enabled = true }: { enabled?: boolean } = {}) {
  const today = todayLocal();
  return useQuery({
    enabled,
    queryKey: queryKeys.transactions.goals(today),
    queryFn: async (): Promise<Goal[]> => {
      const { data, error } = await supabase.rpc('goal_list', { p_today: today });
      if (error) throw error;
      return data;
    },
  });
}

/** Goals that are still being saved for. */
export function openGoals(goals: readonly Goal[]): Goal[] {
  return goals.filter((goal) => goal.bought_on === null);
}

/**
 * Goal photos by goal id. Fetched apart from the goal list, which refreshes after every
 * transaction: photos are up to ~50 KB each and change rarely, so they load once and again only
 * when a goal that has one is edited (its updated_at is part of the key).
 */
export function useGoalPhotos(goals: readonly Goal[] | undefined) {
  const withPhotos = (goals ?? []).filter((goal) => goal.has_photo);
  const version = withPhotos.map((goal) => `${goal.id}@${goal.updated_at}`).join(',');
  return useQuery({
    queryKey: queryKeys.goalPhotos(version),
    enabled: withPhotos.length > 0,
    staleTime: Infinity,
    // While an edited photo loads, keep showing the others.
    placeholderData: keepPreviousData,
    queryFn: async (): Promise<Record<string, string>> => {
      const { data, error } = await supabase
        .from('goals')
        .select('id, photo_data_url')
        .in(
          'id',
          withPhotos.map((goal) => goal.id),
        );
      if (error) throw error;
      return Object.fromEntries(data.flatMap((row) => (row.photo_data_url ? [[row.id, row.photo_data_url]] : [])));
    },
  });
}

export type GoalInput = {
  name: string;
  targetMinor: number;
  targetDate: IsoDate | null;
  icon: string;
  /** A new photo (data URL), null to remove it, or undefined to leave it as it is. */
  photoDataUrl?: string | null | undefined;
};

function invalidate(queryClient: ReturnType<typeof useQueryClient>) {
  return queryClient.invalidateQueries({ queryKey: queryKeys.transactions.all });
}

/** Creates or edits a goal; resolves to its id. */
export function useSaveGoal() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, input }: { id?: string; input: GoalInput }): Promise<string> => {
      const values = {
        name: input.name.trim(),
        target_minor: input.targetMinor,
        target_date: input.targetDate,
        icon: input.icon,
        ...(input.photoDataUrl === undefined ? {} : { photo_data_url: input.photoDataUrl }),
      };
      if (id) {
        const { error } = await supabase.from('goals').update(values).eq('id', id);
        if (error) throw error;
        return id;
      }
      const { data, error } = await supabase.from('goals').insert(values).select('id').single();
      if (error) throw error;
      return data.id;
    },
    onSettled: () => invalidate(queryClient),
  });
}

/** Soft delete; `restore` brings it back (Undo). */
export function useSetGoalDeleted() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, deleted }: { id: string; deleted: boolean }) => {
      const { error } = await supabase
        .from('goals')
        .update({ deleted_at: deleted ? new Date().toISOString() : null })
        .eq('id', id);
      if (error) throw error;
    },
    onSettled: () => invalidate(queryClient),
  });
}

/** Takes money out of a goal (base currency); resolves to the withdrawal's id, for Undo. */
export function useTakeFromGoal() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (input: { goalId: string; amountMinor: number; date: IsoDate; note: string }): Promise<string> => {
      const { data, error } = await supabase.rpc('take_from_goal', {
        p_goal_id: input.goalId,
        p_amount_minor: input.amountMinor,
        p_date: input.date,
        p_note: input.note,
      });
      if (error) throw error;
      return data;
    },
    onSettled: () => invalidate(queryClient),
  });
}

/** Deletes a withdrawal from an open goal (or restores it, for Undo). */
export function useSetWithdrawalDeleted() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, deleted }: { id: string; deleted: boolean }) => {
      const { error } = await supabase.rpc('set_goal_withdrawal_deleted', { p_id: id, p_deleted: deleted });
      if (error) throw error;
    },
    onSettled: () => invalidate(queryClient),
  });
}

/** "I bought it": empties the goal and records what it cost, in one call. */
export function useCompleteGoal() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (input: {
      goalId: string;
      categoryId: string;
      date: IsoDate;
      amountMinor: number;
      payee: string;
      note: string;
    }) => {
      const { error } = await supabase.rpc('complete_goal', {
        p_goal_id: input.goalId,
        p_category_id: input.categoryId,
        p_date: input.date,
        p_amount_minor: input.amountMinor,
        p_payee: input.payee,
        p_note: input.note,
      });
      if (error) throw error;
    },
    onSettled: () => invalidate(queryClient),
  });
}

/** "Not bought yet": removes the purchase and puts the money back in the goal. */
export function useReopenGoal() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (goalId: string) => {
      const { error } = await supabase.rpc('reopen_goal', { p_goal_id: goalId });
      if (error) throw error;
    },
    onSettled: () => invalidate(queryClient),
  });
}
