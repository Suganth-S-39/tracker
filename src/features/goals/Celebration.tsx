import type { CSSProperties } from 'react';
import { cx } from '@/lib/cx';

// Fixed pieces (no randomness, so every render is the same): an angle around the circle, how far
// it flies, its color and shape.
const PIECES = [
  [0, 92, 'bg-savings', 'rounded-full'],
  [24, 78, 'bg-income', 'rounded-sm'],
  [48, 100, 'bg-investment', 'rounded-full'],
  [72, 84, 'bg-accent', 'rounded-sm'],
  [96, 96, 'bg-chart-1', 'rounded-full'],
  [120, 80, 'bg-chart-3', 'rounded-sm'],
  [144, 98, 'bg-savings', 'rounded-full'],
  [168, 86, 'bg-chart-5', 'rounded-sm'],
  [192, 94, 'bg-income', 'rounded-full'],
  [216, 80, 'bg-investment', 'rounded-sm'],
  [240, 100, 'bg-chart-2', 'rounded-full'],
  [264, 84, 'bg-savings', 'rounded-sm'],
  [288, 96, 'bg-chart-4', 'rounded-full'],
  [312, 82, 'bg-accent', 'rounded-sm'],
  [336, 98, 'bg-chart-6', 'rounded-full'],
] as const;

/**
 * A small burst of confetti from the middle of its (positioned) parent, for a goal marked as
 * bought. Transform and opacity only, so it runs on the compositor; with reduced motion the
 * animation is skipped (index.css) and nothing shows. Purely decorative.
 */
export function Celebration() {
  return (
    <span aria-hidden="true" className="pointer-events-none absolute inset-0 grid place-items-center">
      {PIECES.map(([angle, distance, color, shape]) => {
        const radians = (angle * Math.PI) / 180;
        const style = {
          '--dx': `${Math.round(Math.cos(radians) * distance)}px`,
          '--dy': `${Math.round(Math.sin(radians) * distance)}px`,
          '--turn': `${angle * 2}deg`,
        } as CSSProperties;
        return <span key={angle} style={style} className={cx('col-start-1 row-start-1 size-2.5 animate-confetti opacity-0', color, shape)} />;
      })}
    </span>
  );
}
