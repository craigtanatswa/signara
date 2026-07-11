import { NextResponse } from 'next/server'
import {
  assertDocumentPdfAccess,
  generateDocumentPdf,
} from '@/lib/pdf/generate-document-pdf'

export const runtime = 'nodejs'

interface RouteContext {
  params: Promise<{ id: string }>
}

export async function GET(request: Request, context: RouteContext) {
  const { id } = await context.params
  const url = new URL(request.url)
  const wantDownload = url.searchParams.get('download') === '1'
  // Preview-modal downloads should match the on-screen document (no audit page).
  const previewOnly = wantDownload

  const access = await assertDocumentPdfAccess(id)
  if ('error' in access) {
    return NextResponse.json({ error: access.error }, { status: access.status })
  }

  const result = await generateDocumentPdf({
    documentId: id,
    organisationId: access.organisationId,
    forceRegenerate: previewOnly,
    includeAuditTrail: previewOnly ? false : undefined,
  })

  if ('error' in result) {
    return NextResponse.json({ error: result.error }, { status: 500 })
  }

  const filename = result.filename.replace(/"/g, '')
  const disposition = wantDownload ? 'attachment' : 'inline'

  return new NextResponse(new Uint8Array(result.buffer), {
    status: 200,
    headers: {
      'Content-Type': 'application/pdf',
      'Content-Disposition': `${disposition}; filename="${filename}"`,
      'Cache-Control': result.fromCache
        ? 'private, max-age=3600'
        : 'private, no-store',
      'Content-Length': String(result.buffer.byteLength),
    },
  })
}
