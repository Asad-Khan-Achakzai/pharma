'use client'

// Third-party Imports
import classnames from 'classnames'

// Component Imports
import NavToggle from './NavToggle'
import ModeDropdown from '@components/layout/shared/ModeDropdown'
import UserDropdown from '@components/layout/shared/UserDropdown'
import SuperAdminModeBar from './SuperAdminModeBar'
import SuperAdminCompanySwitcher from './SuperAdminCompanySwitcher'

// Util Imports
import { verticalLayoutClasses } from '@layouts/utils/layoutClasses'

const NavbarContent = () => {
  return (
    <div className={classnames(verticalLayoutClasses.navbarContent, 'flex flex-col is-full gap-0')}>
      <SuperAdminModeBar />
      <div className='flex items-center justify-between gap-4 is-full flex-1 pis-4 pie-4'>
        <div className='flex items-center gap-4 flex-wrap'>
          <NavToggle />
          <ModeDropdown />
          <SuperAdminCompanySwitcher />
        </div>
        <div className='flex items-center'>
          <UserDropdown />
        </div>
      </div>
    </div>
  )
}

export default NavbarContent
