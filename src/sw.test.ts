// Runs public/sw.js against fake service-worker globals to check its caching rules.
import { beforeEach, describe, expect, it, vi } from 'vitest'
import source from '../public/sw.js?raw'

const ORIGIN = 'https://mpg.example'

type Listener = (event: FakeEvent) => void
interface FakeEvent {
  request?: { url: string; method: string; mode: string }
  waitUntil: (p: Promise<unknown>) => void
  respondWith: (p: Promise<Response>) => void
}

/** A Map-backed stand-in for the Cache Storage API. */
function fakeCaches() {
  const stores = new Map<string, Map<string, Response>>()
  const keyOf = (r: string | { url: string }) => new URL(typeof r === 'string' ? r : r.url, ORIGIN).href
  const open = async (name: string) => {
    if (!stores.has(name)) stores.set(name, new Map())
    const store = stores.get(name)!
    return {
      addAll: async (urls: string[]) => urls.forEach((u) => store.set(keyOf(u), new Response(`cached ${u}`))),
      put: async (r: { url: string }, res: Response) => void store.set(keyOf(r), res),
      match: async (r: string | { url: string }) => store.get(keyOf(r)),
    }
  }
  return {
    stores,
    api: {
      open,
      keys: async () => [...stores.keys()],
      delete: async (name: string) => stores.delete(name),
    },
  }
}

let listeners: Record<string, Listener>
let caches: ReturnType<typeof fakeCaches>
let fetchMock: ReturnType<typeof vi.fn>
let skipWaiting: ReturnType<typeof vi.fn>
let claim: ReturnType<typeof vi.fn>

beforeEach(() => {
  listeners = {}
  caches = fakeCaches()
  fetchMock = vi.fn()
  skipWaiting = vi.fn()
  claim = vi.fn()
  const self = {
    location: { origin: ORIGIN },
    addEventListener: (type: string, fn: Listener) => (listeners[type] = fn),
    skipWaiting,
    clients: { claim },
  }
  // The worker script sees these as its globals.
  new Function('self', 'caches', 'fetch', source)(self, caches.api, fetchMock)
})

/** Fires the worker's install or activate event and waits for the work it started. */
async function lifecycle(type: 'install' | 'activate') {
  let done: Promise<unknown> = Promise.resolve()
  listeners[type]({ waitUntil: (p) => (done = p), respondWith: () => {} })
  await done
}

/** Dispatches a fetch event; null means the worker let the browser handle it. */
function dispatch(path: string, { method = 'GET', mode = 'cors' } = {}): Promise<Response> | null {
  let responded: Promise<Response> | null = null
  listeners.fetch({
    request: { url: new URL(path, ORIGIN).href, method, mode },
    waitUntil: () => {},
    respondWith: (p) => (responded = p),
  })
  return responded
}

/** The worker's response to a request it is expected to handle. */
function request(path: string, options?: { method?: string; mode?: string }): Promise<Response> {
  const responded = dispatch(path, options)
  if (!responded) throw new Error(`${path} was not handled by the worker`)
  return responded
}

/** What the worker has stored for a path, or undefined if nothing. */
const cached = (path: string) => caches.stores.get('mpg-logger-v1')?.get(new URL(path, ORIGIN).href)

describe('install / activate', () => {
  /** Installing caches what the app needs to start offline and takes over without waiting. */
  it('pre-caches the app shell and activates right away', async () => {
    await lifecycle('install')
    expect(cached('/')).toBeDefined()
    expect(cached('/manifest.webmanifest')).toBeDefined()
    expect(skipWaiting).toHaveBeenCalled()
  })

  /** A new version removes the old version's caches when it activates. */
  it('deletes caches from older versions', async () => {
    await caches.api.open('mpg-logger-v0')
    await caches.api.open('mpg-logger-v1')
    await lifecycle('activate')
    expect([...caches.stores.keys()]).toEqual(['mpg-logger-v1'])
    expect(claim).toHaveBeenCalled()
  })
})

describe('fetch', () => {
  /** /api requests, non-GET requests and other sites are never handled or cached. */
  it('leaves API calls, writes and other sites to the browser', async () => {
    expect(dispatch('/api/fuel-logs')).toBeNull()
    expect(dispatch('/', { method: 'POST' })).toBeNull()
    expect(dispatch('https://fonts.example/x.css')).toBeNull()
    expect(fetchMock).not.toHaveBeenCalled()
  })

  /** Online, pages come from the network (so a new deploy shows at once) and refresh the cached copy. */
  it('pages: uses the network and refreshes the cache', async () => {
    fetchMock.mockResolvedValue(new Response('fresh page'))
    const response = await request('/', { mode: 'navigate' })
    expect(await response.text()).toBe('fresh page')
    expect(cached('/')).toBeDefined()
  })

  /** Offline, any page (even a deep link) opens the cached app. */
  it('pages: falls back to the cached app when offline', async () => {
    await lifecycle('install')
    fetchMock.mockRejectedValue(new TypeError('offline'))
    const response = await request('/some/deep/link', { mode: 'navigate' })
    expect(await response.text()).toBe('cached /')
  })

  /** A 404 is passed on but never stored, so it can't be served later. */
  it('does not cache error responses', async () => {
    fetchMock.mockResolvedValue(new Response('nope', { status: 404 }))
    const response = await request('/missing.png')
    expect(response.status).toBe(404)
    expect(cached('/missing.png')).toBeUndefined()
  })

  /** With nothing cached, an offline request fails just as it would without the worker. */
  it('other files: offline with nothing cached fails like a normal request', async () => {
    fetchMock.mockRejectedValue(new TypeError('offline'))
    await expect(request('/icon-192.png')).rejects.toThrow('offline')
  })

  /** Offline, icons and the manifest come from the cache. */
  it('other files: offline uses the cached copy', async () => {
    await lifecycle('install')
    fetchMock.mockRejectedValue(new TypeError('offline'))
    const response = await request('/icon-192.png')
    expect(await response.text()).toBe('cached /icon-192.png')
  })

  /** Vite's hashed files never change, so after the first fetch they come straight from the cache. */
  it('hashed /assets/: fetched once, then served from the cache', async () => {
    fetchMock.mockResolvedValue(new Response('js'))
    await request('/assets/index-abc.js')
    const second = await request('/assets/index-abc.js')

    expect(await second.text()).toBe('js')
    expect(fetchMock).toHaveBeenCalledOnce()
  })

  /** A failed asset fetch is passed on but not cached. */
  it('hashed /assets/: an error response is passed on but not cached', async () => {
    fetchMock.mockResolvedValue(new Response('gone', { status: 404 }))
    await request('/assets/old.js')
    expect(cached('/assets/old.js')).toBeUndefined()
  })
})
