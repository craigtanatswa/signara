'use server'

import { z } from 'zod'
import { redirect } from 'next/navigation'
import { revalidatePath } from 'next/cache'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { validateUserPlacement } from '@/lib/org-structure/validation'
import { validateOverseenDepartments } from '@/lib/org-structure/overseen-departments'
import { syncUserOverseenDepartments } from '@/lib/org-structure/load-overseen'
import { JOB_LEVELS, type JobLevel } from '@/types/org-structure'

const userIdSchema = z.string().uuid()

const updatePlacementSchema = z.object({
  userId: z.string().uuid(),
  department_id: z.string().uuid(),
  job_level: z.enum(JOB_LEVELS),
  overseen_department_ids: z.array(z.string().uuid()).optional().default([]),
})

async function getAuthenticatedAdmin() {
  const supabase = await createClient()
  const {
    data: { user: authUser },
  } = await supabase.auth.getUser()
  if (!authUser) redirect('/login')

  const { data: profile } = await supabase
    .from('users')
    .select('id, organisation_id, role')
    .eq('id', authUser.id)
    .single()

  if (!profile) redirect('/login')
  if (profile.role !== 'admin') redirect('/dashboard')

  return { supabase, profile }
}

export async function updateMemberPlacement(input: {
  userId: string
  department_id: string
  job_level: JobLevel
  overseen_department_ids?: string[]
}) {
  const parsed = updatePlacementSchema.safeParse(input)
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? 'Invalid request' }
  }

  const { userId, department_id, job_level, overseen_department_ids } = parsed.data
  const { supabase, profile } = await getAuthenticatedAdmin()

  const { data: targetUser, error: targetError } = await supabase
    .from('users')
    .select('id, job_level')
    .eq('id', userId)
    .eq('organisation_id', profile.organisation_id)
    .maybeSingle()

  if (targetError || !targetUser) {
    return { error: 'Team member not found' }
  }

  const [{ data: departments }, { count: otherMdCount }] = await Promise.all([
    supabase
      .from('departments')
      .select('id, name, slug, is_executive')
      .eq('organisation_id', profile.organisation_id),
    supabase
      .from('users')
      .select('id', { count: 'exact', head: true })
      .eq('organisation_id', profile.organisation_id)
      .eq('job_level', 'managing_director')
      .neq('id', userId),
  ])

  const placementError = validateUserPlacement({
    departmentId: department_id,
    jobLevel: job_level,
    departments: departments ?? [],
    hasManagingDirector: (otherMdCount ?? 0) > 0,
    editingUserId: userId,
    currentUserJobLevel: targetUser.job_level as JobLevel,
  })

  if (placementError) {
    return { error: placementError }
  }

  const overseenError = validateOverseenDepartments({
    jobLevel: job_level,
    primaryDepartmentId: department_id,
    overseenDepartmentIds: overseen_department_ids,
    departments: departments ?? [],
  })

  if (overseenError) {
    return { error: overseenError }
  }

  const departmentRecord = (departments ?? []).find((d) => d.id === department_id)

  const { error: updateError } = await supabase
    .from('users')
    .update({
      department_id,
      job_level,
      department: departmentRecord?.name ?? null,
      updated_at: new Date().toISOString(),
    })
    .eq('id', userId)
    .eq('organisation_id', profile.organisation_id)

  if (updateError) {
    return { error: updateError.message }
  }

  const syncResult = await syncUserOverseenDepartments(supabase, {
    userId,
    organisationId: profile.organisation_id,
    overseenDepartmentIds: overseen_department_ids,
  })

  if (syncResult.error) {
    return { error: syncResult.error }
  }

  revalidatePath('/dashboard/team')
  revalidatePath('/dashboard/settings/profile')

  return { success: true }
}

export async function removeMember(userId: string) {
  const parsed = userIdSchema.safeParse(userId)
  if (!parsed.success) {
    return { error: 'Invalid team member' }
  }

  const { supabase, profile } = await getAuthenticatedAdmin()
  const targetId = parsed.data

  if (targetId === profile.id) {
    return { error: 'You cannot remove your own account from here.' }
  }

  const { data: targetUser, error: targetError } = await supabase
    .from('users')
    .select('id, full_name, email, role, job_level')
    .eq('id', targetId)
    .eq('organisation_id', profile.organisation_id)
    .maybeSingle()

  if (targetError || !targetUser) {
    return { error: 'Team member not found' }
  }

  if (targetUser.role === 'admin') {
    const { count: adminCount } = await supabase
      .from('users')
      .select('id', { count: 'exact', head: true })
      .eq('organisation_id', profile.organisation_id)
      .eq('role', 'admin')

    if ((adminCount ?? 0) <= 1) {
      return { error: 'Cannot remove the last admin. Promote another member first.' }
    }
  }

  const adminSupabase = await createAdminClient()

  const { error: notificationsError } = await adminSupabase
    .from('notifications')
    .delete()
    .eq('user_id', targetId)

  if (notificationsError) {
    return { error: notificationsError.message }
  }

  const { error: profileDeleteError } = await adminSupabase
    .from('users')
    .delete()
    .eq('id', targetId)
    .eq('organisation_id', profile.organisation_id)

  if (profileDeleteError) {
    return {
      error:
        profileDeleteError.message.includes('foreign key') ||
        profileDeleteError.code === '23503'
          ? 'This member is linked to documents or approvals and cannot be removed yet.'
          : profileDeleteError.message,
    }
  }

  const { error: authDeleteError } = await adminSupabase.auth.admin.deleteUser(targetId)

  if (authDeleteError) {
    return { error: authDeleteError.message }
  }

  revalidatePath('/dashboard/team')

  return { success: true, removedName: targetUser.full_name }
}
