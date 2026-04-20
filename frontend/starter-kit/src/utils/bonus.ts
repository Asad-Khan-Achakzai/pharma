/** Buy X Get Y — matches backend utils/bonus.js */

export function calculateBonus(quantity: number, buyQty: number, getQty: number): number {
  const q = Number(quantity) || 0
  const b = Number(buyQty) || 0
  const g = Number(getQty) || 0
  if (b <= 0 || g <= 0) return 0
  return Math.floor(q / b) * g
}

export function lineTotalQuantity(paidQty: number, bonusQty: number): number {
  return (Number(paidQty) || 0) + (Number(bonusQty) || 0)
}
