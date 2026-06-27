'use client'

import { useEditor, EditorContent } from '@tiptap/react'
import { StarterKit } from '@tiptap/starter-kit'
import { Placeholder } from '@tiptap/extension-placeholder'
import { TextStyle } from '@tiptap/extension-text-style'
import { Color } from '@tiptap/extension-color'
import { Table } from '@tiptap/extension-table'
import { TableRow } from '@tiptap/extension-table-row'
import { TableCell } from '@tiptap/extension-table-cell'
import { TableHeader } from '@tiptap/extension-table-header'
import { FormFieldExtension } from '@/lib/tiptap/field-extension'
import { PageFlow } from '@/lib/tiptap/page-flow-plugin'
import { DEFAULT_TEMPLATE_TEXT_COLOR, normalizeTemplateContent } from '@/lib/tiptap/field-utils'
import {
  A4_PAGE_GAP_PX,
  A4_PAGE_HEIGHT_PX,
  A4_PAGE_PADDING_X_PX,
  A4_PAGE_PADDING_Y_PX,
  A4_PAGE_WIDTH_PX,
  ORG_LOGO_BLOCK_HEIGHT_PX,
} from '@/lib/tiptap/a4-layout'
import { TemplateToolbar } from './template-toolbar'
import {
  TemplatePageCountBadge,
  TemplatePageGuide,
} from './template-page-guide'
import {
  TemplatePageBackgrounds,
  TemplatePageLogos,
} from './template-document-branding'
import type { OrganisationBranding, TiptapDocument } from '@/types/database'
import { useEffect, useRef, useState } from 'react'

interface TemplateEditorProps {
  initialContent: TiptapDocument | null
  defaultTextColor?: string
  organisationBranding?: OrganisationBranding | null
  onChange?: (content: TiptapDocument) => void
  editable?: boolean
}

