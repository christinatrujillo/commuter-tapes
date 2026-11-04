/** Local calendar date as YYYY-MM-DD. */
export function today(): string {
  return toDateString(new Date())
}

export function addDays(date: string, days: number): string {
  const [y, m, d] = date.split('-').map(Number)
  return toDateString(new Date(y, m - 1, d + days))
}

/** Whole days from `from` to `to` (negative if `to` is earlier). */
export function daysBetween(from: string, to: string): number {
  const at = (date: string) => {
    const [y, m, d] = date.split('-').map(Number)
    return new Date(y, m - 1, d).getTime()
  }
  return Math.round((at(to) - at(from)) / 86400000)
}

function toDateString(d: Date): string {
  const pad = (n: number) => String(n).padStart(2, '0')
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`
}
