import { defineConfig } from 'vitest/config'
import react from '@vitejs/plugin-react'

export default defineConfig({
  // relative asset paths so the built app also loads from file:// inside Electron
  base: './',
  plugins: [react()],
  test: {
    // only the vitest suites under src; scripts/test holds node --test suites (`npm run test:scripts`)
    include: ['src/**/*.test.{ts,tsx}'],
  },
})
