import { randomUUID } from 'crypto'
import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { generateInviteToken, inviteExpiresAt } from '@/lib/auth/invite-token'
import { getAppBaseUrl } from '@/lib/app-url'
import { sendTransactionalEmail } from '@/lib/email/send'
import { buildInvitationEmail } from '@/lib/email/templates/invitation'
import { validateUserPlacement } from '@/lib/org-structure/validation'
import { validateOverseenDepartments } from '@/lib/org-structure/overseen-departments'
import { JOB_LEVELS } from '@/types/org-structure'
import { checkPlanLimits } from '@/lib/billing/limits'
import { buildPlanLimitReachedDetails } from '@/lib/billing/plan-limit-response'

function generateTestEmail(fullName: string): string {
  const slug =
    fullName
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-|-$/g, '')
      .slice(0, 30) || 'user'
  return `${slug}-${randomUUID().slice(0, 8)}@test.signara.local`
}

function isTestUserEmail(email: string): boolean {
  return email.toLowerCase().endsWith('@test.signara.local')
}

const inviteSchema = z.object({
  email: z.union([
    z.literal(''),
    z.string().email({ message: 'Invalid email address' }),
  ]),
  full_name: z.string().min(2, { message: 'Full name must be at least 2 characters' }),
  position: z
    .union([z.string().max(120, { message: 'Position must be 120 characters or fewer' }), z.null()])
    .optional(),
  role: z.enum(['admin', 'member']),
  department_id: z.string().uuid({ message: 'Select a department' }),
  job_level: z.enum(JOB_LEVELS, { message: 'Select a job level' }),
  overseen_department_ids: z.array(z.string().uuid()).optional().default([]),
})

export async function POST(request: NextRequest) {
  try {
    const supabase = await createClient()
    const {
      data: { user: authUser },
    } = await supabase.auth.getUser()

    if (!authUser) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { data: currentUser, error: currentUserError } = await supabase
      .from('users')
      .select('*, organisations(name)')
      .eq('id', authUser.id)
      .single()

    if (currentUserError || !currentUser) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 })
    }

    if (currentUser.role !== 'admin') {
      return NextResponse.json({ error: 'Forbidden: admin access required' }, { status: 403 })
    }

    const limits = await checkPlanLimits(currentUser.organisation_id)
    if (!limits.usersOk) {
      const planLimit = await buildPlanLimitReachedDetails({
        organisationId: currentUser.organisation_id,
        userRole: currentUser.role,
        type: 'users',
        limits,
      })
      return NextResponse.json(
        {
          error:
            "You've reached your plan's user limit. Upgrade to add more team members.",
          planLimit,
        },
        { status: 403 }
      )
    }

    const body = await request.json()
    const parsed = inviteSchema.safeParse(body)
    if (!parsed.success) {
      return NextResponse.json(
        { error: parsed.error.issues[0]?.message ?? 'Invalid request body' },
        { status: 400 }
      )
    }

    const {
      email: rawEmail,
      full_name,
      position: rawPosition,
      role,
      department_id,
      job_level,
      overseen_department_ids,
    } = parsed.data
    const email = rawEmail.trim() || generateTestEmail(full_name)
    const position = rawPosition?.trim() || null

    const { data: departments } = await supabase
      .from('departments')
      .select('id, name, slug, is_executive')
      .eq('organisation_id', currentUser.organisation_id)

    const { count: mdCount } = await supabase
      .from('users')
      .select('id', { count: 'exact', head: true })
      .eq('organisation_id', currentUser.organisation_id)
      .eq('job_level', 'managing_director')

    const placementError = validateUserPlacement({
      departmentId: department_id,
      jobLevel: job_level,
      departments: departments ?? [],
      hasManagingDirector: (mdCount ?? 0) > 0,
    })

    if (placementError) {
      return NextResponse.json({ error: placementError }, { status: 400 })
    }

    const overseenError = validateOverseenDepartments({
      jobLevel: job_level,
      primaryDepartmentId: department_id,
      overseenDepartmentIds: overseen_department_ids,
      departments: departments ?? [],
    })

    if (overseenError) {
      return NextResponse.json({ error: overseenError }, { status: 400 })
    }

    const { data: existingUser } = await supabase
      .from('users')
      .select('id')
      .eq('email', email)
      .eq('organisation_id', currentUser.organisation_id)
      .maybeSingle()

    if (existingUser) {
      return NextResponse.json({ error: 'User already exists in this organisation' }, { status: 400 })
    }

    const { data: existingInvite } = await supabase
      .from('organisation_invites')
      .select('id')
      .eq('organisation_id', currentUser.organisation_id)
      .ilike('email', email)
      .is('accepted_at', null)
      .maybeSingle()

    if (existingInvite) {
      return NextResponse.json(
        { error: 'An open invitation already exists for this email' },
        { status: 400 }
      )
    }

    const token = generateInviteToken()
    const expires_at = inviteExpiresAt(14)
    const adminSupabase = createAdminClient()

    const { error: inviteError } = await adminSupabase.from('organisation_invites').insert({
      organisation_id: currentUser.organisation_id,
      email,
      full_name,
      position,
      role,
      department_id,
      job_level,
      overseen_department_ids,
      token,
      invited_by: currentUser.id,
      expires_at,
    })

    if (inviteError) {
      return NextResponse.json({ error: inviteError.message }, { status: 500 })
    }

    const orgName =
      (currentUser.organisations as { name: string } | null)?.name ?? 'your organisation'
    const inviteUrl = `${getAppBaseUrl()}/join/invite/${token}`

    if (isTestUserEmail(email) || !process.env.RESEND_API_KEY) {
      return NextResponse.json({
        success: true,
        message: 'Invitation created',
        email,
        inviteUrl,
        delivery: 'manual' as const,
      })
    }

    const { subject, html } = buildInvitationEmail({
      recipientName: full_name.split(' ')[0] ?? full_name,
      orgName,
      email,
      inviteUrl,
      inviterName: currentUser.full_name,
      expiresAt: expires_at,
    })

    await sendTransactionalEmail({ to: email, subject, html })

    return NextResponse.json({
      success: true,
      message: 'Invitation sent',
      email,
      inviteUrl,
      delivery: 'email' as const,
    })
  } catch (err) {
    console.error('[invite] Unexpected error:', err)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
