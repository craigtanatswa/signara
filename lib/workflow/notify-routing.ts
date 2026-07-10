import { buildApprovalNeededEmail } from '@/lib/email/templates/approval-needed'
import { buildCompletionEmail } from '@/lib/email/templates/document-completed'
import { buildRejectionEmail } from '@/lib/email/templates/document-rejected'
import { getDocumentUrl, sendTransactionalEmail } from '@/lib/email/send'
import { createNotification } from '@/lib/notifications/create'
import { resolveApprover } from '@/lib/workflow/resolve-approver'
import { createAdminClient } from '@/lib/supabase/admin'
import { parseStepNotes } from '@/lib/workflow/step-notes'
import type { Document, DocumentStep } from '@/types/database'

async function loadOrgName(organisationId: string): Promise<string> {
  const supabase = createAdminClient()
  const { data } = await supabase
    .from('organisations')
    .select('name')
    .eq('id', organisationId)
    .maybeSingle()
  return data?.name ?? 'your organisation'
}

async function loadUser(userId: string): Promise<{ full_name: string; email: string } | null> {
  const supabase = createAdminClient()
  const { data } = await supabase
    .from('users')
    .select('full_name, email')
    .eq('id', userId)
    .maybeSingle()
  return data
}

/** Notify the assignee of a pending step (in-app + email). */
export async function notifyApproverForStep(input: {
  document: Pick<Document, 'id' | 'title' | 'organisation_id' | 'initiated_by'>
  step: DocumentStep
  initiatorName: string
  isReminder?: boolean
}): Promise<void> {
  const approver = await resolveApprover(input.step, input.document.organisation_id)
  if (!approver) return

  const orgName = await loadOrgName(input.document.organisation_id)
  const authorityText = parseStepNotes(input.step.notes).authorityText ?? ''
  const documentUrl = getDocumentUrl(input.document.id)

  await createNotification({
    userId: approver.userId,
    documentId: input.document.id,
    type: 'approval_required',
    title: input.isReminder ? 'Reminder: approval required' : 'Approval required',
    message: input.isReminder
      ? `"${input.document.title}" is still waiting for your approval.`
      : `${input.initiatorName} submitted "${input.document.title}" and it needs your approval.`,
  })

  const email = buildApprovalNeededEmail({
    approverName: approver.name,
    documentTitle: input.document.title,
    initiatorName: input.initiatorName,
    orgName,
    documentUrl,
    authorityText,
    isReminder: input.isReminder,
  })

  await sendTransactionalEmail({
    to: approver.email,
    subject: email.subject,
    html: email.html,
  })
}

export async function notifyDocumentCompleted(input: {
  document: Pick<Document, 'id' | 'title' | 'initiated_by'>
}): Promise<void> {
  const initiator = await loadUser(input.document.initiated_by)
  if (!initiator) return

  await createNotification({
    userId: input.document.initiated_by,
    documentId: input.document.id,
    type: 'document_completed',
    title: 'Document fully approved',
    message: `"${input.document.title}" has been fully approved by everyone in the chain.`,
  })

  const email = buildCompletionEmail({
    recipientName: initiator.full_name,
    documentTitle: input.document.title,
    documentUrl: getDocumentUrl(input.document.id),
  })

  await sendTransactionalEmail({
    to: initiator.email,
    subject: email.subject,
    html: email.html,
  })
}

export async function notifyDocumentRejected(input: {
  document: Pick<Document, 'id' | 'title' | 'initiated_by'>
  rejectedByName: string
  reason: string
}): Promise<void> {
  const initiator = await loadUser(input.document.initiated_by)
  if (!initiator) return

  await createNotification({
    userId: input.document.initiated_by,
    documentId: input.document.id,
    type: 'document_rejected',
    title: 'Document rejected',
    message: `${input.rejectedByName} rejected "${input.document.title}": ${input.reason}`,
  })

  const email = buildRejectionEmail({
    initiatorName: initiator.full_name,
    documentTitle: input.document.title,
    rejectedByName: input.rejectedByName,
    reason: input.reason,
    documentUrl: getDocumentUrl(input.document.id),
  })

  await sendTransactionalEmail({
    to: initiator.email,
    subject: email.subject,
    html: email.html,
  })
}
