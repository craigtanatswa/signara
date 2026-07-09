import { Node, mergeAttributes } from '@tiptap/core'
import { ReactNodeViewRenderer } from '@tiptap/react'
import { NodeSelection } from '@tiptap/pm/state'
import { FormFieldNodeView } from '@/components/templates/form-field-node-view'
import type { Editor } from '@tiptap/core'
import {
  getDefaultFieldLabel,
  isFieldType,
  isSignatureRole,
  normalizeFormFieldAttrs,
} from '@/lib/tiptap/field-utils'
import type { FieldType, FormFieldAttrs, SignatureRole } from '@/types/database'

declare module '@tiptap/core' {
  interface Commands<ReturnType> {
    formField: {
      insertFormField: (attrs: Pick<FormFieldAttrs, 'fieldType'>) => ReturnType
    }
  }
}

function parseFieldType(value: unknown): FieldType {
  return isFieldType(value) ? value : 'text'
}

function parseString(value: unknown, fallback = ''): string {
  return typeof value === 'string' ? value : fallback
}

function parseOptions(value: unknown): string[] {
  if (Array.isArray(value)) {
    return value.filter((item): item is string => typeof item === 'string')
  }

  if (typeof value === 'string') {
    try {
      const parsed = JSON.parse(value)
      return Array.isArray(parsed)
        ? parsed.filter((item): item is string => typeof item === 'string')
        : []
    } catch {
      return []
    }
  }

  return []
}

export const FormFieldExtension = Node.create({
  name: 'formField',
  group: 'inline',
  inline: true,
  atom: true,
  selectable: true,
  draggable: false,

  addAttributes() {
    return {
      fieldId: {
        default: null,
        parseHTML: (element) => element.getAttribute('data-field-id'),
        renderHTML: (attrs) =>
          attrs.fieldId ? { 'data-field-id': attrs.fieldId } : {},
      },
      fieldType: {
        default: 'text' as FieldType,
        parseHTML: (element) => parseFieldType(element.getAttribute('data-field-type')),
        renderHTML: (attrs) => ({ 'data-field-type': attrs.fieldType }),
      },
      label: {
        default: '',
        parseHTML: (element) => parseString(element.getAttribute('data-label')),
        renderHTML: (attrs) => ({ 'data-label': attrs.label ?? '' }),
      },
      required: {
        default: false,
        parseHTML: (element) => element.getAttribute('data-required') === 'true',
        renderHTML: (attrs) => ({ 'data-required': String(Boolean(attrs.required)) }),
      },
      options: {
        default: [] as string[],
        parseHTML: (element) => parseOptions(element.getAttribute('data-options')),
        renderHTML: (attrs) => ({
          'data-options': JSON.stringify(attrs.options ?? []),
        }),
      },
      configured: {
        default: true,
        parseHTML: (element) => element.getAttribute('data-configured') !== 'false',
        renderHTML: (attrs) => ({
          'data-configured': String(attrs.configured !== false),
        }),
      },
      signatureRole: {
        default: null as SignatureRole | null,
        parseHTML: (element) => {
          const value = element.getAttribute('data-signature-role')
          return isSignatureRole(value) ? value : null
        },
        renderHTML: (attrs) =>
          attrs.signatureRole ? { 'data-signature-role': attrs.signatureRole } : {},
      },
    }
  },

  parseHTML() {
    return [{ tag: 'span[data-form-field]' }]
  },

  renderHTML({ HTMLAttributes }) {
    return ['span', mergeAttributes({ 'data-form-field': '' }, HTMLAttributes)]
  },

  addNodeView() {
    return ReactNodeViewRenderer(FormFieldNodeView)
  },

  addCommands() {
    return {
      insertFormField:
        (attrs) =>
        ({ chain, editor, state }) => {
          window.dispatchEvent(new CustomEvent('tiptap:close-field-popovers'))

          const fieldType = parseFieldType(attrs.fieldType)
          const fieldId = crypto.randomUUID()

          let defaultSignatureRole: SignatureRole | undefined
          if (fieldType === 'signature') {
            let signatureCount = 0
            state.doc.descendants((node) => {
              if (node.type.name === 'formField' && node.attrs.fieldType === 'signature') {
                signatureCount += 1
              }
            })
            defaultSignatureRole = signatureCount === 0 ? 'initiator' : 'approver'
          }

          const normalized = {
            ...normalizeFormFieldAttrs({
              fieldId,
              fieldType,
              label: getDefaultFieldLabel(fieldType),
              required: fieldType === 'signature',
              options: [],
              configured: false,
              signatureRole: defaultSignatureRole,
            }),
            configured: false,
          }

          let insertChain = chain().focus()

          // If the cursor is on an existing field chip, insert after it instead of replacing it.
          const { selection } = state
          if (
            selection instanceof NodeSelection &&
            selection.node.type.name === 'formField'
          ) {
            const posAfter = selection.from + selection.node.nodeSize
            insertChain = insertChain.setTextSelection(posAfter)
          }

          const inserted = insertChain
            .insertContent({
              type: 'formField',
              attrs: normalized,
            })
            .run()

          if (inserted) {
            requestAnimationFrame(() => {
              const { selection: nextSelection } = editor.state
              if (
                nextSelection instanceof NodeSelection &&
                nextSelection.node.type.name === 'formField'
              ) {
                const posAfter = nextSelection.from + nextSelection.node.nodeSize
                editor.chain().focus().setTextSelection(posAfter).scrollIntoView().run()
              } else {
                editor.chain().focus().scrollIntoView().run()
              }

              window.dispatchEvent(
                new CustomEvent('tiptap:open-field', { detail: { fieldId } })
              )
            })
          }

          return inserted
        },
    }
  },
})
