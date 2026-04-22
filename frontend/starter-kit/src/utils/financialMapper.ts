type FinancialEnvelope<T extends Record<string, any>> = T & {
  financialModel?: string
  scope?: 'snapshot' | 'period' | 'line' | string
  canonical?: Record<string, any>
}

const ERP_MODEL = 'ERP_STANDARD_V1'

const asEnvelope = <T extends Record<string, any>>(data: unknown): FinancialEnvelope<T> => {
  if (data && typeof data === 'object') return data as FinancialEnvelope<T>
  return {} as FinancialEnvelope<T>
}

export const mapDashboardFinancial = <T extends Record<string, any>>(data: unknown): FinancialEnvelope<T> => {
  const payload = asEnvelope<T>(data)
  const canonical = payload.canonical || {}
  return {
    ...payload,
    financialModel: payload.financialModel || ERP_MODEL,
    scope: payload.scope || 'snapshot',
    canonical,
    totalSales: payload.totalSales ?? canonical.revenueGross ?? 0,
    grossProfit: payload.grossProfit ?? canonical.profitGrossOperational ?? 0,
    netProfit: payload.netProfit ?? canonical.profitNetFinal ?? 0
  }
}

export const mapProfitFinancial = <T extends Record<string, any>>(data: unknown): FinancialEnvelope<T> => {
  const payload = asEnvelope<T>(data)
  const canonical = payload.canonical || {}
  return {
    ...payload,
    financialModel: payload.financialModel || ERP_MODEL,
    scope: payload.scope || 'period',
    canonical,
    grossProfit: payload.grossProfit ?? canonical.profitGrossOperational ?? 0,
    netProfit: payload.netProfit ?? canonical.profitNetFinal ?? 0
  }
}

export const mapSummaryFinancial = <T extends Record<string, any>>(data: unknown): FinancialEnvelope<T> => {
  const payload = asEnvelope<T>(data)
  const canonical = payload.canonical || {}
  return {
    ...payload,
    financialModel: payload.financialModel || ERP_MODEL,
    scope: payload.scope || 'period',
    canonical,
    totalRevenue: payload.totalRevenue ?? canonical.revenueGross ?? 0,
    grossProfit: payload.grossProfit ?? canonical.profitGrossOperational ?? 0,
    netProfit: payload.netProfit ?? canonical.profitNetFinal ?? 0
  }
}

export const mapTrendsFinancial = <T extends Record<string, any>>(data: unknown): FinancialEnvelope<T> => {
  const payload = asEnvelope<T>(data)
  return {
    ...payload,
    financialModel: payload.financialModel || ERP_MODEL,
    scope: payload.scope || 'line',
    canonical: payload.canonical || { granularity: payload.granularity || 'month', lines: [] },
    series: Array.isArray(payload.series) ? payload.series : []
  }
}
