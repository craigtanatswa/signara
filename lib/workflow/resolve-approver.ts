import { createAdminClient } from '@/lib/supabase/admin'
import { notifyOrganisationAdmins } from '@/lib/notifications/create'
import type { DocumentStep } from '@/types/database'

export interface ResolvedApprover {
  userId: string
  name: string
  email: string
}

type ResolvableStep = Pick<DocumentStep, 'id' | 'document_id' | 'assignee_user_id'> & {
  /** Legacy / future role-based assignment (department name or free-text role). */
  assignee_role?: string | null
}

/**
 * Resolve who should act on a document step.
 *
 * 1. If `assignee_user_id` is set, return that user.
 * 2. Else if `assignee_role` is set, pick the first active org user whose
 *    department name (or legacy `department` text) matches the role string.
 * 3. If none found, return null and notify org admins to assign manually.
 */
export async function resolveApprover(
  step: ResolvableStep,
  organisationId: string
): Promise<ResolvedApprover | null> {
  const supabase = createAdminClient()

  if (step.assignee_user_id) {
    const { data: user, error } = await supabase
      .from('users')
      .select('id, full_name, email')
      .eq('id', step.assignee_user_id)
      .eq('organisation_id', organisationId)
      .maybeSingle()

    if (error) {
      console.error('[resolveApprover]', error.message)
      return null
    }

    if (user) {
      return { userId: user.id, name: user.full_name, email: user.email }
    }
  }

  const role = step.assignee_role?.trim()
  if (role) {
    const { data: users, error } = await supabase
      .from('users')
      .select('id, full_name, email, department, departments(name)')
      .eq('organisation_id', organisationId)
      .order('full_name')
      .limit(50)

    if (error) {
      console.error('[resolveApprover] role lookup', error.message)
    } else {
      const roleLower = role.toLowerCase()
      const match = (users ?? []).find((user) => {
        const deptRelation = user.departments as { name: string } | { name: string }[] | null
        const deptFromJoin = Array.isArray(deptRelation)
          ? deptRelation[0]?.name
          : deptRelation?.name
        const deptName = deptFromJoin ?? user.department ?? ''
        return deptName.toLowerCase() === roleLower
      })

      if (match) {
        return { userId: match.id, name: match.full_name, email: match.email }
      }
    }
  }

  await notifyOrganisationAdmins({
    organisationId,
    documentId: step.document_id,
    type: 'approval_assignment_needed',
    title: 'Approver assignment needed',
    message:
      'A document step could not be assigned automatically. Please assign an approver manually.',
  })

  return null
}
