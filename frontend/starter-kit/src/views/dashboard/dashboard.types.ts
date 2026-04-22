export type TodayEmployee = {
  employeeId: string
  name: string
  status: string
  checkInTime: string | null
  checkOutTime?: string | null
  hasCheckedOut?: boolean
}

export type TodayBoard = {
  employees: TodayEmployee[]
  summary: { present: number; notMarked: number; totalEmployees: number }
  distribution: Record<string, number>
}

export type KpiItem = { title: string; value: string; icon: string; color: string }
