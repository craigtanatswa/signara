import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { getActiveStep } from '@/lib/approval/active-step'
import { isFinalStep } from '@/lib/workflow/step-helpers'
import { generatePrintReadyDocumentPdf } from '@/lib/pdf/generate-document-pdf'
import type { DocumentStep } from '@/types/database'

export const runtime = 'nodejs'

interface RouteContext {
  params: Promise<{ id: string }>
}

/**
 * Download a print-and-sign PDF for the final assignee only.
 * Prior digital signatures are visible; the final signature box is blank.
 */
export async function GET(_request: Request, context: RouteContext) {
  const { id } = await context.params

  const supabase = await createClient()
  const {
    data: { user: authUser },
  } = await supabase.auth.getUser()

  if (!authUser) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const admin = createAdminClient()
  const { data: profile } = await admin
    .from('users')
    .select('id, organisation_id')
    .eq('id', authUser.id)
    .single()

  if (!profile) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const { data: document } = await admin
    .from('documents')
    .select('id, organisation_id, status')
    .eq('id', id)
    .eq('organisation_id', profile.organisation_id)
    .maybeSingle()

  if (!document) {
    return NextResponse.json({ error: 'Document not found' }, { status: 404 })
  }

  if (document.status !== 'in_progress') {
    return NextResponse.json(
      { error: 'Print-and-sign is only available while the document is awaiting the final signature.' },
      { status: 400 }
    )
  }

  const { data: stepsData } = await admin
    .from('document_steps')
    .select('*')
    .eq('document_id', id)
    .order('step_order')

  const steps = (stepsData ?? []) as DocumentStep[]
  const actionable = steps.filter((s) => s.status !== 'skipped')
  const activeStep = getActiveStep(steps)

  if (!activeStep || activeStep.status !== 'pending') {
    return NextResponse.json(
      { error: 'This document is not currently awaiting a signature.' },
      { status: 400 }
    )
  }

  if (!isFinalStep(activeStep.step_order, actionable.length)) {
    return NextResponse.json(
      { error: 'Print-and-sign is only available for the final signatory.' },
      { status: 403 }
    )
  }

  if (activeStep.assignee_user_id !== profile.id) {
    return NextResponse.json(
      { error: 'Only the final step assignee can download the print-and-sign PDF.' },
      { status: 403 }
    )
  }

  const result = await generatePrintReadyDocumentPdf({
    documentId: id,
    organisationId: profile.organisation_id,
  })

  if ('error' in result) {
    return NextResponse.json({ error: result.error }, { status: 500 })
  }

  const filename = result.filename.replace(/"/g, '')

  return new NextResponse(new Uint8Array(result.buffer), {
    status: 200,
    headers: {
      'Content-Type': 'application/pdf',
      'Content-Disposition': `attachment; filename="${filename}"`,
      'Cache-Control': result.fromCache
        ? 'private, max-age=300'
        : 'private, no-store',
      'Content-Length': String(result.buffer.byteLength),
    },
  })
}
