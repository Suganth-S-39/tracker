import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { queryKeys } from '@/lib/queryClient';
import { supabase, type Database, type Enums } from '@/lib/supabase';

type NonNull<T> = { [K in keyof T]-?: Exclude<T[K], null> };

type BalanceRow = Database['public']['Views']['iou_balances']['Row'];
type RepaymentRow = Database['public']['Views']['iou_repayment_details']['Row'];

export type IouDirection = Enums<'iou_direction'>;

/**
 * One IOU with its derived balance (public.iou_balances). View columns are typed nullable by
 * the generator; only due_date and note can actually be null.
 */
export type Iou = Omit<NonNull<BalanceRow>, 'due_date' | 'note' | 'status'> & {
  due_date: string | null;
  note: string | null;
  status: 'open' | 'settled';
};

export type Repayment = Omit<NonNull<RepaymentRow>, 'note'> & { note: string | null };

const toIou = (row: BalanceRow) => row as Iou;
const toRepayment = (row: RepaymentRow) => row as Repayment;

/** All IOUs, open ones first, newest first. */
export function useIous() {
  return useQuery({
    queryKey: queryKeys.ious.list,
    queryFn: async (): Promise<Iou[]> => {
      const { data, error } = await supabase
        .from('iou_balances')
        .select('*')
        .order('status')
        .order('date', { ascending: false })
        .order('created_at', { ascending: false });
      if (error) throw error;
      return data.map(toIou);
    },
  });
}

export function useIou(id: string) {
  return useQuery({
    queryKey: queryKeys.ious.detail(id),
    queryFn: async (): Promise<Iou | null> => {
      const { data, error } = await supabase.from('iou_balances').select('*').eq('id', id).maybeSingle();
      if (error) throw error;
      return data ? toIou(data) : null;
    },
  });
}

export function useRepayments(iouId: string) {
  return useQuery({
    queryKey: queryKeys.ious.repayments(iouId),
    queryFn: async (): Promise<Repayment[]> => {
      const { data, error } = await supabase
        .from('iou_repayment_details')
        .select('*')
        .eq('iou_id', iouId)
        .order('date', { ascending: false })
        .order('created_at', { ascending: false });
      if (error) throw error;
      return data.map(toRepayment);
    },
  });
}

export type IouTotals = { owedToMeMinor: number; iOweMinor: number; owedApproximate: boolean; oweApproximate: boolean };

/** "You're owed" / "You owe" in the base currency (converted in SQL). */
export function useIouTotals() {
  return useQuery({
    queryKey: queryKeys.ious.totals,
    queryFn: async (): Promise<IouTotals> => {
      const { data, error } = await supabase.rpc('iou_totals');
      if (error) throw error;
      const row = data[0];
      return {
        owedToMeMinor: row?.owed_to_me_minor ?? 0,
        iOweMinor: row?.i_owe_minor ?? 0,
        owedApproximate: row?.owed_approximate ?? false,
        oweApproximate: row?.owe_approximate ?? false,
      };
    },
  });
}

/** IOU writes also change linked transactions, so everything derived from transactions refreshes. */
function useInvalidateAfterIouWrite() {
  const queryClient = useQueryClient();
  return () => {
    void queryClient.invalidateQueries({ queryKey: queryKeys.ious.all });
    void queryClient.invalidateQueries({ queryKey: queryKeys.transactions.all });
  };
}

export type IouInput = {
  personName: string;
  direction: IouDirection;
  originalAmountMinor: number;
  originalCurrency: string;
  exchangeRate: string;
  baseAmountMinor: number;
  date: string;
  dueDate: string | null;
  note: string;
};

export function useSaveIou() {
  const invalidate = useInvalidateAfterIouWrite();
  return useMutation({
    mutationFn: async ({ id, input }: { id?: string; input: IouInput }): Promise<string> => {
      const args = {
        p_person_name: input.personName,
        p_direction: input.direction,
        p_original_amount_minor: input.originalAmountMinor,
        p_original_currency: input.originalCurrency,
        p_exchange_rate: input.exchangeRate,
        p_base_amount_minor: input.baseAmountMinor,
        p_date: input.date,
        ...(input.dueDate ? { p_due_date: input.dueDate } : {}),
        p_note: input.note,
      };
      const { data, error } = id
        ? await supabase.rpc('update_iou', { p_id: id, ...args })
        : await supabase.rpc('create_iou', args);
      if (error) throw error;
      return data;
    },
    onSettled: invalidate,
  });
}

export function useDeleteIou() {
  const invalidate = useInvalidateAfterIouWrite();
  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.rpc('delete_iou', { p_id: id });
      if (error) throw error;
    },
    onSettled: invalidate,
  });
}

export type RepaymentInput = {
  amountMinor: number;
  currency: string;
  iouCurrencyAmountMinor: number;
  iouCurrencyRate: string;
  baseAmountMinor: number;
  exchangeRate: string;
  date: string;
  note: string;
};

export function useSaveRepayment() {
  const invalidate = useInvalidateAfterIouWrite();
  return useMutation({
    mutationFn: async ({ iouId, id, input }: { iouId: string; id?: string; input: RepaymentInput }) => {
      const args = {
        p_amount_minor: input.amountMinor,
        p_currency: input.currency,
        p_iou_currency_amount_minor: input.iouCurrencyAmountMinor,
        p_iou_currency_rate: input.iouCurrencyRate,
        p_base_amount_minor: input.baseAmountMinor,
        p_exchange_rate: input.exchangeRate,
        p_date: input.date,
        p_note: input.note,
      };
      const { error } = id
        ? await supabase.rpc('update_repayment', { p_id: id, ...args })
        : await supabase.rpc('create_repayment', { p_iou_id: iouId, ...args });
      if (error) throw error;
    },
    onSettled: invalidate,
  });
}

export function useDeleteRepayment() {
  const invalidate = useInvalidateAfterIouWrite();
  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.rpc('delete_repayment', { p_id: id });
      if (error) throw error;
    },
    onSettled: invalidate,
  });
}
