// Tests for FuelLogEditor.tsx: editing a history row in place, its rules and its Save/Cancel behaviour.
import { fireEvent, render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { updateFuelLog } from './api.ts'
import FuelLogEditor from './FuelLogEditor.tsx'
import { makeLog } from './test/logs.ts'

vi.mock('./api.ts', () => ({ updateFuelLog: vi.fn() }))
const updateMock = vi.mocked(updateFuelLog)

const middleLog = makeLog(2, '2026-10-08', 12300, 12600)

/** Renders the editor for a log with mocked callbacks, and returns the callbacks to check. */
function renderEditor(props: Partial<Parameters<typeof FuelLogEditor>[0]> = {}) {
  const onSaved = vi.fn(async () => {})
  const onCancel = vi.fn()
  render(
    <FuelLogEditor
      log={middleLog}
      isOldest={false}
      nextOdometer={12900}
      onSaved={onSaved}
      onCancel={onCancel}
      {...props}
    />,
  )
  return { onSaved, onCancel, save: screen.getByRole('button', { name: 'Save' }) }
}

/** Clears the field with this label and types new text into it. */
async function replace(label: string, text: string) {
  const input = screen.getByLabelText(label)
  await userEvent.clear(input)
  if (text) await userEvent.type(input, text)
}

beforeEach(() => {
  updateMock.mockReset()
})

describe('FuelLogEditor', () => {
  /** The editor opens with the log's values, ready to change the odometer. */
  it('starts with the log values, Save disabled and the odometer focused', () => {
    const { save } = renderEditor()

    expect(screen.getByLabelText('Date')).toHaveValue('2026-10-08')
    expect(screen.getByLabelText('Odometer')).toHaveValue('12600')
    expect(screen.getByLabelText('Odometer')).toHaveFocus()
    expect(screen.getByLabelText('Gallons')).toHaveValue('10')
    expect(screen.getByLabelText('Price/gal')).toHaveValue('3')
    expect(screen.getByText('Miles driven: 300 · Cost: $30.00 · MPG: 30.00')).toBeInTheDocument()
    expect(save).toBeDisabled()
  })

  /** Only the oldest log's previous odometer can be edited; later logs follow the log before them. */
  it('shows previous odometer read-only unless it is the oldest log', () => {
    renderEditor()
    expect(screen.queryByLabelText('Previous odometer')).toBeNull()
    expect(screen.getByText('12,300 mi')).toBeInTheDocument()
  })

  /** The oldest log's new previous odometer is sent with the edit. */
  it('lets the oldest log edit its previous odometer and sends it', async () => {
    const oldest = makeLog(1, '2026-10-01', 12000, 12300)
    updateMock.mockResolvedValue(oldest)
    const { save, onSaved } = renderEditor({ log: oldest, isOldest: true, nextOdometer: 12600 })

    await replace('Previous odometer', '11900')
    expect(screen.getByText('Miles driven: 400 · Cost: $30.00 · MPG: 40.00')).toBeInTheDocument()
    await userEvent.click(save)

    expect(updateMock).toHaveBeenCalledWith(1, {
      date: '2026-10-01',
      previousOdometer: 11900,
      odometer: 12300,
      gallons: 10,
      pricePerGallon: 3,
    })
    expect(onSaved).toHaveBeenCalledOnce()
  })

  /** Save waits for a real change; "12300.0" counts the same as 12300. */
  it('enables Save only after a real change', async () => {
    const { save } = renderEditor()

    await replace('Gallons', '10.0') // same number, different text
    expect(save).toBeDisabled()
    await replace('Gallons', '10')

    await replace('Odometer', '12650')
    expect(save).toBeEnabled()

    await replace('Odometer', '12600')
    expect(save).toBeDisabled()
  })

  it.each([
    ['Gallons', '12'],
    ['Price/gal', '3.25'],
  ])('counts a change to %s', async (label, value) => {
    const { save } = renderEditor()
    await replace(label, value)
    expect(save).toBeEnabled()
  })

  /** Changing the date counts as a change; clearing it restores the log's date. */
  it('counts a date change, and keeps the old date if the field is cleared', () => {
    const { save } = renderEditor()
    const date = screen.getByLabelText('Date')

    fireEvent.change(date, { target: { value: '2026-10-09' } })
    expect(save).toBeEnabled()

    fireEvent.change(date, { target: { value: '' } })
    expect(date).toHaveValue('2026-10-08')
    expect(save).toBeDisabled()
  })

  /** Later logs send previousOdometer as null, so the server keeps the chain intact. */
  it('sends the edit without previousOdometer for a later log', async () => {
    updateMock.mockResolvedValue(middleLog)
    const { save, onSaved } = renderEditor()

    await replace('Odometer', '12650')
    await replace('Gallons', '12.5')
    await userEvent.click(save)

    expect(updateMock).toHaveBeenCalledWith(2, {
      date: '2026-10-08',
      previousOdometer: null,
      odometer: 12650,
      gallons: 12.5,
      pricePerGallon: 3,
    })
    expect(onSaved).toHaveBeenCalledOnce()
  })

  /** An odometer that doesn't go up is explained and can't be saved. */
  it('blocks an odometer equal to the previous reading', async () => {
    const { save } = renderEditor()
    await replace('Odometer', '12300')

    expect(save).toBeDisabled()
    expect(screen.getByText('Odometer must be greater than 12,300 mi.')).toBeInTheDocument()
    expect(screen.getByText('Miles driven: – · Cost: $30.00 · MPG: –')).toBeInTheDocument()
  })

  /** An odometer reaching the next log's is explained and can't be saved. */
  it('blocks an odometer that reaches the next log', async () => {
    const { save } = renderEditor()
    await replace('Odometer', '12900')

    expect(save).toBeDisabled()
    expect(screen.getByText('Odometer must be less than 12,900 mi (the next log).')).toBeInTheDocument()
  })

  /** The latest log's odometer has no upper limit. */
  it('lets the latest log move its odometer up freely', async () => {
    const { save } = renderEditor({ nextOdometer: null })
    await replace('Odometer', '99999')
    expect(save).toBeEnabled()
  })

  /** Submitting an unchanged editor sends nothing. */
  it('does not save when nothing changed, even if the form is submitted', async () => {
    const { save } = renderEditor()
    await userEvent.type(screen.getByLabelText('Gallons'), '{Enter}')
    // The browser skips Enter-submit while Save is disabled; force it to hit the guard too.
    fireEvent.submit(save.closest('form')!)
    expect(updateMock).not.toHaveBeenCalled()
  })

  /** While saving, both buttons are disabled and Escape does nothing. */
  it('shows "Saving…" and disables both buttons while saving', async () => {
    let finish!: () => void
    updateMock.mockReturnValue(new Promise((resolve) => (finish = () => resolve(middleLog))))
    const { save, onCancel } = renderEditor()

    await replace('Gallons', '11')
    await userEvent.click(save)

    expect(screen.getByRole('button', { name: 'Saving…' })).toBeDisabled()
    expect(screen.getByRole('button', { name: 'Cancel' })).toBeDisabled()
    // Escape is ignored mid-save.
    fireEvent.keyDown(screen.getByLabelText('Gallons'), { key: 'Escape' })
    expect(onCancel).not.toHaveBeenCalled()

    finish()
    await vi.waitFor(() => expect(updateMock).toHaveBeenCalledOnce())
  })

  /** A failed save shows the server's reason and the editor stays open for another try. */
  it('shows the server error and allows another try', async () => {
    updateMock.mockRejectedValueOnce(new Error('Current odometer must be less than the next log.'))
    const { save, onSaved } = renderEditor()

    await replace('Gallons', '11')
    await userEvent.click(save)

    expect(await screen.findByRole('alert')).toHaveTextContent('Current odometer must be less than the next log.')
    expect(onSaved).not.toHaveBeenCalled()
    expect(save).toBeEnabled()
  })

  /** Both Cancel and Escape close the editor. */
  it('Cancel and Escape call onCancel', async () => {
    const { onCancel } = renderEditor()

    await userEvent.click(screen.getByRole('button', { name: 'Cancel' }))
    fireEvent.keyDown(screen.getByLabelText('Odometer'), { key: 'Escape' })
    fireEvent.keyDown(screen.getByLabelText('Odometer'), { key: 'a' })

    expect(onCancel).toHaveBeenCalledTimes(2)
    expect(updateMock).not.toHaveBeenCalled()
  })
})
