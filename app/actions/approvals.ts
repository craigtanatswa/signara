'use server'

import { after } from 'next/server'
import { redirect } from 'next/navigation'
import { revalidatePath } from 'next/cache'
import { z } from 'zod'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { getActiveStep } from '@/lib/approval/active-step'
import { parseStepNotes, stringifyStepNotes } from '@/lib/workflow/step-notes'
import {
  notifyApproverForStep,
  notifyDocumentCompleted,
  notifyDocumentRejected,
} from '@/lib/workflow/notify-routing'
import { generateAndStoreFinalPdf } from '@/lib/pdf/generate-document-pdf'
import { tryPersistSignatureForFutureUse } from '@/lib/signatures/persist-for-user'
import { formatUserDisplayName } from '@/lib/users/display-name'
import type { Document, DocumentStep, SignatureCaptureMethod } from '@/types/database'

type AdminClient = Awaited<ReturnType<typeof createAdminClient>>
type AuthProfile = {
  id: string
  organisation_id: string
  full_name: string
  position: string | null
}

const rejectReasonSchema = z
  .string()
  .trim()
  .min(10, 'Please provide a reason of at least 10 characters.')

// These actions perform their own authorisation checks below (organisation
// match, "you are the assignee of the currently active step", sequential
// status guards) and then write with the admin client — sidestepping any
// RLS configuration uncertainty for a flow (assignee updating someone else's
// row transitively) that didn't exist before this feature.
async function getAuthenticatedUser() {
  const supabase = await createClient()
  const {
    data: { user: authUser },
  } = await supabase.auth.getUser()
  if (!authUser) redirect('/login')

  const admin = await createAdminClient()

  const { data: profile } = await admin
    .from('users')
    .select('id, organisation_id, full_name, position')
    .eq('id', authUser.id)
    .single()

  if (!profile) redirect('/login')

  return { supabase: admin, profile: profile as AuthProfile }
}

async function loadDocumentWithSteps(
  supabase: AdminClient,
  documentId: string,
  organisationId: string
) {
  const { data: document } = await supabase
    .from('documents')
    .select('*')
    .eq('id', documentId)
    .eq('organisation_id', organisationId)
    .maybeSingle()

  if (!document) return { document: null, steps: [] as DocumentStep[] }

  const { data: stepsData } = await supabase
    .from('document_steps')
    .select('*')
    .eq('document_id', documentId)
    .order('step_order')

  return { document: document as Document, steps: (stepsData ?? []) as DocumentStep[] }
}

async function approveDocumentStepInternal(
  supabase: AdminClient,
  profile: AuthProfile,
  input: {
    documentId: string
    stepId: string
    signatureDataUrl?: string | null
    signatureMethod?: SignatureCaptureMethod
    comment?: string | null
  }
): Promise<{ error?: string; documentId?: string }> {
  const { document, steps } = await loadDocumentWithSteps(
    supabase,
    input.documentId,
    profile.organisation_id
  )

  if (!document) {
    return { error: 'Document not found.' }
  }

  if (document.status !== 'in_progress') {
    return { error: 'This document is no longer awaiting approval.' }
  }

  const step = steps.find((s) => s.id === input.stepId)
  if (!step) {
    return { error: 'Approval step not found.' }
  }

  const activeStep = getActiveStep(steps)
  if (!activeStep || activeStep.id !== step.id) {
    return { error: 'This step is not currently awaiting action.' }
  }

  // Always re-verify assignee server-side — never trust the client UI alone.
  if (step.assignee_user_id !== profile.id) {
    return { error: 'You are not assigned to this step.' }
  }

  if (step.signature_field_id && !input.signatureDataUrl) {
    return { error: 'Please provide your signature before approving.' }
  }

  const existingNotes = parseStepNotes(step.notes)
  const notes =
    input.comment?.trim()
      ? stringifyStepNotes({ ...existingNotes, approvalComment: input.comment.trim() })
      : step.notes

  const { error: updateError } = await supabase
    .from('document_steps')
    .update({
      status: 'approved',
      signed_at: new Date().toISOString(),
      signature_url: input.signatureDataUrl ?? null,
      notes,
      updated_at: new Date().toISOString(),
    })
    .eq('id', step.id)

  if (updateError) {
    return { error: updateError.message }
  }

  const nextStep = steps.find((s) => s.step_order === step.step_order + 1)

  if (nextStep) {
    await supabase
      .from('document_steps')
      .update({ status: 'pending', updated_at: new Date().toISOString() })
      .eq('id', nextStep.id)

    // Keep legacy current_step in sync when the column is present.
    await supabase
      .from('documents')
      .update({
        current_step: nextStep.step_order,
        updated_at: new Date().toISOString(),
      })
      .eq('id', document.id)

    const { data: initiator } = await supabase
      .from('users')
      .select('full_name, position')
      .eq('id', document.initiated_by)
      .maybeSingle()

    // Email + in-app notification — failures must not block advancement.
    after(() => {
      void notifyApproverForStep({
        document,
        step: { ...nextStep, status: 'pending' },
        initiatorName: initiator
          ? formatUserDisplayName(initiator.full_name, initiator.position)
          : 'A colleague',
      }).catch((err) => console.error('[approveDocumentStep] notify next', err))
    })
  } else {
    await supabase
      .from('documents')
      .update({
        status: 'completed',
        completed_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      })
      .eq('id', document.id)

    // Persist final PDF + notify after the response — do not block approval UX.
    after(() => {
      void generateAndStoreFinalPdf({
        documentId: document.id,
        organisationId: document.organisation_id,
      }).catch((err) => console.error('[approveDocumentStep] final PDF', err))

      void notifyDocumentCompleted({ document }).catch((err) =>
        console.error('[approveDocumentStep] notify complete', err)
      )
    })
  }

  revalidatePath(`/dashboard/documents/${document.id}`)
  return { documentId: document.id }
}

