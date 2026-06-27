'use client'

import type { ReactNode } from 'react'
import {
  Document,
  Page,
  Text,
  View,
  StyleSheet,
  PDFViewer,
} from '@react-pdf/renderer'
import type { TiptapDocument, TiptapMark, TiptapNode } from '@/types/database'
import {
  DEFAULT_TEMPLATE_TEXT_COLOR,
  FIELD_TYPE_LABELS,
  getFieldDisplayLabel,
  getTemplateTextColor,
  normalizeFormFieldAttrs,
} from '@/lib/tiptap/field-utils'

function createStyles(textColor: string) {
  return StyleSheet.create({
    page: {
      fontFamily: 'Helvetica',
      fontSize: 11,
      paddingTop: 48,
      paddingBottom: 48,
      paddingHorizontal: 56,
      color: textColor,
      lineHeight: 1.6,
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

  let fontFamily = 'Helvetica'
  if (isBold && isItalic) fontFamily = 'Helvetica-BoldOblique'
  else if (isBold) fontFamily = 'Helvetica-Bold'
  else if (isItalic) fontFamily = 'Helvetica-Oblique'

  const decorations: string[] = []
  if (isStrike) decorations.push('line-through')
  if (isUnderline) decorations.push('underline')

  const textStyleMark = marks?.find((mark) => mark.type === 'textStyle')
  const inlineColor =
    typeof textStyleMark?.attrs?.color === 'string' ? textStyleMark.attrs.color : undefined

  return {
    fontFamily,
    color: inlineColor ?? defaultColor,
    textDecoration: decorations.length > 0 ? decorations.join(' ') : undefined,
  }
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
      return (
        <Text
          key={`${keyPrefix}-p-${index}`}
          style={{ ...baseStyle, marginBottom: 4 }}
        >
          {renderInlineContent(node.content, baseStyle, defaultColor, `${keyPrefix}-p-${index}`)}
        </Text>
      )
    }

    return renderNode(node, `${keyPrefix}-block-${index}`, defaultColor, createStyles(defaultColor))
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
      const style = level === 1 ? styles.h1 : level === 2 ? styles.h2 : styles.h3
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
          <Text key={key} style={styles.paragraph}>
            {' '}
          </Text>
        )
      }
      return (
        <Text key={key} style={styles.paragraph}>
          {renderInlineContent(node.content, styles.paragraph, textColor, key)}
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
}: {
  content: TiptapDocument
  name: string
  textColor: string
}) {
  const styles = createStyles(textColor)

  return (
    <Document title={name}>
      <Page size="A4" style={styles.page}>
        {(content.content ?? []).map((node, index) =>
          renderNode(node, String(index), textColor, styles)
        )}
      </Page>
    </Document>
  )
}

interface TemplatePdfPreviewProps {
  content: TiptapDocument
  name: string
  textColor?: string
}

export function TemplatePdfPreview({
  content,
  name,
  textColor,
}: TemplatePdfPreviewProps) {
  const resolvedColor = textColor ?? getTemplateTextColor(content) ?? DEFAULT_TEMPLATE_TEXT_COLOR

  return (
    <PDFViewer width="100%" height="100%" showToolbar>
      <TemplatePdfDocument content={content} name={name} textColor={resolvedColor} />
    </PDFViewer>
  )
}

export { getTemplateTextColor }
