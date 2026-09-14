/// <reference types="vitest/config" />
import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig({
  plugins: [react()],
  test: {
    // only the vitest suites under src; test/ holds node --test suites (SSB price fetcher)
    include: ['src/**/*.test.{ts,tsx}'],
  },
})
