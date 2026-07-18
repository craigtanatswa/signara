import type { Plan } from '@/types/database'

export const PAID_PLAN_ORDER = ['starter', 'growth', 'enterprise'] as const

export type PaidPlanId = (typeof PAID_PLAN_ORDER)[number]

export function planRank(planId: string | null | undefined): number {
  if (!planId) return -1
  if (planId === 'trial') return 0
  const idx = PAID_PLAN_ORDER.indexOf(planId as PaidPlanId)
  return idx === -1 ? -1 : idx + 1
}

/** Normalise plan.features from jsonb (array or legacy object). */
export function planFeatures(features: Plan['features']): string[] {
  if (!features) return []
  if (Array.isArray(features)) {
    return features.filter((item): item is string => typeof item === 'string')
  }
  return []
}

export function formatDocumentLimit(maxDocuments: number | null | undefined): string {
  if (maxDocuments == null || maxDocuments === -1) return 'Unlimited'
  return String(maxDocuments)
}

export function formatUserLimit(maxUsers: number | null | undefined): string {
  if (maxUsers == null || maxUsers === -1) return 'Unlimited'
  return String(maxUsers)
}
