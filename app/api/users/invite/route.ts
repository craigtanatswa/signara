import { randomUUID } from 'crypto'
import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { generateTempPassword } from '@/lib/utils'
// DEV ONLY: invitation email disabled while testing approval flows without Resend.
// import { resend } from '@/lib/email/resend'
// import { buildInvitationEmail } from '@/lib/email/templates/invitation'
// import { getResendFromAddress } from '@/lib/email/config'

import { validateUserPlacement } from '@/lib/org-structure/validation'
import { validateOverseenDepartments } from '@/lib/org-structure/overseen-departments'
import { syncUserOverseenDepartments } from '@/lib/org-structure/load-overseen'
import { JOB_LEVELS } from '@/types/org-structure'

function generateTestEmail(fullName: string): string {
  const slug =
    fullName
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-|-$/g, '')
      .slice(0, 30) || 'user'
  return `${slug}-${randomUUID().slice(0, 8)}@test.signara.local`
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
    // 1. Verify session
    const supabase = await createClient()
    const {
      data: { user: authUser },
    } = await supabase.auth.getUser()

    if (!authUser) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    // 2. Verify admin role
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

    // 3. Validate request body
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

    const departmentRecord = (departments ?? []).find((d) => d.id === department_id)
    const { data: existingUser } = await supabase
      .from('users')
      .select('id')
      .eq('email', email)
      .eq('organisation_id', currentUser.organisation_id)
      .maybeSingle()

    if (existingUser) {
      return NextResponse.json({ error: 'User already exists in this organisation' }, { status: 400 })
    }

    // 5. Generate temp password
    const tempPassword = generateTempPassword()

    // 6. Create auth user via admin client
    const adminSupabase = await createAdminClient()
    const { data: newAuthData, error: createAuthError } = await adminSupabase.auth.admin.createUser({
      email,
      password: tempPassword,
      email_confirm: true,
      user_metadata: { full_name },
    })

    if (createAuthError || !newAuthData.user) {
      return NextResponse.json(
        { error: createAuthError?.message ?? 'Failed to create auth user' },
        { status: 500 }
      )
    }

    const newUserId = newAuthData.user.id
    const orgName = (currentUser.organisations as { name: string } | null)?.name ?? 'your organisation'

    // 7. Insert into users table
    const { error: insertUserError } = await adminSupabase.from('users').insert({
      id: newUserId,
      email,
      full_name,
      position,
      organisation_id: currentUser.organisation_id,
      role,
      department_id,
      job_level,
      department: departmentRecord?.name ?? null,
      must_change_password: true,
    })

    if (insertUserError) {
      // Roll back auth user
      await adminSupabase.auth.admin.deleteUser(newUserId)
      return NextResponse.json(
        { error: insertUserError.message },
        { status: 500 }
      )
    }

    const syncResult = await syncUserOverseenDepartments(adminSupabase, {
      userId: newUserId,
      organisationId: currentUser.organisation_id,
      overseenDepartmentIds: overseen_department_ids,
    })

    if (syncResult.error) {
      await adminSupabase.from('users').delete().eq('id', newUserId)
      await adminSupabase.auth.admin.deleteUser(newUserId)
      return NextResponse.json({ error: syncResult.error }, { status: 500 })
    }

    // 8. Insert welcome notification
    await adminSupabase.from('notifications').insert({
      user_id: newUserId,
      type: 'welcome',
      title: 'Welcome to Signara',
      message: `You've been added to ${orgName}. Sign in with your temporary password.`,
    })

    // DEV ONLY: invitation email disabled — return credentials for local testing.
    // const loginUrl = process.env.NEXT_PUBLIC_APP_URL
    //   ? `${process.env.NEXT_PUBLIC_APP_URL}/login`
    //   : 'http://localhost:3000/login'
    //
    // const { subject, html } = buildInvitationEmail({
    //   recipientName: full_name.split(' ')[0],
    //   orgName,
    //   email,
    //   tempPassword,
    //   loginUrl,
    //   inviterName: currentUser.full_name,
    // })
    //
    // const { data: emailData, error: emailError } = await resend.emails.send({
    //   from: getResendFromAddress(),
    //   to: email,
    //   subject,
    //   html,
    // })
    //
    // if (emailError) {
    //   console.error('[invite] Resend error:', emailError)
    //   return NextResponse.json(
    //     {
    //       error:
    //         emailError.message ??
    //         'User was created but the invitation email could not be sent. Check Resend domain verification.',
    //     },
    //     { status: 502 }
    //   )
    // }

    return NextResponse.json({
      success: true,
      message: 'Member created',
      email,
      tempPassword,
    })
  } catch (err) {
    console.error('[invite] Unexpected error:', err)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
