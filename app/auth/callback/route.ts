import { NextResponse } from 'next/server'
import type { EmailOtpType } from '@supabase/supabase-js'
import { createClient } from '@/lib/supabase/server'
import { bootstrapOrganisationForAuthUser } from '@/app/actions/auth'

export async function GET(request: Request) {
  const { searchParams, origin } = new URL(request.url)
  const code = searchParams.get('code')
  const token_hash = searchParams.get('token_hash')
  const type = searchParams.get('type') as EmailOtpType | null
  const next = searchParams.get('next')
  const errorDescription = searchParams.get('error_description')

  if (errorDescription) {
    return NextResponse.redirect(
      `${origin}/login?error=verify&message=${encodeURIComponent(errorDescription)}`
    )
  }

  const supabase = await createClient()

  if (token_hash && type) {
    const { error } = await supabase.auth.verifyOtp({ token_hash, type })
    if (error) {
      return NextResponse.redirect(
        `${origin}/login?error=verify&message=${encodeURIComponent(error.message)}`
      )
    }
  } else if (code) {
    const { error } = await supabase.auth.exchangeCodeForSession(code)
    if (error) {
      return NextResponse.redirect(
        `${origin}/login?error=verify&message=${encodeURIComponent(error.message)}`
      )
    }
  } else {
    return NextResponse.redirect(`${origin}/login?error=verify`)
  }

  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    return NextResponse.redirect(`${origin}/login?error=verify`)
  }

  const meta = user.user_metadata ?? {}
  if (meta.signup_intent === 'register_organisation') {
    const result = await bootstrapOrganisationForAuthUser(user.id)
    if (!result.success) {
      return NextResponse.redirect(
        `${origin}/login?error=verify&message=${encodeURIComponent(result.error)}`
      )
    }
    return NextResponse.redirect(`${origin}/dashboard/onboarding`)
  }

  const safeNext =
    next && next.startsWith('/') && !next.startsWith('//') ? next : '/dashboard'
  return NextResponse.redirect(`${origin}${safeNext}`)
}
