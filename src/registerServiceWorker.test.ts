import { describe, expect, it, vi } from 'vitest'
import { registerServiceWorker } from './registerServiceWorker.ts'

function fakeNavigator(register: () => Promise<unknown>): Navigator {
  return { serviceWorker: { register } } as unknown as Navigator
}

describe('registerServiceWorker', () => {
  it('registers /sw.js in production', () => {
    const register = vi.fn().mockResolvedValue({})
    registerServiceWorker(true, fakeNavigator(register))
    expect(register).toHaveBeenCalledWith('/sw.js')
  })

  it('does nothing in development', () => {
    const register = vi.fn().mockResolvedValue({})
    registerServiceWorker(false, fakeNavigator(register))
    expect(register).not.toHaveBeenCalled()
  })

  it('does nothing in browsers without service workers', () => {
    expect(() => registerServiceWorker(true, {} as Navigator)).not.toThrow()
  })

  it('swallows a failed registration', async () => {
    const register = vi.fn().mockRejectedValue(new Error('blocked'))
    registerServiceWorker(true, fakeNavigator(register))
    await expect(register.mock.results[0].value).rejects.toThrow('blocked')
  })

  it('defaults to the real build mode and navigator', () => {
    // Tests run as a development build, so nothing is registered.
    expect(() => registerServiceWorker()).not.toThrow()
  })
})
