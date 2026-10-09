import { defineConfig, minimal2023Preset } from '@vite-pwa/assets-generator/config';

// Generates the PNG icons and favicon in public/ from the placeholder SVG (open item 9).
// Run with `npm run icons` after changing public/icon.svg.
export default defineConfig({
  headLinkOptions: { preset: '2023' },
  preset: {
    ...minimal2023Preset,
    maskable: {
      ...minimal2023Preset.maskable,
      resizeOptions: { background: '#1D1D1F' },
    },
    apple: {
      ...minimal2023Preset.apple,
      resizeOptions: { background: '#1D1D1F' },
    },
  },
  images: ['public/icon.svg'],
});
