import { Document, Image, Page, Text, View, StyleSheet } from '@react-pdf/renderer'
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
  renderTiptapToPdf,
  type PrintReadyEmptySignature,
} from '@/lib/pdf/render-content'
// import { QrCodeImage } from '@/lib/pdf/components/qr-code'

function createPageStyles(textColor: string, hasLogo: boolean, layout: PageLayout) {
  const logoBlockPt = Math.round(layout.logoBlockHeightPx * 0.75)
  const logoMaxWidthPt = Math.round(layout.logoMaxWidthPx * 0.75)

  return StyleSheet.create({
    page: {
      fontFamily: 'Helvetica',
      fontSize: 11,
      paddingTop: hasLogo ? logoBlockPt : 48,
      paddingBottom: 64,
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
    qrCorner: {
      position: 'absolute',
      top: 16,
      right: 40,
      width: 72,
      alignItems: 'center',
    },
    qrCaption: {
      fontSize: 6,
      color: '#A1A8A2',
      marginTop: 2,
      textAlign: 'center',
    },
    footer: {
      position: 'absolute',
      bottom: 24,
      left: 56,
      right: 56,
      borderTopWidth: 0.5,
      borderTopColor: '#A1A8A2',
      paddingTop: 6,
    },
    footerText: {
      fontSize: 7,
      color: '#A1A8A2',
      textAlign: 'center',
    },
  })
}

export interface PrintReadyDocumentProps {
  document: {
    id: string
    title: string
    status: string
    data: Record<string, unknown> | null
    created_at: string
    completed_at: string | null
  }
  template: Pick<Template, 'name' | 'content'>
  organisationBranding: OrganisationBranding | null
  organisationName: string
  fieldValues: Record<string, unknown>
  /** Prior (non-final) signatures already captured digitally. */
  signaturesByFieldId: Record<string, string | null>
  /** Final step signature field → empty wet-sign box metadata. */
  printReadyEmptySignatures: Record<string, PrintReadyEmptySignature>
  /** Pre-generated QR code data URL encoding the verification URL. */
  qrCodeSrc?: string
}

/**
 * Print-and-sign PDF — prior digital signatures visible, final step left blank
 * for a wet signature, with a verification QR code on page 1.
 */
export function PrintReadyDocument({
  document,
  template,
  organisationBranding,
  organisationName,
  fieldValues,
  signaturesByFieldId,
  printReadyEmptySignatures,
  // qrCodeSrc,
}: PrintReadyDocumentProps) {
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

  return (
    <Document title={`${documentTitle} — Print and sign`} author={organisationName} creator="Signara">
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

        {/* QR code temporarily disabled
        <View style={styles.qrCorner} wrap={false}>
          <QrCodeImage src={qrCodeSrc} size={64} />
          <Text style={styles.qrCaption}>Verify</Text>
        </View>
        */}

        <View style={styles.contentLayer}>
          <View style={styles.documentBody}>
            {renderTiptapToPdf(
              content,
              fieldValues,
              signaturesByFieldId,
              textColor,
              layout,
              printReadyEmptySignatures
            )}
          </View>
        </View>

        <View fixed style={styles.footer}>
          <Text style={styles.footerText}>
            This document was partially digitally signed via Signara.
          </Text>
        </View>
      </Page>
    </Document>
  )
}
