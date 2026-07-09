'use server'

import { createServerClient } from '@supabase/ssr'
import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import { cookies } from 'next/headers'

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
}): Promise<RegisterResult> {
  const { organisationName, fullName, email, password } = formData

  // Service role client — only used server-side in this action
  const cookieStore = await cookies()
  const adminSupabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    {
      cookies: {
        getAll() {
          return cookieStore.getAll()
        },
        setAll(cookiesToSet) {
          try {
            cookiesToSet.forEach(({ name, value, options }) =>
              cookieStore.set(name, value, options)
            )
          } catch {}
        },
      },
    }
  )

  // 1. Create auth user with email confirmed
  const { data: authData, error: authError } =
    await adminSupabase.auth.admin.createUser({
      email,
      password,
      email_confirm: true,
    })

  if (authError || !authData.user) {
    return { success: false, error: authError?.message ?? 'Failed to create user' }
  }

  const authUser = authData.user

  // 2. Insert organisation
  const { data: orgData, error: orgError } = await adminSupabase
    .from('organisations')
    .insert({ name: organisationName })
    .select('id')
    .single()

  if (orgError || !orgData) {
    // Clean up auth user if org insert fails
    await adminSupabase.auth.admin.deleteUser(authUser.id)
    return { success: false, error: orgError?.message ?? 'Failed to create organisation' }
  }

  // 2b. Create Executive department
  const { data: executiveDept, error: deptError } = await adminSupabase
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
    await adminSupabase.auth.admin.deleteUser(authUser.id)
    return { success: false, error: deptError?.message ?? 'Failed to create Executive department' }
  }

  // 3. Insert user profile as org admin + Managing Director
  const { error: userError } = await adminSupabase.from('users').insert({
    id: authUser.id,
    email,
    full_name: fullName,
    organisation_id: orgData.id,
    role: 'admin',
    department_id: executiveDept.id,
    job_level: 'managing_director',
    department: 'Executive',
    must_change_password: false,
  })

  if (userError) {
    await adminSupabase.auth.admin.deleteUser(authUser.id)
    return { success: false, error: userError.message }
  }

  // 4. Sign in with the anon client to set session cookies
  const anonSupabase = await createClient()
  const { error: signInError } = await anonSupabase.auth.signInWithPassword({
    email,
    password,
  })

  if (signInError) {
    return { success: false, error: signInError.message }
  }

  redirect('/dashboard')
}
