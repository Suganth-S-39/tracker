import { createContext, useContext } from 'react';
import type { MonthKey } from '@/domain/dates';

export type MonthContextValue = { month: MonthKey; setMonth: (month: MonthKey) => void };

export const MonthContext = createContext<MonthContextValue | null>(null);

/** The month selected on Home, shared with Budgets and Reports (DECISIONS.md). */
export function useSelectedMonth(): MonthContextValue {
  const value = useContext(MonthContext);
  if (!value) throw new Error('useSelectedMonth must be used inside <MonthProvider>');
  return value;
}
