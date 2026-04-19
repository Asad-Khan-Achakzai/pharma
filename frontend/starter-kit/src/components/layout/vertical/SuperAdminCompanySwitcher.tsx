'use client'

import { useCallback, useEffect, useState } from 'react'
import FormControl from '@mui/material/FormControl'
import InputLabel from '@mui/material/InputLabel'
import Select from '@mui/material/Select'
import MenuItem from '@mui/material/MenuItem'
import { useAuth } from '@/contexts/AuthContext'
import { superAdminService } from '@/services/superAdmin.service'
import { showApiError } from '@/utils/apiErrors'

type CompanyRow = {
  _id: string
  name: string
  city?: string
}

const SuperAdminCompanySwitcher = () => {
  const { user, switchCompanyContext } = useAuth()
  const [companies, setCompanies] = useState<CompanyRow[]>([])
  const [loading, setLoading] = useState(false)
  const [busy, setBusy] = useState(false)

  const activeId =
    user?.activeCompanyId && typeof user.activeCompanyId === 'object'
      ? user.activeCompanyId._id
      : typeof user?.activeCompanyId === 'string'
        ? user.activeCompanyId
        : ''

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const { data } = await superAdminService.listCompanies({ limit: 100, page: 1 })
      setCompanies(data.data || [])
    } catch (e) {
      showApiError(e, 'Failed to load companies')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    if (user?.role === 'SUPER_ADMIN') load()
  }, [user?.role, load])

  if (user?.role !== 'SUPER_ADMIN') return null

  const handleChange = async (companyId: string) => {
    if (!companyId || companyId === activeId) return
    setBusy(true)
    try {
      await switchCompanyContext(companyId)
    } catch (e) {
      showApiError(e, 'Could not switch company')
    } finally {
      setBusy(false)
    }
  }

  return (
    <FormControl size='small' sx={{ minWidth: 220 }} disabled={busy || loading}>
      <InputLabel id='sa-company-switch'>Company</InputLabel>
      <Select
        labelId='sa-company-switch'
        label='Company'
        value={activeId || ''}
        onChange={e => handleChange(e.target.value as string)}
      >
        {companies.map(c => (
          <MenuItem key={c._id} value={c._id}>
            {c.name}
            {c.city ? ` · ${c.city}` : ''}
          </MenuItem>
        ))}
      </Select>
    </FormControl>
  )
}

export default SuperAdminCompanySwitcher
