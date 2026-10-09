import { ArrowLeftRight, ChartPie, House, PiggyBank, type LucideIcon } from 'lucide-react';
import { strings } from '@/strings/en';

export type NavItem = { to: string; label: string; icon: LucideIcon; end?: boolean };

// The bottom bar shows these with the Add button in the middle; the sidebar lists them under it.
export const leftNavItems: readonly NavItem[] = [
  { to: '/', label: strings.nav.home, icon: House, end: true },
  { to: '/transactions', label: strings.nav.transactions, icon: ArrowLeftRight },
];

export const rightNavItems: readonly NavItem[] = [
  { to: '/budgets', label: strings.nav.budgets, icon: PiggyBank },
  { to: '/reports', label: strings.nav.reports, icon: ChartPie },
];
