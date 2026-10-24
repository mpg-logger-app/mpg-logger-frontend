import type { Account } from './account.ts'
import type { FuelLog, NewFuelLog } from './fuel.ts'

// In development, Vite forwards /api/* to http://localhost:8080 (see vite.config.ts).
// The session is an HttpOnly cookie set by the backend; the browser sends it with every
// same-origin request, so no token is handled here.
const BASE = '/api/fuel-logs'

/**
 * Dispatched on window when the server says the session is gone (signed out in another tab,
 * or expired), so the app can go back to the sign-in page. Not sent for the sign-in call itself,
 * where a 401 just means a wrong password.
 */
export const SESSION_ENDED_EVENT = 'mpg:session-ended'

/** A 401: nobody is signed in, or the username/password was wrong. */
export class UnauthorizedError extends Error {}

async function errorMessage(response: Response): Promise<string> {
  // Vite's proxy answers 500/502/504 when the Spring Boot app isn't running.
  if (response.status >= 500) {
    return "Can't reach the backend. Is Spring Boot running on port 8080?"
  }
  try {
    const body = await response.json()
    // Spring returns problem+json: { title, detail, ... }
    return body.detail ?? body.title ?? `Request failed (${response.status})`
  } catch {
    return `Request failed (${response.status})`
  }
}

async function request(input: string, init?: RequestInit): Promise<Response> {
  let response: Response
  try {
    response = await fetch(input, init)
  } catch {
    throw new Error("Can't reach the backend. Is Spring Boot running on port 8080?")
  }
  if (response.status === 401) {
    if (!input.startsWith('/api/auth/')) window.dispatchEvent(new Event(SESSION_ENDED_EVENT))
    throw new UnauthorizedError(await errorMessage(response))
  }
  if (!response.ok) {
    throw new Error(await errorMessage(response))
  }
  return response
}

function sendJson(method: string, body: unknown): RequestInit {
  return { method, headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) }
}

// ---- Fuel logs (always the signed-in user's own) ----

export async function listFuelLogs(): Promise<FuelLog[]> {
  const response = await request(BASE)
  return response.json()
}

export async function createFuelLog(log: NewFuelLog): Promise<FuelLog> {
  const response = await request(BASE, sendJson('POST', log))
  return response.json()
}

/** previousOdometer is only used by the server when editing the oldest log. */
export async function updateFuelLog(id: number, log: NewFuelLog): Promise<FuelLog> {
  const response = await request(`${BASE}/${id}`, sendJson('PUT', log))
  return response.json()
}

export async function deleteFuelLog(id: number): Promise<void> {
  await request(`${BASE}/${id}`, { method: 'DELETE' })
}

// ---- Accounts ----

/** Who is signed in on this browser, or null if nobody. Called on load to restore the session. */
export async function getAccount(): Promise<Account | null> {
  try {
    const response = await request('/api/account')
    return response.json()
  } catch (e) {
    if (e instanceof UnauthorizedError) return null
    throw e
  }
}

/** Creates the account and signs in. Fails with "That username is already taken." on a clash. */
export async function signUp(username: string, name: string, password: string): Promise<Account> {
  const response = await request('/api/auth/signup', sendJson('POST', { username, name, password }))
  return response.json()
}

export async function signIn(username: string, password: string): Promise<Account> {
  const response = await request('/api/auth/signin', sendJson('POST', { username, password }))
  return response.json()
}

export async function signOut(): Promise<void> {
  await request('/api/auth/signout', { method: 'POST' })
}

/** Only the name can be changed for now. */
export async function updateAccount(name: string): Promise<Account> {
  const response = await request('/api/account', sendJson('PUT', { name }))
  return response.json()
}
