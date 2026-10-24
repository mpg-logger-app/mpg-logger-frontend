// Unit tests for registerServiceWorker.ts: when the service worker is registered, and that failures are harmless.
import { describe, expect, it, vi } from 'vitest'
import { registerServiceWorker } from './registerServiceWorker.ts'

/** A navigator whose serviceWorker.register is the given mock. */
function fakeNavigator(register: () => Promise<unknown>): Navigator {
  return { serviceWorker: { register } } as unknown as Navigator
}

describe('registerServiceWorker', () => {
  /** A production build registers the service worker so the app can be installed. */
  it('registers /sw.js in production', () => {
    const register = vi.fn().mockResolvedValue({})
    registerServiceWorker(true, fakeNavigator(register))
    expect(register).toHaveBeenCalledWith('/sw.js')
  })

  /** npm run dev never registers it, so cached files can't hide your edits. */
  it('does nothing in development', () => {
    const register = vi.fn().mockResolvedValue({})
    registerServiceWorker(false, fakeNavigator(register))
    expect(register).not.toHaveBeenCalled()
  })

  /** Browsers without service workers are left alone instead of crashing. */
  it('does nothing in browsers without service workers', () => {
    expect(() => registerServiceWorker(true, {} as Navigator)).not.toThrow()
  })

  /** A failed registration doesn't break the app; it just can't be installed. */
  it('swallows a failed registration', async () => {
    const register = vi.fn().mockRejectedValue(new Error('blocked'))
    registerServiceWorker(true, fakeNavigator(register))
    await expect(register.mock.results[0].value).rejects.toThrow('blocked')
  })

  /** Called with no arguments (as main.tsx does) it uses the real build mode, which is development in tests. */
  it('defaults to the real build mode and navigator', () => {
    // Tests run as a development build, so nothing is registered.
    expect(() => registerServiceWorker()).not.toThrow()
  })
})
