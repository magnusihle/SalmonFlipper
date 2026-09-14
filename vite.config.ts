import { defineConfig } from 'vitest/config'
import react from '@vitejs/plugin-react'

export default defineConfig({
  plugins: [react()],
  test: {
    // the node:test suites under scripts/ run with `npm run test:scripts`
    include: ['src/**/*.test.ts'],
  },
})
