import type { Metadata } from 'next'
import Register from '@views/Register'

export const metadata: Metadata = {
  title: 'Register',
  description: 'Register your company'
}

const RegisterPage = () => {
  return <Register />
}

export default RegisterPage
