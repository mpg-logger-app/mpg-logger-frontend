// Adds matchers like toBeDisabled() / toBeInTheDocument() to expect().
import '@testing-library/jest-dom/vitest'
import { cleanup } from '@testing-library/react'
import { afterEach, vi } from 'vitest'

/** After every test: unmount what it rendered and undo any spies, so tests can't affect each other. */
afterEach(() => {
  cleanup()
  vi.restoreAllMocks()
})
