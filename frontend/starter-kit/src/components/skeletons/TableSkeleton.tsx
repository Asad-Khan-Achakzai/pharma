'use client'

import Card from '@mui/material/Card'
import CardContent from '@mui/material/CardContent'
import Skeleton from '@mui/material/Skeleton'

type TableSkeletonProps = {
  columns?: number
  rows?: number
}

const TableSkeleton = ({ columns = 4, rows = 6 }: TableSkeletonProps) => {
  return (
    <Card>
      <CardContent>
        <Skeleton variant='text' width='36%' height={28} animation='wave' />
        <div className='flex flex-col gap-2'>
          <div className='flex gap-3'>
            {Array.from({ length: columns }).map((_, idx) => (
              <Skeleton key={`h-${idx}`} variant='text' width={`${100 / columns}%`} height={22} animation='wave' />
            ))}
          </div>
          {Array.from({ length: rows }).map((_, rIdx) => (
            <div key={`r-${rIdx}`} className='flex gap-3'>
              {Array.from({ length: columns }).map((__, cIdx) => (
                <Skeleton key={`${rIdx}-${cIdx}`} variant='text' width={`${100 / columns}%`} height={20} animation='wave' />
              ))}
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  )
}

export default TableSkeleton
