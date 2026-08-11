'use server'

import { z } from 'zod'
import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { syncUserOverseenDepartments } from '@/lib/org-structure/load-overseen'
import { checkPlanLimits } from '@/lib/billing/limits'

const acceptSchema = z.object({
  token: z.string().min(16),
  password: z.string().min(8, { message: 'Password must be at least 8 characters' }),
  fullName: z.string().min(2).optional(),
})

export type AcceptInviteResult =
  | { success: true }
  | { success: false; error: string }

export async function acceptOrganisationInvite(input: {
  token: string
  password: string
  fullName?: string
}): Promise<AcceptInviteResult> {
  const parsed = acceptSchema.safeParse(input)
  if (!parsed.success) {
    return { success: false, error: parsed.error.issues[0]?.message ?? 'Invalid request' }
  }

  const { token, password, fullName } = parsed.data
  const admin = createAdminClient()

  const { data: invite, error: inviteError } = await admin
    .from('organisation_invites')
    .select('*')
    .eq('token', token)
    .maybeSingle()

  if (inviteError || !invite) {
    return { success: false, error: 'This invitation link is invalid.' }
  }

  if (invite.accepted_at) {
    return { success: false, error: 'This invitation has already been accepted.' }
  }

  if (new Date(invite.expires_at).getTime() < Date.now()) {
    return { success: false, error: 'This invitation has expired. Ask your admin to resend it.' }
  }

  const limits = await checkPlanLimits(invite.organisation_id)
  if (!limits.usersOk) {
    return {
      success: false,
      error: "This organisation has reached its user limit. Contact the administrator.",
    }
  }

  const { data: existingMember } = await admin
    .from('users')
    .select('id')
    .eq('organisation_id', invite.organisation_id)
    .ilike('email', invite.email)
    .maybeSingle()

  if (existingMember) {
    return { success: false, error: 'An account with this email already exists in the organisation.' }
  }

  const name = (fullName?.trim() || invite.full_name).trim()

  const { data: authData, error: authError } = await admin.auth.admin.createUser({
    email: invite.email,
    password,
    email_confirm: true,
    user_metadata: { full_name: name },
  })

  if (authError || !authData.user) {
    return { success: false, error: authError?.message ?? 'Failed to create account' }
  }

  const newUserId = authData.user.id

  const { data: dept } = invite.department_id
    ? await admin
        .from('departments')
        .select('id, name')
        .eq('id', invite.department_id)
        .maybeSingle()
    : { data: null }

  const { error: userError } = await admin.from('users').insert({
    id: newUserId,
    email: invite.email,
    full_name: name,
    position: invite.position,
    organisation_id: invite.organisation_id,
    role: invite.role,
    department_id: invite.department_id,
    job_level: invite.job_level,
    department: dept?.name ?? null,
    must_change_password: false,
    onboarding_completed_at: new Date().toISOString(),
  })

  if (userError) {
    await admin.auth.admin.deleteUser(newUserId)
    return { success: false, error: userError.message }
  }

  const overseen = Array.isArray(invite.overseen_department_ids)
    ? invite.overseen_department_ids
    : []

  if (overseen.length > 0) {
    const syncResult = await syncUserOverseenDepartments(admin, {
      userId: newUserId,
      organisationId: invite.organisation_id,
      overseenDepartmentIds: overseen,
    })
    if (syncResult.error) {
      await admin.from('users').delete().eq('id', newUserId)
      await admin.auth.admin.deleteUser(newUserId)
      return { success: false, error: syncResult.error }
    }
  }

  const { data: org } = await admin
    .from('organisations')
    .select('name')
    .eq('id', invite.organisation_id)
    .maybeSingle()

  await admin.from('notifications').insert({
    user_id: newUserId,
    type: 'welcome',
    title: 'Welcome to Signara',
    message: `You've joined ${org?.name ?? 'your organisation'}.`,
  })

  await admin
    .from('organisation_invites')
    .update({ accepted_at: new Date().toISOString() })
    .eq('id', invite.id)

  const anon = await createClient()
  const { error: signInError } = await anon.auth.signInWithPassword({
    email: invite.email,
    password,
  })

  if (signInError) {
    return {
      success: false,
      error: 'Account created but sign-in failed. Please sign in from the login page.',
    }
  }

  redirect('/dashboard')
}

// ─── Shareable join link applications ────────────────────────────────────────

const applySchema = z.object({
  token: z.string().min(16),
  fullName: z.string().min(2),
  email: z.string().email(),
  password: z.string().min(8),
})

export type ApplyJoinResult =
  | { success: true }
  | { success: false; error: string }

export async function applyViaJoinLink(input: {
  token: string
  fullName: string
  email: string
  password: string
}): Promise<ApplyJoinResult> {
  const parsed = applySchema.safeParse(input)
  if (!parsed.success) {
    return { success: false, error: parsed.error.issues[0]?.message ?? 'Invalid request' }
  }

  const { token, fullName, email, password } = parsed.data
  const admin = createAdminClient()

  const { data: link, error: linkError } = await admin
    .from('organisation_join_links')
    .select('*')
    .eq('token', token)
    .maybeSingle()

  if (linkError || !link || !link.is_active || link.revoked_at) {
    return { success: false, error: 'This join link is invalid or has been revoked.' }
  }

  if (isJoinLinkAtCapacity(link)) {
    return {
      success: false,
      error: 'This invite link has reached its member limit.',
    }
  }

  const { data: existingMember } = await admin
    .from('users')
    .select('id')
    .eq('organisation_id', link.organisation_id)
    .ilike('email', email)
    .maybeSingle()

  if (existingMember) {
    return { success: false, error: 'An account with this email already exists in the organisation.' }
  }

  const { data: pending } = await admin
    .from('organisation_join_requests')
    .select('id')
    .eq('organisation_id', link.organisation_id)
    .eq('status', 'pending')
    .ilike('email', email)
    .maybeSingle()

  if (pending) {
    return { success: false, error: 'You already have a pending request for this organisation.' }
  }

  const { data: authData, error: authError } = await admin.auth.admin.createUser({
    email,
    password,
    email_confirm: true,
    user_metadata: {
      full_name: fullName.trim(),
      signup_intent: 'join_request',
      organisation_id: link.organisation_id,
    },
  })

  if (authError || !authData.user) {
    return { success: false, error: authError?.message ?? 'Failed to create account' }
  }

  const { error: requestError } = await admin.from('organisation_join_requests').insert({
    organisation_id: link.organisation_id,
    join_link_id: link.id,
    email: email.trim().toLowerCase(),
    full_name: fullName.trim(),
    auth_user_id: authData.user.id,
    status: 'pending',
  })

  if (requestError) {
    await admin.auth.admin.deleteUser(authData.user.id)
    return { success: false, error: requestError.message }
  }

  return { success: true }
}

function isJoinLinkAtCapacity(link: { max_uses: number | null; approved_count: number }): boolean {
  return link.max_uses != null && link.approved_count >= link.max_uses
}

