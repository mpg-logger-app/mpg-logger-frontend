import { useCallback, useEffect, useState } from 'react'
import type { FormEvent } from 'react'
import { createFuelLog, deleteFuelLog, listFuelLogs } from './api.ts'
import ConfirmDialog from './ConfirmDialog.tsx'
import FuelLogEditor from './FuelLogEditor.tsx'
import Toast from './Toast.tsx'
import type { ToastVariant } from './Toast.tsx'
import {
  calcMilesDriven,
  calcMpg,
  calcTotalCost,
  decimalOnly,
  digitsOnly,
  formatLogDate,
  formatTwo,
  formatUsd,
  formatWhole,
  isFormValid,
  parseNumber,
  todayIso,
} from './fuel.ts'
import type { FuelLog } from './fuel.ts'

/**
 * The fuel log at /home, ported from ContentView.swift: the New Fuel Entry form with its live
 * calculation, and the history with edit and delete.
 *
 * @returns the page (two columns on desktop, one on phones)
 */
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

  // The log waiting on the delete confirmation dialog.
  const [pendingDelete, setPendingDelete] = useState<FuelLog | null>(null)
  const cancelDelete = useCallback(() => setPendingDelete(null), [])

  // The status toast; `key` is bumped each time so the animation replays. null hides it.
  const [toast, setToast] = useState<{ key: number; message: string; variant: ToastVariant } | null>(
    null,
  )
  /**
   * Shows the toast, replaying its animation even for the same message.
   *
   * @param message e.g. "Log saved"
   * @param variant success (default) or error
   */
  const showToast = (message: string, variant: ToastVariant = 'success') =>
    setToast((t) => ({ key: (t?.key ?? 0) + 1, message, variant }))
  /** Removes the toast once it has finished (called by Toast). */
  const hideToast = useCallback(() => setToast(null), [])

  /** Reloads the history from the server; a failure shows the load error with Retry. */
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

  /**
   * Swift: logFuelEntry(). Saves the form, then clears it and reloads the history.
   * On failure the typed values stay and the reason is shown.
   *
   * @param event the form submit (button or Enter)
   */
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
      showToast('Log saved')
      await refresh()
    } catch (e) {
      // The toast says what failed; the banner keeps the reason on screen after it fades.
      showToast("Couldn't save log", 'error')
      setActionError((e as Error).message)
    } finally {
      setSaving(false)
    }
  }

  /**
   * Swift: deleteLogs(at:) — swipe-to-delete becomes a Delete button with a confirmation dialog.
   * Called once the dialog is confirmed.
   *
   * @param log the log to delete
   */
  async function deleteLog(log: FuelLog) {
    setPendingDelete(null)
    setActionError(null)
    try {
      await deleteFuelLog(log.id)
      showToast('Log deleted')
      await refresh()
    } catch (e) {
      showToast("Couldn't delete log", 'error')
      setActionError((e as Error).message)
    }
  }

  return (
    <main className="app">
      <h1>Fuel Log</h1>

      {loadError && (
        <div className="banner error" role="alert">
          {loadError}{' '}
          <button type="button" className="link" onClick={() => void refresh()}>
            Retry
          </button>
        </div>
      )}

      {/* Desktop: the entry form on the left, history on the right. Phones: one column. */}
      <div className="app-columns">
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
                    onChange={(e) => setFirstPreviousOdometer(digitsOnly(e.target.value))}
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
                  onChange={(e) => setCurrentOdometer(digitsOnly(e.target.value))}
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
                  onChange={(e) => setGallons(decimalOnly(e.target.value))}
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
                  onChange={(e) => setPricePerGallon(decimalOnly(e.target.value))}
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

        <section className="history-section">
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
                      onClick={() => setPendingDelete(log)}
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
      </div>

      {pendingDelete && (
        <ConfirmDialog
          title="Delete Fuel Entry?"
          message={`The entry from ${formatLogDate(pendingDelete.date)} will be removed. This can't be undone.`}
          confirmLabel="Delete"
          onConfirm={() => void deleteLog(pendingDelete)}
          onCancel={cancelDelete}
        />
      )}

      {toast && (
        <Toast key={toast.key} message={toast.message} variant={toast.variant} onDone={hideToast} />
      )}
    </main>
  )
}