export function TemplateEditor({
  initialContent,
  defaultTextColor = DEFAULT_TEMPLATE_TEXT_COLOR,
  organisationBranding,
  onChange,
  editable = true,
}: TemplateEditorProps) {
  const logoUrl = organisationBranding?.logoUrl ?? null
  const letterheadUrl = organisationBranding?.letterheadUrl ?? null
  const hasLetterhead = Boolean(letterheadUrl)
  const hasLogo = Boolean(logoUrl)
  const canvasRef = useRef<HTMLDivElement>(null)
  const [contentHeightPx, setContentHeightPx] = useState(A4_PAGE_HEIGHT_PX)

  const editor = useEditor(
    {
      extensions: [
        StarterKit.configure({
          heading: { levels: [1, 2, 3] },
        }),
        TextStyle,
        Color.configure({ types: ['textStyle'] }),
        Placeholder.configure({
          placeholder: 'Start typing your document, or insert a field from the toolbar above…',
        }),
        Table.configure({ resizable: true }),
        TableRow,
        TableHeader,
        TableCell,
        FormFieldExtension,
        PageFlow.configure({ hasLogo }),
      ],
      content: normalizeTemplateContent(initialContent) ?? undefined,
      editable,
      editorProps: {
        attributes: {
          class: 'tiptap prose prose-signara max-w-none focus:outline-none',
        },
      },
      onUpdate({ editor }) {
        const normalized = normalizeTemplateContent(editor.getJSON() as TiptapDocument)
        if (normalized) onChange?.(normalized)
      },
      immediatelyRender: false,
    },
    [hasLogo]
  )

  useEffect(() => {
    if (!editor) return
    if (editable !== editor.isEditable) {
      editor.setEditable(editable)
    }
  }, [editor, editable])

  useEffect(() => {
    if (!editor || !canvasRef.current) return

    const measure = () => {
      const pageContent = canvasRef.current?.querySelector('.template-page-content')
      const proseMirror = canvasRef.current?.querySelector('.tiptap')
      const measured =
        pageContent instanceof HTMLElement
          ? pageContent.scrollHeight
          : proseMirror instanceof HTMLElement
            ? proseMirror.scrollHeight
            : A4_PAGE_HEIGHT_PX
      setContentHeightPx(Math.max(measured, A4_PAGE_HEIGHT_PX))
    }

    measure()

    const pageContent = canvasRef.current.querySelector('.template-page-content')
    const proseMirror = canvasRef.current.querySelector('.tiptap')
    const observeTarget =
      pageContent instanceof HTMLElement
        ? pageContent
        : proseMirror instanceof HTMLElement
          ? proseMirror
          : null

    if (!observeTarget) return

    const resizeObserver = new ResizeObserver(measure)
    resizeObserver.observe(observeTarget)

    editor.on('update', measure)

    return () => {
      resizeObserver.disconnect()
      editor.off('update', measure)
    }
  }, [editor])

  if (!editor) return null

  return (
    <div className="flex flex-col">
      {editable && <TemplateToolbar editor={editor} defaultTextColor={defaultTextColor} />}

      <div
        className="rounded-b-lg border border-t-0 border-signara-steel/30 bg-[#dde1e6] py-6"
        onClick={() => editor.commands.focus()}
      >
        <div
          ref={canvasRef}
          className="relative mx-auto shadow-md"
          style={{ width: A4_PAGE_WIDTH_PX }}
        >
          <TemplatePageBackgrounds
            letterheadUrl={letterheadUrl}
            contentHeightPx={contentHeightPx}
          />
          <TemplatePageLogos logoUrl={logoUrl} contentHeightPx={contentHeightPx} />
          <TemplatePageGuide contentHeightPx={contentHeightPx} />
          <div
            className={`template-page-content relative z-[1] ${hasLetterhead ? 'bg-transparent' : ''}`}
          >
            <EditorContent editor={editor} />
          </div>
        </div>
        <TemplatePageCountBadge contentHeightPx={contentHeightPx} />
      </div>

      <style>{`
        .template-page-content {
          background-color: ${hasLetterhead ? 'transparent' : '#ffffff'};
          background-image: ${
            hasLetterhead
              ? 'none'
              : `repeating-linear-gradient(
            to bottom,
            #ffffff 0px,
            #ffffff ${A4_PAGE_HEIGHT_PX}px,
            #dde1e6 ${A4_PAGE_HEIGHT_PX}px,
            #dde1e6 ${A4_PAGE_HEIGHT_PX + A4_PAGE_GAP_PX}px
          )`
          };
          background-size: 100% ${A4_PAGE_HEIGHT_PX + A4_PAGE_GAP_PX}px;
        }

        .tiptap {
          position: relative;
          z-index: 1;
          min-height: ${A4_PAGE_HEIGHT_PX}px;
          padding: ${hasLogo ? ORG_LOGO_BLOCK_HEIGHT_PX : A4_PAGE_PADDING_Y_PX}px ${A4_PAGE_PADDING_X_PX}px ${A4_PAGE_PADDING_Y_PX}px;
          color: ${defaultTextColor};
          background-color: transparent;
          display: flex;
          flex-direction: column;
        }

        .template-page-flow-spacer {
          display: block;
          width: 100%;
          margin: 0;
          padding: 0;
          border: 0;
          background: transparent;
          flex-shrink: 0;
        }

        .tiptap p.is-editor-empty:first-child::before {
          color: #a1a8a2;
          content: attr(data-placeholder);
          float: left;
          height: 0;
          pointer-events: none;
        }

        .tiptap table {
          border-collapse: collapse;
          width: 100%;
          margin: 1em 0;
          table-layout: fixed;
        }

        .tiptap td,
        .tiptap th {
          border: 1px solid #a1a8a2;
          padding: 6px 12px;
          min-width: 80px;
          vertical-align: top;
        }

        .tiptap th {
          background-color: #f8f9fa;
          font-weight: 600;
          color: #0f2c59;
        }

        .tiptap .selectedCell::after {
          background: rgba(212, 175, 55, 0.1);
          content: '';
          left: 0;
          right: 0;
          top: 0;
          bottom: 0;
          pointer-events: none;
          position: absolute;
          z-index: 2;
        }

        .tiptap h1 {
          font-size: 1.75rem;
          font-weight: 700;
          margin-top: 1.5rem;
          margin-bottom: 0.5rem;
          line-height: 1.2;
        }

        .tiptap h2 {
          font-size: 1.375rem;
          font-weight: 600;
          margin-top: 1.25rem;
          margin-bottom: 0.375rem;
          line-height: 1.3;
        }

        .tiptap p {
          margin-bottom: 0.75rem;
          line-height: 1.7;
        }

        .tiptap ul,
        .tiptap ol {
          padding-left: 1.5rem;
          margin-bottom: 0.75rem;
        }

        .tiptap li {
          margin-bottom: 0.25rem;
        }

        .tiptap hr {
          border: none;
          border-top: 1px solid #a1a8a2;
          margin: 1.5rem 0;
        }
      `}</style>
    </div>
  )
}
