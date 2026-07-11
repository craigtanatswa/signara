import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { loadOverseenDepartmentIdsByUser } from '@/lib/org-structure/load-overseen'
import { isJobLevel, type JobLevel } from '@/types/org-structure'

export async function GET() {
  const supabase = await createClient()

  const {
    data: { user: authUser },
  } = await supabase.auth.getUser()

  if (!authUser) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const { data: currentUser, error: currentUserError } = await supabase
    .from('users')
    .select('organisation_id, role')
    .eq('id', authUser.id)
    .single()

  if (currentUserError || !currentUser) {
    return NextResponse.json({ error: 'User not found' }, { status: 404 })
  }

  if (currentUser.role !== 'admin') {
    return NextResponse.json({ error: 'Forbidden: admin access required' }, { status: 403 })
  }

  const [{ data: users, error }, overseenByUser] = await Promise.all([
    supabase
      .from('users')
      .select('id, full_name, email, department_id, job_level, departments!users_department_id_fkey(name)')
      .eq('organisation_id', currentUser.organisation_id)
      .order('full_name'),
    loadOverseenDepartmentIdsByUser(supabase, currentUser.organisation_id),
  ])

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  const mapped = (users ?? []).map((user) => {
    const rawDepartment = user.departments
    const department = Array.isArray(rawDepartment) ? rawDepartment[0] : rawDepartment
    const departmentName =
      department && typeof department === 'object' && 'name' in department
        ? String(department.name)
        : null

    return {
      id: user.id,
      full_name: user.full_name,
      email: user.email,
      department_id: user.department_id,
      department_name: departmentName,
      job_level: isJobLevel(user.job_level) ? user.job_level : ('staff' as JobLevel),
      overseen_department_ids: overseenByUser.get(user.id) ?? [],
    }
  })

  return NextResponse.json({ users: mapped })
}
