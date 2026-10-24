import type { FuelLog, NewFuelLog } from './fuel.ts'

// In development, Vite forwards /api/* to http://localhost:8080 (see vite.config.ts).
const BASE = '/api/fuel-logs'

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
  if (!response.ok) {
    throw new Error(await errorMessage(response))
  }
  return response
}

export async function listFuelLogs(): Promise<FuelLog[]> {
  const response = await request(BASE)
  return response.json()
}

export async function createFuelLog(log: NewFuelLog): Promise<FuelLog> {
  const response = await request(BASE, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(log),
  })
  return response.json()
}

export async function deleteFuelLog(id: number): Promise<void> {
  await request(`${BASE}/${id}`, { method: 'DELETE' })
}
