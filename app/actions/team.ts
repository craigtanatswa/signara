'use server'

import { z } from 'zod'
import { redirect } from 'next/navigation'
import { revalidatePath } from 'next/cache'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { validateUserPlacement } from '@/lib/org-structure/validation'
import { validateOverseenDepartments } from '@/lib/org-structure/overseen-departments'
import { syncUserOverseenDepartments } from '@/lib/org-structure/load-overseen'
import { generateTempPassword } from '@/lib/utils'
import { resend } from '@/lib/email/resend'
import { getResendFromAddress } from '@/lib/email/config'
import { getAppBaseUrl } from '@/lib/email/send'
import { buildPasswordResetEmail } from '@/lib/email/templates/password-reset'
import { buildInvitationEmail } from '@/lib/email/templates/invitation'
import { isTestUserEmail } from '@/lib/users/test-user'
import { JOB_LEVELS, type JobLevel } from '@/types/org-structure'

const userIdSchema = z.string().uuid()

const updatePlacementSchema = z.object({
  userId: z.string().uuid(),
  position: z
    .union([z.string().max(120, { message: 'Position must be 120 characters or fewer' }), z.null()])
    .optional(),
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
  position?: string | null
  department_id: string
  job_level: JobLevel
  overseen_department_ids?: string[]
}) {
  const parsed = updatePlacementSchema.safeParse(input)
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? 'Invalid request' }
  }

  const { userId, position: rawPosition, department_id, job_level, overseen_department_ids } =
    parsed.data
  const position = rawPosition?.trim() || null
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
      position,
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

export async function activateMember(userId: string) {
  const parsed = userIdSchema.safeParse(userId)
  if (!parsed.success) {
    return { error: 'Invalid team member' }
  }

  const { supabase, profile } = await getAuthenticatedAdmin()
  const targetId = parsed.data

  const { data: targetUser, error: targetError } = await supabase
    .from('users')
    .select('id, full_name, must_change_password')
    .eq('id', targetId)
    .eq('organisation_id', profile.organisation_id)
    .maybeSingle()

  if (targetError || !targetUser) {
    return { error: 'Team member not found' }
  }

  if (!targetUser.must_change_password) {
    return { error: 'This account is already active' }
  }

  const { error: updateError } = await supabase
    .from('users')
    .update({
      must_change_password: false,
      updated_at: new Date().toISOString(),
    })
    .eq('id', targetId)
    .eq('organisation_id', profile.organisation_id)

  if (updateError) {
    return { error: updateError.message }
  }

  revalidatePath('/dashboard/team')

  return { success: true, memberName: targetUser.full_name }
}

export type ResetMemberPasswordResult =
  | { success: true; delivery: 'manual'; email: string; tempPassword: string; memberName: string }
  | { success: true; delivery: 'email'; email: string; memberName: string }
  | { error: string }

