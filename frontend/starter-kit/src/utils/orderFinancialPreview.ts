/** Mirrors backend financial.service computeLineSnapshot + roundPKR for create/edit preview */

export const roundPKR = (value: number) => Math.round(value * 100) / 100

export const getCommissionPercent = (distributor: { commissionPercentOnTP?: number | null; discountOnTP?: number | null }) => {
  const p =
    distributor.commissionPercentOnTP != null ? distributor.commissionPercentOnTP : distributor.discountOnTP ?? 0
  return roundPKR(p)
}

export type LineFinancialPreview = {
  grossAmount: number
  pharmacyDiscountAmount: number
  netAfterPharmacy: number
  distributorCommissionAmount: number
  finalCompanyAmount: number
}

export type OrderFinancialTotals = {
  totalAmount: number
  pharmacyDiscountAmount: number
  amountAfterPharmacyDiscount: number
  distributorCommissionAmount: number
  finalCompanyRevenue: number
  totalPaidQuantity: number
  totalBonusQuantity: number
  totalPhysicalQuantity: number
  totalCastingCost: number
}

export function computeLinePreview(
  tp: number,
  qty: number,
  clinicDiscountPct: number,
  distributor: { commissionPercentOnTP?: number | null; discountOnTP?: number | null }
): LineFinancialPreview {
  const commissionPct = getCommissionPercent(distributor)
  const tpLineTotal = roundPKR(tp * qty)
  const pharmacyDiscountAmount = roundPKR((tpLineTotal * clinicDiscountPct) / 100)
  const linePharmacyNet = roundPKR(tpLineTotal - pharmacyDiscountAmount)
  const distributorShare = roundPKR((tpLineTotal * commissionPct) / 100)
  const companyShare = roundPKR(linePharmacyNet - distributorShare)
  return {
    grossAmount: tpLineTotal,
    pharmacyDiscountAmount,
    netAfterPharmacy: linePharmacyNet,
    distributorCommissionAmount: distributorShare,
    finalCompanyAmount: companyShare
  }
}

export function aggregateOrderFinancialPreview(
  lines: LineFinancialPreview[],
  extras?: {
    totalPaidQuantity: number
    totalBonusQuantity: number
    totalPhysicalQuantity: number
    totalCastingCost: number
  }
): OrderFinancialTotals {
  const sum = (key: keyof LineFinancialPreview) =>
    roundPKR(lines.reduce((s, r) => s + r[key], 0))
  return {
    totalAmount: sum('grossAmount'),
    pharmacyDiscountAmount: sum('pharmacyDiscountAmount'),
    amountAfterPharmacyDiscount: sum('netAfterPharmacy'),
    distributorCommissionAmount: sum('distributorCommissionAmount'),
    finalCompanyRevenue: sum('finalCompanyAmount'),
    totalPaidQuantity: extras?.totalPaidQuantity ?? 0,
    totalBonusQuantity: extras?.totalBonusQuantity ?? 0,
    totalPhysicalQuantity: extras?.totalPhysicalQuantity ?? 0,
    totalCastingCost: extras?.totalCastingCost ?? 0
  }
}

export function buildPreviewFromFormItems(
  items: { productId: string; quantity: number; clinicDiscount: number; bonusQuantity?: number }[],
  products: { _id: string; tp: number; casting?: number }[],
  distributor: { commissionPercentOnTP?: number | null; discountOnTP?: number | null } | undefined
): OrderFinancialTotals | null {
  if (!distributor || !items.length || items.some(i => !i.productId || i.quantity < 1)) return null
  const productMap = Object.fromEntries(products.map(p => [p._id, p]))
  const lines: LineFinancialPreview[] = []
  let totalBonusQuantity = 0
  let totalPaidQuantity = 0
  let totalCastingCost = 0
  for (const row of items) {
    const p = productMap[row.productId]
    if (!p) return null
    const bq = row.bonusQuantity ?? 0
    totalBonusQuantity += bq
    totalPaidQuantity += row.quantity
    totalCastingCost += roundPKR((p.casting ?? 0) * (row.quantity + bq))
    lines.push(computeLinePreview(p.tp, row.quantity, row.clinicDiscount ?? 0, distributor))
  }
  const totalPhysicalQuantity = totalPaidQuantity + totalBonusQuantity
  return aggregateOrderFinancialPreview(lines, {
    totalPaidQuantity,
    totalBonusQuantity,
    totalPhysicalQuantity,
    totalCastingCost: roundPKR(totalCastingCost)
  })
}
