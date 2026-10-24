import { afterEach, describe, expect, it, vi } from 'vitest'
import { registerServiceWorker } from './registerServiceWorker.ts'

describe('registerServiceWorker', () => {
  afterEach(() => {
    vi.unstubAllGlobals()
  })

  function stubServiceWorker(register: ReturnType<typeof vi.fn>) {
    vi.stubGlobal('navigator', { ...navigator, serviceWorker: { register } })
  }

  it('registers /sw.js once the page has loaded', () => {
    const register = vi.fn().mockResolvedValue({})
    stubServiceWorker(register)

    registerServiceWorker(true)
    expect(register).not.toHaveBeenCalled()
    window.dispatchEvent(new Event('load'))
    expect(register).toHaveBeenCalledWith('/sw.js')
  })

  it('does nothing in development', () => {
    const register = vi.fn()
    stubServiceWorker(register)

    registerServiceWorker()
    window.dispatchEvent(new Event('load'))
    expect(register).not.toHaveBeenCalled()
  })

  it('does nothing in browsers without service workers', () => {
    expect(() => registerServiceWorker(true)).not.toThrow()
  })

  it('keeps the app working if registration fails', async () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {})
    stubServiceWorker(vi.fn().mockRejectedValue(new Error('blocked')))

    registerServiceWorker(true)
    window.dispatchEvent(new Event('load'))
    await vi.waitFor(() => expect(warn).toHaveBeenCalledWith('Service worker registration failed', expect.any(Error)))
  })
})
