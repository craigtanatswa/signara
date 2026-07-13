'use server'

import { after } from 'next/server'
import { redirect } from 'next/navigation'
import { revalidatePath } from 'next/cache'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { getActiveStep } from '@/lib/approval/active-step'
import { isFinalStep } from '@/lib/workflow/step-helpers'
import { parseStepNotes, stringifyStepNotes } from '@/lib/workflow/step-notes'
import { notifyDocumentCompleted } from '@/lib/workflow/notify-routing'
import { generateAndStoreFinalPdf } from '@/lib/pdf/generate-document-pdf'
import { DOCUMENT_ATTACHMENTS_BUCKET } from '@/lib/storage/document-attachments'
import type { Document, DocumentStep } from '@/types/database'

const PHYSICAL_SIGNATURE_MAX_BYTES = 10 * 1024 * 1024

function extensionForMime(mime: string, filename: string): string {
  const fromName = filename.split('.').pop()?.toLowerCase()
  if (fromName && /^[a-z0-9]{1,8}$/.test(fromName)) return fromName
  if (mime === 'application/pdf') return 'pdf'
  if (mime === 'image/png') return 'png'
  if (mime === 'image/webp') return 'webp'
  if (mime === 'image/gif') return 'gif'
  return 'jpg'
}

/**
 * Complete the final approval step by uploading a physically signed scan.
 * Adapts the product-brief `signature_data` shape onto `signature_url` + notes.
 */
export async function completeWithPhysicalSignature(formData: FormData): Promise<{
  success?: true
  error?: string
}> {
  const supabase = await createClient()
  const {
    data: { user: authUser },
  } = await supabase.auth.getUser()
  if (!authUser) redirect('/login')

  const admin = createAdminClient()
  const { data: profile } = await admin
    .from('users')
    .select('id, organisation_id, full_name')
    .eq('id', authUser.id)
    .single()

  if (!profile) redirect('/login')

  const documentId = formData.get('documentId')
  const stepId = formData.get('stepId')
  const file = formData.get('uploadedFile')

  if (typeof documentId !== 'string' || !documentId) {
    return { error: 'Missing document reference.' }
  }
  if (typeof stepId !== 'string' || !stepId) {
    return { error: 'Missing step reference.' }
  }
  if (!(file instanceof File) || file.size === 0) {
    return { error: 'Please upload a photo or scan of the signed document.' }
  }

  if (file.size > PHYSICAL_SIGNATURE_MAX_BYTES) {
    return { error: 'File must be 10 MB or smaller.' }
  }

  const mime = (file.type || '').toLowerCase()
  const isImage = mime.startsWith('image/')
  const isPdf = mime === 'application/pdf'
  if (!isImage && !isPdf) {
    return { error: 'Upload an image (PNG, JPEG, WebP, GIF) or a PDF only.' }
  }

  const { data: documentData } = await admin
    .from('documents')
    .select('*')
    .eq('id', documentId)
    .eq('organisation_id', profile.organisation_id)
    .maybeSingle()

  if (!documentData) {
    return { error: 'Document not found.' }
  }

  const document = documentData as Document

  if (document.status !== 'in_progress') {
    return { error: 'This document is no longer awaiting approval.' }
  }

  const { data: stepsData } = await admin
    .from('document_steps')
    .select('*')
    .eq('document_id', document.id)
    .order('step_order')

  const steps = (stepsData ?? []) as DocumentStep[]
  const step = steps.find((s) => s.id === stepId)
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

  const actionable = steps.filter((s) => s.status !== 'skipped')
  if (!isFinalStep(step.step_order, actionable.length)) {
    return { error: 'Physical signature upload is only available on the final step.' }
  }

  const ext = extensionForMime(mime || 'application/octet-stream', file.name)
  const storagePath = `${profile.organisation_id}/${document.id}/physical-signature-final.${ext}`
  const buffer = Buffer.from(await file.arrayBuffer())

  const { error: uploadError } = await admin.storage
    .from(DOCUMENT_ATTACHMENTS_BUCKET)
    .upload(storagePath, buffer, {
      upsert: true,
      contentType: mime || 'application/octet-stream',
      cacheControl: '31536000',
    })

  if (uploadError) {
    return { error: uploadError.message || 'Failed to upload signed copy.' }
  }

  const now = new Date().toISOString()
  const existingNotes = parseStepNotes(step.notes)
  const notes = stringifyStepNotes({
    ...existingNotes,
    physicalSignature: true,
  })

  // Store the scan path in signature_url (schema uses signature_url, not signature_data).
  // Image scans embed in the final PDF; PDF scans show as "Physically signed".
  const { error: stepError } = await admin
    .from('document_steps')
    .update({
      status: 'approved',
      signed_at: now,
      signature_url: storagePath,
      notes,
      updated_at: now,
    })
    .eq('id', step.id)

  if (stepError) {
    return { error: stepError.message }
  }

  const { error: docError } = await admin
    .from('documents')
    .update({
      status: 'completed',
      completed_at: now,
      physical_signature_url: storagePath,
      updated_at: now,
    })
    .eq('id', document.id)

  if (docError) {
    return { error: docError.message }
  }

  // Heavy work after the client gets success — keeps the upload→approve path snappy.
  after(() => {
    void generateAndStoreFinalPdf({
      documentId: document.id,
      organisationId: document.organisation_id,
    }).catch((err) => console.error('[completeWithPhysicalSignature] final PDF', err))

    void notifyDocumentCompleted({ document }).catch((err) =>
      console.error('[completeWithPhysicalSignature] notify complete', err)
    )
  })

  revalidatePath(`/dashboard/documents/${document.id}`)
  revalidatePath('/dashboard/documents')
  revalidatePath('/dashboard')

  return { success: true }
}
