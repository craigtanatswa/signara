'use server'

import { redirect } from 'next/navigation'
import { revalidatePath } from 'next/cache'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { getActiveStep } from '@/lib/approval/active-step'
import { parseStepNotes, stringifyStepNotes } from '@/lib/workflow/step-notes'
import type { Document, DocumentStep } from '@/types/database'

type AdminClient = Awaited<ReturnType<typeof createAdminClient>>
type AuthProfile = { id: string; organisation_id: string; full_name: string }

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
    .select('id, organisation_id, full_name')
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

  if (step.assignee_user_id !== profile.id) {
    return { error: 'You are not assigned to this step.' }
  }

  if (step.signature_field_id && !input.signatureDataUrl) {
    return { error: 'Please provide your signature before approving.' }
  }

  const { error: updateError } = await supabase
    .from('document_steps')
    .update({
      status: 'approved',
      signed_at: new Date().toISOString(),
      signature_url: input.signatureDataUrl ?? null,
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

    await supabase.from('notifications').insert({
      user_id: nextStep.assignee_user_id,
      document_id: document.id,
      type: 'approval_required',
      title: 'Approval required',
      message: `"${document.title}" needs your approval.`,
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

    await supabase.from('notifications').insert({
      user_id: document.initiated_by,
      document_id: document.id,
      type: 'document_completed',
      title: 'Document fully approved',
      message: `"${document.title}" has been fully approved by everyone in the chain.`,
    })
  }

  revalidatePath(`/dashboard/documents/${document.id}`)
  return { documentId: document.id }
}

export async function approveDocumentStep(input: {
  documentId: string
  stepId: string
  signatureDataUrl?: string | null
}) {
  const { supabase, profile } = await getAuthenticatedUser()
  const result = await approveDocumentStepInternal(supabase, profile, input)

  if (result.error) {
    return { error: result.error }
  }

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
    })
    if (result.error) {
      failed.push({ documentId: item.documentId, error: result.error })
    } else {
      approved += 1
    }
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
  const reason = input.reason.trim()

  if (!reason) {
    return { error: 'Please provide a reason for rejecting this document.' }
  }

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

  const notes = stringifyStepNotes({ ...parseStepNotes(step.notes), rejectionReason: reason })

  const { error: updateError } = await supabase
    .from('document_steps')
    .update({ status: 'rejected', notes, updated_at: new Date().toISOString() })
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
    .update({ status: 'rejected', updated_at: new Date().toISOString() })
    .eq('id', document.id)

  await supabase.from('notifications').insert({
    user_id: document.initiated_by,
    document_id: document.id,
    type: 'document_rejected',
    title: 'Document rejected',
    message: `${profile.full_name} rejected "${document.title}": ${reason}`,
  })

  revalidatePath(`/dashboard/documents/${document.id}`)
  revalidatePath('/dashboard/documents')
  revalidatePath('/dashboard')

  return { success: true }
}
