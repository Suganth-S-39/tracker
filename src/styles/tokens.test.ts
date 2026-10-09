import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { ACCENT_THEMES, type AccentTheme, type ResolvedTheme } from '@/theme/theme';

// ---------------------------------------------------------------------------
// Color math: WCAG 2.x contrast, plus alpha compositing for translucent glass.
// ---------------------------------------------------------------------------
type Rgba = { r: number; g: number; b: number; a: number };

function parseColor(value: string): Rgba {
  const hex = /^#([0-9A-Fa-f]{6})$/.exec(value);
  if (hex) {
    const n = parseInt(hex[1]!, 16);
    return { r: (n >> 16) & 255, g: (n >> 8) & 255, b: n & 255, a: 1 };
  }
  const rgb = /^rgb\((\d+) (\d+) (\d+)(?: \/ ([\d.]+))?\)$/.exec(value);
  if (rgb) return { r: +rgb[1]!, g: +rgb[2]!, b: +rgb[3]!, a: rgb[4] ? +rgb[4] : 1 };
  throw new Error(`Unsupported color: ${value}`);
}

/** `top` painted over an opaque `bottom`. */
function over(top: Rgba, bottom: Rgba): Rgba {
  const mix = (t: number, b: number) => Math.round(t * top.a + b * (1 - top.a));
  return { r: mix(top.r, bottom.r), g: mix(top.g, bottom.g), b: mix(top.b, bottom.b), a: 1 };
}

function luminance({ r, g, b }: Rgba): number {
  const [lr, lg, lb] = [r, g, b].map((c) => {
    const s = c / 255;
    return s <= 0.04045 ? s / 12.92 : ((s + 0.055) / 1.055) ** 2.4;
  }) as [number, number, number];
  return 0.2126 * lr + 0.7152 * lg + 0.0722 * lb;
}

function contrast(a: Rgba, b: Rgba): number {
  const [hi, lo] = [luminance(a), luminance(b)].sort((x, y) => y - x) as [number, number];
  return (hi + 0.05) / (lo + 0.05);
}

// ---------------------------------------------------------------------------
// tokens.css parsing
// ---------------------------------------------------------------------------

