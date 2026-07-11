'use server'

import { redirect } from 'next/navigation'
import { revalidatePath } from 'next/cache'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import {
  TEMPLATE_REQUEST_ATTACHMENTS_BUCKET,
  TEMPLATE_REQUEST_ATTACHMENT_MAX_BYTES,
  SIGNED_URL_TTL_SECONDS,
  getTemplateRequestAttachmentPath,
  isTemplateRequestMime,
} from '@/lib/storage/template-request-attachments'
import { canRequestTemplate } from '@/lib/templates/can-request-template'
import { formatUserDisplayName } from '@/lib/users/display-name'
import { isJobLevel, type JobLevel } from '@/types/org-structure'
import type { TemplateRequest, TemplateRequestStatus } from '@/types/database'

async function getAuthenticatedUser() {
  const supabase = await createClient()
  const {
    data: { user: authUser },
  } = await supabase.auth.getUser()
  if (!authUser) redirect('/login')

  const { data: profile } = await supabase
    .from('users')
    .select('id, organisation_id, role, department_id, job_level, full_name, position, email')
    .eq('id', authUser.id)
    .single()

  if (!profile) redirect('/login')

  return { supabase, profile }
}

async function getAuthenticatedAdmin() {
  const { supabase, profile } = await getAuthenticatedUser()
  if (profile.role !== 'admin') redirect('/dashboard')
  return { supabase, profile }
}

export async function uploadTemplateRequestAttachment(
  formData: FormData
): Promise<{ error: string } | { path: string; filename: string }> {
  const { supabase, profile } = await getAuthenticatedUser()

  if (!canRequestTemplate(profile.job_level)) {
    return {
      error: 'Only seniors and above can request a template.',
    }
  }

  const file = formData.get('file')
  const draftId = formData.get('draftId')

  if (!(file instanceof File) || file.size === 0) {
    return { error: 'Please upload a PDF or image of the physical form.' }
  }
  if (typeof draftId !== 'string' || !draftId) {
    return { error: 'Missing upload reference.' }
  }
  if (!isTemplateRequestMime(file.type)) {
    return { error: 'Please upload a PDF, PNG, JPEG, WebP, or GIF file.' }
  }
  if (file.size > TEMPLATE_REQUEST_ATTACHMENT_MAX_BYTES) {
    return {
      error: `File must be ${TEMPLATE_REQUEST_ATTACHMENT_MAX_BYTES / (1024 * 1024)} MB or smaller.`,
    }
  }

  const path = getTemplateRequestAttachmentPath(profile.organisation_id, draftId, file.name)
  const buffer = Buffer.from(await file.arrayBuffer())

  const { error: uploadError } = await supabase.storage
    .from(TEMPLATE_REQUEST_ATTACHMENTS_BUCKET)
    .upload(path, buffer, {
      upsert: true,
      contentType: file.type,
    })

  if (uploadError) {
    return { error: uploadError.message }
  }

  return { path, filename: file.name }
}

export async function getTemplateRequestAttachmentSignedUrl(
  path: string
): Promise<{ error: string } | { url: string }> {
  const { supabase, profile } = await getAuthenticatedUser()

  if (!path.startsWith(`${profile.organisation_id}/`)) {
    return { error: 'Attachment not found.' }
  }

  const { data, error } = await supabase.storage
    .from(TEMPLATE_REQUEST_ATTACHMENTS_BUCKET)
    .createSignedUrl(path, SIGNED_URL_TTL_SECONDS)

  if (error || !data) {
    return { error: error?.message ?? 'Could not open this attachment.' }
  }

  return { url: data.signedUrl }
}

