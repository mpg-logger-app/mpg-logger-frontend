// Unit tests for api.ts with fetch mocked: the requests sent, error messages, and 401 handling.
import { beforeEach, describe, expect, it, vi } from 'vitest'
import {
  SESSION_ENDED_EVENT,
  UnauthorizedError,
  createFuelLog,
  deleteFuelLog,
  getAccount,
  listFuelLogs,
  signIn,
  signOut,
  signUp,
  updateAccount,
  updateFuelLog,
} from './api.ts'
import { makeLog } from './test/logs.ts'

const NOT_RUNNING = "Can't reach the backend. Is Spring Boot running on port 8080?"
const entry = { date: '2026-10-01', previousOdometer: null, odometer: 12300, gallons: 10, pricePerGallon: 3 }

/** A fake JSON response, as fetch would return it. */
function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json' } })
}

let fetchMock: ReturnType<typeof vi.fn>

beforeEach(() => {
  fetchMock = vi.fn()
  vi.stubGlobal('fetch', fetchMock)
})

describe('requests', () => {
  /** Loading the history is a plain GET of /api/fuel-logs, returning the JSON as is. */
  it('listFuelLogs GETs all logs', async () => {
    const logs = [makeLog(1, '2026-10-01', 12000, 12300)]
    fetchMock.mockResolvedValue(jsonResponse(logs))

    await expect(listFuelLogs()).resolves.toEqual(logs)
    expect(fetchMock).toHaveBeenCalledWith('/api/fuel-logs', undefined)
  })

  /** A new fill-up is POSTed as JSON with the right Content-Type. */
  it('createFuelLog POSTs JSON', async () => {
    const created = makeLog(1, '2026-10-01', 12000, 12300)
    fetchMock.mockResolvedValue(jsonResponse(created, 201))

    await expect(createFuelLog(entry)).resolves.toEqual(created)
    expect(fetchMock).toHaveBeenCalledWith('/api/fuel-logs', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(entry),
    })
  })

  /** An edit is PUT as JSON to that log's own URL. */
  it('updateFuelLog PUTs JSON to the log', async () => {
    const updated = makeLog(7, '2026-10-01', 12000, 12300)
    fetchMock.mockResolvedValue(jsonResponse(updated))

    await expect(updateFuelLog(7, entry)).resolves.toEqual(updated)
    expect(fetchMock).toHaveBeenCalledWith('/api/fuel-logs/7', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(entry),
    })
  })

  /** Deleting sends DELETE to the log's URL and expects no body back (204). */
  it('deleteFuelLog DELETEs the log', async () => {
    fetchMock.mockResolvedValue(new Response(null, { status: 204 }))

    await expect(deleteFuelLog(7)).resolves.toBeUndefined()
    expect(fetchMock).toHaveBeenCalledWith('/api/fuel-logs/7', { method: 'DELETE' })
  })
})

describe('errors', () => {
  /** A network failure (fetch rejects) becomes a message saying the backend isn't running. */
  it('reports an unreachable backend when fetch itself fails', async () => {
    fetchMock.mockRejectedValue(new TypeError('Failed to fetch'))
    await expect(listFuelLogs()).rejects.toThrow(NOT_RUNNING)
  })

  /** Vite's proxy answers 5xx when Spring Boot is down, which gets the same backend message. */
  it('reports an unreachable backend for 5xx (Vite proxy with Spring Boot down)', async () => {
    fetchMock.mockResolvedValue(new Response('', { status: 502 }))
    await expect(listFuelLogs()).rejects.toThrow(NOT_RUNNING)
  })

  /** Spring's problem+json "detail" (the broken rule) is what the user sees. */
  it('uses the problem+json detail', async () => {
    fetchMock.mockResolvedValue(jsonResponse({ title: 'Invalid fuel log', detail: 'Gallons must be greater than 0.' }, 400))
    await expect(createFuelLog(entry)).rejects.toThrow('Gallons must be greater than 0.')
  })

  /** Without a detail, the problem's title is shown instead. */
  it('falls back to the title when there is no detail', async () => {
    fetchMock.mockResolvedValue(jsonResponse({ title: 'Not Found' }, 404))
    await expect(deleteFuelLog(1)).rejects.toThrow('Not Found')
  })

  /** JSON without detail or title still gives a message, with the status code. */
  it('falls back to the status when the JSON has neither', async () => {
    fetchMock.mockResolvedValue(jsonResponse({}, 409))
    await expect(updateFuelLog(1, entry)).rejects.toThrow('Request failed (409)')
  })

  /** A non-JSON error body still gives a message, with the status code. */
  it('falls back to the status when the body is not JSON', async () => {
    fetchMock.mockResolvedValue(new Response('oops', { status: 400 }))
    await expect(updateFuelLog(1, entry)).rejects.toThrow('Request failed (400)')
  })
})

