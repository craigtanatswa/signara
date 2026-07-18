import { createAdminClient } from '@/lib/supabase/admin'
import { checkPlanLimits } from '@/lib/billing/limits'
import { PAID_PLAN_ORDER, planFeatures, planRank, type PaidPlanId } from '@/lib/billing/plans'
import type { Organisation, Plan, SubscriptionStatus } from '@/types/database'

export type PlanUpgradeLockReason =
  | 'downgrade'
  | 'over_limit'
  | 'trial_expired'
  | 'subscription_inactive'

export interface PlanUpgradeLockState {
  locked: true
  reason: PlanUpgradeLockReason
  currentPlanId: string
  currentPlanName: string
  requiredPlanId: string
  requiredPlanName: string
  upgradeFeatures: string[]
}

function isUnlimited(limit: number | null | undefined): boolean {
  return limit == null || limit === -1
}

function planSatisfiesUsage(
  plan: Pick<Plan, 'max_users' | 'max_documents_per_month'>,
  usersUsed: number,
  documentsUsed: number
): boolean {
  const usersOk = isUnlimited(plan.max_users) || usersUsed < plan.max_users!
  const documentsOk =
    isUnlimited(plan.max_documents_per_month) || documentsUsed < plan.max_documents_per_month!
  return usersOk && documentsOk
}

async function loadPaidPlans(): Promise<Plan[]> {
  const supabase = createAdminClient()
  const { data } = await supabase
    .from('plans')
    .select('id, name, max_users, max_documents_per_month, features')
    .in('id', [...PAID_PLAN_ORDER])

  const plans = (data ?? []) as Plan[]
  return plans.sort(
    (a, b) =>
      PAID_PLAN_ORDER.indexOf(a.id as PaidPlanId) - PAID_PLAN_ORDER.indexOf(b.id as PaidPlanId)
  )
}

/** Lowest paid plan that fits current usage; falls back to enterprise. */
async function getRequiredPlanForUsage(
  usersUsed: number,
  documentsUsed: number
): Promise<Plan | null> {
  const plans = await loadPaidPlans()
  for (const plan of plans) {
    if (planSatisfiesUsage(plan, usersUsed, documentsUsed)) {
      return plan
    }
  }
  return plans.find((p) => p.id === 'enterprise') ?? plans[plans.length - 1] ?? null
}

async function getPlanById(planId: string): Promise<Pick<Plan, 'id' | 'name' | 'features'> | null> {
  const supabase = createAdminClient()
  const { data } = await supabase
    .from('plans')
    .select('id, name, features')
    .eq('id', planId)
    .maybeSingle()
  return data as Pick<Plan, 'id' | 'name' | 'features'> | null
}

function buildLockState(input: {
  reason: PlanUpgradeLockReason
  currentPlanId: string
  currentPlanName: string
  requiredPlan: Pick<Plan, 'id' | 'name' | 'features'>
}): PlanUpgradeLockState {
  const features = planFeatures(input.requiredPlan.features as Plan['features'])
  return {
    locked: true,
    reason: input.reason,
    currentPlanId: input.currentPlanId,
    currentPlanName: input.currentPlanName,
    requiredPlanId: input.requiredPlan.id,
    requiredPlanName: input.requiredPlan.name,
    upgradeFeatures:
      features.length > 0
        ? features
        : [
            'Higher monthly document allowance',
            'More team members on one account',
            'Advanced approval workflows',
            'Organisation branding',
          ],
  }
}

/**
 * Returns lock state when the org must upgrade before using the app.
 * Billing/settings upgrade flow remains accessible via bypass in the layout gate.
 */
