// Type Imports
import type { HorizontalMenuDataType } from '@/types/menuTypes'

export type HorizontalMenuItemWithPermission = HorizontalMenuDataType & {
  permission?: string
  roles?: string[]
  children?: HorizontalMenuItemWithPermission[]
}

const horizontalMenuData = (): HorizontalMenuItemWithPermission[] => [
  { label: 'Super Admin', href: '/super-admin', icon: 'tabler-shield-lock', roles: ['SUPER_ADMIN'] },
  { label: 'Dashboard', href: '/home', icon: 'tabler-smart-home', permission: 'dashboard.view' },
  { label: 'Products', href: '/products/list', icon: 'tabler-pill', permission: 'products.view' },
  { label: 'Distributors', href: '/distributors/list', icon: 'tabler-truck', permission: 'distributors.view' },
  { label: 'Orders', href: '/orders/list', icon: 'tabler-clipboard-list', permission: 'orders.view' },
  { label: 'Pharmacies', href: '/pharmacies/list', icon: 'tabler-building-store', permission: 'pharmacies.view' },
  { label: 'Payments', href: '/payments/list', icon: 'tabler-cash', permission: 'payments.view' },
  { label: 'Reports', href: '/reports', icon: 'tabler-chart-bar', permission: 'reports.view' }
]

export default horizontalMenuData
