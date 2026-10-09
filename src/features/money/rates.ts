import { useQuery } from '@tanstack/react-query';
import { queryKeys } from '@/lib/queryClient';
import { supabase } from '@/lib/supabase';

/** Latest rate for 1 unit of `from` in `to`, as an exact string. Null when none is known. */
export function useLatestRate(from: string, to: string, enabled = true) {
  return useQuery({
    queryKey: queryKeys.rate(from, to),
    enabled: enabled && from !== to,
    staleTime: 10 * 60_000,
    queryFn: async (): Promise<{ rate: string; date: string } | null> => {
      const { data, error } = await supabase.rpc('latest_rate', { p_from: from, p_to: to });
      if (error) throw error;
      const row = data[0];
      return row ? { rate: row.rate, date: row.rate_date } : null;
    },
  });
}
