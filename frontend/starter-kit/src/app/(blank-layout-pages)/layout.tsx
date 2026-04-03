// Type Imports
import type { ChildrenType } from '@core/types'

// Component Imports
import Providers from '@components/Providers'
import BlankLayout from '@layouts/BlankLayout'
import { AuthProvider } from '@/contexts/AuthContext'
import AppReactToastify from '@/libs/styles/AppReactToastify'

// Util Imports
import { getSystemMode } from '@core/utils/serverHelpers'

type Props = ChildrenType

const Layout = async (props: Props) => {
  const { children } = props

  const direction = 'ltr'
  const systemMode = await getSystemMode()

  return (
    <Providers direction={direction}>
      <AuthProvider>
        <BlankLayout systemMode={systemMode}>{children}</BlankLayout>
        <AppReactToastify position='top-right' />
      </AuthProvider>
    </Providers>
  )
}

export default Layout
