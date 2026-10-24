import { beforeEach, describe, expect, it, vi } from 'vitest'
import { createFuelLog, deleteFuelLog, listFuelLogs, updateFuelLog } from './api.ts'
import { makeLog } from './test/logs.ts'

const NOT_RUNNING = "Can't reach the backend. Is Spring Boot running on port 8080?"
const entry = { date: '2026-10-01', previousOdometer: null, odometer: 12300, gallons: 10, pricePerGallon: 3 }

function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json' } })
}

let fetchMock: ReturnType<typeof vi.fn>

beforeEach(() => {
  fetchMock = vi.fn()
  vi.stubGlobal('fetch', fetchMock)
})

describe('requests', () => {
  it('listFuelLogs GETs all logs', async () => {
    const logs = [makeLog(1, '2026-10-01', 12000, 12300)]
    fetchMock.mockResolvedValue(jsonResponse(logs))

    await expect(listFuelLogs()).resolves.toEqual(logs)
    expect(fetchMock).toHaveBeenCalledWith('/api/fuel-logs', undefined)
  })

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

  it('deleteFuelLog DELETEs the log', async () => {
    fetchMock.mockResolvedValue(new Response(null, { status: 204 }))

    await expect(deleteFuelLog(7)).resolves.toBeUndefined()
    expect(fetchMock).toHaveBeenCalledWith('/api/fuel-logs/7', { method: 'DELETE' })
  })
})

describe('errors', () => {
  it('reports an unreachable backend when fetch itself fails', async () => {
    fetchMock.mockRejectedValue(new TypeError('Failed to fetch'))
    await expect(listFuelLogs()).rejects.toThrow(NOT_RUNNING)
  })

  it('reports an unreachable backend for 5xx (Vite proxy with Spring Boot down)', async () => {
    fetchMock.mockResolvedValue(new Response('', { status: 502 }))
    await expect(listFuelLogs()).rejects.toThrow(NOT_RUNNING)
  })

  it('uses the problem+json detail', async () => {
    fetchMock.mockResolvedValue(jsonResponse({ title: 'Invalid fuel log', detail: 'Gallons must be greater than 0.' }, 400))
    await expect(createFuelLog(entry)).rejects.toThrow('Gallons must be greater than 0.')
  })

  it('falls back to the title when there is no detail', async () => {
    fetchMock.mockResolvedValue(jsonResponse({ title: 'Not Found' }, 404))
    await expect(deleteFuelLog(1)).rejects.toThrow('Not Found')
  })

  it('falls back to the status when the JSON has neither', async () => {
    fetchMock.mockResolvedValue(jsonResponse({}, 409))
    await expect(updateFuelLog(1, entry)).rejects.toThrow('Request failed (409)')
  })

  it('falls back to the status when the body is not JSON', async () => {
    fetchMock.mockResolvedValue(new Response('oops', { status: 400 }))
    await expect(updateFuelLog(1, entry)).rejects.toThrow('Request failed (400)')
  })
})
