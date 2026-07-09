import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

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

  const { data: departments, error } = await supabase
    .from('departments')
    .select('id, name, slug, is_executive')
    .eq('organisation_id', currentUser.organisation_id)
    .order('is_executive', { ascending: false })
    .order('name')

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  return NextResponse.json({ departments: departments ?? [] })
}
