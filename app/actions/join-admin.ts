'use server'

import { z } from 'zod'
import { revalidatePath } from 'next/cache'
import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { generateInviteToken, inviteExpiresAt, isJoinLinkAtCapacity } from '@/lib/auth/invite-token'
import { getAppBaseUrl } from '@/lib/app-url'
import { sendTransactionalEmail } from '@/lib/email/send'
import { buildInvitationEmail } from '@/lib/email/templates/invitation'
import {
  buildJoinApprovedEmail,
  buildJoinRejectedEmail,
} from '@/lib/email/templates/join-request'
import { checkPlanLimits } from '@/lib/billing/limits'
import { isTestUserEmail } from '@/lib/users/test-user'

async function getAuthenticatedAdmin() {
  const supabase = await createClient()
  const {
    data: { user: authUser },
  } = await supabase.auth.getUser()
  if (!authUser) redirect('/login')

  const { data: profile } = await supabase
    .from('users')
    .select('id, organisation_id, role, full_name')
    .eq('id', authUser.id)
    .single()

  if (!profile) redirect('/login')
  if (profile.role !== 'admin') redirect('/dashboard')

  return { supabase, profile }
}

export type UpsertJoinLinkResult =
  | { success: true; token: string; max_uses: number | null }
  | { error: string }

export async function upsertOrganisationJoinLink(input: {
  maxUses: number | null
}): Promise<UpsertJoinLinkResult> {
  const maxUses =
    input.maxUses == null || Number.isNaN(input.maxUses) ? null : Math.floor(input.maxUses)
  if (maxUses != null && maxUses < 1) {
    return { error: 'Member limit must be at least 1, or unlimited.' }
  }

  const { supabase, profile } = await getAuthenticatedAdmin()

  const { data: existing } = await supabase
    .from('organisation_join_links')
    .select('*')
    .eq('organisation_id', profile.organisation_id)
    .eq('is_active', true)
    .is('revoked_at', null)
    .maybeSingle()

  if (existing) {
    if (maxUses != null && existing.approved_count > maxUses) {
      return {
        error: `Cannot set limit below ${existing.approved_count} already-approved members.`,
      }
    }
    const { error } = await supabase
      .from('organisation_join_links')
      .update({ max_uses: maxUses })
      .eq('id', existing.id)
    if (error) return { error: error.message }
    revalidatePath('/dashboard/team')
    return { success: true, token: existing.token, max_uses: maxUses }
  }

  const token = generateInviteToken()
  const { error } = await supabase.from('organisation_join_links').insert({
    organisation_id: profile.organisation_id,
    token,
    created_by: profile.id,
    is_active: true,
    default_role: 'member',
    max_uses: maxUses,
    approved_count: 0,
  })

  if (error) return { error: error.message }

  revalidatePath('/dashboard/team')
  return { success: true, token, max_uses: maxUses }
}

export async function revokeOrganisationJoinLink(): Promise<{ success?: true; error?: string }> {
  const { supabase, profile } = await getAuthenticatedAdmin()

  const { error } = await supabase
    .from('organisation_join_links')
    .update({
      is_active: false,
      revoked_at: new Date().toISOString(),
    })
    .eq('organisation_id', profile.organisation_id)
    .eq('is_active', true)
    .is('revoked_at', null)

  if (error) return { error: error.message }

  revalidatePath('/dashboard/team')
  return { success: true }
}

export async function resendPendingInvite(
  inviteId: string
): Promise<
  | { success: true; delivery: 'manual'; email: string; inviteUrl: string; memberName: string }
  | { success: true; delivery: 'email'; email: string; memberName: string }
  | { error: string }
> {
  const parsed = z.string().uuid().safeParse(inviteId)
  if (!parsed.success) return { error: 'Invalid invitation' }

  const { supabase, profile } = await getAuthenticatedAdmin()

  const { data: invite } = await supabase
    .from('organisation_invites')
    .select('*')
    .eq('id', parsed.data)
    .eq('organisation_id', profile.organisation_id)
    .maybeSingle()

  if (!invite || invite.accepted_at) {
    return { error: 'Open invitation not found' }
  }

  const token = generateInviteToken()
  const expires_at = inviteExpiresAt(14)

  const { error: updateError } = await supabase
    .from('organisation_invites')
    .update({ token, expires_at })
    .eq('id', invite.id)

  if (updateError) return { error: updateError.message }

  const { data: org } = await supabase
    .from('organisations')
    .select('name')
    .eq('id', profile.organisation_id)
    .single()

  const inviteUrl = `${getAppBaseUrl()}/join/invite/${token}`
  const orgName = org?.name ?? 'your organisation'

  if (isTestUserEmail(invite.email) || !process.env.RESEND_API_KEY) {
    revalidatePath('/dashboard/team')
    return {
      success: true,
      delivery: 'manual',
      email: invite.email,
      inviteUrl,
      memberName: invite.full_name,
    }
  }

  const { subject, html } = buildInvitationEmail({
    recipientName: invite.full_name.split(' ')[0] ?? invite.full_name,
    orgName,
    email: invite.email,
    inviteUrl,
    inviterName: profile.full_name,
    expiresAt: expires_at,
  })

  await sendTransactionalEmail({ to: invite.email, subject, html })
  revalidatePath('/dashboard/team')
  return {
    success: true,
    delivery: 'email',
    email: invite.email,
    memberName: invite.full_name,
  }
}