export async function resetMemberPassword(userId: string): Promise<ResetMemberPasswordResult> {
  const parsed = userIdSchema.safeParse(userId)
  if (!parsed.success) {
    return { error: 'Invalid team member' }
  }

  const { supabase, profile } = await getAuthenticatedAdmin()
  const targetId = parsed.data

  if (targetId === profile.id) {
    return { error: 'You cannot reset your own password from here. Use Settings instead.' }
  }

  const [{ data: targetUser, error: targetError }, { data: adminProfile }] = await Promise.all([
    supabase
      .from('users')
      .select('id, full_name, email')
      .eq('id', targetId)
      .eq('organisation_id', profile.organisation_id)
      .maybeSingle(),
    supabase
      .from('users')
      .select('full_name, organisations(name)')
      .eq('id', profile.id)
      .single(),
  ])

  if (targetError || !targetUser) {
    return { error: 'Team member not found' }
  }

  const tempPassword = generateTempPassword()
  const adminSupabase = await createAdminClient()

  const { error: authError } = await adminSupabase.auth.admin.updateUserById(targetId, {
    password: tempPassword,
  })

  if (authError) {
    return { error: authError.message }
  }

  const { error: updateError } = await adminSupabase
    .from('users')
    .update({
      must_change_password: true,
      updated_at: new Date().toISOString(),
    })
    .eq('id', targetId)
    .eq('organisation_id', profile.organisation_id)

  if (updateError) {
    return { error: updateError.message }
  }

  if (isTestUserEmail(targetUser.email)) {
    revalidatePath('/dashboard/team')
    return {
      success: true,
      delivery: 'manual',
      email: targetUser.email,
      tempPassword,
      memberName: targetUser.full_name,
    }
  }

  if (!process.env.RESEND_API_KEY) {
    return {
      error:
        'Email is not configured. Set RESEND_API_KEY to send password reset emails to real users.',
    }
  }

  const rawOrg = adminProfile?.organisations
  const orgRecord = Array.isArray(rawOrg) ? rawOrg[0] : rawOrg
  const orgName =
    orgRecord && typeof orgRecord === 'object' && 'name' in orgRecord
      ? String(orgRecord.name)
      : 'your organisation'
  const loginUrl = `${getAppBaseUrl()}/login`
  const { subject, html } = buildPasswordResetEmail({
    recipientName: targetUser.full_name.split(' ')[0] ?? targetUser.full_name,
    orgName,
    email: targetUser.email,
    tempPassword,
    loginUrl,
    adminName: adminProfile?.full_name,
  })

  const { error: emailError } = await resend.emails.send({
    from: getResendFromAddress(),
    to: targetUser.email,
    subject,
    html,
  })

  if (emailError) {
    console.error('[resetMemberPassword] Resend error:', emailError)
    return {
      error:
        emailError.message ??
        'Password was updated but the email could not be sent. Check Resend domain verification.',
    }
  }

  revalidatePath('/dashboard/team')

  return {
    success: true,
    delivery: 'email',
    email: targetUser.email,
    memberName: targetUser.full_name,
  }
}

export async function setMemberActive(userId: string, isActive: boolean) {
  const parsed = userIdSchema.safeParse(userId)
  if (!parsed.success) {
    return { error: 'Invalid team member' }
  }

  const { supabase, profile } = await getAuthenticatedAdmin()
  const targetId = parsed.data

  if (targetId === profile.id) {
    return { error: 'You cannot deactivate your own account.' }
  }

  const { data: targetUser, error: targetError } = await supabase
    .from('users')
    .select('id, full_name, is_active')
    .eq('id', targetId)
    .eq('organisation_id', profile.organisation_id)
    .maybeSingle()

  if (targetError || !targetUser) {
    return { error: 'Team member not found' }
  }

  if (targetUser.is_active === isActive) {
    return {
      error: isActive
        ? 'This account is already active'
        : 'This account is already deactivated',
    }
  }

  const { error: updateError } = await supabase
    .from('users')
    .update({
      is_active: isActive,
      updated_at: new Date().toISOString(),
    })
    .eq('id', targetId)
    .eq('organisation_id', profile.organisation_id)

  if (updateError) {
    return { error: updateError.message }
  }

  revalidatePath('/dashboard/team')

  return {
    success: true,
    memberName: targetUser.full_name,
    isActive,
  }
}

export async function changeMemberRole(userId: string, role: 'admin' | 'member') {
  const parsed = userIdSchema.safeParse(userId)
  if (!parsed.success) {
    return { error: 'Invalid team member' }
  }

  if (role !== 'admin' && role !== 'member') {
    return { error: 'Invalid role' }
  }

  const { supabase, profile } = await getAuthenticatedAdmin()
  const targetId = parsed.data

  const { data: targetUser, error: targetError } = await supabase
    .from('users')
    .select('id, full_name, role')
    .eq('id', targetId)
    .eq('organisation_id', profile.organisation_id)
    .maybeSingle()

  if (targetError || !targetUser) {
    return { error: 'Team member not found' }
  }

  if (targetUser.role === role) {
    return { error: `This member is already a${role === 'admin' ? 'n admin' : ' member'}.` }
  }

  if (targetId === profile.id && role === 'member') {
    const { count: adminCount } = await supabase
      .from('users')
      .select('id', { count: 'exact', head: true })
      .eq('organisation_id', profile.organisation_id)
      .eq('role', 'admin')
      .eq('is_active', true)

    if ((adminCount ?? 0) <= 1) {
      return {
        error:
          'Cannot demote yourself — you are the only admin. Promote another member first.',
      }
    }
  }

  if (targetUser.role === 'admin' && role === 'member') {
    const { count: adminCount } = await supabase
      .from('users')
      .select('id', { count: 'exact', head: true })
      .eq('organisation_id', profile.organisation_id)
      .eq('role', 'admin')
      .eq('is_active', true)

    if ((adminCount ?? 0) <= 1) {
      return { error: 'Cannot demote the last admin. Promote another member first.' }
    }
  }

  const { error: updateError } = await supabase
    .from('users')
    .update({
      role,
      updated_at: new Date().toISOString(),
    })
    .eq('id', targetId)
    .eq('organisation_id', profile.organisation_id)

  if (updateError) {
    return { error: updateError.message }
  }

  revalidatePath('/dashboard/team')

  return {
    success: true,
    memberName: targetUser.full_name,
    role,
  }
}

