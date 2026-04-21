import SupplierDetailPage from '@/views/suppliers/detail/SupplierDetailPage'

const Page = ({ params }: { params: Promise<{ id: string }> }) => <SupplierDetailPage paramsPromise={params} />
export default Page