/** Parses tokens.css into { selector: { --var: value } } (top-level rules only). */
function parseTokens(css: string): Map<string, Record<string, string>> {
  const blocks = new Map<string, Record<string, string>>();
  const withoutComments = css.replace(/\/\*[\s\S]*?\*\//g, '');
  // Drop @media blocks (the reduced-transparency fallback) before reading plain rules.
  const topLevel = withoutComments.replace(/@media[^{]*\{(?:[^{}]*\{[^}]*\})*[^{}]*\}/g, '');
  for (const match of topLevel.matchAll(/([^{}]+)\{([^}]*)\}/g)) {
    const vars: Record<string, string> = {};
    for (const decl of (match[2] ?? '').matchAll(/(--[\w-]+)\s*:\s*([^;]+);/g)) {
      vars[decl[1]!] = decl[2]!.trim();
    }
    for (const selector of (match[1] ?? '').split(',')) {
      const key = selector.trim().replace(/"/g, "'");
      blocks.set(key, { ...blocks.get(key), ...vars });
    }
  }
  return blocks;
}

const blocks = parseTokens(readFileSync(new URL('./tokens.css', import.meta.url), 'utf8'));

/** The variables in effect on <html data-theme=mode data-accent=accent>. */
function tokensFor(mode: ResolvedTheme, accent: AccentTheme): Record<string, string> {
  const layers = [':root', `[data-accent='${accent}']`];
  if (mode === 'dark') layers.push(":root[data-theme='dark']", `[data-theme='dark'][data-accent='${accent}']`);
  return Object.assign({}, ...layers.map((selector) => blocks.get(selector) ?? {})) as Record<string, string>;
}

const combos = (['light', 'dark'] as const).flatMap((mode) => ACCENT_THEMES.map((accent) => [mode, accent] as const));

const AA_TEXT = 4.5;
const AA_GRAPHICS = 3;

describe.each(combos)('%s mode, %s accent', (mode, accent) => {
  const t = tokensFor(mode, accent);
  const color = (name: string): Rgba => {
    const value = t[name];
    if (!value) throw new Error(`${name} is not defined`);
    return parseColor(value);
  };

  // What text can sit on: the page (with each ambient color at full strength), and the glass
  // and dense glass painted over each of those, plus the solid surface fallback.
  const page = color('--bg');
  const backdrops = [page, ...['--mesh-1', '--mesh-2', '--mesh-3'].map((m) => over(color(m), page))];
  const panels = [
    color('--surface'),
    ...backdrops.map((b) => over(color('--glass'), b)),
    ...backdrops.map((b) => over(color('--glass-strong'), b)),
  ];
  const everywhere = [...backdrops, ...panels];
  const worstOn = (fg: Rgba, backgrounds: Rgba[]) => Math.min(...backgrounds.map((bg) => contrast(fg, bg)));

  it.each([['--text'], ['--text-muted'], ['--income-strong'], ['--expense-strong'], ['--savings-strong'], ['--investment-strong'], ['--accent-strong']])(
    '%s is readable as text on the page and on glass',
    (token) => {
      expect(worstOn(color(token), everywhere)).toBeGreaterThanOrEqual(AA_TEXT);
    },
  );

  it('text on accent buttons is readable', () => {
    expect(contrast(color('--on-accent'), color('--accent-strong'))).toBeGreaterThanOrEqual(AA_TEXT);
  });

  it('text on the hero card is readable across its gradient', () => {
    for (const stop of ['--hero-from', '--hero-via', '--hero-to']) {
      expect(contrast(color('--on-hero'), color(stop))).toBeGreaterThanOrEqual(AA_TEXT);
      // ...including inside the translucent total tiles.
      expect(contrast(color('--on-hero'), over(color('--hero-tile'), color(stop)))).toBeGreaterThanOrEqual(AA_TEXT);
    }
  });

  it('control borders are visible (3:1)', () => {
    expect(worstOn(color('--control-border'), everywhere)).toBeGreaterThanOrEqual(AA_GRAPHICS);
  });

  it.each([
    ['--income'],
    ['--expense'],
    ['--savings'],
    ['--investment'],
    ['--accent'],
    ['--chart-1'],
    ['--chart-2'],
    ['--chart-3'],
    ['--chart-4'],
    ['--chart-5'],
    ['--chart-6'],
    ['--chart-7'],
    ['--chart-other'],
  ])('%s works for icons, bars and chart slices on glass (3:1)', (token) => {
    expect(worstOn(color(token), panels)).toBeGreaterThanOrEqual(AA_GRAPHICS);
  });

  it('danger buttons and the swipe-to-delete icon (background color on expense-strong) are readable', () => {
    expect(contrast(color('--bg'), color('--expense-strong'))).toBeGreaterThanOrEqual(AA_TEXT);
  });
});

describe('palette (owner redesign: Apple-inspired, no purple or dark blue)', () => {
  it('uses Apple neutrals', () => {
    expect(tokensFor('light', 'graphite')).toMatchObject({ '--bg': '#F5F5F7', '--surface': '#FFFFFF', '--text': '#1D1D1F' });
    expect(tokensFor('dark', 'graphite')).toMatchObject({ '--bg': '#000000', '--surface': '#1C1C1E', '--text': '#F5F5F7' });
  });

  it('has no purple or dark-blue accent', () => {
    for (const mode of ['light', 'dark'] as const) {
      for (const accent of ACCENT_THEMES) {
        const { r, g, b } = parseColor(tokensFor(mode, accent)['--accent']!);
        const purpleOrBlue = b > r + 40 && b > g + 40;
        expect(purpleOrBlue, `${mode} ${accent}`).toBe(false);
      }
    }
  });
});