export async function cancelPendingInvite(
  inviteId: string
): Promise<{ success?: true; error?: string }> {
  const parsed = z.string().uuid().safeParse(inviteId)
  if (!parsed.success) return { error: 'Invalid invitation' }

  const { supabase, profile } = await getAuthenticatedAdmin()

  const { error } = await supabase
    .from('organisation_invites')
    .delete()
    .eq('id', parsed.data)
    .eq('organisation_id', profile.organisation_id)
    .is('accepted_at', null)

  if (error) return { error: error.message }

  revalidatePath('/dashboard/team')
  return { success: true }
}

export async function reviewJoinRequest(input: {
  requestId: string
  decision: 'approved' | 'rejected'
}): Promise<{ success?: true; error?: string }> {
  const parsed = z
    .object({
      requestId: z.string().uuid(),
      decision: z.enum(['approved', 'rejected']),
    })
    .safeParse(input)

  if (!parsed.success) return { error: 'Invalid request' }

  const { supabase, profile } = await getAuthenticatedAdmin()
  const admin = createAdminClient()

  const { data: request } = await supabase
    .from('organisation_join_requests')
    .select('*, organisation_join_links(*)')
    .eq('id', parsed.data.requestId)
    .eq('organisation_id', profile.organisation_id)
    .maybeSingle()

  if (!request || request.status !== 'pending') {
    return { error: 'Pending join request not found' }
  }

  const { data: org } = await supabase
    .from('organisations')
    .select('name')
    .eq('id', profile.organisation_id)
    .single()

  const orgName = org?.name ?? 'your organisation'

  if (parsed.data.decision === 'rejected') {
    const { error } = await admin
      .from('organisation_join_requests')
      .update({
        status: 'rejected',
        reviewed_by: profile.id,
        reviewed_at: new Date().toISOString(),
      })
      .eq('id', request.id)

    if (error) return { error: error.message }

    if (request.auth_user_id) {
      await admin.auth.admin.deleteUser(request.auth_user_id)
    }

    const { subject, html } = buildJoinRejectedEmail({
      recipientName: request.full_name.split(' ')[0] ?? request.full_name,
      orgName,
    })
    await sendTransactionalEmail({ to: request.email, subject, html })

    revalidatePath('/dashboard/team')
    return { success: true }
  }

  const link = request.organisation_join_links as {
    id: string
    max_uses: number | null
    approved_count: number
    default_role: 'admin' | 'member'
    is_active: boolean
    revoked_at: string | null
  } | null

  if (!link || !link.is_active || link.revoked_at) {
    return { error: 'The shareable join link is no longer active.' }
  }

  if (isJoinLinkAtCapacity(link)) {
    return { error: 'This join link has reached its member limit.' }
  }

  const limits = await checkPlanLimits(profile.organisation_id)
  if (!limits.usersOk) {
    return { error: "You've reached your plan's user limit. Upgrade to approve more members." }
  }

  if (!request.auth_user_id) {
    return { error: 'Applicant account is missing. Ask them to re-apply.' }
  }

  const { data: dept } = await admin
    .from('departments')
    .select('id, name')
    .eq('organisation_id', profile.organisation_id)
    .eq('is_executive', false)
    .order('name')
    .limit(1)
    .maybeSingle()

  const fallbackDept = dept
    ? dept
    : (
        await admin
          .from('departments')
          .select('id, name')
          .eq('organisation_id', profile.organisation_id)
          .eq('is_executive', true)
          .maybeSingle()
      ).data

  const { error: userError } = await admin.from('users').insert({
    id: request.auth_user_id,
    email: request.email,
    full_name: request.full_name,
    organisation_id: profile.organisation_id,
    role: link.default_role,
    department_id: fallbackDept?.id ?? null,
    job_level: 'staff',
    department: fallbackDept?.name ?? null,
    must_change_password: false,
    onboarding_completed_at: new Date().toISOString(),
  })

  if (userError) return { error: userError.message }

  await admin
    .from('organisation_join_links')
    .update({ approved_count: link.approved_count + 1 })
    .eq('id', link.id)

  await admin
    .from('organisation_join_requests')
    .update({
      status: 'approved',
      reviewed_by: profile.id,
      reviewed_at: new Date().toISOString(),
    })
    .eq('id', request.id)

  await admin.from('notifications').insert({
    user_id: request.auth_user_id,
    type: 'welcome',
    title: 'Welcome to Signara',
    message: `Your request to join ${orgName} was approved.`,
  })

  const { subject, html } = buildJoinApprovedEmail({
    recipientName: request.full_name.split(' ')[0] ?? request.full_name,
    orgName,
    loginUrl: `${getAppBaseUrl()}/login`,
  })
  await sendTransactionalEmail({ to: request.email, subject, html })

  revalidatePath('/dashboard/team')
  return { success: true }
}
