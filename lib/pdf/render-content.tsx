import type { ReactNode } from 'react'
import { Image, Text, View, StyleSheet } from '@react-pdf/renderer'
import type { Style } from '@react-pdf/types'
import type { TiptapDocument, TiptapMark, TiptapNode } from '@/types/database'
import {
  getFieldDisplayLabel,
  normalizeFormFieldAttrs,
} from '@/lib/tiptap/field-utils'
import { normalizeFontSize } from '@/lib/tiptap/font-size'
import { formatPdfDateValue, formatPdfFieldValue } from '@/lib/pdf/format-values'
import { getAttachmentFilename } from '@/lib/storage/document-attachments'

const styles = StyleSheet.create({
  h1: {
    fontSize: 18,
    fontFamily: 'Helvetica-Bold',
    marginBottom: 6,
    marginTop: 12,
    color: '#0F2C59',
  },
  h2: {
    fontSize: 14,
    fontFamily: 'Helvetica-Bold',
    marginBottom: 4,
    marginTop: 10,
    color: '#0F2C59',
  },
  h3: {
    fontSize: 12,
    fontFamily: 'Helvetica-Bold',
    marginBottom: 4,
    marginTop: 8,
    color: '#0F2C59',
  },
  paragraph: {
    marginBottom: 6,
    fontSize: 10,
    lineHeight: 1.55,
    color: '#0F2C59',
  },
  listItem: {
    flexDirection: 'row',
    marginBottom: 3,
    paddingLeft: 8,
  },
  bullet: {
    width: 14,
    fontSize: 10,
    color: '#0F2C59',
  },
  listItemText: {
    flex: 1,
    fontSize: 10,
    color: '#0F2C59',
  },
  hr: {
    borderBottomWidth: 1,
    borderBottomColor: '#A1A8A2',
    marginVertical: 10,
  },
  fieldRow: {
    marginVertical: 4,
  },
  fieldLabelValue: {
    fontSize: 10,
    color: '#0F2C59',
    lineHeight: 1.45,
  },
  fieldLabel: {
    fontFamily: 'Helvetica-Bold',
  },
  checkboxRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginVertical: 3,
  },
  checkboxMark: {
    fontSize: 11,
    color: '#0F2C59',
  },
  signatureInline: {
    marginVertical: 6,
    maxWidth: 220,
  },
  signatureImage: {
    width: 180,
    height: 48,
    objectFit: 'contain',
    marginTop: 4,
  },
  signaturePlaceholder: {
    marginTop: 4,
    paddingVertical: 10,
    paddingHorizontal: 8,
    borderWidth: 1,
    borderStyle: 'dashed',
    borderColor: '#A1A8A2',
    borderRadius: 4,
    fontSize: 9,
    color: '#A1A8A2',
    backgroundColor: '#F8F9FA',
  },
  fileNote: {
    fontSize: 9,
    color: '#A1A8A2',
    marginTop: 2,
  },
  tableContainer: {
    marginVertical: 8,
    borderWidth: 1,
    borderColor: '#A1A8A2',
  },
  tableRow: {
    flexDirection: 'row',
    borderBottomWidth: 1,
    borderBottomColor: '#A1A8A2',
  },
  tableCell: {
    flex: 1,
    padding: 6,
    fontSize: 9,
    borderRightWidth: 1,
    borderRightColor: '#A1A8A2',
    color: '#0F2C59',
  },
  tableHeaderCell: {
    flex: 1,
    padding: 6,
    fontSize: 9,
    fontFamily: 'Helvetica-Bold',
    backgroundColor: '#F8F9FA',
    borderRightWidth: 1,
    borderRightColor: '#A1A8A2',
    color: '#0F2C59',
  },
  blockquote: {
    borderLeftWidth: 3,
    borderLeftColor: '#D4AF37',
    paddingLeft: 10,
    marginVertical: 6,
  },
})

type PdfTextStyle = Style

function mergeStyles(...parts: object[]): Style {
  return Object.assign({}, ...parts) as Style
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

  return mergeStyles(baseStyle, {
    marginLeft: indent * 18,
    lineHeight,
    marginBottom,
    textAlign,
  })
}

