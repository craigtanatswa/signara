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
import type { PageLayout } from '@/lib/tiptap/page-size'

export function createExecutedContentStyles(textColor: string) {
  return StyleSheet.create({
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
    /** Matches DocumentFilledFieldDisplay / on-screen preview controls. */
    formFieldStack: {
      marginVertical: 4,
      minWidth: 160,
      maxWidth: 280,
    },
    formFieldLabel: {
      fontSize: 9,
      fontFamily: 'Helvetica-Bold',
      color: textColor,
      marginBottom: 3,
    },
    formFieldRequired: {
      fontSize: 9,
      color: '#e53e3e',
    },
    formFieldInput: {
      borderWidth: 1,
      borderColor: '#A1A8A2',
      borderRadius: 4,
      paddingVertical: 6,
      paddingHorizontal: 8,
      fontSize: 10,
      color: textColor,
      backgroundColor: '#FFFFFF',
      minHeight: 22,
    },
    formFieldCheckboxRow: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 6,
      marginVertical: 4,
    },
    formFieldCheckbox: {
      width: 12,
      height: 12,
      borderWidth: 1,
      borderColor: '#A1A8A2',
      borderRadius: 2,
      alignItems: 'center',
      justifyContent: 'center',
    },
    formFieldCheckboxChecked: {
      fontSize: 9,
      fontFamily: 'Helvetica-Bold',
      color: textColor,
    },
    formFieldSignatureLabel: {
      fontSize: 9,
      fontFamily: 'Helvetica-Bold',
      color: textColor,
      marginBottom: 3,
    },
    formFieldSignatureImage: {
      maxWidth: 220,
      height: 56,
      objectFit: 'contain',
    },
    formFieldSignaturePending: {
      borderWidth: 1,
      borderStyle: 'dashed',
      borderColor: '#A1A8A2',
      borderRadius: 4,
      paddingVertical: 10,
      paddingHorizontal: 10,
      marginVertical: 4,
      backgroundColor: '#F0F1F0',
      fontSize: 9,
      color: '#A1A8A2',
      minWidth: 140,
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
    blockquote: {
      borderLeftWidth: 3,
      borderLeftColor: '#D4AF37',
      paddingLeft: 10,
      marginVertical: 6,
    },
  })
}

type PdfStyles = ReturnType<typeof createExecutedContentStyles>

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

function getBlockStyle(node: TiptapNode, baseStyle: Style): Style {
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
  signaturesByFieldId: Record<string, string | null>
  textColor: string
  styles: PdfStyles
}