export async function approveDocumentStep(input: {
  documentId: string
  stepId: string
  signatureDataUrl?: string | null
  signatureMethod?: SignatureCaptureMethod
  comment?: string | null
}) {
  const { supabase, profile } = await getAuthenticatedUser()
  const result = await approveDocumentStepInternal(supabase, profile, input)

  if (result.error) {
    return { error: result.error }
  }

  const signatureDataUrl = input.signatureDataUrl
  const signatureMethod = input.signatureMethod
  const userId = profile.id

  after(() => {
    void tryPersistSignatureForFutureUse({
      userId,
      imageData: signatureDataUrl,
      method: signatureMethod,
      supabase,
    })
  })

  revalidatePath('/dashboard/documents')
  revalidatePath('/dashboard')

  return { success: true }
}

/**
 * Approve many documents the current user is assigned to as the active step.
 * Uses one shared signature for all items that require one.
 */
export async function approveDocumentStepsBatch(input: {
  items: Array<{ documentId: string; stepId: string }>
  signatureDataUrl?: string | null
  signatureMethod?: SignatureCaptureMethod
}): Promise<{
  approved: number
  failed: Array<{ documentId: string; error: string }>
  error?: string
}> {
  if (!input.items.length) {
    return { approved: 0, failed: [], error: 'Select at least one document.' }
  }

  if (input.items.length > 50) {
    return { approved: 0, failed: [], error: 'You can approve at most 50 documents at once.' }
  }

  const { supabase, profile } = await getAuthenticatedUser()
  const failed: Array<{ documentId: string; error: string }> = []
  let approved = 0

  const seen = new Set<string>()
  const uniqueItems = input.items.filter((item) => {
    if (seen.has(item.documentId)) return false
    seen.add(item.documentId)
    return true
  })

  for (const item of uniqueItems) {
    const result = await approveDocumentStepInternal(supabase, profile, {
      documentId: item.documentId,
      stepId: item.stepId,
      signatureDataUrl: input.signatureDataUrl,
      signatureMethod: input.signatureMethod,
    })
    if (result.error) {
      failed.push({ documentId: item.documentId, error: result.error })
    } else {
      approved += 1
    }
  }

  if (approved > 0) {
    const signatureDataUrl = input.signatureDataUrl
    const signatureMethod = input.signatureMethod
    const userId = profile.id
    after(() => {
      void tryPersistSignatureForFutureUse({
        userId,
        imageData: signatureDataUrl,
        method: signatureMethod,
        supabase,
      })
    })
  }

  revalidatePath('/dashboard/documents')
  revalidatePath('/dashboard')

  return { approved, failed }
}

export async function rejectDocumentStep(input: {
  documentId: string
  stepId: string
  reason: string
}) {
  const { supabase, profile } = await getAuthenticatedUser()

  const parsed = rejectReasonSchema.safeParse(input.reason)
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? 'Invalid rejection reason.' }
  }
  const reason = parsed.data

  const { document, steps } = await loadDocumentWithSteps(
    supabase,
    input.documentId,
    profile.organisation_id
  )

  if (!document) {
    return { error: 'Document not found.' }
  }

  if (document.status !== 'in_progress') {
    return { error: 'This document is no longer awaiting approval.' }
  }

  const step = steps.find((s) => s.id === input.stepId)
  if (!step) {
    return { error: 'Approval step not found.' }
  }

  const activeStep = getActiveStep(steps)
  if (!activeStep || activeStep.id !== step.id) {
    return { error: 'This step is not currently awaiting action.' }
  }

  if (step.assignee_user_id !== profile.id) {
    return { error: 'You are not assigned to this step.' }
  }

  const rejectedAt = new Date().toISOString()
  const notes = stringifyStepNotes({
    ...parseStepNotes(step.notes),
    rejectionReason: reason,
    rejectedAt,
  })

  const { error: updateError } = await supabase
    .from('document_steps')
    .update({ status: 'rejected', notes, updated_at: rejectedAt })
    .eq('id', step.id)

  if (updateError) {
    return { error: updateError.message }
  }

  const remainingStepIds = steps
    .filter((s) => s.step_order > step.step_order && (s.status === 'waiting' || s.status === 'pending'))
    .map((s) => s.id)

  if (remainingStepIds.length > 0) {
    await supabase
      .from('document_steps')
      .update({ status: 'skipped', updated_at: new Date().toISOString() })
      .in('id', remainingStepIds)
  }

  await supabase
    .from('documents')
    .update({
      status: 'rejected',
      rejection_reason: reason,
      updated_at: new Date().toISOString(),
    })
    .eq('id', document.id)

  await notifyDocumentRejected({
    document,
    rejectedByName: formatUserDisplayName(profile.full_name, profile.position),
    reason,
  }).catch((err) => console.error('[rejectDocumentStep] notify', err))

  revalidatePath(`/dashboard/documents/${document.id}`)
  revalidatePath('/dashboard/documents')
  revalidatePath('/dashboard')

  return { success: true }
}
