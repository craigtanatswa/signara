import type { Editor } from '@tiptap/core'
import type {
  FieldType,
  FormFieldAttrs,
  PageOrientation,
  SignatureRole,
  TiptapDocument,
  TiptapMark,
  TiptapNode,
} from '@/types/database'
import { normalizeFontSize } from '@/lib/tiptap/font-size'

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

export function isSignatureRole(value: unknown): value is SignatureRole {
  return value === 'initiator' || value === 'approver'
}

export function getFieldDisplayLabel(
  attrs: Pick<FormFieldAttrs, 'label' | 'fieldType' | 'signatureRole'>
): string {
  const trimmed = attrs.label?.trim()
  let base: string
  if (trimmed) {
    base = trimmed
  } else if (isFieldType(attrs.fieldType)) {
    base = getDefaultFieldLabel(attrs.fieldType)
  } else {
    base = 'Field'
  }

  if (attrs.fieldType === 'signature' && attrs.signatureRole === 'initiator') {
    return `${base} (Initiator)`
  }

  return base
}

export function isFieldLabelValid(label: string): boolean {
  return label.trim().length > 0
}

export const DEFAULT_TEMPLATE_TEXT_COLOR = '#000000'

export function getTemplateTextColor(content: TiptapDocument | null | undefined): string {
  const color = content?.attrs?.textColor
  if (typeof color === 'string' && /^#[0-9A-Fa-f]{6}$/.test(color)) {
    return color
  }
  return DEFAULT_TEMPLATE_TEXT_COLOR
}

export function getTemplateUsesOrganisationLogo(
  content: TiptapDocument | null | undefined
): boolean {
  return content?.attrs?.useOrganisationLogo === true
}

export function getTemplateUsesOrganisationLetterhead(
  content: TiptapDocument | null | undefined
): boolean {
  return content?.attrs?.useOrganisationLetterhead === true
}

export function getTemplatePageOrientation(
  content: TiptapDocument | null | undefined
): PageOrientation {
  return content?.attrs?.pageOrientation === 'landscape' ? 'landscape' : 'portrait'
}

export function withTemplateTextColor(
  content: TiptapDocument | null,
  textColor: string
): TiptapDocument | null {
  if (!content) return content

  return {
    ...content,
    attrs: {
      ...content.attrs,
      textColor: getTemplateTextColor({ ...content, attrs: { textColor } }),
    },
  }
}

export function withTemplateOrganisationLogo(
  content: TiptapDocument | null,
  useOrganisationLogo: boolean
): TiptapDocument {
  return withTemplateBranding(content, {
    useOrganisationLogo,
    useOrganisationLetterhead: getTemplateUsesOrganisationLetterhead(content),
  })
}

export function withTemplateOrganisationLetterhead(
  content: TiptapDocument | null,
  useOrganisationLetterhead: boolean
): TiptapDocument {
  return withTemplateBranding(content, {
    useOrganisationLogo: getTemplateUsesOrganisationLogo(content),
    useOrganisationLetterhead,
  })
}

export function withTemplateBranding(
  content: TiptapDocument | null,
  {
    useOrganisationLogo,
    useOrganisationLetterhead,
    pageOrientation,
  }: {
    useOrganisationLogo: boolean
    useOrganisationLetterhead: boolean
    pageOrientation?: PageOrientation
  }
): TiptapDocument {
  return {
    ...(content ?? { type: 'doc' as const, content: [{ type: 'paragraph' }] }),
    attrs: {
      ...(content?.attrs ?? {}),
      textColor: getTemplateTextColor(content),
      useOrganisationLogo,
      useOrganisationLetterhead,
      pageOrientation: pageOrientation ?? getTemplatePageOrientation(content),
    },
  }
}

export function withTemplatePageOrientation(
  content: TiptapDocument | null,
  pageOrientation: PageOrientation
): TiptapDocument {
  return withTemplateBranding(content, {
    useOrganisationLogo: getTemplateUsesOrganisationLogo(content),
    useOrganisationLetterhead: getTemplateUsesOrganisationLetterhead(content),
    pageOrientation,
  })
}

export function normalizeFormFieldAttrs(
  attrs: Record<string, unknown> | undefined
): FormFieldAttrs {
  const fieldType = isFieldType(attrs?.fieldType) ? attrs.fieldType : 'text'
  const rawLabel = typeof attrs?.label === 'string' ? attrs.label.trim() : ''
  const label = rawLabel || getDefaultFieldLabel(fieldType)
  const signatureRole =
    fieldType === 'signature' && isSignatureRole(attrs?.signatureRole)
      ? attrs.signatureRole
      : undefined

  return {
    fieldId: typeof attrs?.fieldId === 'string' ? attrs.fieldId : crypto.randomUUID(),
    fieldType,
    label,
    required: fieldType === 'signature' ? true : Boolean(attrs?.required),
    options: Array.isArray(attrs?.options)
      ? attrs.options.filter((o): o is string => typeof o === 'string')
      : [],
    configured: attrs?.configured !== false,
    signatureRole,
  }
}

