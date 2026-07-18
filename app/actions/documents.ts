'use server'

import { redirect } from 'next/navigation'
import { revalidatePath } from 'next/cache'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import {
  canInitiateTemplate,
  getEligibleApprovers,
  buildStepApproverShortageMessage,
  validateApprovalChain,
  type ChainAssignment,
} from '@/lib/approval/eligibility'
import {
  canInitiatorCancelDocument,
  canInitiatorEditDocument,
  getMissingInitiatorSignatureError,
} from '@/lib/approval/document-initiator'
import { shouldIncludeWorkflowStep } from '@/lib/workflow/resolve-steps'
import { parseStepNotes, stringifyStepNotes } from '@/lib/workflow/step-notes'
import { notifyApproverForStep } from '@/lib/workflow/notify-routing'
import {
  getInitiatorSignatureField,
  listApproverSignatureFieldOptions,
} from '@/lib/workflow/signature-fields'
import { formatStepPolicyLabel, normaliseWorkflow } from '@/types/workflow'
import { loadOverseenDepartmentIdsByUser } from '@/lib/org-structure/load-overseen'
import { formatUserDisplayName } from '@/lib/users/display-name'
import { JOB_LEVEL_LABELS, isJobLevel, type JobLevel } from '@/types/org-structure'
import {
  DOCUMENT_ATTACHMENTS_BUCKET,
  DOCUMENT_ATTACHMENT_MAX_BYTES,
  SIGNED_URL_TTL_SECONDS,
  getDocumentAttachmentPath,
} from '@/lib/storage/document-attachments'
import type { OrganisationUserOption, Workflow } from '@/types/workflow'
import { checkPlanLimits } from '@/lib/billing/limits'
import { buildPlanLimitReachedDetails } from '@/lib/billing/plan-limit-response'
import type {
  Template,
  Document,
  DocumentStep,
  TiptapDocument,
  SignatureCaptureMethod,
} from '@/types/database'
import { tryPersistSignatureForFutureUse } from '@/lib/signatures/persist-for-user'

async function getAuthenticatedUser() {
  const supabase = await createClient()
  const {
    data: { user: authUser },
  } = await supabase.auth.getUser()
  if (!authUser) redirect('/login')

  const { data: profile } = await supabase
    .from('users')
    .select('id, organisation_id, role, department_id, department, job_level, full_name, position, email')
    .eq('id', authUser.id)
    .single()

  if (!profile) redirect('/login')

  return { supabase, profile }
}

/**
 * Loads the full organisation roster for approver eligibility checks.
 * Uses the service-role client — member RLS typically only exposes the
 * current user's row, which would make every other approver invisible.
 */
async function loadOrganisationUsers(
  organisationId: string
): Promise<{ users: OrganisationUserOption[]; error?: string }> {
  const supabase = createAdminClient()

  const [
    { data: orgUsers, error: usersError },
    overseenByUser,
    { data: departments, error: departmentsError },
  ] = await Promise.all([
    supabase
      .from('users')
      .select('id, full_name, position, email, department_id, job_level')
      .eq('organisation_id', organisationId)
      .eq('must_change_password', false)
      .eq('is_active', true),
    loadOverseenDepartmentIdsByUser(supabase, organisationId),
    supabase.from('departments').select('id, name').eq('organisation_id', organisationId),
  ])

  if (usersError) {
    console.error('[loadOrganisationUsers]', usersError.message)
    return { users: [], error: usersError.message }
  }

  if (departmentsError) {
    console.error('[loadOrganisationUsers] departments', departmentsError.message)
  }

  const departmentsById = new Map((departments ?? []).map((d) => [d.id, d.name]))

  const users = (orgUsers ?? []).map((user) => ({
    id: user.id,
    full_name: user.full_name,
    position: (user.position as string | null) ?? null,
    email: user.email,
    department_id: user.department_id,
    department_name: user.department_id ? (departmentsById.get(user.department_id) ?? null) : null,
    job_level: isJobLevel(user.job_level) ? user.job_level : ('staff' as JobLevel),
    overseen_department_ids: overseenByUser.get(user.id) ?? [],
  }))

  return { users }
}