export interface RenderContentContext {
  fieldValues: Record<string, unknown>
  /** Embeddable signature data URLs keyed by fieldId. */
  signaturesByFieldId: Record<string, string | null>
  textColor?: string
}

function renderInlineContent(
  nodes: TiptapNode[] | undefined,
  baseStyle: PdfTextStyle,
  defaultColor: string,
  keyPrefix: string,
  ctx: RenderContentContext
): ReactNode {
  if (!nodes?.length) return null

  return nodes.map((node, index) => {
    if (node.type === 'text') {
      return (
        <Text
          key={`${keyPrefix}-text-${index}`}
          style={mergeStyles(baseStyle, getMarkStyles(node.marks, defaultColor))}
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

    if (node.type === 'formField') {
      return renderFormField(node, `${keyPrefix}-ff-${index}`, ctx)
    }

    return null
  })
}

function renderBlockContent(
  nodes: TiptapNode[] | undefined,
  baseStyle: PdfTextStyle,
  defaultColor: string,
  keyPrefix: string,
  ctx: RenderContentContext
): ReactNode {
  if (!nodes?.length) return null

  return nodes.map((node, index) => {
    if (node.type === 'paragraph') {
      const paragraphStyle = getBlockStyle(node, { ...baseStyle, marginBottom: 4 })
      return (
        <Text key={`${keyPrefix}-p-${index}`} style={paragraphStyle}>
          {renderInlineContent(
            node.content,
            paragraphStyle,
            defaultColor,
            `${keyPrefix}-p-${index}`,
            ctx
          )}
        </Text>
      )
    }

    return renderNode(node, `${keyPrefix}-block-${index}`, ctx)
  })
}

function renderFormField(
  node: TiptapNode,
  key: string,
  ctx: RenderContentContext
): ReactNode {
  const attrs = normalizeFormFieldAttrs(node.attrs)
  const label = getFieldDisplayLabel(attrs)
  const value = ctx.fieldValues[attrs.fieldId]

  if (attrs.fieldType === 'signature') {
    const imageSrc = ctx.signaturesByFieldId[attrs.fieldId] ?? null
    return (
      <View key={key} style={styles.signatureInline} wrap={false}>
        <Text style={styles.fieldLabelValue}>
          <Text style={styles.fieldLabel}>{label}</Text>
        </Text>
        {imageSrc ? (
          // eslint-disable-next-line jsx-a11y/alt-text -- signature image in PDF output
          <Image src={imageSrc} style={styles.signatureImage} />
        ) : (
          <Text style={styles.signaturePlaceholder}>
            {value === 'physical' ? 'Physically signed' : 'Signature pending'}
          </Text>
        )}
      </View>
    )
  }

  if (attrs.fieldType === 'checkbox') {
    const checked = Boolean(value)
    return (
      <View key={key} style={styles.checkboxRow} wrap={false}>
        <Text style={styles.checkboxMark}>{checked ? '[X]' : '[ ]'}</Text>
        <Text style={styles.fieldLabelValue}>{label}</Text>
      </View>
    )
  }

  if (attrs.fieldType === 'date') {
    return (
      <View key={key} style={styles.fieldRow} wrap={false}>
        <Text style={styles.fieldLabelValue}>
          <Text style={styles.fieldLabel}>{label}: </Text>
          {formatPdfDateValue(value)}
        </Text>
      </View>
    )
  }

  if (attrs.fieldType === 'file') {
    const filename =
      typeof value === 'string' && value ? getAttachmentFilename(value) : null
    return (
      <View key={key} style={styles.fieldRow} wrap={false}>
        <Text style={styles.fieldLabelValue}>
          <Text style={styles.fieldLabel}>{label}: </Text>
          {filename ? `[Attached: ${filename}]` : '—'}
        </Text>
        {filename ? (
          <Text style={styles.fileNote}>See audit trail / attachments for the file link</Text>
        ) : null}
      </View>
    )
  }

  return (
    <View key={key} style={styles.fieldRow} wrap={false}>
      <Text style={styles.fieldLabelValue}>
        <Text style={styles.fieldLabel}>{label}: </Text>
        {formatPdfFieldValue(attrs.fieldType, value)}
      </Text>
    </View>
  )
}

function renderNode(
  node: TiptapNode,
  key: string,
  ctx: RenderContentContext
): ReactNode {
  const textColor = ctx.textColor ?? '#0F2C59'

  switch (node.type) {
    case 'heading': {
      const level = (node.attrs?.level as number) ?? 1
      const style = getBlockStyle(
        node,
        level === 1 ? styles.h1 : level === 2 ? styles.h2 : styles.h3
      )
      return (
        <Text key={key} style={style}>
          {renderInlineContent(node.content, style, textColor, key, ctx)}
        </Text>
      )
    }

    case 'paragraph': {
      const hasContent = (node.content ?? []).some((child) => {
        if (child.type === 'text') return (child.text ?? '').length > 0
        if (child.type === 'formField') return true
        return child.type === 'hardBreak'
      })
      if (!hasContent) {
        return (
          <Text key={key} style={getBlockStyle(node, styles.paragraph)}>
            {' '}
          </Text>
        )
      }

      // Paragraphs that contain formFields can't be pure Text trees — use View.
      const hasFormField = (node.content ?? []).some((child) => child.type === 'formField')
      if (hasFormField) {
        return (
          <View key={key} style={getBlockStyle(node, { marginBottom: 6 })}>
            {(node.content ?? []).map((child, index) => {
              if (child.type === 'formField') {
                return renderFormField(child, `${key}-ff-${index}`, ctx)
              }
              if (child.type === 'text' || child.type === 'hardBreak') {
                return (
                  <Text
                    key={`${key}-t-${index}`}
                    style={mergeStyles(
                      styles.paragraph,
                      child.type === 'text' ? getMarkStyles(child.marks, textColor) : {}
                    )}
                  >
                    {child.type === 'hardBreak' ? '\n' : (child.text ?? '')}
                  </Text>
                )
              }
              return null
            })}
          </View>
        )
      }

      const style = getBlockStyle(node, styles.paragraph)
      return (
        <Text key={key} style={style}>
          {renderInlineContent(node.content, style, textColor, key, ctx)}
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
                <View style={styles.listItemText}>
                  {renderBlockContent(
                    item.content,
                    styles.listItemText,
                    textColor,
                    `${key}-li-${index}`,
                    ctx
                  )}
                </View>
              </View>
            )
          })}
        </View>
      )
    }

    case 'horizontalRule':
      return <View key={key} style={styles.hr} />

    case 'formField':
      return renderFormField(node, key, ctx)

    case 'table': {
      return (
        <View key={key} style={styles.tableContainer}>
          {(node.content ?? []).map((row, rowIdx) => (
            <View key={rowIdx} style={styles.tableRow}>
              {(row.content ?? []).map((cell, cellIdx) => {
                const isHeader = cell.type === 'tableHeader'
                const cellStyle = isHeader ? styles.tableHeaderCell : styles.tableCell
                return (
                  <View key={cellIdx} style={cellStyle}>
                    {renderBlockContent(
                      cell.content,
                      cellStyle,
                      textColor,
                      `${key}-cell-${rowIdx}-${cellIdx}`,
                      ctx
                    )}
                  </View>
                )
              })}
            </View>
          ))}
        </View>
      )
    }

    case 'blockquote': {
      return (
        <View key={key} style={styles.blockquote}>
          {renderBlockContent(
            node.content,
            { ...styles.paragraph, color: '#A1A8A2' },
            '#A1A8A2',
            `${key}-quote`,
            ctx
          )}
        </View>
      )
    }

    default:
      return null
  }
}

/** Walk Tiptap JSON and produce @react-pdf/renderer elements with real field values. */
export function renderTiptapToPdf(
  content: TiptapDocument,
  fieldValues: Record<string, unknown>,
  signaturesByFieldId: Record<string, string | null> = {},
  textColor = '#0F2C59'
): ReactNode {
  const ctx: RenderContentContext = {
    fieldValues,
    signaturesByFieldId,
    textColor,
  }

  return (content.content ?? []).map((node, index) =>
    renderNode(node, `root-${index}`, ctx)
  )
}
