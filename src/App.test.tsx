import { StrictMode } from 'react'
import { act, fireEvent, render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { createFuelLog, deleteFuelLog, listFuelLogs, updateFuelLog } from './api.ts'
import App from './App.tsx'
import { TOAST_DURATION_MS } from './Toast.tsx'
import { makeLog, threeLogs } from './test/logs.ts'

vi.mock('./api.ts', () => ({
  listFuelLogs: vi.fn(),
  createFuelLog: vi.fn(),
  updateFuelLog: vi.fn(),
  deleteFuelLog: vi.fn(),
}))
const listMock = vi.mocked(listFuelLogs)
const createMock = vi.mocked(createFuelLog)
const updateMock = vi.mocked(updateFuelLog)
const deleteMock = vi.mocked(deleteFuelLog)

beforeEach(() => {
  vi.useFakeTimers({ toFake: ['Date'] })
  vi.setSystemTime(new Date(2026, 9, 24))
  listMock.mockReset().mockResolvedValue(threeLogs())
  createMock.mockReset()
  updateMock.mockReset()
  deleteMock.mockReset()
})

afterEach(() => {
  vi.useRealTimers()
})

async function renderApp() {
  render(<App />)
  await screen.findByText('Oct 15, 2026')
}

const type = (label: string, text: string) => userEvent.type(screen.getByLabelText(label), text)
const logButton = () => screen.getByRole('button', { name: /Log Fuel Entry|Saving…/ })

describe('loading', () => {
  it('shows Loading… then the history, newest first', async () => {
    render(<App />)
    expect(screen.getByText('Loading…')).toBeInTheDocument()

    const dates = await screen.findAllByText(/^Oct \d+, 2026$/)
    expect(dates.map((d) => d.textContent)).toEqual(['Oct 15, 2026', 'Oct 8, 2026', 'Oct 1, 2026'])
    expect(screen.getByText('Cost: $35.00')).toBeInTheDocument()
    expect(screen.queryByText('Loading…')).toBeNull()
  })

  it('shows an empty state with no logs', async () => {
    listMock.mockResolvedValue([])
    render(<App />)
    expect(await screen.findByText('No fuel entries logged yet.')).toBeInTheDocument()
  })

  it('shows a load error and retries', async () => {
    listMock.mockRejectedValueOnce(new Error('Backend down'))
    render(<App />)

    expect(await screen.findByRole('alert')).toHaveTextContent('Backend down')
    await userEvent.click(screen.getByRole('button', { name: 'Retry' }))

    expect(await screen.findByText('Oct 15, 2026')).toBeInTheDocument()
    expect(screen.queryByText('Backend down')).toBeNull()
  })

  it('keeps the error if the retry also fails', async () => {
    listMock.mockRejectedValue(new Error('Backend down'))
    render(<App />)
    await screen.findByRole('alert')

    listMock.mockRejectedValue(new Error('Still down'))
    await userEvent.click(screen.getByRole('button', { name: 'Retry' }))
    expect(await screen.findByText(/Still down/)).toBeInTheDocument()
  })

  it('ignores the first, discarded load under StrictMode', async () => {
    listMock.mockResolvedValueOnce([]).mockResolvedValue(threeLogs())
    render(
      <StrictMode>
        <App />
      </StrictMode>,
    )
    expect(await screen.findByText('Oct 15, 2026')).toBeInTheDocument()
    expect(screen.queryByText('No fuel entries logged yet.')).toBeNull()
  })

  it('ignores a discarded failed load under StrictMode', async () => {
    listMock.mockRejectedValueOnce(new Error('stale')).mockResolvedValue(threeLogs())
    render(
      <StrictMode>
        <App />
      </StrictMode>,
    )
    expect(await screen.findByText('Oct 15, 2026')).toBeInTheDocument()
    expect(screen.queryByText('stale')).toBeNull()
  })
})

describe('new fuel entry', () => {
  it('uses the latest odometer as previous and logs an entry', async () => {
    createMock.mockResolvedValue(makeLog(4, '2026-10-24', 12900, 13200))
    await renderApp()

    expect(screen.getByText('12,900 mi')).toBeInTheDocument()
    expect(logButton()).toBeDisabled()

    await type('Current Odometer', '13200')
    await type('Gallons Pumped', '10')
    await type('Price Per Gallon', '3.5')

    expect(screen.getByText('300 mi')).toBeInTheDocument()
    expect(screen.getByText('30.00')).toBeInTheDocument()
    expect(screen.getByText('$35.00')).toBeInTheDocument()

    await userEvent.click(logButton())

    expect(createMock).toHaveBeenCalledWith({
      date: '2026-10-24',
      previousOdometer: null,
      odometer: 13200,
      gallons: 10,
      pricePerGallon: 3.5,
    })
    expect(listMock).toHaveBeenCalledTimes(2)
    expect(screen.getByLabelText('Current Odometer')).toHaveValue('')
    expect(screen.getByLabelText('Gallons Pumped')).toHaveValue('')
    expect(screen.getByRole('status')).toHaveTextContent('Log saved')
  })

  it('asks for the previous odometer on the very first log and sends it', async () => {
    listMock.mockResolvedValue([])
    createMock.mockResolvedValue(makeLog(1, '2026-10-24', 12000, 12300))
    render(<App />)
    await screen.findByText('No fuel entries logged yet.')

    await type('Previous Odometer', '12000')
    await type('Current Odometer', '12300')
    await type('Gallons Pumped', '10')
    await type('Price Per Gallon', '3')
    await userEvent.click(logButton())

    expect(createMock).toHaveBeenCalledWith(expect.objectContaining({ previousOdometer: 12000 }))
    expect(screen.getByLabelText('Previous Odometer')).toHaveValue('')
  })

  it('explains why an equal or lower odometer is blocked', async () => {
    await renderApp()

    await type('Current Odometer', '12900')
    expect(screen.getByText('Current odometer must be greater than 12,900 mi.')).toBeInTheDocument()

    await userEvent.clear(screen.getByLabelText('Current Odometer'))
    expect(screen.queryByText(/Current odometer must be greater/)).toBeNull()
  })

  it('lets you pick a date and falls back to today when it is cleared', async () => {
    createMock.mockResolvedValue(makeLog(4, '2026-10-20', 12900, 13200))
    await renderApp()
    const date = screen.getByLabelText('Fuel Date')
    expect(date).toHaveValue('2026-10-24')

    fireEvent.change(date, { target: { value: '' } })
    expect(date).toHaveValue('2026-10-24')

    fireEvent.change(date, { target: { value: '2026-10-20' } })
    await type('Current Odometer', '13200')
    await type('Gallons Pumped', '10')
    await type('Price Per Gallon', '3')
    await userEvent.click(logButton())

    expect(createMock).toHaveBeenCalledWith(expect.objectContaining({ date: '2026-10-20' }))
    expect(date).toHaveValue('2026-10-24')
  })

  it('does not submit an invalid form with Enter', async () => {
    await renderApp()
    await type('Current Odometer', '12000{Enter}')
    expect(createMock).not.toHaveBeenCalled()
  })

  it('ignores a second submit while saving', async () => {
    let finish!: () => void
    createMock.mockReturnValue(new Promise((resolve) => (finish = () => resolve(makeLog(4, '2026-10-24', 12900, 13200)))))
    await renderApp()

    await type('Current Odometer', '13200')
    await type('Gallons Pumped', '10')
    await type('Price Per Gallon', '3')
    await userEvent.click(logButton())

    expect(logButton()).toHaveTextContent('Saving…')
    fireEvent.submit(logButton().closest('form')!)
    expect(createMock).toHaveBeenCalledOnce()

    finish()
    await vi.waitFor(() => expect(logButton()).toHaveTextContent('Log Fuel Entry'))
  })

  it('only lets numbers be typed into the number fields', async () => {
    await renderApp()

    await type('Current Odometer', '13,2a0-0 mi')
    await type('Gallons Pumped', '1x0.5.0 gal')
    await type('Price Per Gallon', '$3.4!9')

    expect(screen.getByLabelText('Current Odometer')).toHaveValue('13200')
    expect(screen.getByLabelText('Gallons Pumped')).toHaveValue('10.50')
    expect(screen.getByLabelText('Price Per Gallon')).toHaveValue('3.49')
  })

  it('shows a save error and keeps what was typed', async () => {
    createMock.mockRejectedValue(new Error('Gallons must be greater than 0.'))
    await renderApp()

    await type('Current Odometer', '13200')
    await type('Gallons Pumped', '10')
    await type('Price Per Gallon', '3')
    await userEvent.click(logButton())

    expect(await screen.findByRole('alert')).toHaveTextContent('Gallons must be greater than 0.')
    const toast = screen.getByRole('status')
    expect(toast).toHaveTextContent("Couldn't save log")
    expect(toast).toHaveClass('error')
    expect(screen.getByLabelText('Current Odometer')).toHaveValue('13200')
    expect(logButton()).toBeEnabled()
  })
})

describe('editing a log', () => {
  it('edits a row in place and refreshes after saving', async () => {
    updateMock.mockResolvedValue(makeLog(1, '2026-10-01', 12000, 12400))
    await renderApp()

    await userEvent.click(screen.getByRole('button', { name: 'Edit entry from Oct 1, 2026' }))
    const editor = screen.getByRole('form', { name: 'Edit entry from Oct 1, 2026' })

    // Oldest log: previous odometer is editable; the next log (12,600) is the upper bound.
    expect(within(editor).getByLabelText('Previous odometer')).toHaveValue('12000')
    await userEvent.clear(within(editor).getByLabelText('Odometer'))
    await userEvent.type(within(editor).getByLabelText('Odometer'), '12600')
    expect(within(editor).getByText('Odometer must be less than 12,600 mi (the next log).')).toBeInTheDocument()

    // Only one row at a time: the other Edit buttons are disabled.
    expect(screen.getByRole('button', { name: 'Edit entry from Oct 8, 2026' })).toBeDisabled()

    listMock.mockResolvedValue([
      makeLog(3, '2026-10-15', 12600, 12900, 10, 3.5),
      makeLog(2, '2026-10-08', 12400, 12600),
      makeLog(1, '2026-10-01', 12000, 12400),
    ])
    await userEvent.clear(within(editor).getByLabelText('Odometer'))
    await userEvent.type(within(editor).getByLabelText('Odometer'), '12400')
    await userEvent.click(within(editor).getByRole('button', { name: 'Save' }))

    expect(updateMock).toHaveBeenCalledWith(1, expect.objectContaining({ odometer: 12400, previousOdometer: 12000 }))
    expect(await screen.findByText('Odometer: 12,400 mi')).toBeInTheDocument()
    expect(screen.queryByRole('form', { name: /Edit entry/ })).toBeNull()
    expect(screen.getByText('Miles driven: 200')).toBeInTheDocument()
  })

  it('treats the newest log as having no next log', async () => {
    await renderApp()
    await userEvent.click(screen.getByRole('button', { name: 'Edit entry from Oct 15, 2026' }))
    const editor = screen.getByRole('form', { name: 'Edit entry from Oct 15, 2026' })

    expect(within(editor).queryByLabelText('Previous odometer')).toBeNull()
    await userEvent.clear(within(editor).getByLabelText('Odometer'))
    await userEvent.type(within(editor).getByLabelText('Odometer'), '50000')
    expect(within(editor).getByRole('button', { name: 'Save' })).toBeEnabled()
  })

  it('Cancel puts the row back unchanged', async () => {
    await renderApp()
    await userEvent.click(screen.getByRole('button', { name: 'Edit entry from Oct 8, 2026' }))
    await userEvent.type(screen.getByLabelText('Gallons'), '5')
    await userEvent.click(screen.getByRole('button', { name: 'Cancel' }))

    expect(screen.queryByRole('form', { name: /Edit entry/ })).toBeNull()
    expect(screen.getAllByText('Gallons: 10.00')).toHaveLength(3)
    expect(updateMock).not.toHaveBeenCalled()
  })
})

describe('deleting a log', () => {
  const deleteButton = (date: string) =>
    screen.getByRole('button', { name: `Delete entry from ${date}` })
  const dialog = () => screen.getByRole('alertdialog', { name: 'Delete Fuel Entry?' })
  const confirmDelete = (user: Pick<typeof userEvent, 'click'> = userEvent) =>
    user.click(within(dialog()).getByRole('button', { name: 'Delete' }))

  it('asks for confirmation in a dialog, and does nothing if cancelled', async () => {
    await renderApp()

    await userEvent.click(deleteButton('Oct 8, 2026'))
    expect(dialog()).toHaveTextContent('The entry from Oct 8, 2026 will be removed.')
    expect(within(dialog()).getByRole('button', { name: 'Cancel' })).toHaveFocus()

    await userEvent.click(within(dialog()).getByRole('button', { name: 'Cancel' }))
    expect(screen.queryByRole('alertdialog')).toBeNull()
    expect(deleteMock).not.toHaveBeenCalled()
  })

  it('cancels with Escape or a tap on the backdrop', async () => {
    await renderApp()

    await userEvent.click(deleteButton('Oct 8, 2026'))
    await userEvent.keyboard('a')
    expect(dialog()).toBeInTheDocument()
    await userEvent.keyboard('{Escape}')
    expect(screen.queryByRole('alertdialog')).toBeNull()

    await userEvent.click(deleteButton('Oct 8, 2026'))
    await userEvent.click(document.querySelector('.dialog-backdrop')!)
    expect(screen.queryByRole('alertdialog')).toBeNull()

    // A click inside the dialog itself doesn't dismiss it.
    await userEvent.click(deleteButton('Oct 8, 2026'))
    await userEvent.click(within(dialog()).getByText('Delete Fuel Entry?'))
    expect(dialog()).toBeInTheDocument()
    expect(deleteMock).not.toHaveBeenCalled()
  })

  it('deletes after confirming and refreshes', async () => {
    deleteMock.mockResolvedValue()
    await renderApp()

    listMock.mockResolvedValue([makeLog(1, '2026-10-01', 12000, 12300)])
    await userEvent.click(deleteButton('Oct 15, 2026'))
    await confirmDelete()

    expect(deleteMock).toHaveBeenCalledWith(3)
    expect(screen.queryByRole('alertdialog')).toBeNull()
    await vi.waitFor(() => expect(screen.queryByText('Oct 15, 2026')).toBeNull())
  })

  it('shows a "Log deleted" check mark that dismisses itself', async () => {
    vi.useFakeTimers({ toFake: ['Date', 'setTimeout', 'clearTimeout'], shouldAdvanceTime: true })
    vi.setSystemTime(new Date(2026, 9, 24))
    deleteMock.mockResolvedValue()
    await renderApp()

    const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime })
    await user.click(deleteButton('Oct 15, 2026'))
    await confirmDelete(user)
    const toast = await screen.findByRole('status')
    expect(toast).toHaveTextContent('Log deleted')
    expect(toast).toHaveClass('success')
    expect(toast.querySelector('svg.toast-icon')).not.toBeNull()

    act(() => vi.advanceTimersByTime(TOAST_DURATION_MS))
    expect(screen.queryByRole('status')).toBeNull()
  })

  it('shows a delete error', async () => {
    deleteMock.mockRejectedValue(new Error('Fuel log 3 not found.'))
    await renderApp()

    await userEvent.click(deleteButton('Oct 15, 2026'))
    await confirmDelete()
    expect(await screen.findByRole('alert')).toHaveTextContent('Fuel log 3 not found.')
    const toast = screen.getByRole('status')
    expect(toast).toHaveTextContent("Couldn't delete log")
    expect(toast).toHaveClass('error')
  })
})