export async function createTemplateRequest(input: {
  title: string
  description?: string | null
  departmentId: string
  attachmentPath: string
  attachmentFilename: string
}): Promise<{ error: string } | { requestId: string }> {
  const { supabase, profile } = await getAuthenticatedUser()

  if (!canRequestTemplate(profile.job_level)) {
    return {
      error:
        'Only seniors and above can request a template. Ask a senior or supervisor in your department to submit this.',
    }
  }

  const title = input.title.trim()
  if (!title) {
    return { error: 'Please enter a name for the form you want digitised.' }
  }
  if (!input.departmentId) {
    return { error: 'Please select a department.' }
  }
  if (!input.attachmentPath || !input.attachmentFilename) {
    return { error: 'Please upload a PDF or image of the physical form.' }
  }
  if (!input.attachmentPath.startsWith(`${profile.organisation_id}/`)) {
    return { error: 'Invalid attachment. Please upload the form again.' }
  }

  const { data: department, error: departmentError } = await supabase
    .from('departments')
    .select('id, name')
    .eq('id', input.departmentId)
    .eq('organisation_id', profile.organisation_id)
    .maybeSingle()

  if (departmentError || !department) {
    return { error: 'Department not found.' }
  }

  // Prefer the requester's own department; admins/MD may request for any.
  if (
    profile.role !== 'admin' &&
    profile.department_id &&
    profile.department_id !== input.departmentId
  ) {
    const jobLevel = isJobLevel(profile.job_level) ? profile.job_level : ('staff' as JobLevel)
    if (jobLevel !== 'managing_director') {
      return { error: 'You can only request a template for your own department.' }
    }
  }

  if (!profile.department_id && profile.role !== 'admin') {
    return {
      error:
        'Your account is not assigned to a department. Ask an admin to set your department on the Team page first.',
    }
  }

  const { data: request, error: insertError } = await supabase
    .from('template_requests')
    .insert({
      organisation_id: profile.organisation_id,
      requested_by: profile.id,
      department_id: input.departmentId,
      title,
      description: input.description?.trim() || null,
      attachment_path: input.attachmentPath,
      attachment_filename: input.attachmentFilename,
      status: 'pending',
    })
    .select('id')
    .single()

  if (insertError || !request) {
    return { error: insertError?.message ?? 'Failed to submit your request.' }
  }

  // Notify all org admins (service role so RLS doesn't hide other admins).
  const adminClient = createAdminClient()
  const { data: admins } = await adminClient
    .from('users')
    .select('id')
    .eq('organisation_id', profile.organisation_id)
    .eq('role', 'admin')

  if (admins && admins.length > 0) {
    await adminClient.from('notifications').insert(
      admins.map((admin) => ({
        user_id: admin.id,
        type: 'template_request',
        title: 'New template request',
        message: `${formatUserDisplayName(profile.full_name, profile.position)} requested a "${title}" template for ${department.name}.`,
      }))
    )
  }

  revalidatePath('/dashboard/requests')
  revalidatePath('/dashboard/templates')
  revalidatePath('/dashboard/documents/new')

  return { requestId: request.id }
}

function mapTemplateRequestRows(
  data: Array<Record<string, unknown>>
): TemplateRequestListItem[] {
  return data.map((row) => {
    const department = Array.isArray(row.departments) ? row.departments[0] : row.departments
    const requester = Array.isArray(row.requester) ? row.requester[0] : row.requester

    return {
      id: String(row.id),
      title: String(row.title),
      description: (row.description as string | null) ?? null,
      status: row.status as TemplateRequestStatus,
      attachment_path: String(row.attachment_path),
      attachment_filename: String(row.attachment_filename),
      admin_notes: (row.admin_notes as string | null) ?? null,
      created_at: String(row.created_at),
      reviewed_at: (row.reviewed_at as string | null) ?? null,
      departmentName:
        department && typeof department === 'object' && 'name' in department
          ? String(department.name)
          : 'Unknown department',
      requesterName:
        requester && typeof requester === 'object' && 'full_name' in requester
          ? formatUserDisplayName(
              String(requester.full_name),
              'position' in requester ? (requester.position as string | null) : null
            )
          : 'Unknown',
      requesterJobLevel:
        requester &&
        typeof requester === 'object' &&
        'job_level' in requester &&
        isJobLevel(requester.job_level)
          ? requester.job_level
          : null,
    }
  })
}

const TEMPLATE_REQUEST_LIST_SELECT = `
  id,
  title,
  description,
  status,
  attachment_path,
  attachment_filename,
  admin_notes,
  created_at,
  reviewed_at,
  department_id,
  requested_by,
  departments ( name ),
  requester:users!requested_by ( full_name, position, job_level )
`

export interface TemplateRequestListItem {
  id: string
  title: string
  description: string | null
  status: TemplateRequestStatus
  attachment_path: string
  attachment_filename: string
  admin_notes: string | null
  created_at: string
  reviewed_at: string | null
  departmentName: string
  requesterName: string
  requesterJobLevel: JobLevel | null
}

export async function listPendingTemplateRequests(): Promise<{
  error?: string
  requests: TemplateRequestListItem[]
}> {
  const result = await listOrganisationTemplateRequests('pending')
  return result
}

