import { Document, Page, View, StyleSheet } from '@react-pdf/renderer'
import type { Organisation, Template, TiptapDocument } from '@/types/database'
import { getTemplateTextColor, DEFAULT_TEMPLATE_TEXT_COLOR } from '@/lib/tiptap/field-utils'
import { PdfHeader } from '@/lib/pdf/components/pdf-header'
import { SignatureBlock, type SignatureBlockEntry } from '@/lib/pdf/components/signature-block'
import {
  AuditTrailPage,
  type AuditTrailStepRow,
} from '@/lib/pdf/components/audit-trail'
import { renderTiptapToPdf } from '@/lib/pdf/render-content'

const styles = StyleSheet.create({
  page: {
    fontFamily: 'Helvetica',
    fontSize: 10,
    paddingTop: 40,
    paddingBottom: 48,
    paddingHorizontal: 40,
    color: '#0F2C59',
    lineHeight: 1.5,
  },
  body: {
    width: '100%',
  },
})

export interface ExecutedDocumentProps {
  document: {
    id: string
    title: string
    status: string
    data: Record<string, unknown> | null
    created_at: string
    completed_at: string | null
  }
  template: Pick<Template, 'name' | 'content'>
  organisation: Pick<Organisation, 'name' | 'logo_url'> & {
    /** Pre-resolved embeddable logo data URL (or null). */
    logoSrc: string | null
  }
  fieldValues: Record<string, unknown>
  signaturesByFieldId: Record<string, string | null>
  signatureEntries: SignatureBlockEntry[]
  auditSteps: AuditTrailStepRow[]
  initiatedByName: string
  rejectedAt: string | null
}

export function ExecutedDocument({
  document,
  template,
  organisation,
  fieldValues,
  signaturesByFieldId,
  signatureEntries,
  auditSteps,
  initiatedByName,
  rejectedAt,
}: ExecutedDocumentProps) {
  const content = (template.content ?? {
    type: 'doc',
    content: [],
  }) as TiptapDocument
  const textColor = getTemplateTextColor(content) ?? DEFAULT_TEMPLATE_TEXT_COLOR
  const documentTitle = document.title || template.name

  return (
    <Document title={documentTitle} author={organisation.name} creator="Signara">
      <Page size="A4" style={styles.page} wrap>
        <PdfHeader
          organisationName={organisation.name}
          logoSrc={organisation.logoSrc}
          documentTitle={documentTitle}
          documentId={document.id}
        />

        <View style={styles.body}>
          {renderTiptapToPdf(content, fieldValues, signaturesByFieldId, textColor)}
          <SignatureBlock entries={signatureEntries} />
        </View>
      </Page>

      <AuditTrailPage
        organisationName={organisation.name}
        logoSrc={organisation.logoSrc}
        documentTitle={documentTitle}
        documentId={document.id}
        initiatedByName={initiatedByName}
        initiatedAt={document.created_at}
        completedAt={document.completed_at}
        rejectedAt={rejectedAt}
        documentStatus={document.status}
        steps={auditSteps}
      />
    </Document>
  )
}