export async function getActiveTemplatesForInitiation() {
  const { supabase, profile } = await getAuthenticatedUser()

  const [{ data, error }, { data: userDept }] = await Promise.all([
    supabase
      .from('templates')
      .select(
        'id, name, description, workflow, is_active, scope, department_id, allowed_departments, departments!templates_department_id_fkey(name), updated_at'
      )
      .eq('organisation_id', profile.organisation_id)
      .eq('is_active', true)
      .order('name'),
    profile.department_id
      ? supabase
          .from('departments')
          .select('name')
          .eq('id', profile.department_id)
          .maybeSingle()
      : Promise.resolve({ data: null }),
  ])

  if (error) {
    return { error: error.message, templates: [] }
  }

  const userDepartmentName =
    userDept?.name ?? profile.department ?? null
  const userDepartmentNameLower = userDepartmentName?.toLowerCase() ?? null

  const templates = (data ?? [])
    .filter((template) => (template.workflow as Workflow | null)?.steps?.length)
    .filter((template) => {
      const allowed = template.allowed_departments as string[] | null
      if (allowed && allowed.length > 0) {
        if (!userDepartmentNameLower) return false
        return allowed.some((name) => name.toLowerCase() === userDepartmentNameLower)
      }

      // Legacy single-department scope
      return (
        template.scope !== 'department' ||
        template.department_id === profile.department_id
      )
    })
    .map((template) => {
      const rawDepartment = template.departments
      const department = Array.isArray(rawDepartment) ? rawDepartment[0] : rawDepartment
      const departmentName =
        department && typeof department === 'object' && 'name' in department
          ? String(department.name)
          : null

      return {
        id: template.id,
        name: template.name,
        description: template.description,
        scope: template.scope,
        departmentName,
        stepCount: (template.workflow as Workflow | null)?.steps?.length ?? 0,
        updated_at: template.updated_at,
      }
    })

  return { templates }
}

export interface InitiationStepInfo {
  workflowStepId: string
  stepNumber: number
  signatureLabel: string | null
  authorityText: string
  policyLabel: string
  eligibleApprovers: OrganisationUserOption[]
}

export interface DocumentInitiationContext {
  template: {
    id: string
    name: string
    scope: 'organisation' | 'department'
    content: TiptapDocument | null
  }
  steps: InitiationStepInfo[]
  /** Hard blockers (e.g. missing department) that prevent assigning approvers. */
  blockingError?: string
  /** Soft warnings when a step has no eligible people — those steps can be left empty and skipped. */
  shortageWarnings?: string[]
}

/**
 * Loads everything the initiation UI needs: the active workflow steps (after
 * applying conditions) and, for each, the pool of people eligible to approve
 * it. Pools follow the admin-set minimum job level and department scope — they
 * do not change with the initiator's seniority. Empty pools are soft warnings;
 * those steps can be left blank and skipped at submit time.
 *
 * `formData` should be the values collected so far in the "fill in details"
 * wizard step — workflow steps can be conditional on field values, so the
 * active step list can change once the initiator has filled the form in.
 * Pass `{}` for an initial/blank check (e.g. before the form has been filled).
 */
