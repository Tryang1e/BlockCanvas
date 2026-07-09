import ShopClient from '@/components/dashboard/ShopClient'

// 상점 — 모은 코인으로 상품 구매. 데이터/구매는 세션 기반 server action(getMyShop 등)으로 처리.
export default async function DashboardShopPage() {
  return (
    <div className="animate-in fade-in zoom-in-95 duration-500">
      <div className="mb-8">
        <h1 className="text-3xl font-black text-neutral-900 tracking-tight mb-2">상점</h1>
        <p className="text-neutral-500 font-medium">모은 코인으로 다양한 상품을 구매하세요.</p>
      </div>
      <ShopClient />
    </div>
  )
}
