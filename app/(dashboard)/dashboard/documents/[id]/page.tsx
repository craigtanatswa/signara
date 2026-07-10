import { redirect, notFound } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { Header } from '@/components/layout/header'
import { DashboardPageBody } from '@/components/layout/dashboard-page-body'
import { BackLink } from '@/components/layout/back-link'
import { Badge } from '@/components/ui/badge'
import { ApprovalPanel } from '@/components/documents/approval-panel'
import { InitiatorDocumentPanel } from '@/components/documents/initiator-document-panel'
import {
  canInitiatorCancelDocument,
  canInitiatorEditDocument,
  getInitiatorSignatureFromData,
} from '@/lib/approval/document-initiator'
import { getActiveStep } from '@/lib/approval/active-step'
import { getInitiatorSignatureField } from '@/lib/workflow/signature-fields'
import { getFieldDisplayLabel, listTemplateFieldsWithRoles } from '@/lib/tiptap/field-utils'
import { getAttachmentFilename } from '@/lib/storage/document-attachments'
import { getDocumentAttachmentSignedUrl } from '@/app/actions/documents'
import { parseStepNotes } from '@/lib/workflow/step-notes'
import { JOB_LEVEL_LABELS } from '@/types/org-structure'
import type { JobLevel } from '@/types/org-structure'
import type { User, Document, DocumentStep, Template } from '@/types/database'

interface DocumentPageProps {
  params: Promise<{ id: string }>
}

const STATUS_BADGE_CLASS: Record<Document['status'], string> = {
  draft: 'border-signara-steel/30 bg-signara-background text-signara-navy',
  in_progress: 'border-amber-200 bg-amber-50 text-amber-800',
  completed: 'border-green-200 bg-green-50 text-green-700',
  rejected: 'border-red-200 bg-red-50 text-red-700',
  cancelled: 'border-gray-200 bg-gray-50 text-gray-600',
}

const STATUS_LABEL: Record<Document['status'], string> = {
  draft: 'Draft',
  in_progress: 'In progress',
  completed: 'Completed',
  rejected: 'Rejected',
  cancelled: 'Cancelled',
}

const STEP_STATUS_BADGE_CLASS: Record<DocumentStep['status'], string> = {
  approved: 'border-green-200 bg-green-50 text-green-700',
  pending: 'border-amber-200 bg-amber-50 text-amber-800',
  rejected: 'border-red-200 bg-red-50 text-red-700',
  waiting: 'border-signara-steel/30 text-signara-steel',
  skipped: 'border-signara-steel/30 text-signara-steel',
}

const STEP_STATUS_LABEL: Record<DocumentStep['status'], string> = {
  approved: 'Approved',
  pending: 'Awaiting approval',
  rejected: 'Rejected',
  waiting: 'Waiting',
  skipped: 'Skipped',
}

