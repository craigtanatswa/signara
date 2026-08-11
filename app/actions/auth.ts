'use server'

import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { getAppBaseUrl } from '@/lib/app-url'
import { resend } from '@/lib/email/resend'
import { getResendFromAddress } from '@/lib/email/config'
import { buildConfirmSignupEmail } from '@/lib/email/templates/confirm-signup'
import { redirect } from 'next/navigation'
import type { JobLevel } from '@/types/org-structure'

export async function signOut() {
  const supabase = await createClient()
  await supabase.auth.signOut()
  redirect('/login')
}

export type RegisterResult =
  | { success: true }
  | { success: false; error: string }

export async function registerOrganisation(formData: {
  organisationName: string
  fullName: string
  email: string
  password: string
  isManagingDirector?: boolean
}): Promise<RegisterResult> {
  const { organisationName, fullName, email, password, isManagingDirector } = formData
  const jobLevel: JobLevel = isManagingDirector ? 'managing_director' : 'staff'
  const trimmedOrg = organisationName.trim()
  const trimmedName = fullName.trim()
  const trimmedEmail = email.trim().toLowerCase()
  const redirectTo = `${getAppBaseUrl()}/auth/callback`

  const admin = createAdminClient()

  // Admin generateLink creates the auth user (unconfirmed) without sending
  // Supabase's default email — we send a branded Resend message instead.
  const { data: linkData, error: linkError } = await admin.auth.admin.generateLink({
    type: 'signup',
    email: trimmedEmail,
    password,
    options: {
      data: {
        organisation_name: trimmedOrg,
        full_name: trimmedName,
        job_level: jobLevel,
        signup_intent: 'register_organisation',
      },
      redirectTo,
    },
  })

  if (linkError || !linkData?.properties?.hashed_token) {
    return {
      success: false,
      error: linkError?.message ?? 'Failed to create account',
    }
  }

  const confirmUrl = `${getAppBaseUrl()}/auth/callback?token_hash=${encodeURIComponent(
    linkData.properties.hashed_token
  )}&type=signup`

  const { subject, html } = buildConfirmSignupEmail({
    recipientName: trimmedName.split(' ')[0] ?? trimmedName,
    email: trimmedEmail,
    confirmUrl,
    organisationName: trimmedOrg,
  })

  if (!process.env.RESEND_API_KEY) {
    // Local/dev without Resend: surface the link on the check-email page.
    redirect(
      `/register/check-email?email=${encodeURIComponent(trimmedEmail)}&devConfirmUrl=${encodeURIComponent(confirmUrl)}`
    )
  }

  const { error: emailError } = await resend.emails.send({
    from: getResendFromAddress(),
    to: trimmedEmail,
    subject,
    html,
  })

  if (emailError) {
    console.error('[register] Resend error:', emailError)
    return {
      success: false,
      error:
        emailError.message ??
        'Account was created but the confirmation email could not be sent. Check Resend configuration.',
    }
  }

  redirect(`/register/check-email?email=${encodeURIComponent(trimmedEmail)}`)
}

/**
 * Creates organisation + Executive dept + admin profile after email verification
 * (or immediately when confirmation is disabled).
 */
export async function bootstrapOrganisationForAuthUser(
  authUserId: string
): Promise<RegisterResult> {
  const admin = createAdminClient()

  const { data: existing } = await admin
    .from('users')
    .select('id')
    .eq('id', authUserId)
    .maybeSingle()

  if (existing) {
    return { success: true }
  }

  const { data: authData, error: authLookupError } = await admin.auth.admin.getUserById(authUserId)
  if (authLookupError || !authData.user) {
    return { success: false, error: authLookupError?.message ?? 'User not found' }
  }

  const meta = authData.user.user_metadata ?? {}
  if (meta.signup_intent !== 'register_organisation') {
    return { success: false, error: 'Missing registration details. Please register again.' }
  }

  const organisationName =
    typeof meta.organisation_name === 'string' ? meta.organisation_name.trim() : ''
  const fullName = typeof meta.full_name === 'string' ? meta.full_name.trim() : ''
  const email = authData.user.email
  const jobLevel: JobLevel =
    meta.job_level === 'managing_director' ? 'managing_director' : 'staff'

  if (!organisationName || organisationName.length < 2) {
    return { success: false, error: 'Organisation name is missing from registration.' }
  }
  if (!fullName || fullName.length < 2) {
    return { success: false, error: 'Full name is missing from registration.' }
  }
  if (!email) {
    return { success: false, error: 'Email is missing from registration.' }
  }

  const { data: orgData, error: orgError } = await admin
    .from('organisations')
    .insert({ name: organisationName })
    .select('id')
    .single()

  if (orgError || !orgData) {
    return { success: false, error: orgError?.message ?? 'Failed to create organisation' }
  }

  const { data: executiveDept, error: deptError } = await admin
    .from('departments')
    .insert({
      organisation_id: orgData.id,
      name: 'Executive',
      slug: 'executive',
      is_executive: true,
    })
    .select('id')
    .single()

  if (deptError || !executiveDept) {
    await admin.from('organisations').delete().eq('id', orgData.id)
    return { success: false, error: deptError?.message ?? 'Failed to create Executive department' }
  }

  const { error: userError } = await admin.from('users').insert({
    id: authUserId,
    email,
    full_name: fullName,
    organisation_id: orgData.id,
    role: 'admin',
    department_id: executiveDept.id,
    job_level: jobLevel,
    department: 'Executive',
    must_change_password: false,
    onboarding_completed_at: null,
  })

  if (userError) {
    await admin.from('organisations').delete().eq('id', orgData.id)
    return { success: false, error: userError.message }
  }

  return { success: true }
}

/** Completes org creation for a signed-in user who verified email but has no profile yet. */
export async function finishPendingRegistration(): Promise<RegisterResult> {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    return { success: false, error: 'You must be signed in to finish registration.' }
  }

  const result = await bootstrapOrganisationForAuthUser(user.id)
  if (!result.success) return result

  redirect('/dashboard/onboarding')
}
