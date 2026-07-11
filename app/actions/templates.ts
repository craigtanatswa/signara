'use server'

import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import { revalidatePath } from 'next/cache'
import type { TemplateScope, TiptapDocument } from '@/types/database'
import type { Workflow } from '@/types/workflow'

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

function validateTemplateName(name: string): string | null {
  if (!name.trim()) {
    return 'Template title is required.'
  }
  return null
}

function validateTemplateScope(scope: TemplateScope, departmentId: string | null): string | null {
  if (scope === 'department' && !departmentId) {
    return 'Select a department for this template, or make it organisation-wide.'
  }
  return null
}

async function resolveOrgDepartmentId(
  supabase: Awaited<ReturnType<typeof createClient>>,
  organisationId: string,
  departmentId: string | null
): Promise<{ departmentId: string | null; error?: string }> {
  if (!departmentId) {
    return { departmentId: null }
  }

  const { data: department } = await supabase
    .from('departments')
    .select('id')
    .eq('id', departmentId)
    .eq('organisation_id', organisationId)
    .maybeSingle()

  if (!department) {
    return { departmentId: null, error: 'Selected department was not found in your organisation.' }
  }

  return { departmentId: department.id }
}

// ─── Create ──────────────────────────────────────────────────────────────────

export async function createTemplate(data: {
  name: string
  description: string | null
  content: TiptapDocument | null
  is_active: boolean
  scope?: TemplateScope
  department_id?: string | null
  archive_department_id?: string | null
}) {
  const { supabase, profile } = await getAuthenticatedAdmin()
  const nameError = validateTemplateName(data.name)
  if (nameError) {
    return { error: nameError }
  }

  const scope: TemplateScope = data.scope ?? 'organisation'
  const departmentId = scope === 'department' ? (data.department_id ?? null) : null
  const scopeError = validateTemplateScope(scope, departmentId)
  if (scopeError) {
    return { error: scopeError }
  }

  if (departmentId) {
    const accessDept = await resolveOrgDepartmentId(supabase, profile.organisation_id, departmentId)
    if (accessDept.error) {
      return { error: accessDept.error }
    }
  }

  const archiveDept = await resolveOrgDepartmentId(
    supabase,
    profile.organisation_id,
    data.archive_department_id ?? null
  )
  if (archiveDept.error) {
    return { error: archiveDept.error }
  }

  const { data: template, error } = await supabase
    .from('templates')
    .insert({
      organisation_id: profile.organisation_id,
      name: data.name.trim(),
      description: data.description,
      content: data.content,
      workflow: { steps: [] } satisfies Workflow,
      scope,
      department_id: departmentId,
      archive_department_id: archiveDept.departmentId,
      created_by: profile.id,
      version: 1,
      is_active: data.is_active,
    })
    .select('id')
    .single()

  if (error) {
    return { error: error.message }
  }

  revalidatePath('/dashboard/templates')
  revalidatePath('/dashboard/archive')
  return { id: template.id }
}

// ─── Update ──────────────────────────────────────────────────────────────────

