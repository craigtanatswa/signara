import type { SupabaseClient } from '@supabase/supabase-js'

export interface OverseenDepartmentRow {
  id: string
  name: string
}

export async function loadOverseenDepartmentIdsByUser(
  supabase: SupabaseClient,
  organisationId: string
): Promise<Map<string, string[]>> {
  const { data } = await supabase
    .from('user_overseen_departments')
    .select('user_id, department_id')
    .eq('organisation_id', organisationId)

  const map = new Map<string, string[]>()
  for (const row of data ?? []) {
    const existing = map.get(row.user_id) ?? []
    existing.push(row.department_id)
    map.set(row.user_id, existing)
  }
  return map
}

export async function loadOverseenDepartmentsByUser(
  supabase: SupabaseClient,
  organisationId: string
): Promise<Map<string, OverseenDepartmentRow[]>> {
  const { data } = await supabase
    .from('user_overseen_departments')
    .select('user_id, departments(id, name)')
    .eq('organisation_id', organisationId)

  const map = new Map<string, OverseenDepartmentRow[]>()
  for (const row of data ?? []) {
    const rawDepartment = row.departments
    const department = Array.isArray(rawDepartment) ? rawDepartment[0] : rawDepartment
    if (!department || typeof department !== 'object' || !('id' in department)) continue

    const entry: OverseenDepartmentRow = {
      id: String(department.id),
      name: String(department.name),
    }
    const existing = map.get(row.user_id) ?? []
    existing.push(entry)
    map.set(row.user_id, existing)
  }

  for (const [userId, depts] of map) {
    map.set(
      userId,
      depts.sort((a, b) => a.name.localeCompare(b.name))
    )
  }

  return map
}

export async function syncUserOverseenDepartments(
  supabase: SupabaseClient,
  input: {
    userId: string
    organisationId: string
    overseenDepartmentIds: string[]
  }
): Promise<{ error?: string }> {
  const { userId, organisationId, overseenDepartmentIds } = input
  const uniqueIds = [...new Set(overseenDepartmentIds)]

  const { error: deleteError } = await supabase
    .from('user_overseen_departments')
    .delete()
    .eq('user_id', userId)
    .eq('organisation_id', organisationId)

  if (deleteError) {
    return { error: deleteError.message }
  }

  if (uniqueIds.length === 0) {
    return {}
  }

  const { error: insertError } = await supabase.from('user_overseen_departments').insert(
    uniqueIds.map((departmentId) => ({
      user_id: userId,
      department_id: departmentId,
      organisation_id: organisationId,
    }))
  )

  if (insertError) {
    return { error: insertError.message }
  }

  return {}
}
