/** YYYY-MM-DD in local calendar (for APIs and form state). */
export function formatYyyyMmDd(d: Date): string {
  const y = d.getFullYear()
  const m = String(d.getMonth() + 1).padStart(2, '0')
  const day = String(d.getDate()).padStart(2, '0')
  return `${y}-${m}-${day}`
}

/** Parse YYYY-MM-DD as a local calendar date. */
export function parseYyyyMmDd(s: string): Date | null {
  const t = s.trim()
  if (!/^\d{4}-\d{2}-\d{2}$/.test(t)) return null
  const [y, m, d] = t.split('-').map(Number)
  if (m < 1 || m > 12 || d < 1 || d > 31) return null
  const dt = new Date(y, m - 1, d)
  if (dt.getFullYear() !== y || dt.getMonth() !== m - 1 || dt.getDate() !== d) return null
  return dt
}

/** Today (or given instant) as YYYY-MM-DD local. */
export function getLocalDateISO(d = new Date()): string {
  return formatYyyyMmDd(d)
}
