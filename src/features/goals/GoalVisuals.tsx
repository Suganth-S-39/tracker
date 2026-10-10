import { Check } from 'lucide-react';
import { createElement } from 'react';
import { cx } from '@/lib/cx';
import { goalIcon } from './goalIcons';

const BADGE_SIZES = {
  sm: { box: 'size-10 rounded-full', icon: 'size-5' },
  md: { box: 'size-12 rounded-2xl', icon: 'size-6' },
  lg: { box: 'size-16 rounded-[1.25rem]', icon: 'size-8' },
} as const;

/**
 * A goal's photo, or its icon on the savings tint. Decorative: the goal's name is always shown
 * next to it. Bought goals get a check in the corner.
 */
export function GoalBadge({
  icon,
  photo,
  bought = false,
  size = 'sm',
}: {
  icon: string;
  photo?: string | undefined;
  bought?: boolean;
  size?: keyof typeof BADGE_SIZES;
}) {
  const s = BADGE_SIZES[size];
  return (
    <span aria-hidden="true" className={cx('relative grid shrink-0 place-items-center', s.box, !photo && 'bg-savings-tint text-savings-strong')}>
      {photo ? (
        <img src={photo} alt="" decoding="async" className={cx('size-full object-cover', s.box)} />
      ) : (
        createElement(goalIcon(icon), { className: s.icon })
      )}
      {bought ? (
        <span className="absolute -right-1 -bottom-1 grid size-5 place-items-center rounded-full bg-savings-strong text-bg ring-2 ring-surface">
          <Check className="size-3" strokeWidth={3} />
        </span>
      ) : null}
    </span>
  );
}

/**
 * A slim progress bar. The fill is moved with a transform (not its width), so a change animates
 * on the compositor without re-laying-out the page; the rounded track clips it.
 */
export function GoalProgressBar({ fraction, className }: { fraction: number; className?: string }) {
  return (
    <div aria-hidden="true" className={cx('h-2 overflow-hidden rounded-full bg-control', className)}>
      <div
        className="h-full w-full rounded-full bg-savings transition-transform duration-500 ease-out motion-reduce:transition-none"
        style={{ transform: `translateX(${(Math.min(1, Math.max(0, fraction)) - 1) * 100}%)` }}
      />
    </div>
  );
}

const RING_SIZE = 132;
const RING_STROKE = 11;

/** The goal page's progress ring, with the percentage in the middle. Static (no animation). */
export function GoalRing({ fraction, label }: { fraction: number; label: string }) {
  const radius = (RING_SIZE - RING_STROKE) / 2;
  const circumference = 2 * Math.PI * radius;
  const clamped = Math.min(1, Math.max(0, fraction));
  return (
    <div className="relative grid size-[8.25rem] shrink-0 place-items-center">
      <svg aria-hidden="true" viewBox={`0 0 ${RING_SIZE} ${RING_SIZE}`} className="absolute inset-0 size-full -rotate-90">
        <circle cx={RING_SIZE / 2} cy={RING_SIZE / 2} r={radius} fill="none" strokeWidth={RING_STROKE} className="stroke-control" />
        {clamped > 0 ? (
          <circle
            cx={RING_SIZE / 2}
            cy={RING_SIZE / 2}
            r={radius}
            fill="none"
            strokeWidth={RING_STROKE}
            strokeLinecap="round"
            strokeDasharray={circumference}
            strokeDashoffset={circumference * (1 - clamped)}
            className="stroke-savings"
          />
        ) : null}
      </svg>
      <span className="font-display text-[1.75rem] font-semibold tracking-tight tabular">{label}</span>
    </div>
  );
}
