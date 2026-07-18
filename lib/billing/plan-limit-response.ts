import { createAdminClient } from '@/lib/supabase/admin'
import type { PlanLimitCheck } from '@/lib/billing/limits'

export const PLAN_LIMIT_ERROR_CODE = 'PLAN_LIMIT_REACHED' as const

export type PlanLimitType = 'users' | 'documents'

export interface PlanLimitReachedDetails {
  code: typeof PLAN_LIMIT_ERROR_CODE
  type: PlanLimitType
  used: number
  limit: number
  currentPlanId: string
  currentPlanName: string
  upgradePlanId: string | null
  upgradePlanName: string | null
  upgradeFeatures: string[]
  canUpgrade: boolean
}

const PLAN_ORDER = ['trial', 'starter', 'growth', 'enterprise'] as const

function getNextPaidPlanId(currentPlanId: string | null): string | null {
  const current = currentPlanId ?? 'trial'
  const index = PLAN_ORDER.indexOf(current as (typeof PLAN_ORDER)[number])
  if (index === -1) return 'starter'
  if (index >= PLAN_ORDER.length - 1) return null
  const next = PLAN_ORDER[index + 1]
  return next === 'trial' ? 'starter' : next
}

function parseFeatures(raw: unknown): string[] {
  if (Array.isArray(raw)) {
    return raw.filter((item): item is string => typeof item === 'string')
  }
  return []
}

export async function buildPlanLimitReachedDetails(input: {
  organisationId: string
  userRole: 'admin' | 'member'
  type: PlanLimitType
  limits: PlanLimitCheck
}): Promise<PlanLimitReachedDetails> {
  const supabase = createAdminClient()

  const { data: org } = await supabase
    .from('organisations')
    .select('plan_id, plans(id, name, features)')
    .eq('id', input.organisationId)
    .single()

  const currentPlanId = org?.plan_id ?? 'trial'
  const planRaw = org?.plans as
    | { id: string; name: string; features: unknown }
    | { id: string; name: string; features: unknown }[]
    | null
  const currentPlan = Array.isArray(planRaw) ? (planRaw[0] ?? null) : planRaw

  const upgradePlanId = getNextPaidPlanId(currentPlanId)
  let upgradePlanName: string | null = null
  let upgradeFeatures: string[] = []

  if (upgradePlanId) {
    const { data: upgradePlan } = await supabase
      .from('plans')
      .select('name, features')
      .eq('id', upgradePlanId)
      .maybeSingle()

    upgradePlanName = upgradePlan?.name ?? upgradePlanId
    upgradeFeatures = parseFeatures(upgradePlan?.features)
  } else {
    upgradeFeatures = parseFeatures(currentPlan?.features)
  }

  const used =
    input.type === 'users' ? input.limits.usersUsed : input.limits.documentsUsed
  const limit =
    input.type === 'users'
      ? (input.limits.usersLimit ?? 0)
      : (input.limits.documentsLimit ?? 0)

  return {
    code: PLAN_LIMIT_ERROR_CODE,
    type: input.type,
    used,
    limit,
    currentPlanId,
    currentPlanName: currentPlan?.name ?? currentPlanId,
    upgradePlanId,
    upgradePlanName,
    upgradeFeatures,
    canUpgrade: input.userRole === 'admin',
  }
}

export function isPlanLimitReachedPayload(
  value: unknown
): value is { error: string; planLimit: PlanLimitReachedDetails } {
  if (!value || typeof value !== 'object') return false
  const record = value as Record<string, unknown>
  const planLimit = record.planLimit
  if (!planLimit || typeof planLimit !== 'object') return false
  const details = planLimit as Record<string, unknown>
  return details.code === PLAN_LIMIT_ERROR_CODE && typeof details.type === 'string'
}

export function getPlanLimitHeadline(type: PlanLimitType): string {
  return type === 'users'
    ? 'Team member limit reached'
    : 'Monthly document limit reached'
}

export function getPlanLimitDescription(details: PlanLimitReachedDetails): string {
  if (details.type === 'users') {
    return `Your ${details.currentPlanName} plan includes ${details.limit} team member${
      details.limit === 1 ? '' : 's'
    }. You currently have ${details.used} active member${
      details.used === 1 ? '' : 's'
    }, so you can't add anyone else on this plan.`
  }

  return `Your ${details.currentPlanName} plan includes ${details.limit} document${
    details.limit === 1 ? '' : 's'
  } per month. You've already created ${details.used} this month, so you can't start another until your allowance resets or you upgrade.`
}

export function getPlanLimitUpgradeIntro(details: PlanLimitReachedDetails): string {
  if (!details.upgradePlanName) {
    return 'Upgrade to unlock higher limits and more capabilities:'
  }

  if (details.type === 'users') {
    return `Upgrade to ${details.upgradePlanName} to invite more team members and unlock:`
  }

  return `Upgrade to ${details.upgradePlanName} to send more documents and unlock:`
}
