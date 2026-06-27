import type { FieldType, FormFieldAttrs, TiptapDocument, TiptapNode } from '@/types/database'

export const FIELD_TYPE_LABELS: Record<FieldType, string> = {
  text: 'Text',
  number: 'Number',
  date: 'Date',
  dropdown: 'Dropdown',
  checkbox: 'Checkbox',
  file: 'File attachment',
  signature: 'Signature',
}

const FIELD_TYPES = Object.keys(FIELD_TYPE_LABELS) as FieldType[]

export function isFieldType(value: unknown): value is FieldType {
  return typeof value === 'string' && FIELD_TYPES.includes(value as FieldType)
}

export function getDefaultFieldLabel(fieldType: FieldType): string {
  return FIELD_TYPE_LABELS[fieldType]
}

export function getFieldDisplayLabel(
  attrs: Pick<FormFieldAttrs, 'label' | 'fieldType'>
): string {
  const trimmed = attrs.label?.trim()
  if (trimmed) return trimmed
  if (isFieldType(attrs.fieldType)) {
    return getDefaultFieldLabel(attrs.fieldType)
  }
  return 'Field'
}

export function isFieldLabelValid(label: string): boolean {
  return label.trim().length > 0
}

export function normalizeFormFieldAttrs(
  attrs: Record<string, unknown> | undefined
): FormFieldAttrs {
  const fieldType = isFieldType(attrs?.fieldType) ? attrs.fieldType : 'text'
  const rawLabel = typeof attrs?.label === 'string' ? attrs.label.trim() : ''
  const label = rawLabel || getDefaultFieldLabel(fieldType)

  return {
    fieldId: typeof attrs?.fieldId === 'string' ? attrs.fieldId : crypto.randomUUID(),
    fieldType,
    label,
    required: Boolean(attrs?.required),
    options: Array.isArray(attrs?.options)
      ? attrs.options.filter((o): o is string => typeof o === 'string')
      : [],
    configured: attrs?.configured !== false,
  }
}

function normalizeNode(node: TiptapNode): TiptapNode {
  if (node.type === 'formField') {
    const attrs = normalizeFormFieldAttrs(node.attrs)
    return {
      ...node,
      attrs: { ...attrs },
    }
  }

  if (node.content?.length) {
    return {
      ...node,
      content: node.content.map(normalizeNode),
    }
  }

  return node
}

export function normalizeTemplateContent(
  content: TiptapDocument | null
): TiptapDocument | null {
  if (!content) return content

  return {
    ...content,
    content: (content.content ?? []).map(normalizeNode),
  }
}

export function validateTemplateFields(content: TiptapDocument | null): string | null {
  if (!content?.content?.length) return null

  function walk(nodes: TiptapNode[]): string | null {
    for (const node of nodes) {
      if (node.type === 'formField') {
        const attrs = normalizeFormFieldAttrs(node.attrs)

        if (!isFieldType(node.attrs?.fieldType)) {
          return 'A form field is missing its field type. Double-click it to configure.'
        }

        if (!isFieldLabelValid(attrs.label)) {
          return `The ${FIELD_TYPE_LABELS[attrs.fieldType]} field needs a label. Double-click it to configure.`
        }

        if (node.attrs?.configured === false) {
          return `The "${attrs.label}" field has not been saved. Double-click it and click Save.`
        }
      }

      if (node.content?.length) {
        const error = walk(node.content)
        if (error) return error
      }
    }

    return null
  }

  return walk(content.content)
}
