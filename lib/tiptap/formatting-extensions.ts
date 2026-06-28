import { Extension } from '@tiptap/core'
import type { Node as ProseMirrorNode } from '@tiptap/pm/model'
import type { Transaction } from '@tiptap/pm/state'
import { normalizeFontSize } from '@/lib/tiptap/font-size'

const INDENT_STEP_PX = 24
const MAX_INDENT_LEVEL = 12

declare module '@tiptap/core' {
  interface Commands<ReturnType> {
    fontSize: {
      setFontSize: (fontSize: string) => ReturnType
      unsetFontSize: () => ReturnType
    }
    paragraphFormatting: {
      increaseIndent: () => ReturnType
      decreaseIndent: () => ReturnType
      setLineHeight: (lineHeight: string) => ReturnType
      setParagraphSpacing: (spacing: string) => ReturnType
    }
  }
}

export const FontSize = Extension.create({
  name: 'fontSize',

  addGlobalAttributes() {
    return [
      {
        types: ['textStyle'],
        attributes: {
          fontSize: {
            default: null,
            parseHTML: (element) => normalizeFontSize(element.style.fontSize),
            renderHTML: (attributes) => {
              if (!attributes.fontSize) return {}
              return { style: `font-size: ${attributes.fontSize}` }
            },
          },
        },
      },
    ]
  },

  addCommands() {
    return {
      setFontSize:
        (fontSize) =>
        ({ chain }) => {
          const normalized = normalizeFontSize(fontSize) ?? fontSize
          return chain().setMark('textStyle', { fontSize: normalized }).run()
        },
      unsetFontSize:
        () =>
        ({ chain }) =>
          chain().setMark('textStyle', { fontSize: null }).removeEmptyTextStyle().run(),
    }
  },
})

function parseIndent(value: unknown): number {
  return typeof value === 'number' && Number.isFinite(value)
    ? Math.max(0, Math.min(MAX_INDENT_LEVEL, value))
    : 0
}

function updateSelectedBlocks(
  tr: Transaction,
  from: number,
  to: number,
  updater: (attrs: Record<string, unknown>) => Record<string, unknown>
) {
  tr.doc.nodesBetween(from, to, (node: ProseMirrorNode, pos: number) => {
    if (!['paragraph', 'heading', 'listItem'].includes(node.type.name)) return
    tr.setNodeMarkup(pos, undefined, updater(node.attrs))
  })
}

export const ParagraphFormatting = Extension.create({
  name: 'paragraphFormatting',

  addGlobalAttributes() {
    return [
      {
        types: ['paragraph', 'heading', 'listItem'],
        attributes: {
          indent: {
            default: 0,
            parseHTML: (element) => {
              const marginLeft = Number.parseFloat(element.style.marginLeft)
              return Number.isFinite(marginLeft) ? Math.round(marginLeft / INDENT_STEP_PX) : 0
            },
            renderHTML: (attributes) => {
              const indent = parseIndent(attributes.indent)
              if (!indent) return {}
              return { style: `margin-left: ${indent * INDENT_STEP_PX}px` }
            },
          },
          lineHeight: {
            default: null,
            parseHTML: (element) => element.style.lineHeight || null,
            renderHTML: (attributes) =>
              attributes.lineHeight ? { style: `line-height: ${attributes.lineHeight}` } : {},
          },
          paragraphSpacing: {
            default: null,
            parseHTML: (element) => element.style.marginBottom || null,
            renderHTML: (attributes) =>
              attributes.paragraphSpacing
                ? { style: `margin-bottom: ${attributes.paragraphSpacing}` }
                : {},
          },
        },
      },
    ]
  },

  addCommands() {
    return {
      increaseIndent:
        () =>
        ({ state, dispatch }) => {
          const tr = state.tr
          updateSelectedBlocks(tr, state.selection.from, state.selection.to, (attrs) => ({
            ...attrs,
            indent: Math.min(MAX_INDENT_LEVEL, parseIndent(attrs.indent) + 1),
          }))
          dispatch?.(tr)
          return true
        },
      decreaseIndent:
        () =>
        ({ state, dispatch }) => {
          const tr = state.tr
          updateSelectedBlocks(tr, state.selection.from, state.selection.to, (attrs) => ({
            ...attrs,
            indent: Math.max(0, parseIndent(attrs.indent) - 1),
          }))
          dispatch?.(tr)
          return true
        },
      setLineHeight:
        (lineHeight) =>
        ({ state, dispatch }) => {
          const tr = state.tr
          updateSelectedBlocks(tr, state.selection.from, state.selection.to, (attrs) => ({
            ...attrs,
            lineHeight,
          }))
          dispatch?.(tr)
          return true
        },
      setParagraphSpacing:
        (spacing) =>
        ({ state, dispatch }) => {
          const tr = state.tr
          updateSelectedBlocks(tr, state.selection.from, state.selection.to, (attrs) => ({
            ...attrs,
            paragraphSpacing: spacing,
          }))
          dispatch?.(tr)
          return true
        },
    }
  },
})

export const TabIndent = Extension.create({
  name: 'tabIndent',

  addKeyboardShortcuts() {
    return {
      Tab: ({ editor }) => {
        if (editor.can().sinkListItem('listItem')) {
          return editor.chain().sinkListItem('listItem').run()
        }
        return editor.commands.increaseIndent()
      },
      'Shift-Tab': ({ editor }) => {
        if (editor.can().liftListItem('listItem')) {
          return editor.chain().liftListItem('listItem').run()
        }
        return editor.commands.decreaseIndent()
      },
    }
  },
})