export async function getDocumentInitiationContext(
  templateId: string,
  formData: Record<string, unknown> = {}
): Promise<{ error: string } | DocumentInitiationContext> {
  const { supabase, profile } = await getAuthenticatedUser()

  const { data: templateData, error: templateError } = await supabase
    .from('templates')
    .select('*')
    .eq('id', templateId)
    .eq('organisation_id', profile.organisation_id)
    .maybeSingle()

  if (templateError || !templateData) {
    return { error: 'Template not found.' }
  }

  const template = templateData as Template

  if (!template.is_active) {
    return { error: 'This template is not active.' }
  }

  if (!canInitiateTemplate(template, { department_id: profile.department_id })) {
    return { error: 'This template is only available to a specific department you are not part of.' }
  }

  const workflow = normaliseWorkflow(template.workflow ?? { steps: [] })
  if (workflow.steps.length === 0) {
    return { error: 'This template has no approval chain configured.' }
  }

  const signatureFields = listApproverSignatureFieldOptions(template.content)
  const signatureLabelById = new Map(signatureFields.map((f) => [f.fieldId, f.label]))

  const activeSteps = workflow.steps.filter((step) => shouldIncludeWorkflowStep(step, formData))

  const templateInfo = {
    id: template.id,
    name: template.name,
    scope: template.scope,
    content: template.content,
  }

  if (activeSteps.length === 0) {
    return { error: 'This template has no approval steps after applying conditions.' }
  }

  const initiator = {
    id: profile.id,
    department_id: profile.department_id,
    job_level: isJobLevel(profile.job_level) ? profile.job_level : ('staff' as JobLevel),
  }

  const needsInitiatorDepartment = activeSteps.some((step) => step.departmentScope === 'initiator')
  if (needsInitiatorDepartment && !initiator.department_id) {
    return {
      template: templateInfo,
      steps: [],
      blockingError:
        'Your account is not assigned to a department. Ask an admin to set your department on the Team page before you can start this document.',
    }
  }

  const [rosterResult, { data: departments }] = await Promise.all([
    loadOrganisationUsers(profile.organisation_id),
    supabase.from('departments').select('id, name, is_executive').eq('organisation_id', profile.organisation_id),
  ])
  const departmentsById = new Map((departments ?? []).map((d) => [d.id, d]))

  if (rosterResult.error) {
    return {
      template: templateInfo,
      steps: [],
      blockingError:
        'Could not load organisation members to check approver availability. Please try again.',
    }
  }

  const users = rosterResult.users
  const initiatorDepartmentName = initiator.department_id
    ? departmentsById.get(initiator.department_id)?.name
    : null

  const steps: InitiationStepInfo[] = activeSteps.map((step, index) => ({
    workflowStepId: step.id,
    stepNumber: index + 1,
    signatureLabel: signatureLabelById.get(step.signatureFieldId ?? '') ?? null,
    authorityText: step.authorityText?.trim() ?? '',
    policyLabel: formatStepPolicyLabel(
      step,
      departmentsById,
      (level: JobLevel) => JOB_LEVEL_LABELS[level],
      { initiatorDepartmentId: initiator.department_id }
    ),
    eligibleApprovers: getEligibleApprovers(step, initiator, users),
  }))

  // Empty pools are not blocking — the initiator can leave those steps empty
  // and skip them. Surface a soft warning so they know why the list is empty.
  const shortageWarnings = steps
    .map((step, index) =>
      step.eligibleApprovers.length === 0
        ? buildStepApproverShortageMessage({
            stepNumber: step.stepNumber,
            step: activeSteps[index],
            initiator,
            users,
            departmentName:
              activeSteps[index].departmentScope === 'fixed' && activeSteps[index].assigneeDepartmentId
                ? (departmentsById.get(activeSteps[index].assigneeDepartmentId)?.name ?? null)
                : initiatorDepartmentName,
            policyLabel: step.policyLabel,
          })
        : null
    )
    .filter((message): message is string => Boolean(message))

  return {
    template: templateInfo,
    steps,
    shortageWarnings: shortageWarnings.length > 0 ? shortageWarnings : undefined,
  }
}

