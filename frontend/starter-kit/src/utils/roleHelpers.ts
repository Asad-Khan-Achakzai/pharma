/** Tenant or platform admins with full app access (not medical rep). */
export const isAdminLike = (role?: string | null) => role === 'ADMIN' || role === 'SUPER_ADMIN'
