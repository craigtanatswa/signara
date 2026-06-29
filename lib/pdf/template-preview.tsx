'use client'

import { useEffect, useState, type ReactNode } from 'react'
import {
  Document,
  Image,
  Page,
  Text,
  View,
  StyleSheet,
  PDFViewer,
} from '@react-pdf/renderer'
import type { OrganisationBranding, TiptapDocument, TiptapMark, TiptapNode } from '@/types/database'
import {
  DEFAULT_TEMPLATE_TEXT_COLOR,
  FIELD_TYPE_LABELS,
  getFieldDisplayLabel,
  getTemplateTextColor,
  getTemplateUsesOrganisationLogo,
  getTemplateUsesOrganisationLetterhead,
  normalizeFormFieldAttrs,
} from '@/lib/tiptap/field-utils'
import { normalizeFontSize } from '@/lib/tiptap/font-size'
import { resolveOrganisationBrandingForPdf } from '@/lib/pdf/resolve-pdf-image'
import { ORG_LOGO_BLOCK_HEIGHT_PX } from '@/lib/tiptap/a4-layout'

const ORG_LOGO_BLOCK_PT = Math.round(ORG_LOGO_BLOCK_HEIGHT_PX * 0.75)
const A4_WIDTH_PT = 595.28
const A4_HEIGHT_PT = 841.89

function createStyles(textColor: string, hasLogo: boolean) {
  return StyleSheet.create({
    page: {
      fontFamily: 'Helvetica',
      fontSize: 11,
      paddingTop: hasLogo ? ORG_LOGO_BLOCK_PT : 48,
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
      width: A4_WIDTH_PT,
      height: A4_HEIGHT_PT,
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
      width: 200,
      height: 60,
      objectFit: 'contain',
    },
    documentBody: {
      width: '100%',
    },
    contentLayer: {
      position: 'relative',
    },
    h1: {
      fontSize: 20,
      fontFamily: 'Helvetica-Bold',
      marginBottom: 6,
      marginTop: 12,
      color: textColor,
    },
    h2: {
      fontSize: 15,
      fontFamily: 'Helvetica-Bold',
      marginBottom: 4,
      marginTop: 10,
      color: textColor,
    },
    h3: {
      fontSize: 13,
      fontFamily: 'Helvetica-Bold',
      marginBottom: 4,
      marginTop: 8,
      color: textColor,
    },
    paragraph: {
      marginBottom: 6,
      fontSize: 11,
      lineHeight: 1.6,
      color: textColor,
    },
    listItem: {
      flexDirection: 'row',
      marginBottom: 3,
      paddingLeft: 8,
    },
    bullet: {
      width: 12,
      fontSize: 11,
      color: textColor,
    },
    listItemText: {
      flex: 1,
      fontSize: 11,
      color: textColor,
    },
    hr: {
      borderBottomWidth: 1,
      borderBottomColor: '#a1a8a2',
      marginVertical: 10,
    },
    formFieldBox: {
      borderWidth: 1,
      borderStyle: 'dashed',
      borderColor: '#D4AF37',
      borderRadius: 4,
      paddingVertical: 6,
      paddingHorizontal: 10,
      marginVertical: 4,
      flexDirection: 'row',
      alignItems: 'center',
      gap: 6,
      backgroundColor: '#FFFDF0',
    },
    formFieldLabel: {
      fontSize: 10,
      color: textColor,
      flex: 1,
    },
    formFieldType: {
      fontSize: 9,
      color: '#a1a8a2',
      textTransform: 'uppercase',
    },
    formFieldRequired: {
      fontSize: 9,
      color: '#e53e3e',
    },
    tableContainer: {
      marginVertical: 8,
      borderWidth: 1,
      borderColor: '#a1a8a2',
    },
    tableRow: {
      flexDirection: 'row',
      borderBottomWidth: 1,
      borderBottomColor: '#a1a8a2',
    },
    tableCell: {
      flex: 1,
      padding: 6,
      fontSize: 10,
      borderRightWidth: 1,
      borderRightColor: '#a1a8a2',
      color: textColor,
    },
    tableHeaderCell: {
      flex: 1,
      padding: 6,
      fontSize: 10,
      fontFamily: 'Helvetica-Bold',
      backgroundColor: '#f8f9fa',
      borderRightWidth: 1,
      borderRightColor: '#a1a8a2',
      color: textColor,
    },
  })
}

type PdfStyles = ReturnType<typeof createStyles>
type PdfTextStyle = PdfStyles[keyof PdfStyles]

function mergePdfStyles(...styles: object[]) {
  return Object.assign({}, ...styles) as PdfTextStyle
}

