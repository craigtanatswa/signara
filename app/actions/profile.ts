'use server'

import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import { isBrandTheme, type BrandTheme } from '@/lib/brand-themes'

export type ActionResult =
  | { success: true; message: string }
  | { success: false; error: string }

export async function updateProfile(data: {
  full_name: string
  department: string
}): Promise<ActionResult> {
  const supabase = await createClient()

  const {
    data: { user: authUser },
  } = await supabase.auth.getUser()

  if (!authUser) {
    redirect('/login')
  }

  const { error } = await supabase
    .from('users')
    .update({
      full_name: data.full_name.trim(),
      department: data.department.trim() || null,
    })
    .eq('id', authUser.id)

  if (error) {
    return { success: false, error: error.message }
  }

  return { success: true, message: 'Profile updated successfully' }
}

export async function updateOrganisation(data: {
  name: string
}): Promise<ActionResult> {
  const supabase = await createClient()

  const {
    data: { user: authUser },
  } = await supabase.auth.getUser()

  if (!authUser) {
    redirect('/login')
  }

  const { data: userProfile, error: profileError } = await supabase
    .from('users')
    .select('organisation_id, role')
    .eq('id', authUser.id)
    .single()

  if (profileError || !userProfile) {
    return { success: false, error: 'User not found' }
  }

  if (userProfile.role !== 'admin') {
    return { success: false, error: 'Admin access required' }
  }

  const { error } = await supabase
    .from('organisations')
    .update({ name: data.name.trim() })
    .eq('id', userProfile.organisation_id)

  if (error) {
    return { success: false, error: error.message }
  }

  return { success: true, message: 'Organisation updated successfully' }
}

export async function updateBrandTheme(
  brandTheme: BrandTheme
): Promise<ActionResult> {
  if (!isBrandTheme(brandTheme)) {
    return { success: false, error: 'Invalid brand theme' }
  }

  const supabase = await createClient()

  const {
    data: { user: authUser },
  } = await supabase.auth.getUser()

  if (!authUser) {
    redirect('/login')
  }

  const { data: userProfile, error: profileError } = await supabase
    .from('users')
    .select('organisation_id, role')
    .eq('id', authUser.id)
    .single()

  if (profileError || !userProfile) {
    return { success: false, error: 'User not found' }
  }

  if (userProfile.role !== 'admin') {
    return { success: false, error: 'Admin access required' }
  }

  const { error } = await supabase
    .from('organisations')
    .update({ brand_theme: brandTheme })
    .eq('id', userProfile.organisation_id)

  if (error) {
    return { success: false, error: error.message }
  }

  return { success: true, message: 'Brand theme updated successfully' }
}

export async function updatePassword(password: string): Promise<ActionResult> {
  const supabase = await createClient()

  const {
    data: { user: authUser },
  } = await supabase.auth.getUser()

  if (!authUser) {
    redirect('/login')
  }

  const { error: updateError } = await supabase.auth.updateUser({ password })

  if (updateError) {
    return { success: false, error: updateError.message }
  }

  // Clear first-login flag when applicable
  await supabase
    .from('users')
    .update({ must_change_password: false })
    .eq('id', authUser.id)

  return { success: true, message: 'Password updated successfully' }
}
