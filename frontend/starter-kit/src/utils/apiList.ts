/**
 * Normalizes list API responses from axios.
 * Handles: `{ data: T[] }`, `{ data: { docs: T[] } }`, and `{ data: { data: { docs } } }` (ApiResponse envelope).
 */
export function normalizeDocs<T>(res: { data?: unknown }): T[] {
  const envelope = res?.data as { data?: unknown } | unknown[] | undefined
  if (!envelope) return []
  if (Array.isArray(envelope)) return envelope as T[]

  const envObj = envelope as { data?: unknown }
  const payload = envObj.data !== undefined ? envObj.data : envelope
  const p = payload as { docs?: T[]; data?: T[] } | T[] | undefined

  if (Array.isArray(p)) return p
  if (p && typeof p === 'object' && Array.isArray(p.docs)) return p.docs
  if (p && typeof p === 'object' && Array.isArray(p.data)) return p.data
  return []
}
