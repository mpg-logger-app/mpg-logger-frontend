import { afterEach, describe, expect, it, vi } from 'vitest'
import {
  calcMilesDriven,
  calcMpg,
  calcTotalCost,
  editProblem,
  formatLogDate,
  formatTwo,
  formatUsd,
  formatWhole,
  isFormValid,
  parseNumber,
  todayIso,
  decimalOnly,
  digitsOnly,
} from './fuel.ts'

describe('parseNumber', () => {
  it('reads plain numbers', () => {
    expect(parseNumber('12300')).toBe(12300)
    expect(parseNumber('3.49')).toBe(3.49)
    expect(parseNumber('10.')).toBe(10)
    expect(parseNumber('.5')).toBe(0.5)
  })

  it('returns null for empty or invalid text (like Swift Double("..."))', () => {
    for (const text of ['', ' ', 'abc', '1,000', '-5', '1e3', '1.2.3', '.']) {
      expect(parseNumber(text)).toBeNull()
    }
  })

  it('returns null for a number too big to be finite', () => {
    expect(parseNumber('9'.repeat(400))).toBeNull()
  })
})

describe('input filters', () => {
  it('digitsOnly drops everything but digits', () => {
    expect(digitsOnly('12300')).toBe('12300')
    expect(digitsOnly('12,3a0-0 mi!')).toBe('12300')
    expect(digitsOnly('12.5')).toBe('125')
    expect(digitsOnly('abc')).toBe('')
  })

  it('decimalOnly keeps digits and the first decimal point', () => {
    expect(decimalOnly('3.49')).toBe('3.49')
    expect(decimalOnly('$3.4.9')).toBe('3.49')
    expect(decimalOnly('10.')).toBe('10.')
    expect(decimalOnly('.5')).toBe('.5')
    expect(decimalOnly('-1e3 gal')).toBe('13')
    expect(decimalOnly('abc')).toBe('')
  })
})

describe('calculations', () => {
  it('calcMilesDriven needs current > previous', () => {
    expect(calcMilesDriven(12000, 12300)).toBe(300)
    expect(calcMilesDriven(12000, 12000)).toBeNull()
    expect(calcMilesDriven(12000, 11999)).toBeNull()
    expect(calcMilesDriven(null, 12300)).toBeNull()
    expect(calcMilesDriven(12000, null)).toBeNull()
  })

  it('calcMpg needs miles and gallons > 0', () => {
    expect(calcMpg(300, 10)).toBe(30)
    expect(calcMpg(300, 0)).toBeNull()
    expect(calcMpg(null, 10)).toBeNull()
    expect(calcMpg(300, null)).toBeNull()
  })

  it('calcTotalCost treats missing values as 0', () => {
    expect(calcTotalCost(10, 3.5)).toBe(35)
    expect(calcTotalCost(null, 3.5)).toBe(0)
    expect(calcTotalCost(10, null)).toBe(0)
  })
})

describe('isFormValid', () => {
  it('accepts a complete, valid entry', () => {
    expect(isFormValid(12000, 12300, 10, 3.49)).toBe(true)
  })

  it('rejects missing values', () => {
    expect(isFormValid(null, 12300, 10, 3.49)).toBe(false)
    expect(isFormValid(12000, null, 10, 3.49)).toBe(false)
    expect(isFormValid(12000, 12300, null, 3.49)).toBe(false)
    expect(isFormValid(12000, 12300, 10, null)).toBe(false)
  })

  it('rejects zero values and equal or lower readings', () => {
    expect(isFormValid(0, 12300, 10, 3.49)).toBe(false)
    expect(isFormValid(12000, 12000, 10, 3.49)).toBe(false)
    expect(isFormValid(12000, 12300, 0, 3.49)).toBe(false)
    expect(isFormValid(12000, 12300, 10, 0)).toBe(false)
  })
})

describe('editProblem', () => {
  it('is null for a valid edit', () => {
    expect(editProblem(12000, 12300, 10, 3, 12600)).toBeNull()
    expect(editProblem(12000, 99999, 10, 3, null)).toBeNull()
  })

  it('explains each broken rule', () => {
    expect(editProblem(null, 12300, 10, 3, null)).toBe('Previous odometer must be greater than 0.')
    expect(editProblem(0, 12300, 10, 3, null)).toBe('Previous odometer must be greater than 0.')
    expect(editProblem(12000, null, 10, 3, null)).toBe('Odometer must be greater than 12,000 mi.')
    expect(editProblem(12000, 12000, 10, 3, null)).toBe('Odometer must be greater than 12,000 mi.')
    expect(editProblem(12000, 12600, 10, 3, 12600)).toBe(
      'Odometer must be less than 12,600 mi (the next log).',
    )
    expect(editProblem(12000, 12300, null, 3, null)).toBe('Gallons must be greater than 0.')
    expect(editProblem(12000, 12300, 0, 3, null)).toBe('Gallons must be greater than 0.')
    expect(editProblem(12000, 12300, 10, null, null)).toBe('Price per gallon must be greater than 0.')
    expect(editProblem(12000, 12300, 10, 0, null)).toBe('Price per gallon must be greater than 0.')
  })
})

describe('formatting', () => {
  it('formats numbers like the Swift app', () => {
    expect(formatWhole(12345.6)).toBe('12,346')
    expect(formatTwo(3)).toBe('3.00')
    expect(formatUsd(34.9)).toBe('$34.90')
  })

  it('formats an ISO date as a local date (no off-by-one day)', () => {
    expect(formatLogDate('2026-10-23')).toBe('Oct 23, 2026')
  })
})

describe('todayIso', () => {
  afterEach(() => {
    vi.useRealTimers()
  })

  it('pads month and day', () => {
    vi.useFakeTimers({ toFake: ['Date'] })
    vi.setSystemTime(new Date(2026, 0, 5, 23, 30))
    expect(todayIso()).toBe('2026-01-05')
  })

  it('works for two-digit months and days', () => {
    vi.useFakeTimers({ toFake: ['Date'] })
    vi.setSystemTime(new Date(2026, 11, 25))
    expect(todayIso()).toBe('2026-12-25')
  })
})
