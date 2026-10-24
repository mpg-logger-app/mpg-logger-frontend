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

/**
 * A readable message for a failed response.
 *
 * @param response a response that wasn't ok
 * @returns the problem+json detail or title, or a fallback with the status code
 */
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

/**
 * fetch(), with every failure turned into an Error carrying a message fit to show.
 *
 * @param input the API path, e.g. "/api/fuel-logs"
 * @param init method, headers and body, as for fetch()
 * @returns the response, only if it was ok
 * @throws UnauthorizedError for a 401 (and SESSION_ENDED_EVENT, except for /api/auth/*)
 * @throws Error for other failures, including an unreachable backend
 */
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

/**
 * fetch() options for sending JSON.
 *
 * @param method e.g. "POST" or "PUT"
 * @param body the value to send as JSON
 * @returns the options for request()
 */
function sendJson(method: string, body: unknown): RequestInit {
  return { method, headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) }
}

// ---- Fuel logs (always the signed-in user's own) ----

/** @returns the signed-in user's logs, newest (highest odometer) first */
export async function listFuelLogs(): Promise<FuelLog[]> {
  const response = await request(BASE)
  return response.json()
}

/**
 * Logs a fill-up.
 *
 * @param log the fill-up; previousOdometer is only used for the very first log
 * @returns the saved log, with the calculated values
 */
export async function createFuelLog(log: NewFuelLog): Promise<FuelLog> {
  const response = await request(BASE, sendJson('POST', log))
  return response.json()
}

/**
 * Edits a log. previousOdometer is only used by the server when editing the oldest log.
 *
 * @param id the log to edit
 * @param log the new values
 * @returns the edited log
 */
export async function updateFuelLog(id: number, log: NewFuelLog): Promise<FuelLog> {
  const response = await request(`${BASE}/${id}`, sendJson('PUT', log))
  return response.json()
}

/** @param id the log to delete */
export async function deleteFuelLog(id: number): Promise<void> {
  await request(`${BASE}/${id}`, { method: 'DELETE' })
}

// ---- Accounts ----

/**
 * Who is signed in on this browser. Called on load to restore the session.
 *
 * @returns the account, or null if nobody is signed in
 * @throws Error if the backend can't be reached
 */
export async function getAccount(): Promise<Account | null> {
  try {
    const response = await request('/api/account')
    return response.json()
  } catch (e) {
    if (e instanceof UnauthorizedError) return null
    throw e
  }
}

/**
 * Creates the account and signs in (the backend sets the session cookie).
 *
 * @param username the wanted username
 * @param name the name to show
 * @param password the password
 * @returns the new account
 * @throws Error "That username is already taken." on a clash, or the broken rule's message
 */
export async function signUp(username: string, name: string, password: string): Promise<Account> {
  const response = await request('/api/auth/signup', sendJson('POST', { username, name, password }))
  return response.json()
}

/**
 * Signs in (the backend sets the session cookie).
 *
 * @param username the username, any case
 * @param password the password
 * @returns the account
 * @throws UnauthorizedError "Wrong username or password."
 */
export async function signIn(username: string, password: string): Promise<Account> {
  const response = await request('/api/auth/signin', sendJson('POST', { username, password }))
  return response.json()
}

/** Ends this browser's session (the backend clears the cookie). */
export async function signOut(): Promise<void> {
  await request('/api/auth/signout', { method: 'POST' })
}

/**
 * Changes the signed-in user's name. Only the name can be changed for now.
 *
 * @param name the new name
 * @returns the updated account
 */
export async function updateAccount(name: string): Promise<Account> {
  const response = await request('/api/account', sendJson('PUT', { name }))
  return response.json()
}