function getMarkStyles(marks: TiptapMark[] | undefined, defaultColor: string) {
  const markTypes = new Set((marks ?? []).map((mark) => mark.type))
  const isBold = markTypes.has('bold')
  const isItalic = markTypes.has('italic')
  const isStrike = markTypes.has('strike')
  const isUnderline = markTypes.has('underline')

  const textStyleMark = marks?.find((mark) => mark.type === 'textStyle')
  const fontFamilyAttr =
    typeof textStyleMark?.attrs?.fontFamily === 'string'
      ? textStyleMark.attrs.fontFamily
      : undefined

  let fontFamily = fontFamilyAttr?.includes('Courier')
    ? 'Courier'
    : fontFamilyAttr?.includes('Times')
      ? 'Times-Roman'
      : 'Helvetica'
  if (isBold && isItalic) fontFamily = 'Helvetica-BoldOblique'
  else if (isBold) fontFamily = 'Helvetica-Bold'
  else if (isItalic) fontFamily = 'Helvetica-Oblique'

  const decorations: string[] = []
  if (isStrike) decorations.push('line-through')
  if (isUnderline) decorations.push('underline')

  const inlineColor =
    typeof textStyleMark?.attrs?.color === 'string' ? textStyleMark.attrs.color : undefined
  const fontSizeRaw =
    typeof textStyleMark?.attrs?.fontSize === 'string'
      ? normalizeFontSize(textStyleMark.attrs.fontSize)
      : null
  const fontSize = fontSizeRaw ? Number.parseFloat(fontSizeRaw) : undefined
  const highlightMark = marks?.find((mark) => mark.type === 'highlight')
  const backgroundColor =
    typeof highlightMark?.attrs?.color === 'string' ? highlightMark.attrs.color : undefined

  return {
    fontFamily,
    color: inlineColor ?? defaultColor,
    fontSize,
    backgroundColor,
    textDecoration: decorations.length > 0 ? decorations.join(' ') : undefined,
  }
}

function getBlockStyle(node: TiptapNode, baseStyle: PdfTextStyle): PdfTextStyle {
  const attrs = node.attrs ?? {}
  const indent = typeof attrs.indent === 'number' ? attrs.indent : 0
  const lineHeight =
    typeof attrs.lineHeight === 'string' && attrs.lineHeight
      ? Number.parseFloat(attrs.lineHeight)
      : undefined
  const marginBottom =
    typeof attrs.paragraphSpacing === 'string' && attrs.paragraphSpacing
      ? Number.parseFloat(attrs.paragraphSpacing)
      : undefined
  const textAlign =
    typeof attrs.textAlign === 'string'
      ? (attrs.textAlign as 'left' | 'center' | 'right' | 'justify')
      : undefined

  return mergePdfStyles(baseStyle, {
    marginLeft: indent * 18,
    lineHeight,
    marginBottom,
    textAlign,
  })
}

function renderInlineContent(
  nodes: TiptapNode[] | undefined,
  baseStyle: PdfTextStyle,
  defaultColor: string,
  keyPrefix: string
): ReactNode {
  if (!nodes?.length) return null

  return nodes.map((node, index) => {
    if (node.type === 'text') {
      return (
        <Text
          key={`${keyPrefix}-text-${index}`}
          style={mergePdfStyles(baseStyle, getMarkStyles(node.marks, defaultColor))}
        >
          {node.text ?? ''}
        </Text>
      )
    }

    if (node.type === 'hardBreak') {
      return (
        <Text key={`${keyPrefix}-break-${index}`} style={baseStyle}>
          {'\n'}
        </Text>
      )
    }

    return null
  })
}

function renderBlockContent(
  nodes: TiptapNode[] | undefined,
  baseStyle: PdfTextStyle,
  defaultColor: string,
  keyPrefix: string
): ReactNode {
  if (!nodes?.length) return null

  return nodes.map((node, index) => {
    if (node.type === 'paragraph') {
      const paragraphStyle = getBlockStyle(node, { ...baseStyle, marginBottom: 4 })
      return (
        <Text
          key={`${keyPrefix}-p-${index}`}
          style={paragraphStyle}
        >
          {renderInlineContent(node.content, paragraphStyle, defaultColor, `${keyPrefix}-p-${index}`)}
        </Text>
      )
    }

    return renderNode(node, `${keyPrefix}-block-${index}`, defaultColor, createStyles(defaultColor, false))
  })
}

