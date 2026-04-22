'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'
import type { SyntheticEvent } from 'react'
import dynamic from 'next/dynamic'
import Link from 'next/link'
import classnames from 'classnames'
import type { ApexOptions } from 'apexcharts'

import Grid from '@mui/material/Grid'
import Card from '@mui/material/Card'
import CardHeader from '@mui/material/CardHeader'
import CardContent from '@mui/material/CardContent'
import Typography from '@mui/material/Typography'
import Button from '@mui/material/Button'
import Skeleton from '@mui/material/Skeleton'
import Tab from '@mui/material/Tab'
import TabContext from '@mui/lab/TabContext'
import TabList from '@mui/lab/TabList'
import TabPanel from '@mui/lab/TabPanel'

import CustomAvatar from '@core/components/mui/Avatar'
import { inventoryService } from '@/services/inventory.service'
import { showApiError } from '@/utils/apiErrors'

const AppReactApexCharts = dynamic(() => import('@/libs/styles/AppReactApexCharts'), { ssr: false })

const TOP_N = 10
const DASHBOARD_DETAIL_LIMIT = 120

type TabId = 'value' | 'quantity' | 'distributor'

type SummaryRow = {
  productName: string
  totalQuantity: number
  totalValue: number
}

type DetailRow = {
  quantity: number
  avgCostPerUnit: number
  distributorId?: { name?: string } | null
}

const truncLabel = (s: string, max = 36) => {
  const t = (s || '—').trim()
  return t.length <= max ? t : `${t.slice(0, max - 1)}…`
}

type InventoryDashboardChartsProps = {
  deferFetch?: boolean
}