export type ResendInvitationResult =
  | { success: true; delivery: 'manual'; email: string; tempPassword: string; memberName: string }
  | { success: true; delivery: 'email'; email: string; memberName: string }
  | { error: string }

export async function resendInvitation(userId: string): Promise<ResendInvitationResult> {
  const parsed = userIdSchema.safeParse(userId)
  if (!parsed.success) {
    return { error: 'Invalid team member' }
  }

  const { supabase, profile } = await getAuthenticatedAdmin()
  const targetId = parsed.data

  const [{ data: targetUser, error: targetError }, { data: adminProfile }] = await Promise.all([
    supabase
      .from('users')
      .select('id, full_name, email, must_change_password, is_active')
      .eq('id', targetId)
      .eq('organisation_id', profile.organisation_id)
      .maybeSingle(),
    supabase
      .from('users')
      .select('full_name, organisations(name)')
      .eq('id', profile.id)
      .single(),
  ])

  if (targetError || !targetUser) {
    return { error: 'Team member not found' }
  }

  if (!targetUser.must_change_password) {
    return {
      error:
        'This member has already completed setup. Use Reset password instead.',
    }
  }

  if (targetUser.is_active === false) {
    return { error: 'Reactivate this account before resending an invitation.' }
  }

  const tempPassword = generateTempPassword()
  const adminSupabase = await createAdminClient()

  const { error: authError } = await adminSupabase.auth.admin.updateUserById(targetId, {
    password: tempPassword,
  })

  if (authError) {
    return { error: authError.message }
  }

  const { error: updateError } = await adminSupabase
    .from('users')
    .update({
      must_change_password: true,
      updated_at: new Date().toISOString(),
    })
    .eq('id', targetId)
    .eq('organisation_id', profile.organisation_id)

  if (updateError) {
    return { error: updateError.message }
  }

  if (isTestUserEmail(targetUser.email)) {
    revalidatePath('/dashboard/team')
    return {
      success: true,
      delivery: 'manual',
      email: targetUser.email,
      tempPassword,
      memberName: targetUser.full_name,
    }
  }

  if (!process.env.RESEND_API_KEY) {
    return {
      error:
        'Email is not configured. Set RESEND_API_KEY to send invitation emails to real users.',
    }
  }

  const rawOrg = adminProfile?.organisations
  const orgRecord = Array.isArray(rawOrg) ? rawOrg[0] : rawOrg
  const orgName =
    orgRecord && typeof orgRecord === 'object' && 'name' in orgRecord
      ? String(orgRecord.name)
      : 'your organisation'
  const loginUrl = `${getAppBaseUrl()}/login`
  const { subject, html } = buildInvitationEmail({
    recipientName: targetUser.full_name.split(' ')[0] ?? targetUser.full_name,
    orgName,
    email: targetUser.email,
    tempPassword,
    loginUrl,
    inviterName: adminProfile?.full_name,
  })

  const { error: emailError } = await resend.emails.send({
    from: getResendFromAddress(),
    to: targetUser.email,
    subject,
    html,
  })

  if (emailError) {
    console.error('[resendInvitation] Resend error:', emailError)
    return {
      error:
        emailError.message ??
        'Password was updated but the invitation email could not be sent.',
    }
  }

  revalidatePath('/dashboard/team')

  return {
    success: true,
    delivery: 'email',
    email: targetUser.email,
    memberName: targetUser.full_name,
  }
}