export async function createDocumentFromTemplate(input: {
  templateId: string
  title: string
  data?: Record<string, unknown>
  assignments: ChainAssignment[]
}) {
  const { supabase, profile } = await getAuthenticatedUser()
  const title = input.title.trim()

  if (!title) {
    return { error: 'Document title is required.' }
  }

  try {
    const limits = await checkPlanLimits(profile.organisation_id)
    if (!limits.documentsOk) {
      const planLimit = await buildPlanLimitReachedDetails({
        organisationId: profile.organisation_id,
        userRole: profile.role,
        type: 'documents',
        limits,
      })
      return {
        error:
          "You've reached your plan's monthly document limit. Upgrade to continue.",
        planLimit,
      }
    }
  } catch (err) {
    console.error('[createDocumentFromTemplate] plan limit check failed', err)
    return { error: 'Could not verify plan limits. Please try again.' }
  }

  const { data: templateData, error: templateError } = await supabase
    .from('templates')
    .select('*')
    .eq('id', input.templateId)
    .eq('organisation_id', profile.organisation_id)
    .maybeSingle()

  if (templateError || !templateData) {
    return { error: 'Template not found.' }
  }

  const template = templateData as Template

  if (!template.is_active) {
    return { error: 'This template is not active.' }
  }

  if (!canInitiateTemplate(template, { department_id: profile.department_id })) {
    return { error: 'You are not eligible to start a document from this template.' }
  }

  const workflow = normaliseWorkflow(template.workflow ?? { steps: [] })
  if (workflow.steps.length === 0) {
    return { error: 'This template has no approval chain configured.' }
  }

  const [rosterResult, { data: departments }] = await Promise.all([
    loadOrganisationUsers(profile.organisation_id),
    supabase.from('departments').select('id, name, is_executive').eq('organisation_id', profile.organisation_id),
  ])

  if (rosterResult.error) {
    return { error: 'Could not load organisation members to validate approvers. Please try again.' }
  }

  const users = rosterResult.users
  const departmentsById = new Map((departments ?? []).map((d) => [d.id, d]))
  const formData = input.data ?? {}

  const { valid, errors, resolvedSteps } = validateApprovalChain({
    workflow,
    initiator: {
      id: profile.id,
      department_id: profile.department_id,
      job_level: isJobLevel(profile.job_level) ? profile.job_level : ('staff' as JobLevel),
    },
    assignments: (input.assignments ?? []).filter((assignment) => Boolean(assignment.userId)),
    users,
    formData,
  })

  if (!valid) {
    return { error: errors.join(' ') }
  }

  const { data: document, error: documentError } = await supabase
    .from('documents')
    .insert({
      organisation_id: profile.organisation_id,
      template_id: template.id,
      title,
      status: 'draft',
      initiated_by: profile.id,
      data: formData,
    })
    .select('id')
    .single()

  if (documentError || !document) {
    return { error: documentError?.message ?? 'Failed to create document.' }
  }

  const stepRows = resolvedSteps.map((step) => {
    const resolvedDepartmentName =
      step.departmentScope === 'fixed' && step.assigneeDepartmentId
        ? (departmentsById.get(step.assigneeDepartmentId)?.name ?? null)
        : null

    return {
      document_id: document.id,
      step_order: step.stepOrder,
      assignee_user_id: step.assigneeUserId,
      status: 'waiting',
      signature_field_id: step.signatureFieldId,
      workflow_step_id: step.workflowStepId,
      notes: stringifyStepNotes({
        authorityText: step.authorityText,
        deadlineHours: step.deadlineHours,
        minJobLevel: step.minJobLevel,
        departmentScope: step.departmentScope,
        resolvedDepartmentName,
      }),
    }
  })

  const { error: stepsError } = await supabase.from('document_steps').insert(stepRows)

  if (stepsError) {
    await supabase.from('documents').delete().eq('id', document.id)
    return { error: stepsError.message }
  }

  revalidatePath('/dashboard/documents')
  revalidatePath('/dashboard')

  return { documentId: document.id }
}

/**
 * Uploads a "file" field attachment collected while filling in a document
 * draft. `draftId` is a client-generated id used purely as a storage folder
 * key — it does not need to match the eventual document row id.
 */
export async function uploadDocumentAttachment(
  formData: FormData
): Promise<{ error: string } | { path: string; filename: string }> {
  const { supabase, profile } = await getAuthenticatedUser()

  const file = formData.get('file')
  const draftId = formData.get('draftId')

  if (!(file instanceof File) || file.size === 0) {
    return { error: 'No file selected.' }
  }
  if (typeof draftId !== 'string' || !draftId) {
    return { error: 'Missing draft reference for this upload.' }
  }
  if (file.size > DOCUMENT_ATTACHMENT_MAX_BYTES) {
    return { error: `File must be ${DOCUMENT_ATTACHMENT_MAX_BYTES / (1024 * 1024)} MB or smaller.` }
  }

  const path = getDocumentAttachmentPath(profile.organisation_id, draftId, file.name)
  const buffer = Buffer.from(await file.arrayBuffer())

  const { error: uploadError } = await supabase.storage
    .from(DOCUMENT_ATTACHMENTS_BUCKET)
    .upload(path, buffer, {
      upsert: true,
      contentType: file.type || 'application/octet-stream',
    })

  if (uploadError) {
    return { error: uploadError.message }
  }

  return { path, filename: file.name }
}

/** Short-lived signed URL for viewing a document attachment (approvers and the initiator only, via RLS). */
export async function getDocumentAttachmentSignedUrl(
  path: string
): Promise<{ error: string } | { url: string }> {
  const { supabase } = await getAuthenticatedUser()

  const { data, error } = await supabase.storage
    .from(DOCUMENT_ATTACHMENTS_BUCKET)
    .createSignedUrl(path, SIGNED_URL_TTL_SECONDS)

  if (error || !data) {
    return { error: error?.message ?? 'Could not generate a link for this file.' }
  }

  return { url: data.signedUrl }
}

