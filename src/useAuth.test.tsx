// Unit test for useAuth.ts.
import { renderHook } from '@testing-library/react'
import { expect, it, vi } from 'vitest'
import { useAuth } from './useAuth.ts'

/** Using useAuth() outside <AuthProvider> is a programming mistake, so it fails loudly instead of returning nothing. */
it('throws when used outside AuthProvider', () => {
  // React logs the thrown error; keep the test output clean.
  vi.spyOn(console, 'error').mockImplementation(() => {})
  expect(() => renderHook(() => useAuth())).toThrow('useAuth must be used inside <AuthProvider>')
})
