import { useCallback, useEffect, useState } from 'react'
import type { FormEvent } from 'react'
import { createFuelLog, deleteFuelLog, listFuelLogs } from './api.ts'
import FuelLogEditor from './FuelLogEditor.tsx'
import {
  calcMilesDriven,
  calcMpg,
  calcTotalCost,
  formatLogDate,
  formatTwo,
  formatUsd,
  formatWhole,
  isFormValid,
  parseNumber,
  todayIso,
} from './fuel.ts'
import type { FuelLog } from './fuel.ts'

// Port of ContentView.swift
export default function App() {
  // Swift: @Query(sort: \FuelLog.odometer, order: .reverse) — the API returns them in that order.
  const [fuelLogs, setFuelLogs] = useState<FuelLog[] | null>(null)
  const [loadError, setLoadError] = useState<string | null>(null)

  const [fuelDate, setFuelDate] = useState(todayIso())
  const [firstPreviousOdometer, setFirstPreviousOdometer] = useState('') // first log only
  const [currentOdometer, setCurrentOdometer] = useState('')
  const [gallons, setGallons] = useState('')
  const [pricePerGallon, setPricePerGallon] = useState('')

  const [saving, setSaving] = useState(false)
  const [actionError, setActionError] = useState<string | null>(null)

  // The history row being edited in place (one at a time).
  const [editingId, setEditingId] = useState<number | null>(null)

  const refresh = useCallback(async () => {
    try {
      setFuelLogs(await listFuelLogs())
      setLoadError(null)
    } catch (e) {
      setLoadError((e as Error).message)
    }
  }, [])

  // Initial load. The `ignore` flag stops a stale response from being applied
  // if React runs the effect twice (it does in development with StrictMode).
  useEffect(() => {
    let ignore = false
    listFuelLogs().then(
      (data) => {
        if (!ignore) setFuelLogs(data)
      },
      (e: Error) => {
        if (!ignore) setLoadError(e.message)
      },
    )
    return () => {
      ignore = true
    }
  }, [])

  // ---- Derived values (same rules as the Swift computed properties) ----
  const logs = fuelLogs ?? []
  const isFirstFuelLog = logs.length === 0
  const previousOdometerValue = isFirstFuelLog
    ? parseNumber(firstPreviousOdometer)
    : logs[0].odometer
  const currentValue = parseNumber(currentOdometer)
  const gallonsValue = parseNumber(gallons)
  const priceValue = parseNumber(pricePerGallon)

  const milesDriven = calcMilesDriven(previousOdometerValue, currentValue)
  const calculatedMpg = calcMpg(milesDriven, gallonsValue)
  const totalCost = calcTotalCost(gallonsValue, priceValue)
  const formIsValid =
    fuelLogs !== null && isFormValid(previousOdometerValue, currentValue, gallonsValue, priceValue)
  // Only shown once both readings are typed, so an empty form isn't covered in errors.
  const odometerProblem =
    previousOdometerValue !== null && currentValue !== null && !(currentValue > previousOdometerValue)
      ? `Current odometer must be greater than ${formatWhole(previousOdometerValue)} mi.`
      : null

  // Swift: logFuelEntry()
  async function logFuelEntry(event: FormEvent) {
    event.preventDefault()
    if (!formIsValid || saving) return
    setSaving(true)
    setActionError(null)
    try {
      await createFuelLog({
        date: fuelDate,
        previousOdometer: isFirstFuelLog ? previousOdometerValue : null,
        odometer: currentValue!,
        gallons: gallonsValue!,
        pricePerGallon: priceValue!,
      })
      // Clear the form
      setFirstPreviousOdometer('')
      setCurrentOdometer('')
      setGallons('')
      setPricePerGallon('')
      setFuelDate(todayIso())
      await refresh()
    } catch (e) {
      setActionError((e as Error).message)
    } finally {
      setSaving(false)
    }
  }

  // Swift: deleteLogs(at:) — swipe-to-delete becomes a Delete button with a confirmation.
  async function deleteLog(log: FuelLog) {
    if (!window.confirm(`Delete the fuel entry from ${formatLogDate(log.date)}?`)) return
    setActionError(null)
    try {
      await deleteFuelLog(log.id)
      await refresh()
    } catch (e) {
      setActionError((e as Error).message)
    }
  }

  return (
    <main className="app">
      <h1>MPG Logger</h1>

      {loadError && (
        <div className="banner error" role="alert">
          {loadError}{' '}
          <button type="button" className="link" onClick={() => void refresh()}>
            Retry
          </button>
        </div>
      )}

      <form onSubmit={logFuelEntry}>
        <section>
          <h2>New Fuel Entry</h2>
          <div className="card">
            <label className="row">
              <span>Fuel Date</span>
              <input
                type="date"
                value={fuelDate}
                onChange={(e) => setFuelDate(e.target.value || todayIso())}
                required
              />
            </label>

            {isFirstFuelLog ? (
              <label className="row">
                <span className="sr-only">Previous Odometer</span>
                <input
                  className="full"
                  type="text"
                  inputMode="numeric"
                  placeholder="Previous Odometer"
                  value={firstPreviousOdometer}
                  onChange={(e) => setFirstPreviousOdometer(e.target.value)}
                />
              </label>
            ) : (
              <div className="row">
                <span>Previous Odometer</span>
                <span className="secondary">{formatWhole(previousOdometerValue!)} mi</span>
              </div>
            )}

            <label className="row">
              <span className="sr-only">Current Odometer</span>
              <input
                className="full"
                type="text"
                inputMode="numeric"
                placeholder="Current Odometer"
                value={currentOdometer}
                onChange={(e) => setCurrentOdometer(e.target.value)}
              />
            </label>
            {odometerProblem && <div className="row edit-problem">{odometerProblem}</div>}

            <label className="row">
              <span className="sr-only">Gallons Pumped</span>
              <input
                className="full"
                type="text"
                inputMode="decimal"
                placeholder="Gallons Pumped"
                value={gallons}
                onChange={(e) => setGallons(e.target.value)}
              />
            </label>

            <label className="row">
              <span className="sr-only">Price Per Gallon</span>
              <input
                className="full"
                type="text"
                inputMode="decimal"
                placeholder="Price Per Gallon"
                value={pricePerGallon}
                onChange={(e) => setPricePerGallon(e.target.value)}
              />
            </label>
          </div>
        </section>

        <section>
          <h2>Calculation</h2>
          <div className="card">
            {milesDriven !== null && (
              <div className="row">
                <span>Miles Driven</span>
                <span>{formatWhole(milesDriven)} mi</span>
              </div>
            )}
            {calculatedMpg !== null && (
              <div className="row">
                <span>MPG</span>
                <span className="semibold">{formatTwo(calculatedMpg)}</span>
              </div>
            )}
            <div className="row">
              <span>Fuel Cost</span>
              <span>{formatUsd(totalCost)}</span>
            </div>
          </div>
        </section>

        <section>
          <div className="card">
            <button type="submit" className="primary" disabled={!formIsValid || saving}>
              <span aria-hidden="true">⛽</span> {saving ? 'Saving…' : 'Log Fuel Entry'}
            </button>
          </div>
          {actionError && (
            <div className="banner error" role="alert">
              {actionError}
            </div>
          )}
        </section>
      </form>

      <section>
        <h2>Fuel History</h2>
        <div className="card">
          {fuelLogs === null && !loadError && <div className="row secondary">Loading…</div>}
          {fuelLogs !== null && logs.length === 0 && (
            <div className="row secondary">No fuel entries logged yet.</div>
          )}
          {logs.map((log, index) =>
            log.id === editingId ? (
              <FuelLogEditor
                key={log.id}
                log={log}
                // Logs are newest first, so the oldest is last and the next (newer) log is just above.
                isOldest={index === logs.length - 1}
                nextOdometer={index > 0 ? logs[index - 1].odometer : null}
                onSaved={async () => {
                  await refresh()
                  setEditingId(null)
                }}
                onCancel={() => setEditingId(null)}
              />
            ) : (
              <div className="row history" key={log.id}>
                <div className="history-text">
                  <div className="headline">{formatLogDate(log.date)}</div>
                  <div>Odometer: {formatWhole(log.odometer)} mi</div>
                  <div>Miles driven: {formatWhole(log.milesDriven)}</div>
                  <div>Gallons: {formatTwo(log.gallons)}</div>
                  <div>Price: {formatUsd(log.pricePerGallon)}/gal</div>
                  <div>Cost: {formatUsd(log.totalCost)}</div>
                  <div className="bold">MPG: {formatTwo(log.mpg)}</div>
                </div>
                <div className="row-actions">
                  <button
                    type="button"
                    className="edit"
                    onClick={() => setEditingId(log.id)}
                    disabled={editingId !== null}
                    aria-label={`Edit entry from ${formatLogDate(log.date)}`}
                  >
                    Edit
                  </button>
                  <button
                    type="button"
                    className="delete"
                    onClick={() => void deleteLog(log)}
                    aria-label={`Delete entry from ${formatLogDate(log.date)}`}
                  >
                    Delete
                  </button>
                </div>
              </div>
            ),
          )}
        </div>
      </section>
    </main>
  )
}