/** Infer signature roles for legacy templates: first signature → initiator, rest → approver. */
export function assignDefaultSignatureRoles(fields: FormFieldAttrs[]): FormFieldAttrs[] {
  let hasInitiator = fields.some(
    (field) => field.fieldType === 'signature' && field.signatureRole === 'initiator'
  )

  return fields.map((field) => {
    if (field.fieldType !== 'signature') return field
    if (field.signatureRole) return field
    if (!hasInitiator) {
      hasInitiator = true
      return { ...field, signatureRole: 'initiator' as const, required: true }
    }
    return { ...field, signatureRole: 'approver' as const, required: true }
  })
}

export function listTemplateFieldsWithRoles(content: TiptapDocument | null): FormFieldAttrs[] {
  return assignDefaultSignatureRoles(listTemplateFields(content))
}

function withoutLayoutAttrs(attrs: TiptapNode['attrs']): TiptapNode['attrs'] {
  if (!attrs || !('pageSplit' in attrs)) return attrs

  const rest = { ...attrs }
  delete rest.pageSplit
  return Object.keys(rest).length ? rest : undefined
}

function normalizeNodeList(nodes: TiptapNode[] | undefined): TiptapNode[] {
  const normalized: TiptapNode[] = []

  for (const node of nodes ?? []) {
    const next = normalizeNode(node)
    const previous = normalized.at(-1)

    if (
      node.type === 'paragraph' &&
      node.attrs?.pageSplit === true &&
      previous?.type === 'paragraph'
    ) {
      previous.content = [
        ...(previous.content ?? []),
        ...(next.content ?? []),
      ]
      continue
    }

    normalized.push(next)
  }

  return normalized
}

function normalizeMarks(marks: TiptapMark[] | undefined): TiptapMark[] | undefined {
  if (!marks?.length) return marks

  return marks.map((mark) => {
    if (mark.type !== 'textStyle' || typeof mark.attrs?.fontSize !== 'string') {
      return mark
    }

    const fontSize = normalizeFontSize(mark.attrs.fontSize)
    if (!fontSize || fontSize === mark.attrs.fontSize) {
      return mark
    }

    return { ...mark, attrs: { ...mark.attrs, fontSize } }
  })
}

function normalizeNode(node: TiptapNode): TiptapNode {
  if (node.type === 'formField') {
    const attrs = normalizeFormFieldAttrs(node.attrs)
    return {
      ...node,
      attrs: { ...attrs },
    }
  }

  if (node.type === 'text' && node.marks?.length) {
    const marks = normalizeMarks(node.marks)
    if (marks !== node.marks) {
      return { ...node, marks }
    }
  }

  if (node.content?.length) {
    return {
      ...node,
      attrs: withoutLayoutAttrs(node.attrs),
      content: normalizeNodeList(node.content),
    }
  }

  return {
    ...node,
    attrs: withoutLayoutAttrs(node.attrs),
  }
}

export function normalizeTemplateContent(
  content: TiptapDocument | null
): TiptapDocument | null {
  if (!content) return content

  return {
    ...content,
    attrs: {
      ...content.attrs,
      textColor: getTemplateTextColor(content),
      useOrganisationLogo: getTemplateUsesOrganisationLogo(content),
      useOrganisationLetterhead: getTemplateUsesOrganisationLetterhead(content),
      pageOrientation: getTemplatePageOrientation(content),
    },
    content: normalizeNodeList(content.content),
  }
}

export function listTemplateFields(content: TiptapDocument | null): FormFieldAttrs[] {
  if (!content?.content?.length) return []

  const fields: FormFieldAttrs[] = []

  function walk(nodes: TiptapNode[]) {
    for (const node of nodes) {
      if (node.type === 'formField') {
        fields.push(normalizeFormFieldAttrs(node.attrs))
      }

      if (node.content?.length) {
        walk(node.content)
      }
    }
  }

  walk(content.content)
  return fields
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

export function demoteOtherInitiatorSignatures(editor: Editor, keepFieldId: string) {
  const { state } = editor
  const tr = state.tr
  let changed = false

  state.doc.descendants((node, pos) => {
    if (node.type.name !== 'formField') return
    const attrs = node.attrs as FormFieldAttrs
    if (
      attrs.fieldType === 'signature' &&
      attrs.signatureRole === 'initiator' &&
      attrs.fieldId !== keepFieldId
    ) {
      tr.setNodeMarkup(pos, undefined, { ...node.attrs, signatureRole: 'approver' })
      changed = true
    }
  })

  if (changed) {
    editor.view.dispatch(tr)
  }
}

export function validateSignatureFieldRoles(content: TiptapDocument | null): string | null {
  const fields = listTemplateFieldsWithRoles(content)
  const initiatorFields = fields.filter(
    (field) => field.fieldType === 'signature' && field.signatureRole === 'initiator'
  )

  if (initiatorFields.length > 1) {
    return 'Only one initiator signature field is allowed on a template.'
  }

  const signatureFields = fields.filter((field) => field.fieldType === 'signature')
  const initiatorIndex = signatureFields.findIndex((field) => field.signatureRole === 'initiator')
  if (initiatorIndex > 0) {
    return 'The initiator signature must appear before approver signatures in the document.'
  }

  return null
}