export default async function DocumentDetailPage({ params }: DocumentPageProps) {
  const { id } = await params
  const supabase = await createClient()

  const {
    data: { user: authUser },
  } = await supabase.auth.getUser()
  if (!authUser) redirect('/login')

  const { data: profile } = await supabase
    .from('users')
    .select('*')
    .eq('id', authUser.id)
    .single()
  if (!profile) redirect('/login')

  const user = profile as User

  const { data: documentData } = await supabase
    .from('documents')
    .select('*, templates(name, content)')
    .eq('id', id)
    .eq('organisation_id', profile.organisation_id)
    .maybeSingle()

  if (!documentData) notFound()

  const document = documentData as Document & {
    templates: Pick<Template, 'name' | 'content'> | null
  }

  const { data: stepsData } = await supabase
    .from('document_steps')
    .select('*, users(full_name, email, job_level, departments(name))')
    .eq('document_id', id)
    .order('step_order')

  const steps = (stepsData ?? []) as (DocumentStep & {
    users: {
      full_name: string
      email: string
      job_level: JobLevel
      departments: { name: string } | null
    } | null
  })[]

  const { data: initiator } = await supabase
    .from('users')
    .select('full_name, departments(name)')
    .eq('id', document.initiated_by)
    .maybeSingle()

  const isInitiator = document.initiated_by === user.id
  const activeStep = getActiveStep(steps)
  const isCurrentUserActiveApprover =
    document.status === 'in_progress' && activeStep?.assignee_user_id === user.id

  const initiatorField = getInitiatorSignatureField(document.templates?.content ?? null)
  const initiatorFieldLabel = initiatorField ? getFieldDisplayLabel(initiatorField) : null
  const existingInitiatorSignature = initiatorField
    ? getInitiatorSignatureFromData(document.data, initiatorField.fieldId)
    : null

  const detailFields = listTemplateFieldsWithRoles(document.templates?.content ?? null).filter(
    (field) => field.fieldType !== 'signature'
  )
  const detailFieldEntries = await Promise.all(
    detailFields.map(async (field) => {
      const value = document.data?.[field.fieldId]
      let displayValue: string | null = null
      let fileUrl: string | null = null

      if (value === undefined || value === null || value === '') {
        displayValue = null
      } else if (field.fieldType === 'checkbox') {
        displayValue = value ? 'Yes' : 'No'
      } else if (field.fieldType === 'file' && typeof value === 'string') {
        displayValue = getAttachmentFilename(value)
        const signed = await getDocumentAttachmentSignedUrl(value)
        fileUrl = 'url' in signed ? signed.url : null
      } else if (field.fieldType === 'date' && typeof value === 'string') {
        const parsed = new Date(value)
        displayValue = Number.isNaN(parsed.getTime()) ? value : parsed.toLocaleDateString('en-GB')
      } else {
        displayValue = String(value)
      }

      return { field, displayValue, fileUrl }
    })
  )

  const showDraftPanel = isInitiator && canInitiatorEditDocument(document, user.id)
  const canCancel = isInitiator && canInitiatorCancelDocument(document, steps, user.id)
  const showSubmittedCancelPanel =
    canCancel && document.status === 'in_progress' && !steps.some((step) => step.status === 'approved')
  const showRejectedCancelPanel = canCancel && document.status === 'rejected'

  return (
    <>
      <Header pageTitle={document.title} user={user} />
      <DashboardPageBody>
        <div className="mx-auto max-w-3xl space-y-6">
          <BackLink href="/dashboard/documents" label="Back to documents" />

          <div className="rounded-lg border border-signara-steel/30 bg-white p-6 shadow-sm">
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div>
                <h2 className="text-xl font-bold text-signara-navy">{document.title}</h2>
                <p className="mt-1 text-sm text-signara-steel">
                  Template: {document.templates?.name ?? 'Unknown'}
                </p>
              </div>
              <Badge variant="outline" className={STATUS_BADGE_CLASS[document.status]}>
                {STATUS_LABEL[document.status]}
              </Badge>
            </div>

            <dl className="mt-4 grid gap-3 text-sm sm:grid-cols-2">
              <div>
                <dt className="text-signara-steel">Initiated by</dt>
                <dd className="font-medium text-signara-navy">
                  {initiator?.full_name ?? 'Unknown'}
                </dd>
              </div>
              <div>
                <dt className="text-signara-steel">Created</dt>
                <dd className="font-medium text-signara-navy">
                  {new Date(document.created_at).toLocaleString('en-GB')}
                </dd>
              </div>
            </dl>

            {existingInitiatorSignature && document.status !== 'draft' && (
              <div className="mt-4 rounded-md border border-signara-steel/20 bg-signara-background/60 p-3">
                <p className="text-xs font-medium text-signara-steel">Initiator signature</p>
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={existingInitiatorSignature}
                  alt={initiatorFieldLabel ?? 'Initiator signature'}
                  className="mt-2 max-h-24"
                />
              </div>
            )}
          </div>

          {detailFieldEntries.length > 0 && (
            <div className="rounded-lg border border-signara-steel/30 bg-white shadow-sm">
              <div className="border-b border-signara-steel/20 px-6 py-4">
                <h3 className="font-semibold text-signara-navy">Details</h3>
              </div>
              <dl className="divide-y divide-signara-steel/10">
                {detailFieldEntries.map(({ field, displayValue, fileUrl }) => (
                  <div key={field.fieldId} className="grid gap-1 px-6 py-3 sm:grid-cols-2 sm:gap-4">
                    <dt className="text-sm text-signara-steel">{field.label}</dt>
                    <dd className="text-sm font-medium text-signara-navy">
                      {displayValue === null ? (
                        '—'
                      ) : fileUrl ? (
                        <a
                          href={fileUrl}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="text-signara-gold hover:underline"
                        >
                          {displayValue}
                        </a>
                      ) : (
                        displayValue
                      )}
                    </dd>
                  </div>
                ))}
              </dl>
            </div>
          )}

          {showDraftPanel && (
            <InitiatorDocumentPanel
              documentId={document.id}
              initiatorFieldLabel={initiatorFieldLabel}
              existingSignature={existingInitiatorSignature}
              mode="draft"
            />
          )}

          {showSubmittedCancelPanel && (
            <InitiatorDocumentPanel
              documentId={document.id}
              initiatorFieldLabel={null}
              existingSignature={null}
              mode="submitted"
            />
          )}

          {showRejectedCancelPanel && (
            <InitiatorDocumentPanel
              documentId={document.id}
              initiatorFieldLabel={null}
              existingSignature={null}
              mode="cancel-only"
            />
          )}

          {isCurrentUserActiveApprover && activeStep && (
            <ApprovalPanel
              documentId={document.id}
              stepId={activeStep.id}
              authorityText={parseStepNotes(activeStep.notes).authorityText ?? ''}
              requiresSignature={Boolean(activeStep.signature_field_id)}
            />
          )}

          <div className="rounded-lg border border-signara-steel/30 bg-white shadow-sm">
            <div className="border-b border-signara-steel/20 px-6 py-4">
              <h3 className="font-semibold text-signara-navy">Approval chain</h3>
              <p className="mt-0.5 text-sm text-signara-steel">Runs in order, one step at a time</p>
            </div>
            <ol className="divide-y divide-signara-steel/10">
              {steps.map((step, index) => {
                const meta = parseStepNotes(step.notes)
                const assignee = step.users
                return (
                  <li key={step.id} className="px-6 py-4">
                    <div className="flex items-start justify-between gap-4">
                      <div>
                        <p className="text-sm font-medium text-signara-navy">
                          Step {index + 1}: {assignee?.full_name ?? 'Unassigned'}
                        </p>
                        <p className="text-xs text-signara-steel">{assignee?.email}</p>
                        {(meta.resolvedDepartmentName || meta.minJobLevel) && (
                          <p className="mt-1 text-xs text-signara-steel">
                            {meta.resolvedDepartmentName ?? 'Organisation-wide'}
                            {meta.minJobLevel ? ` · ${JOB_LEVEL_LABELS[meta.minJobLevel]}+` : ''}
                          </p>
                        )}
                        {meta.authorityText && (
                          <p className="mt-2 text-sm text-signara-navy/80">{meta.authorityText}</p>
                        )}
                        {step.status === 'rejected' && meta.rejectionReason && (
                          <p className="mt-2 rounded-md border border-red-200 bg-red-50 px-3 py-2 text-xs text-red-800">
                            Reason: {meta.rejectionReason}
                          </p>
                        )}
                      </div>
                      <Badge variant="outline" className={STEP_STATUS_BADGE_CLASS[step.status]}>
                        {STEP_STATUS_LABEL[step.status]}
                      </Badge>
                    </div>
                  </li>
                )
              })}
            </ol>
          </div>
        </div>
      </DashboardPageBody>
    </>
  )
}
