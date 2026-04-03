'use client'

import { useState } from 'react'
import Typography from '@mui/material/Typography'
import Button from '@mui/material/Button'
import Alert from '@mui/material/Alert'
import Grid from '@mui/material/Grid'
import Card from '@mui/material/Card'
import CardContent from '@mui/material/CardContent'
import Link from '@components/Link'
import Logo from '@components/layout/shared/Logo'
import CustomTextField from '@core/components/mui/TextField'
import { useAuth } from '@/contexts/AuthContext'

const Register = () => {
  const [form, setForm] = useState({ companyName: '', companyEmail: '', companyPhone: '', name: '', email: '', password: '' })
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)
  const { register } = useAuth()

  const handleChange = (field: string) => (e: React.ChangeEvent<HTMLInputElement>) => {
    setForm(prev => ({ ...prev, [field]: e.target.value }))
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError('')
    setLoading(true)

    try {
      await register(form)
    } catch (err: any) {
      setError(err.response?.data?.message || 'Registration failed')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className='flex items-center justify-center min-bs-[100dvh] p-6'>
      <Card className='is-full sm:is-[600px]'>
        <CardContent className='p-8'>
          <div className='flex justify-center mbe-6'>
            <Logo />
          </div>
          <Typography variant='h4' className='text-center mbe-1'>Register Your Company</Typography>
          <Typography className='text-center mbe-6'>Create your account to get started</Typography>
          {error && <Alert severity='error' className='mbe-4'>{error}</Alert>}
          <form onSubmit={handleSubmit} className='flex flex-col gap-5'>
            <Typography variant='h6'>Company Details</Typography>
            <Grid container spacing={4}>
              <Grid size={{ xs: 12, sm: 6 }}>
                <CustomTextField fullWidth label='Company Name' required value={form.companyName} onChange={handleChange('companyName')} />
              </Grid>
              <Grid size={{ xs: 12, sm: 6 }}>
                <CustomTextField fullWidth label='Company Email' type='email' required value={form.companyEmail} onChange={handleChange('companyEmail')} />
              </Grid>
              <Grid size={{ xs: 12, sm: 6 }}>
                <CustomTextField fullWidth label='Company Phone' value={form.companyPhone} onChange={handleChange('companyPhone')} />
              </Grid>
            </Grid>
            <Typography variant='h6'>Admin Account</Typography>
            <Grid container spacing={4}>
              <Grid size={{ xs: 12, sm: 6 }}>
                <CustomTextField fullWidth label='Your Name' required value={form.name} onChange={handleChange('name')} />
              </Grid>
              <Grid size={{ xs: 12, sm: 6 }}>
                <CustomTextField fullWidth label='Email' type='email' required value={form.email} onChange={handleChange('email')} />
              </Grid>
              <Grid size={{ xs: 12 }}>
                <CustomTextField fullWidth label='Password' type='password' required value={form.password} onChange={handleChange('password')} />
              </Grid>
            </Grid>
            <Button fullWidth variant='contained' type='submit' disabled={loading}>
              {loading ? 'Creating...' : 'Register'}
            </Button>
            <div className='flex justify-center items-center gap-2'>
              <Typography>Already have an account?</Typography>
              <Typography component={Link} href='/login' color='primary.main'>Sign in</Typography>
            </div>
          </form>
        </CardContent>
      </Card>
    </div>
  )
}

export default Register
