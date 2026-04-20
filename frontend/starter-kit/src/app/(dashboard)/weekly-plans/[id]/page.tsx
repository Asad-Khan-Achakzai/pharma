import WeeklyPlanDetailPage from '@/views/weeklyPlans/WeeklyPlanDetailPage'

const Page = ({ params }: { params: Promise<{ id: string }> }) => <WeeklyPlanDetailPage paramsPromise={params} />

export default Page
