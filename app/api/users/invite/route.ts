import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { generateTempPassword } from '@/lib/utils'
import { resend } from '@/lib/email/resend'
import { buildInvitationEmail } from '@/lib/email/templates/invitation'
import { getResendFromAddress } from '@/lib/email/config'

const inviteSchema = z.object({
  email: z.string().email({ message: 'Invalid email address' }),
  full_name: z.string().min(2, { message: 'Full name must be at least 2 characters' }),
  role: z.enum(['admin', 'member']),
  department: z.string().optional(),
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

    const { email, full_name, role, department } = parsed.data

    // 4. Check if user already exists in this org
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
      organisation_id: currentUser.organisation_id,
      role,
      department: department ?? null,
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

    // 8. Insert welcome notification
    await adminSupabase.from('notifications').insert({
      user_id: newUserId,
      type: 'welcome',
      title: 'Welcome to Signara',
      message: `You've been added to ${orgName}. Sign in with your temporary password.`,
    })

    // 9. Send invitation email
    const loginUrl = process.env.NEXT_PUBLIC_APP_URL
      ? `${process.env.NEXT_PUBLIC_APP_URL}/login`
      : 'http://localhost:3000/login'

    const { subject, html } = buildInvitationEmail({
      recipientName: full_name.split(' ')[0],
      orgName,
      email,
      tempPassword,
      loginUrl,
      inviterName: currentUser.full_name,
    })

    const { data: emailData, error: emailError } = await resend.emails.send({
      from: getResendFromAddress(),
      to: email,
      subject,
      html,
    })

    if (emailError) {
      console.error('[invite] Resend error:', emailError)
      return NextResponse.json(
        {
          error:
            emailError.message ??
            'User was created but the invitation email could not be sent. Check Resend domain verification.',
        },
        { status: 502 }
      )
    }

    // 10. Return success
    return NextResponse.json({ success: true, message: 'Invitation sent', emailId: emailData?.id })
  } catch (err) {
    console.error('[invite] Unexpected error:', err)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
