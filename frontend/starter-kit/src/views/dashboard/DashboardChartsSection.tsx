'use client'

import { memo } from 'react'
import dynamic from 'next/dynamic'
import Skeleton from '@mui/material/Skeleton'

const ProfitCostDashboardCharts = dynamic(
  () => import('@/views/dashboard/ProfitCostDashboardCharts'),
  { ssr: false, loading: () => <Skeleton variant='rounded' height={360} sx={{ m: 2 }} /> }
)
const InventoryDashboardCharts = dynamic(
  () => import('@/views/dashboard/InventoryDashboardCharts'),
  { ssr: false, loading: () => <Skeleton variant='rounded' height={360} sx={{ m: 2 }} /> }
)

const DashboardChartsSection = memo(function DashboardChartsSection({
  canViewReports,
  canViewInventory,
  nonCriticalReady
}: {
  canViewReports: boolean
  canViewInventory: boolean
  nonCriticalReady: boolean
}) {
  if (!nonCriticalReady) return null
  return (
    <>
      {canViewReports && <ProfitCostDashboardCharts deferFetch />}
      {canViewInventory && <InventoryDashboardCharts deferFetch />}
    </>
  )
})

export default DashboardChartsSection
