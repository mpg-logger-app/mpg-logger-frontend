// Types, parsing, calculations and formatting ported from ContentView.swift / FuelLog.swift.

export interface FuelLog {
  id: number
  date: string // "YYYY-MM-DD"
  previousOdometer: number
  odometer: number
  gallons: number
  pricePerGallon: number
  milesDriven: number
  mpg: number
  totalCost: number
}

export interface NewFuelLog {
  date: string
  previousOdometer: number | null
  odometer: number
  gallons: number
  pricePerGallon: number
}

/**
 * Swift's Double("...") returns nil for anything that isn't a plain number.
 * JavaScript's Number("") is 0, so a stricter parser is used to keep the
 * same behaviour: empty or invalid text gives null.
 */
export function parseNumber(text: string): number | null {
  if (!/^(\d+(\.\d*)?|\.\d+)$/.test(text)) {
    return null
  }
  const value = Number(text)
  return Number.isFinite(value) ? value : null
}

/** Swift: milesDriven (nil unless current > previous). */
export function calcMilesDriven(previous: number | null, current: number | null): number | null {
  if (previous === null || current === null || !(current > previous)) {
    return null
  }
  return current - previous
}

/** Swift: calculatedMPG. */
export function calcMpg(miles: number | null, gallons: number | null): number | null {
  if (miles === null || gallons === null || !(gallons > 0)) {
    return null
  }
  return miles / gallons
}

/** Swift: totalCost (missing values count as 0). */
export function calcTotalCost(gallons: number | null, price: number | null): number {
  return (gallons ?? 0) * (price ?? 0)
}

/** Swift: formIsValid. */
export function isFormValid(
  previous: number | null,
  current: number | null,
  gallons: number | null,
  price: number | null,
): boolean {
  if (previous === null || current === null || gallons === null || price === null) {
    return false
  }
  return previous > 0 && current > previous && gallons > 0 && price > 0
}

/**
 * Why an edited log can't be saved, or null if it can. Same rules as the server:
 * the normal form rules, plus the odometer has to stay below the next log's,
 * because the next log will start at the edited reading.
 */
export function editProblem(
  previous: number | null,
  current: number | null,
  gallons: number | null,
  price: number | null,
  nextOdometer: number | null,
): string | null {
  if (previous === null || !(previous > 0)) return 'Previous odometer must be greater than 0.'
  if (current === null || !(current > previous)) {
    return `Odometer must be greater than ${formatWhole(previous)} mi.`
  }
  if (nextOdometer !== null && !(current < nextOdometer)) {
    return `Odometer must be less than ${formatWhole(nextOdometer)} mi (the next log).`
  }
  if (gallons === null || !(gallons > 0)) return 'Gallons must be greater than 0.'
  if (price === null || !(price > 0)) return 'Price per gallon must be greater than 0.'
  return null
}

// ---- Formatting (en-US, matching the Swift .formatted() calls) ----

const wholeNumber = new Intl.NumberFormat('en-US', { maximumFractionDigits: 0 })
const twoDecimals = new Intl.NumberFormat('en-US', {
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
})
const usd = new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' })
const mediumDate = new Intl.DateTimeFormat('en-US', { dateStyle: 'medium' })

export const formatWhole = (n: number) => wholeNumber.format(n)
export const formatTwo = (n: number) => twoDecimals.format(n)
export const formatUsd = (n: number) => usd.format(n)

/**
 * "2026-10-23" -> "Oct 23, 2026".
 * new Date("2026-10-23") would be read as UTC midnight and show the
 * previous day in US time zones, so the parts are read as a local date.
 */
export function formatLogDate(isoDate: string): string {
  const [year, month, day] = isoDate.split('-').map(Number)
  return mediumDate.format(new Date(year, month - 1, day))
}

/** Today's date as "YYYY-MM-DD" in the local time zone (not UTC). */
export function todayIso(): string {
  const now = new Date()
  const mm = String(now.getMonth() + 1).padStart(2, '0')
  const dd = String(now.getDate()).padStart(2, '0')
  return `${now.getFullYear()}-${mm}-${dd}`
}
