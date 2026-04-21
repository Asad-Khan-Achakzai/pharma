// Type Imports
import type { VerticalMenuDataType } from '@/types/menuTypes'

export type MenuItemWithPermission = VerticalMenuDataType & {
  permission?: string
  /** If set, menu item is only shown for these roles (e.g. SUPER_ADMIN). */
  roles?: string[]
  children?: MenuItemWithPermission[]
}

const verticalMenuData = (): MenuItemWithPermission[] => [
  {
    label: 'Super Admin',
    href: '/super-admin',
    icon: 'tabler-shield-lock',
    roles: ['SUPER_ADMIN']
  },
  {
    label: 'Dashboard',
    href: '/home',
    icon: 'tabler-smart-home',
    permission: 'dashboard.view'
  },
  {
    label: 'Products',
    href: '/products/list',
    icon: 'tabler-pill',
    permission: 'products.view'
  },
  {
    label: 'Distributors',
    href: '/distributors/list',
    icon: 'tabler-truck',
    permission: 'distributors.view'
  },
  {
    label: 'Suppliers',
    href: '/suppliers/list',
    icon: 'tabler-building-factory',
    permission: 'suppliers.view'
  },
  {
    label: 'Inventory',
    icon: 'tabler-packages',
    permission: 'inventory.view',
    children: [
      { label: 'Overview', href: '/inventory' },
      { label: 'Stock Transfer', href: '/inventory/transfer' }
    ]
  },
  {
    label: 'Pharmacies',
    href: '/pharmacies/list',
    icon: 'tabler-building-store',
    permission: 'pharmacies.view'
  },
  {
    label: 'Doctors',
    icon: 'tabler-stethoscope',
    permission: 'doctors.view',
    children: [
      { label: 'All doctors', href: '/doctors/list' },
      { label: 'Doctor activities', href: '/doctor-activities/list' }
    ]
  },
  {
    label: 'Orders',
    icon: 'tabler-clipboard-list',
    permission: 'orders.view',
    children: [
      { label: 'All Orders', href: '/orders/list' },
      { label: 'Create Order', href: '/orders/add', permission: 'orders.create' }
    ]
  },
  {
    label: 'Payments',
    icon: 'tabler-cash',
    permission: 'payments.view',
    children: [
      { label: 'Collections', href: '/payments/list' },
      { label: 'Record collection', href: '/payments/add', permission: 'payments.create' },
      { label: 'Settlements', href: '/settlements/list' },
      { label: 'Record settlement', href: '/settlements/add', permission: 'payments.create' }
    ]
  },
  {
    label: 'Ledger',
    href: '/ledger',
    icon: 'tabler-report-money',
    permission: 'ledger.view'
  },
  {
    label: 'Targets',
    href: '/targets',
    icon: 'tabler-target-arrow',
    permission: 'targets.view'
  },
  {
    label: 'Weekly Plans',
    icon: 'tabler-calendar-week',
    permission: 'weeklyPlans.view',
    children: [
      { label: 'All plans', href: '/weekly-plans' },
      { label: "Today's visits", href: '/visits/today', permission: 'weeklyPlans.markVisit' }
    ]
  },
  {
    label: 'Expenses',
    href: '/expenses/list',
    icon: 'tabler-receipt',
    permission: 'expenses.view'
  },
  {
    label: 'Payroll',
    icon: 'tabler-wallet',
    permission: 'payroll.view',
    children: [
      { label: 'Payroll', href: '/payroll' },
      { label: 'Salary structure', href: '/salary-structure', permission: 'payroll.view' },
      { label: 'Attendance', href: '/attendance', permission: 'attendance.view' }
    ]
  },
  {
    label: 'Reports',
    href: '/reports',
    icon: 'tabler-chart-bar',
    permission: 'reports.view'
  },
  {
    label: 'Users',
    href: '/users/list',
    icon: 'tabler-users',
    permission: 'users.view'
  },
  {
    label: 'Audit Log',
    href: '/audit-log',
    icon: 'tabler-history',
    permission: 'users.view'
  }
]

export default verticalMenuData