function renderInlineContent(
  nodes: TiptapNode[] | undefined,
  baseStyle: Style,
  keyPrefix: string,
  ctx: RenderContentContext
): ReactNode {
  if (!nodes?.length) return null

  return nodes.map((node, index) => {
    if (node.type === 'text') {
      return (
        <Text
          key={`${keyPrefix}-text-${index}`}
          style={mergeStyles(baseStyle, getMarkStyles(node.marks, ctx.textColor))}
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
  baseStyle: Style,
  keyPrefix: string,
  ctx: RenderContentContext
): ReactNode {
  if (!nodes?.length) return null

  return nodes.map((node, index) => {
    if (node.type === 'paragraph') {
      const paragraphStyle = getBlockStyle(node, mergeStyles(baseStyle, { marginBottom: 4 }))
      return (
        <Text key={`${keyPrefix}-p-${index}`} style={paragraphStyle}>
          {renderInlineContent(node.content, paragraphStyle, `${keyPrefix}-p-${index}`, ctx)}
        </Text>
      )
    }

    return renderNode(node, `${keyPrefix}-block-${index}`, ctx)
  })
}

function displayFieldValue(fieldType: string, value: unknown): string {
  if (fieldType === 'date') return formatPdfDateValue(value)
  return formatPdfFieldValue(fieldType, value)
}

function renderFormField(
  node: TiptapNode,
  key: string,
  ctx: RenderContentContext
): ReactNode {
  const { styles } = ctx
  const attrs = normalizeFormFieldAttrs(node.attrs)
  const label = getFieldDisplayLabel(attrs)
  const value = ctx.fieldValues[attrs.fieldId]

  if (attrs.fieldType === 'signature') {
    const imageSrc = ctx.signaturesByFieldId[attrs.fieldId] ?? null
    if (imageSrc) {
      return (
        <View key={key} style={styles.formFieldStack} wrap={false}>
          <Text style={styles.formFieldSignatureLabel}>{label}</Text>
          {/* eslint-disable-next-line jsx-a11y/alt-text -- signature image in PDF output */}
          <Image src={imageSrc} style={styles.formFieldSignatureImage} />
        </View>
      )
    }

    const pending =
      value === 'physical'
        ? 'Physically signed'
        : attrs.signatureRole === 'initiator'
          ? `${label} — not signed`
          : `${label} — awaiting signature`

    return (
      <Text key={key} style={styles.formFieldSignaturePending}>
        {pending}
      </Text>
    )
  }

  if (attrs.fieldType === 'checkbox') {
    const checked = Boolean(value)
    return (
      <View key={key} style={styles.formFieldCheckboxRow} wrap={false}>
        <View style={styles.formFieldCheckbox}>
          {checked ? <Text style={styles.formFieldCheckboxChecked}>X</Text> : null}
        </View>
        <Text style={{ fontSize: 10, color: ctx.textColor }}>
          {attrs.label}
          {attrs.required ? <Text style={styles.formFieldRequired}> *</Text> : null}
        </Text>
      </View>
    )
  }

  if (attrs.fieldType === 'file') {
    const filename =
      typeof value === 'string' && value ? getAttachmentFilename(value) : null
    return (
      <View key={key} style={styles.formFieldStack} wrap={false}>
        <Text style={styles.formFieldLabel}>
          {label}
          {attrs.required ? <Text style={styles.formFieldRequired}> *</Text> : null}
        </Text>
        <Text style={styles.formFieldInput}>{filename ?? '—'}</Text>
      </View>
    )
  }

  return (
    <View key={key} style={styles.formFieldStack} wrap={false}>
      <Text style={styles.formFieldLabel}>
        {label}
        {attrs.required ? <Text style={styles.formFieldRequired}> *</Text> : null}
      </Text>
      <Text style={styles.formFieldInput}>{displayFieldValue(attrs.fieldType, value)}</Text>
    </View>
  )
}

function renderNode(node: TiptapNode, key: string, ctx: RenderContentContext): ReactNode {
  const { styles, textColor } = ctx

  switch (node.type) {
    case 'heading': {
      const level = (node.attrs?.level as number) ?? 1
      const style = getBlockStyle(
        node,
        level === 1 ? styles.h1 : level === 2 ? styles.h2 : styles.h3
      )
      return (
        <Text key={key} style={style}>
          {renderInlineContent(node.content, style, key, ctx)}
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
          {renderInlineContent(node.content, style, key, ctx)}
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
            mergeStyles(styles.paragraph, { color: '#a1a8a2' }),
            `${key}-quote`,
            { ...ctx, textColor: '#a1a8a2' }
          )}
        </View>
      )
    }

    default:
      return null
  }
}

/** Walk Tiptap JSON and produce @react-pdf elements matching the on-screen document preview. */
export function renderTiptapToPdf(
  content: TiptapDocument,
  fieldValues: Record<string, unknown>,
  signaturesByFieldId: Record<string, string | null> = {},
  textColor = '#000000',
  _layout?: PageLayout
): ReactNode {
  const styles = createExecutedContentStyles(textColor)
  const ctx: RenderContentContext = {
    fieldValues,
    signaturesByFieldId,
    textColor,
    styles,
  }

  return (content.content ?? []).map((node, index) =>
    renderNode(node, `root-${index}`, ctx)
  )
}