/** Admin: all org template requests, optionally filtered by status. */
export async function listOrganisationTemplateRequests(
  status?: TemplateRequestStatus | 'all'
): Promise<{
  error?: string
  requests: TemplateRequestListItem[]
}> {
  const { supabase, profile } = await getAuthenticatedAdmin()

  let query = supabase
    .from('template_requests')
    .select(TEMPLATE_REQUEST_LIST_SELECT)
    .eq('organisation_id', profile.organisation_id)
    .order('created_at', { ascending: false })

  if (status && status !== 'all') {
    query = query.eq('status', status)
  }

  const { data, error } = await query

  if (error) {
    return { error: error.message, requests: [] }
  }

  return {
    requests: mapTemplateRequestRows((data ?? []) as Array<Record<string, unknown>>),
  }
}

/** Member: requests submitted by the current user. */
export async function listMyTemplateRequests(): Promise<{
  error?: string
  requests: TemplateRequestListItem[]
}> {
  const { supabase, profile } = await getAuthenticatedUser()

  const { data, error } = await supabase
    .from('template_requests')
    .select(TEMPLATE_REQUEST_LIST_SELECT)
    .eq('organisation_id', profile.organisation_id)
    .eq('requested_by', profile.id)
    .order('created_at', { ascending: false })

  if (error) {
    return { error: error.message, requests: [] }
  }

  return {
    requests: mapTemplateRequestRows((data ?? []) as Array<Record<string, unknown>>),
  }
}

export async function dismissTemplateRequest(input: {
  requestId: string
  adminNotes?: string | null
}): Promise<{ error: string } | { success: true }> {
  const { supabase, profile } = await getAuthenticatedAdmin()

  const { data: request, error: fetchError } = await supabase
    .from('template_requests')
    .select('id, status, requested_by, title')
    .eq('id', input.requestId)
    .eq('organisation_id', profile.organisation_id)
    .maybeSingle()

  if (fetchError || !request) {
    return { error: 'Request not found.' }
  }
  if ((request as TemplateRequest).status !== 'pending') {
    return { error: 'This request has already been reviewed.' }
  }

  const { error: updateError } = await supabase
    .from('template_requests')
    .update({
      status: 'dismissed',
      admin_notes: input.adminNotes?.trim() || null,
      reviewed_by: profile.id,
      reviewed_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    })
    .eq('id', input.requestId)

  if (updateError) {
    return { error: updateError.message }
  }

  await supabase.from('notifications').insert({
    user_id: request.requested_by,
    type: 'template_request_dismissed',
    title: 'Template request declined',
    message: `Your request for "${request.title}" was declined by an administrator.`,
  })

  revalidatePath('/dashboard/requests')
  revalidatePath('/dashboard/templates')
  return { success: true }
}

export async function fulfillTemplateRequest(input: {
  requestId: string
  templateId?: string | null
  adminNotes?: string | null
}): Promise<{ error: string } | { success: true }> {
  const { supabase, profile } = await getAuthenticatedAdmin()

  const { data: request, error: fetchError } = await supabase
    .from('template_requests')
    .select('id, status, requested_by, title')
    .eq('id', input.requestId)
    .eq('organisation_id', profile.organisation_id)
    .maybeSingle()

  if (fetchError || !request) {
    return { error: 'Request not found.' }
  }
  if ((request as TemplateRequest).status !== 'pending') {
    return { error: 'This request has already been reviewed.' }
  }

  if (input.templateId) {
    const { data: template } = await supabase
      .from('templates')
      .select('id')
      .eq('id', input.templateId)
      .eq('organisation_id', profile.organisation_id)
      .maybeSingle()

    if (!template) {
      return { error: 'Linked template not found.' }
    }
  }

  const { error: updateError } = await supabase
    .from('template_requests')
    .update({
      status: 'fulfilled',
      admin_notes: input.adminNotes?.trim() || null,
      reviewed_by: profile.id,
      reviewed_at: new Date().toISOString(),
      resulting_template_id: input.templateId ?? null,
      updated_at: new Date().toISOString(),
    })
    .eq('id', input.requestId)

  if (updateError) {
    return { error: updateError.message }
  }

  await supabase.from('notifications').insert({
    user_id: request.requested_by,
    type: 'template_request_fulfilled',
    title: 'Template request satisfied',
    message: `Your request for "${request.title}" has been accepted and satisfied. A new template is ready to use.`,
  })

  revalidatePath('/dashboard/requests')
  revalidatePath('/dashboard/templates')
  return { success: true }
}
