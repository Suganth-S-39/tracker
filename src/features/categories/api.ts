import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useMemo } from 'react';
import { queryKeys } from '@/lib/queryClient';
import { supabase, type Enums, type Tables } from '@/lib/supabase';
import { strings } from '@/strings/en';

export type Category = Tables<'categories'>;
export type TransactionType = Enums<'transaction_type'>;

/** All of the user's categories, including hidden and system ones. */
export function useCategories() {
  return useQuery({
    queryKey: queryKeys.categories,
    staleTime: 5 * 60_000,
    queryFn: async (): Promise<Category[]> => {
      const { data, error } = await supabase
        .from('categories')
        .select('*')
        .is('deleted_at', null)
        .order('kind')
        .order('sort_order')
        .order('name');
      if (error) throw error;
      return data;
    },
  });
}

export function useCategoryMap(): ReadonlyMap<string, Category> {
  const { data } = useCategories();
  return useMemo(() => new Map((data ?? []).map((c) => [c.id, c])), [data]);
}

/** Display name: system categories by key (localisable), the rest by their name. */
export function categoryLabel(category: Pick<Category, 'name' | 'system_key'>): string {
  return category.system_key ? strings.categories.system[category.system_key] : category.name;
}

/**
 * Categories offered in the Add form for a type: visible, non-system. A category that is
 * already on the transaction being edited stays available even if it was hidden since.
 */
export function selectableCategories(
  categories: readonly Category[],
  type: TransactionType,
  keepId?: string,
): Category[] {
  return categories.filter(
    (c) => c.kind === type && !c.is_system && (!c.is_hidden || c.id === keepId),
  );
}

type CategoryInput = { name: string; icon: string; kind: TransactionType };

export function useSaveCategory() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (input: { id?: string } & CategoryInput) => {
      const name = input.name.trim();
      if (input.id) {
        const { error } = await supabase.from('categories').update({ name, icon: input.icon }).eq('id', input.id);
        if (error) throw error;
        return;
      }
      const existing = queryClient.getQueryData<Category[]>(queryKeys.categories) ?? [];
      const sortOrder = Math.max(0, ...existing.filter((c) => c.kind === input.kind && !c.is_system).map((c) => c.sort_order)) + 1;
      const { error } = await supabase
        .from('categories')
        .insert({ name, icon: input.icon, kind: input.kind, sort_order: sortOrder });
      if (error) throw error;
    },
    onSettled: () => queryClient.invalidateQueries({ queryKey: queryKeys.categories }),
  });
}

export function useSetCategoryHidden() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, hidden }: { id: string; hidden: boolean }) => {
      const { error } = await supabase.from('categories').update({ is_hidden: hidden }).eq('id', id);
      if (error) throw error;
    },
    onMutate: async ({ id, hidden }) => {
      await queryClient.cancelQueries({ queryKey: queryKeys.categories });
      queryClient.setQueryData<Category[]>(queryKeys.categories, (old) =>
        old?.map((c) => (c.id === id ? { ...c, is_hidden: hidden } : c)),
      );
    },
    onSettled: () => queryClient.invalidateQueries({ queryKey: queryKeys.categories }),
  });
}