export async function updateTemplate(
  id: string,
  data: {
    name: string
    description: string | null
    content: TiptapDocument | null
    is_active: boolean
    scope?: TemplateScope
    department_id?: string | null
    archive_department_id?: string | null
  }
) {
  const { supabase, profile } = await getAuthenticatedAdmin()
  const nameError = validateTemplateName(data.name)
  if (nameError) {
    return { error: nameError }
  }

  const scope: TemplateScope = data.scope ?? 'organisation'
  const departmentId = scope === 'department' ? (data.department_id ?? null) : null
  const scopeError = validateTemplateScope(scope, departmentId)
  if (scopeError) {
    return { error: scopeError }
  }

  if (departmentId) {
    const accessDept = await resolveOrgDepartmentId(supabase, profile.organisation_id, departmentId)
    if (accessDept.error) {
      return { error: accessDept.error }
    }
  }

  const archiveDept = await resolveOrgDepartmentId(
    supabase,
    profile.organisation_id,
    data.archive_department_id ?? null
  )
  if (archiveDept.error) {
    return { error: archiveDept.error }
  }

  // Fetch current version to increment it
  const { data: existing } = await supabase
    .from('templates')
    .select('version, organisation_id')
    .eq('id', id)
    .eq('organisation_id', profile.organisation_id)
    .single()

  if (!existing) {
    return { error: 'Template not found' }
  }

  const { error } = await supabase
    .from('templates')
    .update({
      name: data.name.trim(),
      description: data.description,
      content: data.content,
      is_active: data.is_active,
      scope,
      department_id: departmentId,
      archive_department_id: archiveDept.departmentId,
      version: (existing.version ?? 1) + 1,
      updated_at: new Date().toISOString(),
    })
    .eq('id', id)
    .eq('organisation_id', profile.organisation_id)

  if (error) {
    return { error: error.message }
  }

  revalidatePath('/dashboard/templates')
  revalidatePath('/dashboard/archive')
  return { success: true }
}

// ─── Delete ──────────────────────────────────────────────────────────────────

export async function deleteTemplate(id: string) {
  const { supabase, profile } = await getAuthenticatedAdmin()

  const { error } = await supabase
    .from('templates')
    .delete()
    .eq('id', id)
    .eq('organisation_id', profile.organisation_id)

  if (error) {
    return { error: error.message }
  }

  revalidatePath('/dashboard/templates')
  return { success: true }
}

// ─── Duplicate ───────────────────────────────────────────────────────────────

export async function duplicateTemplate(id: string) {
  const { supabase, profile } = await getAuthenticatedAdmin()

  const { data: source } = await supabase
    .from('templates')
    .select('*')
    .eq('id', id)
    .eq('organisation_id', profile.organisation_id)
    .single()

  if (!source) {
    return { error: 'Template not found' }
  }

  const { data: copy, error } = await supabase
    .from('templates')
    .insert({
      organisation_id: profile.organisation_id,
      name: `${source.name} (copy)`,
      description: source.description,
      content: source.content,
      workflow: source.workflow ?? ({ steps: [] } satisfies Workflow),
      scope: source.scope ?? 'organisation',
      department_id: source.department_id ?? null,
      archive_department_id: source.archive_department_id ?? null,
      created_by: profile.id,
      version: 1,
      is_active: false,
    })
    .select('id')
    .single()

  if (error) {
    return { error: error.message }
  }

  revalidatePath('/dashboard/templates')
  return { id: copy.id }
}

// ─── Toggle active ────────────────────────────────────────────────────────────

export async function toggleTemplateActive(id: string, is_active: boolean) {
  const { supabase, profile } = await getAuthenticatedAdmin()

  const { error } = await supabase
    .from('templates')
    .update({ is_active, updated_at: new Date().toISOString() })
    .eq('id', id)
    .eq('organisation_id', profile.organisation_id)

  if (error) {
    return { error: error.message }
  }

  revalidatePath('/dashboard/templates')
  return { success: true }
}

// ─── Workflow ────────────────────────────────────────────────────────────────

export async function updateTemplateWorkflow(id: string, workflow: Workflow) {
  const { supabase, profile } = await getAuthenticatedAdmin()

  const { data: existing } = await supabase
    .from('templates')
    .select('id')
    .eq('id', id)
    .eq('organisation_id', profile.organisation_id)
    .maybeSingle()

  if (!existing) {
    return { error: 'Template not found' }
  }

  const { error } = await supabase
    .from('templates')
    .update({ workflow, updated_at: new Date().toISOString() })
    .eq('id', id)
    .eq('organisation_id', profile.organisation_id)

  if (error) {
    return { error: error.message }
  }

  revalidatePath('/dashboard/templates')
  revalidatePath(`/dashboard/templates/${id}/workflow`)
  return { success: true }
}
