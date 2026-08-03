import { defineConfig } from 'vitest/config';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],
  resolve: {
    // Our placeholder animations use only basic SVG shapes. The light player
    // omits expressions and keeps the optional mascot chunk substantially smaller.
    alias: { 'lottie-web': 'lottie-web/build/player/esm/lottie_light.min.js' },
  },
  build: { chunkSizeWarningLimit: 600 },
  test: {
    environment: 'jsdom',
    setupFiles: './src/test/setup.ts',
    css: true,
  },
});
