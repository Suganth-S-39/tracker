import { Plus, Settings } from 'lucide-react';
import { NavLink } from 'react-router';
import { Button } from '@/components/ui/Button';
import { cx } from '@/lib/cx';
import { strings } from '@/strings/en';
import { BrandMark } from './BrandMark';
import { leftNavItems, rightNavItems, sidebarOnlyNavItems, type NavItem } from './navItems';

function SidebarLink({ item }: { item: NavItem }) {
  const Icon = item.icon;
  return (
    <li>
      <NavLink
        to={item.to}
        end={item.end ?? false}
        className={({ isActive }) =>
          cx(
            'flex h-11 items-center gap-3 rounded-full px-3.5 text-sm font-semibold',
            isActive ? 'bg-accent-tint text-accent-strong' : 'text-fg-muted hover:bg-hover hover:text-fg',
          )
        }
      >
        <Icon aria-hidden="true" className="size-5" />
        {item.label}
      </NavLink>
    </li>
  );
}

/**
 * Wide-screen navigation: the same items as the bottom bar, with Add at the top. Settings is also
 * listed at the bottom, since desktop has no thumb-reach constraint (phones reach it from Home).
 */
export function Sidebar({ onAdd, addDisabled }: { onAdd: () => void; addDisabled: boolean }) {
  return (
    <aside className="glass-rail fixed inset-y-0 left-0 z-30 hidden w-60 flex-col border-r border-glass-border px-4 py-5 wide:flex">
      <div className="mb-6 px-2">
        <BrandMark />
      </div>
      <Button size="lg" fullWidth onClick={onAdd} disabled={addDisabled} icon={<Plus aria-hidden="true" className="size-5" />}>
        {strings.nav.addLong}
      </Button>
      <nav aria-label={strings.nav.label} className="mt-6 flex-1">
        <ul className="flex flex-col gap-1">
          {[...leftNavItems, ...rightNavItems, ...sidebarOnlyNavItems].map((item) => (
            <SidebarLink key={item.to} item={item} />
          ))}
        </ul>
      </nav>
      <ul>
        <SidebarLink item={{ to: '/settings', label: strings.nav.settings, icon: Settings }} />
      </ul>
    </aside>
  );
}
