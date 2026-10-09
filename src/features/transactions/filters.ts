import { addMonths, monthOf, monthRange, todayLocal, type IsoDate } from '@/domain/dates';
import type { TransactionFilters } from './api';
import type { TransactionType } from './kinds';

export type DatePreset = 'all' | 'thisMonth' | 'lastMonth' | 'last3Months' | 'custom';

export type FilterState = {
  search: string;
  type: '' | TransactionType;
  categoryId: string;
  datePreset: DatePreset;
  customFrom: IsoDate;
  customTo: IsoDate;
};

export const EMPTY_FILTERS: FilterState = {
  search: '',
  type: '',
  categoryId: '',
  datePreset: 'all',
  customFrom: '',
  customTo: '',
};

export function hasActiveFilters(state: FilterState): boolean {
  return state.search.trim() !== '' || state.type !== '' || state.categoryId !== '' || state.datePreset !== 'all';
}

/** Turns the filter controls into query parameters. `today` is injectable for tests. */
export function toQueryFilters(state: FilterState, today: IsoDate = todayLocal()): TransactionFilters {
  const current = monthOf(today);
  const range = (() => {
    switch (state.datePreset) {
      case 'thisMonth':
        return { from: monthRange(current).first, to: monthRange(current).last };
      case 'lastMonth': {
        const last = addMonths(current, -1);
        return { from: monthRange(last).first, to: monthRange(last).last };
      }
      case 'last3Months':
        return { from: monthRange(addMonths(current, -2)).first, to: monthRange(current).last };
      case 'custom':
        return { from: state.customFrom || undefined, to: state.customTo || undefined };
      case 'all':
        return {};
    }
  })();

  return {
    ...(state.type ? { type: state.type } : {}),
    ...(state.categoryId ? { categoryId: state.categoryId } : {}),
    ...(range.from ? { from: range.from } : {}),
    ...(range.to ? { to: range.to } : {}),
    ...(state.search.trim() ? { search: state.search.trim() } : {}),
  };
}