function renderNode(
  node: TiptapNode,
  key: string,
  textColor: string,
  styles: PdfStyles
): ReactNode {
  switch (node.type) {
    case 'heading': {
      const level = (node.attrs?.level as number) ?? 1
      const style = getBlockStyle(
        node,
        level === 1 ? styles.h1 : level === 2 ? styles.h2 : styles.h3
      )
      return (
        <Text key={key} style={style}>
          {renderInlineContent(node.content, style, textColor, key)}
        </Text>
      )
    }

    case 'paragraph': {
      const hasContent = (node.content ?? []).some(
        (child) => child.type === 'text' && (child.text ?? '').length > 0
      )
      if (!hasContent) {
        return (
          <Text key={key} style={getBlockStyle(node, styles.paragraph)}>
            {' '}
          </Text>
        )
      }
      const style = getBlockStyle(node, styles.paragraph)
      return (
        <Text key={key} style={style}>
          {renderInlineContent(node.content, style, textColor, key)}
        </Text>
      )
    }

    case 'bulletList':
    case 'orderedList': {
      return (
        <View key={key}>
          {(node.content ?? []).map((item, index) => {
            const bulletChar = node.type === 'bulletList' ? '•' : `${index + 1}.`
            return (
              <View key={index} style={styles.listItem}>
                <Text style={styles.bullet}>{bulletChar}</Text>
                <Text style={styles.listItemText}>
                  {renderBlockContent(
                    item.content,
                    styles.listItemText,
                    textColor,
                    `${key}-li-${index}`
                  )}
                </Text>
              </View>
            )
          })}
        </View>
      )
    }

    case 'horizontalRule':
      return <View key={key} style={styles.hr} />

    case 'formField': {
      const attrs = normalizeFormFieldAttrs(node.attrs)
      return (
        <View key={key} style={styles.formFieldBox}>
          <Text style={styles.formFieldType}>{FIELD_TYPE_LABELS[attrs.fieldType]}:</Text>
          <Text style={styles.formFieldLabel}>{getFieldDisplayLabel(attrs)}</Text>
          {attrs.required && <Text style={styles.formFieldRequired}>*</Text>}
        </View>
      )
    }

    case 'table': {
      return (
        <View key={key} style={styles.tableContainer}>
          {(node.content ?? []).map((row, rowIdx) => (
            <View key={rowIdx} style={styles.tableRow}>
              {(row.content ?? []).map((cell, cellIdx) => {
                const isHeader = cell.type === 'tableHeader'
                const cellStyle = isHeader ? styles.tableHeaderCell : styles.tableCell
                return (
                  <Text key={cellIdx} style={cellStyle}>
                    {renderBlockContent(
                      cell.content,
                      cellStyle,
                      textColor,
                      `${key}-cell-${rowIdx}-${cellIdx}`
                    )}
                  </Text>
                )
              })}
            </View>
          ))}
        </View>
      )
    }

    case 'blockquote': {
      return (
        <View
          key={key}
          style={{
            borderLeftWidth: 3,
            borderLeftColor: '#D4AF37',
            paddingLeft: 10,
            marginVertical: 6,
          }}
        >
          <Text style={{ ...styles.paragraph, color: '#a1a8a2' }}>
            {renderBlockContent(node.content, styles.paragraph, '#a1a8a2', `${key}-quote`)}
          </Text>
        </View>
      )
    }

    default:
      return null
  }
}

function TemplatePdfDocument({
  content,
  name,
  textColor,
  organisationBranding,
}: {
  content: TiptapDocument
  name: string
  textColor: string
  organisationBranding?: OrganisationBranding | null
}) {
  const logoUrl = getTemplateUsesOrganisationLogo(content)
    ? organisationBranding?.logoUrl ?? null
    : null
  const letterheadUrl = getTemplateUsesOrganisationLetterhead(content)
    ? organisationBranding?.letterheadUrl ?? null
    : null
  const styles = createStyles(textColor, Boolean(logoUrl))

  return (
    <Document title={name}>
      <Page size="A4" style={styles.page}>
        {letterheadUrl ? (
          // eslint-disable-next-line jsx-a11y/alt-text -- decorative background layer in PDF output
          <Image fixed src={letterheadUrl} style={styles.letterheadBackground} />
        ) : null}

        {logoUrl ? (
          <View fixed style={styles.logoBand}>
            {/* eslint-disable-next-line jsx-a11y/alt-text -- organisation logo in PDF output */}
            <Image src={logoUrl} style={styles.logoImage} />
          </View>
        ) : null}

        <View style={styles.contentLayer}>
          <View style={styles.documentBody}>
            {(content.content ?? []).map((node, index) =>
              renderNode(node, String(index), textColor, styles)
            )}
          </View>
        </View>
      </Page>
    </Document>
  )
}

interface TemplatePdfPreviewProps {
  content: TiptapDocument
  name: string
  textColor?: string
  organisationBranding?: OrganisationBranding | null
}

export function TemplatePdfPreview({
  content,
  name,
  textColor,
  organisationBranding,
}: TemplatePdfPreviewProps) {
  const resolvedColor = textColor ?? getTemplateTextColor(content) ?? DEFAULT_TEMPLATE_TEXT_COLOR
  const [resolvedBranding, setResolvedBranding] = useState<OrganisationBranding | null>(null)
  const [isPreparing, setIsPreparing] = useState(true)

  useEffect(() => {
    let cancelled = false

    async function prepare() {
      setIsPreparing(true)
      const branding = await resolveOrganisationBrandingForPdf(organisationBranding)
      if (!cancelled) {
        setResolvedBranding(branding)
        setIsPreparing(false)
      }
    }

    prepare()

    return () => {
      cancelled = true
    }
  }, [organisationBranding])

  if (isPreparing) {
    return (
      <div className="flex h-full items-center justify-center text-signara-steel">
        Preparing PDF preview…
      </div>
    )
  }

  return (
    <PDFViewer width="100%" height="100%" showToolbar>
      <TemplatePdfDocument
        content={content}
        name={name}
        textColor={resolvedColor}
        organisationBranding={resolvedBranding}
      />
    </PDFViewer>
  )
}

export { getTemplateTextColor }