async function loadDocumentForInitiator(
  supabase: Awaited<ReturnType<typeof createClient>>,
  documentId: string,
  organisationId: string,
  userId: string
) {
  const { data: documentData } = await supabase
    .from('documents')
    .select('*, templates(content)')
    .eq('id', documentId)
    .eq('organisation_id', organisationId)
    .maybeSingle()

  if (!documentData) {
    return { error: 'Document not found.' as const }
  }

  const document = documentData as Document & {
    templates: { content: Template['content'] } | null
  }

  if (document.initiated_by !== userId) {
    return { error: 'Only the initiator can perform this action.' as const }
  }

  const { data: stepsData } = await supabase
    .from('document_steps')
    .select('*')
    .eq('document_id', documentId)
    .order('step_order')

  const steps = (stepsData ?? []) as DocumentStep[]

  return { document, steps }
}

export async function saveInitiatorSignature(input: {
  documentId: string
  signatureDataUrl: string | null
}) {
  const { supabase, profile } = await getAuthenticatedUser()

  const loaded = await loadDocumentForInitiator(
    supabase,
    input.documentId,
    profile.organisation_id,
    profile.id
  )
  if ('error' in loaded) return { error: loaded.error }

  const { document, steps } = loaded

  if (!canInitiatorEditDocument(document, profile.id)) {
    return { error: 'This document can no longer be edited.' }
  }

  const initiatorField = getInitiatorSignatureField(document.templates?.content ?? null)
  if (!initiatorField) {
    return { error: 'This template has no initiator signature field.' }
  }

  const nextData = { ...(document.data ?? {}) }
  if (input.signatureDataUrl) {
    nextData[initiatorField.fieldId] = input.signatureDataUrl
  } else {
    delete nextData[initiatorField.fieldId]
  }

  const { error } = await supabase
    .from('documents')
    .update({ data: nextData, updated_at: new Date().toISOString() })
    .eq('id', document.id)

  if (error) {
    return { error: error.message }
  }

  revalidatePath(`/dashboard/documents/${document.id}`)
  return { success: true }
}

export async function submitDocumentForApproval(input: {
  documentId: string
  /** When provided, writes the initiator signature onto the document before submit. */
  signatureDataUrl?: string | null
  signatureMethod?: SignatureCaptureMethod
}) {
  const { documentId, signatureDataUrl, signatureMethod } = input

  const { supabase, profile } = await getAuthenticatedUser()

  const loaded = await loadDocumentForInitiator(
    supabase,
    documentId,
    profile.organisation_id,
    profile.id
  )
  if ('error' in loaded) return { error: loaded.error }

  const { document, steps } = loaded

  if (document.status !== 'draft') {
    return { error: 'This document has already been submitted.' }
  }

  // Persist initiator signature onto the document in the same round-trip when provided.
  let documentData = document.data ?? {}
  if (signatureDataUrl !== undefined) {
    const initiatorField = getInitiatorSignatureField(document.templates?.content ?? null)
    if (initiatorField) {
      const nextData = { ...documentData }
      if (signatureDataUrl) {
        nextData[initiatorField.fieldId] = signatureDataUrl
      } else {
        delete nextData[initiatorField.fieldId]
      }
      const { error: sigError } = await supabase
        .from('documents')
        .update({ data: nextData, updated_at: new Date().toISOString() })
        .eq('id', document.id)
      if (sigError) {
        return { error: sigError.message }
      }
      documentData = nextData
    }
  }

  const signatureError = getMissingInitiatorSignatureError(
    document.templates?.content ?? null,
    documentData
  )
  if (signatureError) {
    return { error: signatureError }
  }

  const firstStep = steps.find((step) => step.step_order === 0)
  if (!firstStep) {
    return { error: 'This document has no approval steps.' }
  }

  const { error: documentError } = await supabase
    .from('documents')
    .update({
      status: 'in_progress',
      current_step: firstStep.step_order,
      rejection_reason: null,
      completed_at: null,
      updated_at: new Date().toISOString(),
    })
    .eq('id', document.id)

  if (documentError) {
    return { error: documentError.message }
  }

  const { error: stepError } = await supabase
    .from('document_steps')
    .update({ status: 'pending', updated_at: new Date().toISOString() })
    .eq('id', firstStep.id)

  if (stepError) {
    return { error: stepError.message }
  }

  await notifyApproverForStep({
    document,
    step: { ...firstStep, status: 'pending' },
    initiatorName: formatUserDisplayName(profile.full_name, profile.position),
  }).catch((err) => console.error('[submitDocumentForApproval] notify', err))

  const librarySignature =
    signatureDataUrl ??
    (() => {
      const field = getInitiatorSignatureField(document.templates?.content ?? null)
      if (!field) return null
      const value = documentData[field.fieldId]
      return typeof value === 'string' ? value : null
    })()

  await tryPersistSignatureForFutureUse({
    userId: profile.id,
    imageData: librarySignature,
    method: signatureMethod,
    supabase,
  })

  revalidatePath(`/dashboard/documents/${document.id}`)
  revalidatePath('/dashboard/documents')
  revalidatePath('/dashboard')

  return { success: true }
}

