import { createAdminClient } from '@/lib/supabase/admin'

export interface PlanLimitCheck {
  usersOk: boolean
  documentsOk: boolean
  usersLimit: number | null
  documentsLimit: number | null
  usersUsed: number
  documentsUsed: number
}

function isUnlimited(limit: number | null | undefined): boolean {
  return limit == null || limit === -1
}

/**
 * Server-side plan usage check. Treats max_users / max_documents of null or -1 as unlimited.
 */
export async function checkPlanLimits(organisationId: string): Promise<PlanLimitCheck> {
  const supabase = createAdminClient()

  const { data: org, error: orgError } = await supabase
    .from('organisations')
    .select('plan_id, plans(max_users, max_documents_per_month)')
    .eq('id', organisationId)
    .single()

  if (orgError || !org) {
    throw new Error(orgError?.message ?? 'Organisation not found')
  }

  const planRaw = org.plans as
    | { max_users: number | null; max_documents_per_month: number | null }
    | { max_users: number | null; max_documents_per_month: number | null }[]
    | null
  const plan = Array.isArray(planRaw) ? (planRaw[0] ?? null) : planRaw
  const usersLimit = plan?.max_users ?? null
  const documentsLimit = plan?.max_documents_per_month ?? null

  const [{ count: usersUsed }, { data: docCount, error: rpcError }] = await Promise.all([
    supabase
      .from('users')
      .select('id', { count: 'exact', head: true })
      .eq('organisation_id', organisationId)
      .eq('is_active', true),
    supabase.rpc('get_org_document_count_this_month', { org_id: organisationId }),
  ])

  if (rpcError) {
    throw new Error(rpcError.message)
  }

  const documentsUsed = typeof docCount === 'number' ? docCount : 0
  const usedUsers = usersUsed ?? 0

  return {
    usersOk: isUnlimited(usersLimit) || usedUsers < usersLimit!,
    documentsOk: isUnlimited(documentsLimit) || documentsUsed < documentsLimit!,
    usersLimit,
    documentsLimit,
    usersUsed: usedUsers,
    documentsUsed,
  }
}

/** True when usage is at or above 80% of a finite limit. */
export function isApproachingLimit(used: number, limit: number | null): boolean {
  if (limit == null || limit === -1 || limit <= 0) return false
  return used / limit >= 0.8
}