export async function getPlanUpgradeLock(
  organisation: Pick<
    Organisation,
    'id' | 'plan_id' | 'subscription_status' | 'trial_ends_at' | 'minimum_plan_id'
  >
): Promise<PlanUpgradeLockState | null> {
  const currentPlanId = organisation.plan_id ?? 'trial'
  const currentPlan = await getPlanById(currentPlanId)
  const currentPlanName = currentPlan?.name ?? currentPlanId
  const subscriptionStatus = (organisation.subscription_status ?? 'trialing') as SubscriptionStatus

  const trialExpired =
    currentPlanId === 'trial' &&
    subscriptionStatus === 'trialing' &&
    organisation.trial_ends_at != null &&
    new Date(organisation.trial_ends_at).getTime() <= Date.now()

  if (trialExpired) {
    const required = (await getPlanById('starter')) ?? {
      id: 'starter',
      name: 'Starter',
      features: null,
    }
    return buildLockState({
      reason: 'trial_expired',
      currentPlanId,
      currentPlanName,
      requiredPlan: required,
    })
  }

  if (subscriptionStatus === 'past_due' || subscriptionStatus === 'canceled') {
    const required =
      (await getPlanById(currentPlanId === 'trial' ? 'starter' : currentPlanId)) ??
      (await getPlanById('starter')) ?? {
        id: 'starter',
        name: 'Starter',
        features: null,
      }
    return buildLockState({
      reason: 'subscription_inactive',
      currentPlanId,
      currentPlanName,
      requiredPlan: required,
    })
  }

  const limits = await checkPlanLimits(organisation.id)
  const overLimit = !limits.usersOk || !limits.documentsOk

  if (organisation.minimum_plan_id) {
    const minimumRank = planRank(organisation.minimum_plan_id)
    const currentRank = planRank(currentPlanId)
    if (currentRank < minimumRank) {
      const required =
        (await getPlanById(organisation.minimum_plan_id)) ??
        (await getPlanById('growth')) ?? {
          id: 'growth',
          name: 'Growth',
          features: null,
        }
      return buildLockState({
        reason: 'downgrade',
        currentPlanId,
        currentPlanName,
        requiredPlan: required,
      })
    }
  }

  if (overLimit) {
    const required = await getRequiredPlanForUsage(limits.usersUsed, limits.documentsUsed)
    if (required && planRank(currentPlanId) < planRank(required.id)) {
      return buildLockState({
        reason: 'over_limit',
        currentPlanId,
        currentPlanName,
        requiredPlan: required,
      })
    }
  }

  return null
}

/** Persist minimum tier after a voluntary downgrade. */
export async function recordPlanDowngrade(
  organisationId: string,
  previousPlanId: string | null,
  newPlanId: string
): Promise<void> {
  const previousRank = planRank(previousPlanId)
  const newRank = planRank(newPlanId)
  if (previousRank <= 0 || newRank >= previousRank) return

  const supabase = createAdminClient()
  await supabase
    .from('organisations')
    .update({
      minimum_plan_id: previousPlanId,
      updated_at: new Date().toISOString(),
    })
    .eq('id', organisationId)
}

/** Clear minimum tier once the org upgrades to an sufficient plan. */
export async function clearMinimumPlanIfSatisfied(
  organisationId: string,
  newPlanId: string
): Promise<void> {
  const supabase = createAdminClient()
  const { data: org } = await supabase
    .from('organisations')
    .select('minimum_plan_id')
    .eq('id', organisationId)
    .single()

  const limits = await checkPlanLimits(organisationId)
  const requiredFromUsage = await getRequiredPlanForUsage(limits.usersUsed, limits.documentsUsed)
  const newRank = planRank(newPlanId)

  const minimumRank = planRank(org?.minimum_plan_id)
  const usageRank = planRank(requiredFromUsage?.id)

  const satisfiesMinimum = !org?.minimum_plan_id || newRank >= minimumRank
  const satisfiesUsage = !requiredFromUsage || newRank >= usageRank
  const withinLimits = limits.usersOk && limits.documentsOk

  if (satisfiesMinimum && satisfiesUsage && withinLimits) {
    await supabase
      .from('organisations')
      .update({
        minimum_plan_id: null,
        updated_at: new Date().toISOString(),
      })
      .eq('id', organisationId)
  }
}

export function getPlanUpgradeLockTitle(reason: PlanUpgradeLockReason): string {
  switch (reason) {
    case 'downgrade':
      return 'Upgrade required to continue'
    case 'over_limit':
      return 'Your plan no longer fits your usage'
    case 'trial_expired':
      return 'Your trial has ended'
    case 'subscription_inactive':
      return 'Renew your subscription'
  }
}

export function getPlanUpgradeLockDescription(state: PlanUpgradeLockState): string {
  switch (state.reason) {
    case 'downgrade':
      return `You moved to ${state.currentPlanName}, which is a lower tier than your organisation needs. Upgrade to ${state.requiredPlanName} or above to use Signara again.`
    case 'over_limit':
      return `Your ${state.currentPlanName} plan can't support your current team size or document volume. Upgrade to ${state.requiredPlanName} to restore access.`
    case 'trial_expired':
      return `Your free trial is over. Choose ${state.requiredPlanName} or a higher plan to keep using Signara.`
    case 'subscription_inactive':
      return 'Your subscription needs attention. Renew or upgrade your plan to unlock the app.'
  }
}

/** Routes that stay fully accessible while a plan upgrade is required. */
export function isPlanUpgradeBypassPath(pathname: string): boolean {
  return (
    pathname.startsWith('/dashboard/settings/billing') ||
    pathname === '/dashboard/settings'
  )
}
