'use server'

import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import { revalidatePath } from 'next/cache'
import {
  buildUniqueDepartmentSlug,
  validateDepartmentName,
} from '@/lib/org-structure/validation'
import type { Department } from '@/types/database'

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

export async function createDepartment(name: string) {
  const { supabase, profile } = await getAuthenticatedAdmin()
  const trimmed = name.trim()

  const { data: existing } = await supabase
    .from('departments')
    .select('name, slug')
    .eq('organisation_id', profile.organisation_id)

  const departments = (existing ?? []) as Pick<Department, 'name' | 'slug'>[]
  const nameError = validateDepartmentName(trimmed, departments.map((d) => d.name))
  if (nameError) {
    return { error: nameError }
  }

  const slug = buildUniqueDepartmentSlug(
    trimmed,
    departments.map((d) => d.slug)
  )

  const { data, error } = await supabase
    .from('departments')
    .insert({
      organisation_id: profile.organisation_id,
      name: trimmed,
      slug,
      is_executive: false,
    })
    .select('id, name, slug, is_executive')
    .single()

  if (error) {
    return { error: error.message }
  }

  revalidatePath('/dashboard/team')
  revalidatePath('/dashboard/settings/departments')
  return { department: data }
}

export async function deleteDepartment(id: string) {
  const { supabase, profile } = await getAuthenticatedAdmin()

  const { data: department } = await supabase
    .from('departments')
    .select('id, is_executive')
    .eq('id', id)
    .eq('organisation_id', profile.organisation_id)
    .maybeSingle()

  if (!department) {
    return { error: 'Department not found' }
  }

  if (department.is_executive) {
    return { error: 'The Executive department cannot be deleted.' }
  }

  const { count } = await supabase
    .from('users')
    .select('id', { count: 'exact', head: true })
    .eq('department_id', id)

  if ((count ?? 0) > 0) {
    return { error: 'Move or remove all members from this department before deleting it.' }
  }

  const { error } = await supabase
    .from('departments')
    .delete()
    .eq('id', id)
    .eq('organisation_id', profile.organisation_id)

  if (error) {
    return { error: error.message }
  }

  revalidatePath('/dashboard/team')
  revalidatePath('/dashboard/settings/departments')
  return { success: true }
}

export async function getDepartmentsForOrg(organisationId: string) {
  const supabase = await createClient()

  const { data } = await supabase
    .from('departments')
    .select('id, name, slug, is_executive')
    .eq('organisation_id', organisationId)
    .order('is_executive', { ascending: false })
    .order('name')

  return data ?? []
}
