import OrderDetailPage from '@/views/orders/OrderDetailPage'
const Page = ({ params }: { params: Promise<{ id: string }> }) => <OrderDetailPage paramsPromise={params} />
export default Page
