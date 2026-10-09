import { Plus } from 'lucide-react';
import { NavLink } from 'react-router';
import { cx } from '@/lib/cx';
import { strings } from '@/strings/en';
import { leftNavItems, rightNavItems, type NavItem } from './navItems';

function BottomNavLink({ item }: { item: NavItem }) {
  const Icon = item.icon;
  return (
    <li className="flex-1">
      <NavLink
        to={item.to}
        end={item.end ?? false}
        className={({ isActive }) =>
          cx(
            'flex h-16 flex-col items-center justify-center gap-1 text-xs font-medium',
            isActive ? 'text-accent-strong' : 'text-fg-muted hover:text-fg',
          )
        }
      >
        <Icon aria-hidden="true" className="size-6" />
        {item.label}
      </NavLink>
    </li>
  );
}

/** Phone navigation: four tabs with a prominent Add button in the center. */
export function BottomNav({ onAdd, addDisabled }: { onAdd: () => void; addDisabled: boolean }) {
  return (
    <nav
      aria-label={strings.nav.label}
      data-bottom-nav
      className="glass-bar fixed inset-x-0 bottom-0 z-30 border-t border-glass-border pb-safe wide:hidden"
    >
      <ul className="mx-auto flex max-w-lg items-stretch">
        {leftNavItems.map((item) => (
          <BottomNavLink key={item.to} item={item} />
        ))}
        <li className="flex flex-1 items-center justify-center">
          <button
            type="button"
            onClick={onAdd}
            disabled={addDisabled}
            aria-label={strings.nav.addLong}
            className="-mt-6 grid size-14 place-items-center rounded-full bg-accent-strong text-on-accent shadow-raised transition-transform active:scale-95 disabled:opacity-50"
          >
            <Plus aria-hidden="true" className="size-7" strokeWidth={2.5} />
          </button>
        </li>
        {rightNavItems.map((item) => (
          <BottomNavLink key={item.to} item={item} />
        ))}
      </ul>
    </nav>
  );
}
