import { useMemo, useState, type ReactNode } from 'react';
import { monthOf, todayLocal } from '@/domain/dates';
import { MonthContext } from './month-context';

export function MonthProvider({ children }: { children: ReactNode }) {
  const [month, setMonth] = useState(() => monthOf(todayLocal()));
  const value = useMemo(() => ({ month, setMonth }), [month]);
  return <MonthContext value={value}>{children}</MonthContext>;
}
