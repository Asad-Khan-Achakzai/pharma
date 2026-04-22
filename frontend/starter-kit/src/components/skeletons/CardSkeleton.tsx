'use client'

import Card from '@mui/material/Card'
import CardContent from '@mui/material/CardContent'
import Skeleton from '@mui/material/Skeleton'

type CardSkeletonProps = {
  rows?: number
  showHeader?: boolean
  height?: number
}

const CardSkeleton = ({ rows = 3, showHeader = true, height = 22 }: CardSkeletonProps) => {
  return (
    <Card>
      <CardContent>
        {showHeader && <Skeleton variant='text' width='48%' height={28} animation='wave' />}
        {Array.from({ length: rows }).map((_, idx) => (
          <Skeleton key={idx} variant='text' width={`${92 - idx * 8}%`} height={height} animation='wave' />
        ))}
      </CardContent>
    </Card>
  )
}

export default CardSkeleton