const InventoryDashboardCharts = ({ deferFetch = false }: InventoryDashboardChartsProps) => {
  const [tab, setTab] = useState<TabId>('value')
  const [summaryLoading, setSummaryLoading] = useState(true)
  const [detailLoading, setDetailLoading] = useState(true)
  const [summaryRows, setSummaryRows] = useState<SummaryRow[]>([])
  const [detailRows, setDetailRows] = useState<DetailRow[]>([])
  const [totals, setTotals] = useState({ totalUnits: 0, totalValue: 0, uniqueProducts: 0 })

  /** Load summary first; detail rows are deferred until distributor tab is opened. */
  const load = useCallback(() => {
    void (async () => {
      setSummaryLoading(true)
      try {
        const summaryRes = await inventoryService.getSummary()
        const s = summaryRes.data.data
        setSummaryRows(s?.byProduct || [])
        setTotals(s?.totals || { totalUnits: 0, totalValue: 0, uniqueProducts: 0 })
      } catch (e) {
        showApiError(e, 'Failed to load inventory summary')
        setSummaryRows([])
        setTotals({ totalUnits: 0, totalValue: 0, uniqueProducts: 0 })
      } finally {
        setSummaryLoading(false)
      }
    })()
  }, [])

  useEffect(() => {
    if (!deferFetch) return
    load()
  }, [deferFetch, load])

  useEffect(() => {
    if (!deferFetch || tab !== 'distributor' || detailRows.length > 0) return
    let cancelled = false
    void (async () => {
      setDetailLoading(true)
      try {
        /**
         * Dashboard only needs a compact slice for the chart; full inventory detail belongs to Inventory page.
         */
        const detailRes = await inventoryService.getAll({ limit: DASHBOARD_DETAIL_LIMIT })
        if (!cancelled) setDetailRows(detailRes.data.data || [])
      } catch (e) {
        if (!cancelled) {
          showApiError(e, 'Failed to load inventory detail for distributor view')
          setDetailRows([])
        }
      } finally {
        if (!cancelled) setDetailLoading(false)
      }
    })()
    return () => {
      cancelled = true
    }
  }, [deferFetch, tab, detailRows.length])

  const distributorAgg = useMemo(() => {
    const m = new Map<string, number>()
    for (const r of detailRows) {
      const name =
        r.distributorId && typeof r.distributorId === 'object' && r.distributorId.name
          ? String(r.distributorId.name)
          : '—'
      const v = (r.quantity || 0) * (r.avgCostPerUnit || 0)
      m.set(name, (m.get(name) || 0) + v)
    }
    return [...m.entries()]
      .sort((a, b) => b[1] - a[1])
      .slice(0, TOP_N)
  }, [detailRows])

  const byValue = useMemo(() => {
    return [...summaryRows]
      .sort((a, b) => (b.totalValue || 0) - (a.totalValue || 0))
      .slice(0, TOP_N)
  }, [summaryRows])

  const byQty = useMemo(() => {
    return [...summaryRows]
      .sort((a, b) => (b.totalQuantity || 0) - (a.totalQuantity || 0))
      .slice(0, TOP_N)
  }, [summaryRows])

  const barHeight = (count: number) => Math.max(260, Math.min(520, 48 + count * 36))

  const valueOptions: ApexOptions = useMemo(() => {
    const rows = byValue
    const cats = rows.map(r => truncLabel(r.productName || '—'))
    return {
      chart: { toolbar: { show: false } },
      plotOptions: { bar: { horizontal: true, borderRadius: 4, barHeight: '70%' } },
      dataLabels: { enabled: false },
      xaxis: {
        categories: cats,
        labels: { style: { fontSize: '11px' } }
      },
      yaxis: {
        labels: {
          formatter: (val: number) =>
            `₨ ${(val || 0).toLocaleString('en-PK', { maximumFractionDigits: 0 })}`
        }
      },
      colors: ['var(--mui-palette-primary-main)'],
      grid: { strokeDashArray: 4, borderColor: 'var(--mui-palette-divider)' }
    }
  }, [byValue])

  const valueSeries = useMemo(
    () => [{ name: 'Stock value', data: byValue.map(r => r.totalValue || 0) }],
    [byValue]
  )

  const qtyOptions: ApexOptions = useMemo(() => {
    const rows = byQty
    const cats = rows.map(r => truncLabel(r.productName || '—'))
    return {
      chart: { toolbar: { show: false } },
      plotOptions: { bar: { horizontal: true, borderRadius: 4, barHeight: '70%' } },
      dataLabels: { enabled: false },
      xaxis: {
        categories: cats,
        labels: { style: { fontSize: '11px' } }
      },
      yaxis: {
        labels: {
          formatter: (val: number) => (val || 0).toLocaleString('en-PK', { maximumFractionDigits: 0 })
        }
      },
      colors: ['var(--mui-palette-info-main)'],
      grid: { strokeDashArray: 4, borderColor: 'var(--mui-palette-divider)' }
    }
  }, [byQty])

  const qtySeries = useMemo(
    () => [{ name: 'Units', data: byQty.map(r => r.totalQuantity || 0) }],
    [byQty]
  )

  const distOptions: ApexOptions = useMemo(() => {
    const cats = distributorAgg.map(([name]) => truncLabel(name))
    return {
      chart: { toolbar: { show: false } },
      plotOptions: { bar: { horizontal: true, borderRadius: 4, barHeight: '70%' } },
      dataLabels: { enabled: false },
      xaxis: {
        categories: cats,
        labels: { style: { fontSize: '11px' } }
      },
      yaxis: {
        labels: {
          formatter: (val: number) =>
            `₨ ${(val || 0).toLocaleString('en-PK', { maximumFractionDigits: 0 })}`
        }
      },
      colors: ['var(--mui-palette-success-main)'],
      grid: { strokeDashArray: 4, borderColor: 'var(--mui-palette-divider)' }
    }
  }, [distributorAgg])

  const distSeries = useMemo(
    () => [{ name: 'Stock value', data: distributorAgg.map(([, v]) => v) }],
    [distributorAgg]
  )

  const handleTab = (_: SyntheticEvent, v: string) => setTab(v as TabId)

  const formatPKR = (v: number) =>
    `₨ ${(v || 0).toLocaleString('en-PK', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`

  const tabDefs: { id: TabId; title: string; icon: string }[] = [
    { id: 'value', title: 'By value', icon: 'tabler-currency-dollar' },
    { id: 'quantity', title: 'By quantity', icon: 'tabler-packages' },
    { id: 'distributor', title: 'By distributor', icon: 'tabler-truck-delivery' }
  ]

  return (
    <Grid size={{ xs: 12 }}>
      <Card>
        <CardHeader
          title='Inventory overview'
          subheader='Top products and distributor stock (same sources as the Inventory page).'
          action={
            <Button component={Link} href='/inventory' size='small' variant='tonal'>
              Open inventory
            </Button>
          }
        />
        <CardContent className='flex flex-col gap-4'>
          {summaryLoading ? (
            <Skeleton variant='text' width='85%' height={24} animation='wave' />
          ) : (
            <Typography variant='body2' color='text.secondary'>
              Total value {formatPKR(totals.totalValue)} · {totals.totalUnits.toLocaleString('en-PK')} units ·{' '}
              {totals.uniqueProducts} products
            </Typography>
          )}

          {summaryLoading && detailLoading ? (
            <>
              <div className='flex flex-wrap gap-3 mbe-2'>
                {Array.from({ length: 3 }).map((_, i) => (
                  <Skeleton key={i} variant='rounded' width={110} height={100} animation='wave' />
                ))}
              </div>
              <Skeleton variant='rounded' width='100%' height={360} animation='wave' />
            </>
          ) : (
            <TabContext value={tab}>
              <TabList
                variant='scrollable'
                scrollButtons='auto'
                onChange={handleTab}
                aria-label='inventory chart tabs'
                className='!border-0 mbe-4'
                sx={{
                  '& .MuiTabs-indicator': { display: 'none !important' },
                  '& .MuiTab-root': { padding: '0 !important', border: '0 !important', minHeight: 0 }
                }}
              >
                {tabDefs.map(def => (
                  <Tab
                    key={def.id}
                    value={def.id}
                    className='mie-4'
                    label={
                      <div
                        className={classnames(
                          'flex flex-col items-center justify-center gap-2 is-[110px] bs-[100px] border rounded-xl',
                          tab === def.id
                            ? 'border-solid border-[var(--mui-palette-primary-main)]'
                            : 'border-dashed'
                        )}
                      >
                        <CustomAvatar
                          variant='rounded'
                          skin='light'
                          size={38}
                          {...(tab === def.id && { color: 'primary' })}
                        >
                          <i
                            className={classnames('text-[22px]', def.icon, {
                              'text-textSecondary': tab !== def.id
                            })}
                          />
                        </CustomAvatar>
                        <Typography className='font-medium text-center leading-tight' color='text.primary'>
                          {def.title}
                        </Typography>
                      </div>
                    }
                  />
                ))}
              </TabList>

              <TabPanel value='value' className='!p-0'>
                {summaryLoading ? (
                  <Skeleton variant='rounded' width='100%' height={360} animation='wave' />
                ) : valueSeries[0]?.data?.some((n: number) => n > 0) ? (
                  <AppReactApexCharts
                    type='bar'
                    height={barHeight(byValue.length)}
                    width='100%'
                    options={valueOptions}
                    series={valueSeries}
                  />
                ) : (
                  <Typography color='text.secondary'>No product summary to chart.</Typography>
                )}
              </TabPanel>
              <TabPanel value='quantity' className='!p-0'>
                {summaryLoading ? (
                  <Skeleton variant='rounded' width='100%' height={360} animation='wave' />
                ) : qtySeries[0]?.data?.some((n: number) => n > 0) ? (
                  <AppReactApexCharts
                    type='bar'
                    height={barHeight(byQty.length)}
                    width='100%'
                    options={qtyOptions}
                    series={qtySeries}
                  />
                ) : (
                  <Typography color='text.secondary'>No product summary to chart.</Typography>
                )}
              </TabPanel>
              <TabPanel value='distributor' className='!p-0'>
                {detailLoading ? (
                  <Skeleton variant='rounded' width='100%' height={360} animation='wave' />
                ) : distSeries[0]?.data?.some((n: number) => n > 0) ? (
                  <AppReactApexCharts
                    type='bar'
                    height={barHeight(distributorAgg.length)}
                    width='100%'
                    options={distOptions}
                    series={distSeries}
                  />
                ) : (
                  <Typography color='text.secondary'>No distributor-level stock rows.</Typography>
                )}
              </TabPanel>
            </TabContext>
          )}
        </CardContent>
      </Card>
    </Grid>
  )
}

export default InventoryDashboardCharts