describe('accounts', () => {
  const account = { id: 1, username: 'chandan', name: 'Chandan' }
  const post = (body: unknown) => ({
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  })

  /** Restoring the session asks GET /api/account and returns the user. */
  it('getAccount returns the signed-in user', async () => {
    fetchMock.mockResolvedValue(jsonResponse(account))
    await expect(getAccount()).resolves.toEqual(account)
    expect(fetchMock).toHaveBeenCalledWith('/api/account', undefined)
  })

  /** A 401 when restoring the session means "signed out", not an error. */
  it('getAccount returns null when nobody is signed in', async () => {
    fetchMock.mockResolvedValue(jsonResponse({ detail: 'Please sign in.' }, 401))
    await expect(getAccount()).resolves.toBeNull()
  })

  /** An unreachable backend is an error, so the app can say it can't connect rather than "signed out". */
  it('getAccount still fails when the backend is down', async () => {
    fetchMock.mockRejectedValue(new TypeError('Failed to fetch'))
    await expect(getAccount()).rejects.toThrow(NOT_RUNNING)
  })

  /** The three auth calls POST to their /api/auth paths with the right bodies. */
  it('signUp, signIn and signOut POST to /api/auth', async () => {
    fetchMock.mockResolvedValue(jsonResponse(account, 201))
    await expect(signUp('chandan', 'Chandan', 'password123')).resolves.toEqual(account)
    expect(fetchMock).toHaveBeenLastCalledWith(
      '/api/auth/signup',
      post({ username: 'chandan', name: 'Chandan', password: 'password123' }),
    )

    fetchMock.mockResolvedValue(jsonResponse(account))
    await expect(signIn('chandan', 'password123')).resolves.toEqual(account)
    expect(fetchMock).toHaveBeenLastCalledWith('/api/auth/signin', post({ username: 'chandan', password: 'password123' }))

    fetchMock.mockResolvedValue(new Response(null, { status: 204 }))
    await expect(signOut()).resolves.toBeUndefined()
    expect(fetchMock).toHaveBeenLastCalledWith('/api/auth/signout', { method: 'POST' })
  })

  /** Saving the account page PUTs only the name. */
  it('updateAccount PUTs the new name', async () => {
    fetchMock.mockResolvedValue(jsonResponse({ ...account, name: 'CJ' }))
    await expect(updateAccount('CJ')).resolves.toEqual({ ...account, name: 'CJ' })
    expect(fetchMock).toHaveBeenCalledWith('/api/account', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name: 'CJ' }),
    })
  })

  /** A 401 from a normal API call fires SESSION_ENDED_EVENT, so the app goes back to sign-in. */
  it('a 401 from the app announces that the session ended', async () => {
    const ended = vi.fn()
    window.addEventListener(SESSION_ENDED_EVENT, ended)
    fetchMock.mockResolvedValue(jsonResponse({ detail: 'Please sign in.' }, 401))

    await expect(listFuelLogs()).rejects.toBeInstanceOf(UnauthorizedError)
    expect(ended).toHaveBeenCalledOnce()
    window.removeEventListener(SESSION_ENDED_EVENT, ended)
  })

  /** A 401 from sign-in is just "wrong password" and must not fire SESSION_ENDED_EVENT. */
  it('a wrong password is an error, not an ended session', async () => {
    const ended = vi.fn()
    window.addEventListener(SESSION_ENDED_EVENT, ended)
    fetchMock.mockResolvedValue(jsonResponse({ detail: 'Wrong username or password.' }, 401))

    await expect(signIn('chandan', 'nope')).rejects.toThrow('Wrong username or password.')
    expect(ended).not.toHaveBeenCalled()
    window.removeEventListener(SESSION_ENDED_EVENT, ended)
  })
})
