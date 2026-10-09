import { describe, expect, it } from 'vitest';
import { EMPTY_FILTERS, hasActiveFilters, toQueryFilters } from './filters';

const today = '2026-10-09';

describe('toQueryFilters', () => {
  it('sends nothing for empty filters', () => {
    expect(toQueryFilters(EMPTY_FILTERS, today)).toEqual({});
    expect(hasActiveFilters(EMPTY_FILTERS)).toBe(false);
  });

  it('maps date presets to calendar ranges', () => {
    expect(toQueryFilters({ ...EMPTY_FILTERS, datePreset: 'thisMonth' }, today)).toEqual({ from: '2026-10-01', to: '2026-10-31' });
    expect(toQueryFilters({ ...EMPTY_FILTERS, datePreset: 'lastMonth' }, today)).toEqual({ from: '2026-09-01', to: '2026-09-30' });
    expect(toQueryFilters({ ...EMPTY_FILTERS, datePreset: 'last3Months' }, today)).toEqual({ from: '2026-08-01', to: '2026-10-31' });
    expect(toQueryFilters({ ...EMPTY_FILTERS, datePreset: 'lastMonth' }, '2026-01-15')).toEqual({ from: '2025-12-01', to: '2025-12-31' });
  });

  it('allows open-ended custom ranges', () => {
    expect(toQueryFilters({ ...EMPTY_FILTERS, datePreset: 'custom', customFrom: '2026-05-01' }, today)).toEqual({ from: '2026-05-01' });
  });

  it('trims search and passes type and category', () => {
    const state = { ...EMPTY_FILTERS, search: '  cafe ', type: 'expense' as const, categoryId: 'c1' };
    expect(toQueryFilters(state, today)).toEqual({ search: 'cafe', type: 'expense', categoryId: 'c1' });
    expect(hasActiveFilters(state)).toBe(true);
  });

  it('ignores whitespace-only search', () => {
    expect(hasActiveFilters({ ...EMPTY_FILTERS, search: '   ' })).toBe(false);
  });
});
