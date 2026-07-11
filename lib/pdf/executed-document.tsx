import { Document, Image, Page, View, StyleSheet } from '@react-pdf/renderer'
import type { OrganisationBranding, Template, TiptapDocument } from '@/types/database'
import {
  DEFAULT_TEMPLATE_TEXT_COLOR,
  getTemplatePageOrientation,
  getTemplateTextColor,
  getTemplateUsesOrganisationLetterhead,
  getTemplateUsesOrganisationLogo,
} from '@/lib/tiptap/field-utils'
import { getPageLayout, resolveLetterheadUrl, type PageLayout } from '@/lib/tiptap/page-size'
import {
  AuditTrailPage,
  type AuditTrailStepRow,
} from '@/lib/pdf/components/audit-trail'
import { renderTiptapToPdf } from '@/lib/pdf/render-content'

function createPageStyles(textColor: string, hasLogo: boolean, layout: PageLayout) {
  const logoBlockPt = Math.round(layout.logoBlockHeightPx * 0.75)
  const logoMaxWidthPt = Math.round(layout.logoMaxWidthPx * 0.75)

  return StyleSheet.create({
    page: {
      fontFamily: 'Helvetica',
      fontSize: 11,
      paddingTop: hasLogo ? logoBlockPt : 48,
      paddingBottom: 48,
      paddingHorizontal: 56,
      color: textColor,
      lineHeight: 1.6,
      position: 'relative',
    },
    letterheadBackground: {
      position: 'absolute',
      top: 0,
      left: 0,
      width: layout.widthPt,
      height: layout.heightPt,
      objectFit: 'contain',
      objectPosition: 'top',
    },
    logoBand: {
      position: 'absolute',
      top: 12,
      left: 56,
      right: 56,
      height: 60,
      alignItems: 'center',
      justifyContent: 'center',
    },
    logoImage: {
      width: logoMaxWidthPt,
      height: 60,
      objectFit: 'contain',
    },
    documentBody: {
      width: '100%',
    },
    contentLayer: {
      position: 'relative',
    },
  })
}

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
  /** Pre-resolved embeddable branding (data URLs). */
  organisationBranding: OrganisationBranding | null
  organisationName: string
  fieldValues: Record<string, unknown>
  signaturesByFieldId: Record<string, string | null>
  auditSteps: AuditTrailStepRow[]
  initiatedByName: string
  rejectedAt: string | null
  /** Include the audit trail page (default true for completed records). */
  includeAuditTrail?: boolean
}

/**
 * Executed document PDF — page layout, logo band, letterhead, and typography match
 * the on-screen DocumentContentView / template PDF preview.
 */
export function ExecutedDocument({
  document,
  template,
  organisationBranding,
  organisationName,
  fieldValues,
  signaturesByFieldId,
  auditSteps,
  initiatedByName,
  rejectedAt,
  includeAuditTrail = true,
}: ExecutedDocumentProps) {
  const content = (template.content ?? {
    type: 'doc',
    content: [],
  }) as TiptapDocument

  const textColor = getTemplateTextColor(content) ?? DEFAULT_TEMPLATE_TEXT_COLOR
  const pageOrientation = getTemplatePageOrientation(content)
  const layout = getPageLayout(pageOrientation)
  const logoSrc = getTemplateUsesOrganisationLogo(content)
    ? organisationBranding?.logoUrl ?? null
    : null
  const letterheadSrc = getTemplateUsesOrganisationLetterhead(content)
    ? resolveLetterheadUrl(organisationBranding, pageOrientation)
    : null
  const styles = createPageStyles(textColor, Boolean(logoSrc), layout)
  const documentTitle = document.title || template.name

  // Prefer logo for audit header; fall back to nothing (org name text in PdfHeader)
  const auditLogoSrc = organisationBranding?.logoUrl ?? null

  return (
    <Document title={documentTitle} author={organisationName} creator="Signara">
      <Page size="A4" orientation={pageOrientation} style={styles.page} wrap>
        {letterheadSrc ? (
          // eslint-disable-next-line jsx-a11y/alt-text -- decorative background layer in PDF output
          <Image fixed src={letterheadSrc} style={styles.letterheadBackground} />
        ) : null}

        {logoSrc ? (
          <View fixed style={styles.logoBand}>
            {/* eslint-disable-next-line jsx-a11y/alt-text -- organisation logo in PDF output */}
            <Image src={logoSrc} style={styles.logoImage} />
          </View>
        ) : null}

        <View style={styles.contentLayer}>
          <View style={styles.documentBody}>
            {renderTiptapToPdf(
              content,
              fieldValues,
              signaturesByFieldId,
              textColor,
              layout
            )}
          </View>
        </View>
      </Page>

      {includeAuditTrail ? (
        <AuditTrailPage
          organisationName={organisationName}
          logoSrc={auditLogoSrc}
          documentTitle={documentTitle}
          documentId={document.id}
          initiatedByName={initiatedByName}
          initiatedAt={document.created_at}
          completedAt={document.completed_at}
          rejectedAt={rejectedAt}
          documentStatus={document.status}
          steps={auditSteps}
        />
      ) : null}
    </Document>
  )
}
