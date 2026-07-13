import { redirect, notFound } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { Header } from '@/components/layout/header'
import { DashboardPageBody } from '@/components/layout/dashboard-page-body'
import { BackLink } from '@/components/layout/back-link'
import { Badge } from '@/components/ui/badge'
import { ApprovalPanel } from '@/components/documents/approval-panel'
import { ApprovalProgress, type ApprovalProgressStep } from '@/components/documents/approval-progress'
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
import { getOrganisationBrandingForOrg } from '@/app/actions/organisation-branding'
import { parseStepNotes } from '@/lib/workflow/step-notes'
import { buildDocumentPreviewContext } from '@/lib/documents/build-preview-context'
import { loadDocumentForViewer } from '@/lib/documents/load-for-viewer'
import { DocumentInstancePreview } from '@/components/documents/document-instance-preview'
// import { DocumentPdfButton } from '@/components/documents/document-pdf-button'
import { isFinalStep } from '@/lib/workflow/step-helpers'
import { isJobLevel, type JobLevel } from '@/types/org-structure'
import { formatUserDisplayName } from '@/lib/users/display-name'
import type { User, Document } from '@/types/database'

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

  const loaded = await loadDocumentForViewer({
    documentId: id,
    userId: user.id,
    organisationId: profile.organisation_id,
    role: user.role,
  })
  if (!loaded) notFound()

  const { document, steps: rawSteps } = loaded

  // Enrich steps with assignee profiles (service-role — member RLS hides other users).
  const admin = createAdminClient()
  const assigneeIds = Array.from(
    new Set(rawSteps.map((step) => step.assignee_user_id).filter(Boolean))
  )

  const { data: assigneeRows } =
    assigneeIds.length > 0
      ? await admin
          .from('users')
          // Disambiguate: users also link to departments via user_overseen_departments.
          .select(
            'id, full_name, position, email, job_level, departments!users_department_id_fkey(name)'
          )
          .in('id', assigneeIds)
      : { data: [] as Array<{
          id: string
          full_name: string
          position: string | null
          email: string
          job_level: string
          departments: { name: string } | { name: string }[] | null
        }> }

  const assigneeById = new Map(
    (assigneeRows ?? []).map((row) => {
      const dept = Array.isArray(row.departments) ? row.departments[0] : row.departments
      return [
        row.id,
        {
          full_name: row.full_name,
          position: row.position ?? null,
          email: row.email,
          job_level: (isJobLevel(row.job_level) ? row.job_level : 'staff') as JobLevel,
          departments: dept ? { name: dept.name } : null,
        },
      ] as const
    })
  )

  const steps: ApprovalProgressStep[] = rawSteps.map((step) => ({
    ...step,
    users: assigneeById.get(step.assignee_user_id) ?? null,
  }))

  const { data: initiator } = await admin
    .from('users')
    .select('full_name, position, departments!users_department_id_fkey(name)')
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
  const rejectedStep = steps.find((step) => step.status === 'rejected')
  const rejectionReason =
    document.rejection_reason ??
    (rejectedStep ? parseStepNotes(rejectedStep.notes).rejectionReason : null) ??
    null
  const showRejectedPanel = isInitiator && document.status === 'rejected'

  const [organisationBranding, previewContext] = await Promise.all([
    getOrganisationBrandingForOrg(profile.organisation_id),
    buildDocumentPreviewContext({
      templateContent: document.templates?.content ?? null,
      documentData: document.data,
      steps,
    }),
  ])

  // Prefer the uploaded physical scan — same file as Archive "Approved document".
  let physicalSignaturePath: string | null = document.physical_signature_url ?? null
  if (!physicalSignaturePath && document.status === 'completed') {
    const physicalStep = [...rawSteps]
      .sort((a, b) => b.step_order - a.step_order)
      .find((step) => {
        if (step.status !== 'approved') return false
        const notes = parseStepNotes(step.notes)
        const url = step.signature_url
        if (!notes.physicalSignature || !url) return false
        if (url.startsWith('data:image/') || url === 'physical') return false
        return true
      })
    physicalSignaturePath = physicalStep?.signature_url ?? null
  }

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
              <div className="flex flex-wrap items-center gap-2">
                <DocumentInstancePreview
                  documentId={document.id}
                  documentTitle={document.title}
                  templateName={document.templates?.name ?? 'Document'}
                  templateContent={document.templates?.content ?? null}
                  organisationBranding={organisationBranding}
                  preview={previewContext}
                  physicalSignaturePath={physicalSignaturePath}
                />
                {/* Preview / Download PDF temporarily disabled — use Preview document instead
                {(document.status === 'completed' ||
                  document.status === 'in_progress' ||
                  document.status === 'rejected') && (
                  <DocumentPdfButton
                    documentId={document.id}
                    mode={document.status === 'completed' ? 'download' : 'preview'}
                  />
                )}
                */}
                <Badge variant="outline" className={STATUS_BADGE_CLASS[document.status]}>
                  {STATUS_LABEL[document.status]}
                </Badge>
                {document.archived && (
                  <Badge
                    variant="outline"
                    className="border-signara-steel/40 bg-signara-steel/10 text-signara-steel"
                  >
                    Archived
                  </Badge>
                )}
              </div>
            </div>

            <dl className="mt-4 grid gap-3 text-sm sm:grid-cols-2">
              <div>
                <dt className="text-signara-steel">Initiated by</dt>
                <dd className="font-medium text-signara-navy">
                  {initiator
                    ? formatUserDisplayName(initiator.full_name, initiator.position)
                    : 'Unknown'}
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

          {showRejectedPanel && (
            <InitiatorDocumentPanel
              documentId={document.id}
              initiatorFieldLabel={null}
              existingSignature={null}
              mode="rejected"
              rejectionReason={rejectionReason}
            />
          )}

          {isCurrentUserActiveApprover && activeStep && (
            <ApprovalPanel
              documentId={document.id}
              stepId={activeStep.id}
              authorityText={parseStepNotes(activeStep.notes).authorityText ?? ''}
              requiresSignature={Boolean(activeStep.signature_field_id)}
              isFinalStep={isFinalStep(
                activeStep.step_order,
                steps.filter((s) => s.status !== 'skipped').length
              )}
            />
          )}

          <ApprovalProgress steps={steps} isInitiator={isInitiator} />
        </div>
      </DashboardPageBody>
    </>
  )
}
