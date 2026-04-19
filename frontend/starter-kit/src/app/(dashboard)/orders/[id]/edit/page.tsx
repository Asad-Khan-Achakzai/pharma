import EditOrderPage from '@/views/orders/EditOrderPage'

const Page = ({ params }: { params: Promise<{ id: string }> }) => <EditOrderPage paramsPromise={params} />

export default Page
