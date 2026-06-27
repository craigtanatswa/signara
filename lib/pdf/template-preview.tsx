'use client'

import {
  Document,
  Page,
  Text,
  View,
  StyleSheet,
  PDFViewer,
} from '@react-pdf/renderer'
import type { TiptapDocument, TiptapNode } from '@/types/database'
import {
  FIELD_TYPE_LABELS,
  getFieldDisplayLabel,
  normalizeFormFieldAttrs,
} from '@/lib/tiptap/field-utils'

// ─── Styles ───────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  page: {
    fontFamily: 'Helvetica',
    fontSize: 11,
    paddingTop: 48,
    paddingBottom: 48,
    paddingHorizontal: 56,
    color: '#0f2c59',
    lineHeight: 1.6,
  },
  h1: {
    fontSize: 20,
    fontFamily: 'Helvetica-Bold',
    marginBottom: 6,
    marginTop: 12,
    color: '#0f2c59',
  },
  h2: {
    fontSize: 15,
    fontFamily: 'Helvetica-Bold',
    marginBottom: 4,
    marginTop: 10,
    color: '#0f2c59',
  },
  h3: {
    fontSize: 13,
    fontFamily: 'Helvetica-Bold',
    marginBottom: 4,
    marginTop: 8,
    color: '#0f2c59',
  },
  paragraph: {
    marginBottom: 6,
    fontSize: 11,
    lineHeight: 1.6,
  },
  listItem: {
    flexDirection: 'row',
    marginBottom: 3,
    paddingLeft: 8,
  },
  bullet: {
    width: 12,
    fontSize: 11,
  },
  listItemText: {
    flex: 1,
    fontSize: 11,
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
    color: '#0f2c59',
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
  },
  tableHeaderCell: {
    flex: 1,
    padding: 6,
    fontSize: 10,
    fontFamily: 'Helvetica-Bold',
    backgroundColor: '#f8f9fa',
    borderRightWidth: 1,
    borderRightColor: '#a1a8a2',
    color: '#0f2c59',
  },
})

// ─── Node renderers ───────────────────────────────────────────────────────────

function renderText(node: TiptapNode): string {
  if (node.type === 'text') return node.text ?? ''
  if (node.content) return node.content.map(renderText).join('')
  return ''
}

function renderNode(node: TiptapNode, key: string): React.ReactNode {
  switch (node.type) {
    case 'heading': {
      const level = (node.attrs?.level as number) ?? 1
      const text = node.content?.map(renderText).join('') ?? ''
      const style = level === 1 ? styles.h1 : level === 2 ? styles.h2 : styles.h3
      return <Text key={key} style={style}>{text}</Text>
    }

    case 'paragraph': {
      const text = node.content?.map(renderText).join('') ?? ''
      if (!text.trim()) return <Text key={key} style={styles.paragraph}>{' '}</Text>
      return <Text key={key} style={styles.paragraph}>{text}</Text>
    }

    case 'bulletList':
    case 'orderedList': {
      return (
        <View key={key}>
          {(node.content ?? []).map((item, i) => {
            const bulletChar = node.type === 'bulletList' ? '•' : `${i + 1}.`
            const itemText = item.content?.map(n => n.content?.map(renderText).join('') ?? '').join('') ?? ''
            return (
              <View key={i} style={styles.listItem}>
                <Text style={styles.bullet}>{bulletChar}</Text>
                <Text style={styles.listItemText}>{itemText}</Text>
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
          <Text style={styles.formFieldType}>
            {FIELD_TYPE_LABELS[attrs.fieldType]}:
          </Text>
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
                const cellText = cell.content?.map(n => n.content?.map(renderText).join('') ?? '').join('') ?? ''
                return (
                  <Text
                    key={cellIdx}
                    style={isHeader ? styles.tableHeaderCell : styles.tableCell}
                  >
                    {cellText}
                  </Text>
                )
              })}
            </View>
          ))}
        </View>
      )
    }

    case 'blockquote': {
      const text = node.content?.map(n => n.content?.map(renderText).join('') ?? '').join('') ?? ''
      return (
        <View key={key} style={{ borderLeftWidth: 3, borderLeftColor: '#D4AF37', paddingLeft: 10, marginVertical: 6 }}>
          <Text style={{ ...styles.paragraph, color: '#a1a8a2' }}>{text}</Text>
        </View>
      )
    }

    default:
      return null
  }
}

// ─── PDF Document ─────────────────────────────────────────────────────────────

function TemplatePdfDocument({ content, name }: { content: TiptapDocument; name: string }) {
  return (
    <Document title={name}>
      <Page size="A4" style={styles.page}>
        {(content.content ?? []).map((node, i) => renderNode(node, String(i)))}
      </Page>
    </Document>
  )
}

// ─── Exported viewer component ────────────────────────────────────────────────

interface TemplatePdfPreviewProps {
  content: TiptapDocument
  name: string
}

export function TemplatePdfPreview({ content, name }: TemplatePdfPreviewProps) {
  return (
    <PDFViewer width="100%" height="100%" showToolbar>
      <TemplatePdfDocument content={content} name={name} />
    </PDFViewer>
  )
}
