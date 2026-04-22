'use client'

import Card from '@mui/material/Card'
import CardContent from '@mui/material/CardContent'
import Skeleton from '@mui/material/Skeleton'

type ChartSkeletonProps = {
  titleWidth?: string | number
  height?: number
}

const ChartSkeleton = ({ titleWidth = '40%', height = 320 }: ChartSkeletonProps) => {
  return (
    <Card>
      <CardContent>
        <Skeleton variant='text' width={titleWidth} height={28} animation='wave' />
        <Skeleton variant='rounded' width='100%' height={height} animation='wave' />
      </CardContent>
    </Card>
  )
}

export default ChartSkeleton
