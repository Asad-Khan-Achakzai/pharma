'use client'

import Grid from '@mui/material/Grid'
import CardSkeleton from './CardSkeleton'
import TableSkeleton from './TableSkeleton'

type PageSkeletonProps = {
  cardCount?: number
  showTable?: boolean
}

const PageSkeleton = ({ cardCount = 3, showTable = true }: PageSkeletonProps) => {
  return (
    <Grid container spacing={4}>
      {Array.from({ length: cardCount }).map((_, idx) => (
        <Grid key={idx} size={{ xs: 12, md: 4 }}>
          <CardSkeleton rows={3} />
        </Grid>
      ))}
      {showTable && (
        <Grid size={{ xs: 12 }}>
          <TableSkeleton />
        </Grid>
      )}
    </Grid>
  )
}

export default PageSkeleton
