import { describe, expect, it } from 'vitest';
import { isOverdue, repayableMinor, repaymentBaseRate } from './iou';

describe('repaymentBaseRate', () => {
  const base = { iouRate: '0.0111', latestToBase: '83.2' };

  it('is 1 when the repayment is in the base currency', () => {
    expect(repaymentBaseRate({ ...base, repaymentCurrency: 'INR', iouCurrency: 'USD', baseCurrency: 'INR' })).toBe('1');
  });

  it('reuses the repayment -> IOU rate when the IOU is in the base currency', () => {
    expect(repaymentBaseRate({ ...base, repaymentCurrency: 'USD', iouCurrency: 'INR', baseCurrency: 'INR', iouRate: '83.5' })).toBe(
      '83.5',
    );
  });

  it('uses the latest rate when all three currencies differ', () => {
    expect(repaymentBaseRate({ ...base, repaymentCurrency: 'EUR', iouCurrency: 'USD', baseCurrency: 'INR' })).toBe('83.2');
  });

  it('is null when the needed rate is unknown', () => {
    expect(
      repaymentBaseRate({ repaymentCurrency: 'EUR', iouCurrency: 'USD', baseCurrency: 'INR', iouRate: '1.1', latestToBase: null }),
    ).toBeNull();
    expect(
      repaymentBaseRate({ repaymentCurrency: 'USD', iouCurrency: 'INR', baseCurrency: 'INR', iouRate: null, latestToBase: '83' }),
    ).toBeNull();
  });
});

describe('isOverdue', () => {
  it('is overdue after the due date while something remains', () => {
    expect(isOverdue('2026-10-01', 500, '2026-10-02')).toBe(true);
  });

  it('is not overdue on the due date, without one, or once settled', () => {
    expect(isOverdue('2026-10-02', 500, '2026-10-02')).toBe(false);
    expect(isOverdue(null, 500, '2026-10-02')).toBe(false);
    expect(isOverdue('2026-10-01', 0, '2026-10-02')).toBe(false);
  });
});

describe('repayableMinor', () => {
  it('is the remaining balance for a new repayment', () => {
    expect(repayableMinor(6000)).toBe(6000);
  });

  it('adds back the amount of the repayment being edited', () => {
    expect(repayableMinor(6000, 4000)).toBe(10000);
  });
});
