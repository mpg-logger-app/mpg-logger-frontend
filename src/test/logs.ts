import type { FuelLog } from '../fuel.ts'

/** Builds a FuelLog with the calculated fields filled in, like the API returns. */
export function makeLog(
  id: number,
  date: string,
  previousOdometer: number,
  odometer: number,
  gallons = 10,
  pricePerGallon = 3,
): FuelLog {
  const milesDriven = odometer - previousOdometer
  return {
    id,
    date,
    previousOdometer,
    odometer,
    gallons,
    pricePerGallon,
    milesDriven,
    mpg: milesDriven / gallons,
    totalCost: gallons * pricePerGallon,
  }
}

/** Three logs, newest first (the order the API returns them in). */
export function threeLogs(): FuelLog[] {
  return [
    makeLog(3, '2026-10-15', 12600, 12900, 10, 3.5),
    makeLog(2, '2026-10-08', 12300, 12600),
    makeLog(1, '2026-10-01', 12000, 12300),
  ]
}
