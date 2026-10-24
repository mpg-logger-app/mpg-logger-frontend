import { useState } from 'react'
import type { FormEvent, KeyboardEvent } from 'react'
import { updateFuelLog } from './api.ts'
import {
  calcMilesDriven,
  calcMpg,
  calcTotalCost,
  editProblem,
  formatLogDate,
  formatTwo,
  formatUsd,
  formatWhole,
  parseNumber,
} from './fuel.ts'
import type { FuelLog } from './fuel.ts'

interface Props {
  log: FuelLog
  /** Only the oldest log's previous odometer was typed in; the rest follow the log before them. */
  isOldest: boolean
  /** Odometer of the next (newer) log, or null if this is the latest log. */
  nextOdometer: number | null
  onSaved: () => Promise<void>
  onCancel: () => void
}

/** A history row turned into inputs, edited in place. */
export default function FuelLogEditor({ log, isOldest, nextOdometer, onSaved, onCancel }: Props) {
  const [date, setDate] = useState(log.date)
  const [previousOdometer, setPreviousOdometer] = useState(String(log.previousOdometer))
  const [odometer, setOdometer] = useState(String(log.odometer))
  const [gallons, setGallons] = useState(String(log.gallons))
  const [pricePerGallon, setPricePerGallon] = useState(String(log.pricePerGallon))

  const [saving, setSaving] = useState(false)
  const [saveError, setSaveError] = useState<string | null>(null)

  const previousValue = isOldest ? parseNumber(previousOdometer) : log.previousOdometer
  const odometerValue = parseNumber(odometer)
  const gallonsValue = parseNumber(gallons)
  const priceValue = parseNumber(pricePerGallon)

  const milesDriven = calcMilesDriven(previousValue, odometerValue)
  const mpg = calcMpg(milesDriven, gallonsValue)
  const totalCost = calcTotalCost(gallonsValue, priceValue)

  // Compared as numbers so "12300.0" counts as unchanged from 12300.
  const hasChanges =
    date !== log.date ||
    previousValue !== log.previousOdometer ||
    odometerValue !== log.odometer ||
    gallonsValue !== log.gallons ||
    priceValue !== log.pricePerGallon
  const problem = editProblem(previousValue, odometerValue, gallonsValue, priceValue, nextOdometer)
  const canSave = hasChanges && problem === null && !saving

  async function save(event: FormEvent) {
    event.preventDefault()
    if (!canSave) return
    setSaving(true)
    setSaveError(null)
    try {
      await updateFuelLog(log.id, {
        date,
        previousOdometer: isOldest ? previousValue : null,
        odometer: odometerValue!,
        gallons: gallonsValue!,
        pricePerGallon: priceValue!,
      })
      await onSaved()
    } catch (e) {
      setSaveError((e as Error).message)
      setSaving(false)
    }
  }

  function cancelOnEscape(event: KeyboardEvent) {
    if (event.key === 'Escape' && !saving) onCancel()
  }

  return (
    <form
      className="row history editing"
      onSubmit={save}
      onKeyDown={cancelOnEscape}
      aria-label={`Edit entry from ${formatLogDate(log.date)}`}
    >
      <div className="history-text">
        <label className="edit-field">
          <span>Date</span>
          <input type="date" value={date} onChange={(e) => setDate(e.target.value || log.date)} required />
        </label>

        {isOldest ? (
          <label className="edit-field">
            <span>Previous odometer</span>
            <input
              type="text"
              inputMode="numeric"
              value={previousOdometer}
              onChange={(e) => setPreviousOdometer(e.target.value)}
            />
          </label>
        ) : (
          <div className="edit-field">
            <span>Previous odometer</span>
            <span className="secondary">{formatWhole(log.previousOdometer)} mi</span>
          </div>
        )}

        <label className="edit-field">
          <span>Odometer</span>
          <input
            type="text"
            inputMode="numeric"
            value={odometer}
            onChange={(e) => setOdometer(e.target.value)}
            autoFocus
          />
        </label>

        <label className="edit-field">
          <span>Gallons</span>
          <input
            type="text"
            inputMode="decimal"
            value={gallons}
            onChange={(e) => setGallons(e.target.value)}
          />
        </label>

        <label className="edit-field">
          <span>Price/gal</span>
          <input
            type="text"
            inputMode="decimal"
            value={pricePerGallon}
            onChange={(e) => setPricePerGallon(e.target.value)}
          />
        </label>

        <div className="secondary">
          Miles driven: {milesDriven !== null ? formatWhole(milesDriven) : '–'} · Cost:{' '}
          {formatUsd(totalCost)} · MPG: {mpg !== null ? formatTwo(mpg) : '–'}
        </div>

        {hasChanges && problem && <div className="edit-problem">{problem}</div>}
        {saveError && (
          <div className="edit-problem" role="alert">
            {saveError}
          </div>
        )}
      </div>

      <div className="row-actions">
        <button type="submit" className="save" disabled={!canSave}>
          {saving ? 'Saving…' : 'Save'}
        </button>
        <button type="button" className="cancel" onClick={onCancel} disabled={saving}>
          Cancel
        </button>
      </div>
    </form>
  )
}