/**
 * Reset a rejected document so the initiator can make changes and submit again.
 * Steps return to `waiting` (cleared signatures); the first approver is notified
 * again when they call `submitDocumentForApproval`.
 */
export async function resubmitDocument(documentId: string) {
  const { supabase, profile } = await getAuthenticatedUser()

  const loaded = await loadDocumentForInitiator(
    supabase,
    documentId,
    profile.organisation_id,
    profile.id
  )
  if ('error' in loaded) return { error: loaded.error }

  const { document, steps } = loaded

  if (document.status !== 'rejected') {
    return { error: 'Only rejected documents can be resubmitted.' }
  }

  if (document.initiated_by !== profile.id) {
    return { error: 'Only the initiator can resubmit this document.' }
  }

  const { error: documentError } = await supabase
    .from('documents')
    .update({
      status: 'draft',
      completed_at: null,
      current_step: 0,
      rejection_reason: null,
      updated_at: new Date().toISOString(),
    })
    .eq('id', document.id)

  if (documentError) {
    return { error: documentError.message }
  }

  for (const step of steps) {
    const notes = parseStepNotes(step.notes)
    const { rejectionReason: _removed, approvalComment: _comment, rejectedAt: _rejectedAt, ...policyNotes } =
      notes

    const { error: stepError } = await supabase
      .from('document_steps')
      .update({
        status: 'waiting',
        signed_at: null,
        signature_url: null,
        last_reminder_sent_at: null,
        notes: stringifyStepNotes(policyNotes),
        updated_at: new Date().toISOString(),
      })
      .eq('id', step.id)

    if (stepError) {
      return { error: stepError.message }
    }
  }

  revalidatePath(`/dashboard/documents/${document.id}`)
  revalidatePath('/dashboard/documents')
  revalidatePath('/dashboard')

  return { success: true }
}

export async function cancelDocument(documentId: string) {
  const { supabase, profile } = await getAuthenticatedUser()

  const loaded = await loadDocumentForInitiator(
    supabase,
    documentId,
    profile.organisation_id,
    profile.id
  )
  if ('error' in loaded) return { error: loaded.error }

  const { document, steps } = loaded

  if (!canInitiatorCancelDocument(document, steps, profile.id)) {
    return { error: 'This document can no longer be cancelled.' }
  }

  const { error: documentError } = await supabase
    .from('documents')
    .update({ status: 'cancelled', updated_at: new Date().toISOString() })
    .eq('id', document.id)

  if (documentError) {
    return { error: documentError.message }
  }

  const remainingStepIds = steps
    .filter((step) => step.status === 'waiting' || step.status === 'pending')
    .map((step) => step.id)

  if (remainingStepIds.length > 0) {
    await supabase
      .from('document_steps')
      .update({ status: 'skipped', updated_at: new Date().toISOString() })
      .in('id', remainingStepIds)
  }

  revalidatePath(`/dashboard/documents/${document.id}`)
  revalidatePath('/dashboard/documents')
  revalidatePath('/dashboard')

  return { success: true }
}

/**
 * Soft-archive documents (admin only). Non-destructive — hides from default
 * list views; PDF download and detail access remain available.
 */
export async function bulkArchiveDocuments(input: {
  documentIds: string[]
}): Promise<{ archived: number; error?: string }> {
  const ids = Array.from(new Set(input.documentIds.filter(Boolean)))
  if (ids.length === 0) {
    return { archived: 0, error: 'No documents selected' }
  }

  const { profile } = await getAuthenticatedUser()
  if (profile.role !== 'admin') {
    return { archived: 0, error: 'Only admins can archive documents' }
  }

  const admin = createAdminClient()
  const now = new Date().toISOString()

  const { data, error } = await admin
    .from('documents')
    .update({ archived: true, updated_at: now })
    .in('id', ids)
    .eq('organisation_id', profile.organisation_id)
    .select('id')

  if (error) {
    return { archived: 0, error: error.message }
  }

  revalidatePath('/dashboard/documents')
  revalidatePath('/dashboard/archive')

  return { archived: data?.length ?? 0 }
}

