import { readFileSync, readdirSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';

// Spec section 7: never hardcode a color in a component. Colors live only in tokens.css.
// (Tailwind's default palette is also removed in index.css, so `bg-red-500` cannot compile.)

const srcDir = fileURLToPath(new URL('..', import.meta.url));

const sourceFiles = readdirSync(srcDir, { recursive: true, encoding: 'utf8' })
  .filter((file) => /\.(ts|tsx)$/.test(file))
  .filter((file) => !/\.test\.tsx?$/.test(file) && !file.endsWith('database.types.ts'));

const COLOR_PATTERNS = [
  /#(?:[0-9a-fA-F]{3,4}|[0-9a-fA-F]{6}|[0-9a-fA-F]{8})(?![\w-])/,
  /\b(?:rgba?|hsla?|oklch|oklab|lab|lch|hwb|color-mix)\(/,
];

describe('no hardcoded colors in source', () => {
  it('found source files to scan', () => {
    expect(sourceFiles.length).toBeGreaterThan(10);
  });

  it.each(sourceFiles)('%s', (file) => {
    const text = readFileSync(`${srcDir}/${file}`, 'utf8');
    for (const pattern of COLOR_PATTERNS) {
      expect(text, `color literal in ${file}`).not.toMatch(pattern);
    }
  });
});
