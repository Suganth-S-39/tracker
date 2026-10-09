import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useUserId } from '@/features/auth/auth-context';
import { queryKeys } from '@/lib/queryClient';
import { supabase, type Tables } from '@/lib/supabase';

export type Profile = Tables<'profiles'>;
export type Currency = Tables<'currencies'>;

export function useProfile() {
  const userId = useUserId();
  return useQuery({
    queryKey: queryKeys.profile(userId),
    queryFn: async (): Promise<Profile> => {
      const { data, error } = await supabase.from('profiles').select('*').eq('user_id', userId).single();
      if (error) throw error;
      return data;
    },
  });
}

type ProfileUpdate = Partial<Pick<Profile, 'display_name' | 'timezone' | 'accent_theme' | 'theme_mode' | 'avatar_data_url'>>;

export function useUpdateProfile() {
  const userId = useUserId();
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (changes: ProfileUpdate): Promise<Profile> => {
      const { data, error } = await supabase
        .from('profiles')
        .update(changes)
        .eq('user_id', userId)
        .select('*')
        .single();
      if (error) throw error;
      return data;
    },
    onSuccess: (profile) => queryClient.setQueryData(queryKeys.profile(userId), profile),
  });
}

export function useCompleteOnboarding() {
  const userId = useUserId();
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (input: { baseCurrency: string; timezone: string; displayName: string; avatarDataUrl: string | null }): Promise<Profile> => {
      // One call: base currency, name, optional photo and the starter categories, all or nothing.
      const { data, error } = await supabase.rpc('complete_onboarding', {
        p_base_currency: input.baseCurrency,
        p_timezone: input.timezone,
        p_display_name: input.displayName,
        ...(input.avatarDataUrl ? { p_avatar_data_url: input.avatarDataUrl } : {}),
      });
      if (error) throw error;
      return data;
    },
    onSuccess: (profile) => queryClient.setQueryData(queryKeys.profile(userId), profile),
  });
}

/** Supported currencies. Reference data: fetched once per session. */
export function useCurrencies() {
  return useQuery({
    queryKey: queryKeys.currencies,
    staleTime: Infinity,
    gcTime: Infinity,
    queryFn: async (): Promise<Currency[]> => {
      const { data, error } = await supabase.from('currencies').select('*').order('code');
      if (error) throw error;
      return data;
    },
  });
}

/** The browser's IANA timezone, e.g. "Asia/Kolkata". */
export function browserTimezone(): string {
  return Intl.DateTimeFormat().resolvedOptions().timeZone;
}
