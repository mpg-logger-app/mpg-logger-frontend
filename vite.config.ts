import react from '@vitejs/plugin-react'
import { defineConfig } from 'vitest/config'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],
  server: {
    // Forward API calls to Spring Boot so the browser sees one origin (no CORS setup needed).
    proxy: {
      '/api': 'http://localhost:8080',
    },
  },
  // `npm test` runs the tests once; `npm run coverage` also writes coverage/index.html.
  test: {
    environment: 'jsdom',
    setupFiles: ['./src/test/setup.ts'],
    coverage: {
      include: ['src/**/*.{ts,tsx}'],
      exclude: ['src/**/*.test.{ts,tsx}', 'src/test/**'],
      reporter: ['text', 'html'],
    },
  },
})
