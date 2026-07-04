'use client'

import { useEditor, EditorContent } from '@tiptap/react'
import { StarterKit } from '@tiptap/starter-kit'
import { Placeholder } from '@tiptap/extension-placeholder'
import { TextStyle } from '@tiptap/extension-text-style'
import { Color } from '@tiptap/extension-color'
import { FontFamily } from '@tiptap/extension-font-family'
import { Highlight } from '@tiptap/extension-highlight'
import { TextAlign } from '@tiptap/extension-text-align'
import { Table } from '@tiptap/extension-table'
import { TableRow } from '@tiptap/extension-table-row'
import { TableCell } from '@tiptap/extension-table-cell'
import { TableHeader } from '@tiptap/extension-table-header'
import { FormFieldExtension } from '@/lib/tiptap/field-extension'
import { FontSize, ParagraphFormatting, TabIndent } from '@/lib/tiptap/formatting-extensions'
import { PageFlow } from '@/lib/tiptap/page-flow-plugin'
import { DEFAULT_TEMPLATE_TEXT_COLOR, normalizeTemplateContent } from '@/lib/tiptap/field-utils'
import {
  getCanvasHeightPx,
  getPageLayout,
  hasLetterheadForOrientation,
  resolveLetterheadUrl,
} from '@/lib/tiptap/page-size'
import { DEFAULT_TEMPLATE_FONT_SIZE_PT } from '@/lib/tiptap/font-size'
import { TemplateToolbar } from './template-toolbar'
import {
  TemplatePageCountBadge,
  TemplatePageGuide,
} from './template-page-guide'
import {
  TemplatePageBackgrounds,
  TemplatePageLogos,
} from './template-document-branding'
import type { OrganisationBranding, PageOrientation, TiptapDocument } from '@/types/database'
import {
  forwardRef,
  useEffect,
  useImperativeHandle,
  useMemo,
  useRef,
  useState,
} from 'react'

interface TemplateEditorProps {
  initialContent: TiptapDocument | null
  defaultTextColor?: string
  organisationBranding?: OrganisationBranding | null
  useOrganisationLogo?: boolean
  useOrganisationLetterhead?: boolean
  pageOrientation?: PageOrientation
  onUseOrganisationLogoChange?: (checked: boolean) => void
  onUseOrganisationLetterheadChange?: (checked: boolean) => void
  onChange?: (content: TiptapDocument) => void
  onDirty?: () => void
  editable?: boolean
}

export interface TemplateEditorHandle {
  getContent: () => TiptapDocument | null
}

export const TemplateEditor = forwardRef<TemplateEditorHandle, TemplateEditorProps>(function TemplateEditor({
  initialContent,
  defaultTextColor = DEFAULT_TEMPLATE_TEXT_COLOR,
  organisationBranding,
  useOrganisationLogo = false,
  useOrganisationLetterhead = false,
  pageOrientation = 'portrait',
  onUseOrganisationLogoChange,
  onUseOrganisationLetterheadChange,
  onChange,
  onDirty,
  editable = true,
}: TemplateEditorProps, ref) {
  const layout = useMemo(() => getPageLayout(pageOrientation), [pageOrientation])
  const logoUrl = useOrganisationLogo ? organisationBranding?.logoUrl ?? null : null
  const letterheadUrl = useOrganisationLetterhead
    ? resolveLetterheadUrl(organisationBranding, pageOrientation)
    : null
  const hasLetterhead = Boolean(letterheadUrl)
  const hasLogo = Boolean(logoUrl)
  const logoAvailable = Boolean(organisationBranding?.logoUrl)
  const letterheadAvailable = hasLetterheadForOrientation(organisationBranding, pageOrientation)
  const canvasRef = useRef<HTMLDivElement>(null)
  const onChangeRef = useRef(onChange)
  const onDirtyRef = useRef(onDirty)
  const debounceTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const [contentHeightPx, setContentHeightPx] = useState(layout.heightPx)

  useEffect(() => {
    onChangeRef.current = onChange
  }, [onChange])

  useEffect(() => {
    onDirtyRef.current = onDirty
  }, [onDirty])

  const editor = useEditor(
    {
      extensions: [
        StarterKit.configure({
          heading: { levels: [1, 2, 3] },
        }),
        TextStyle,
        Color.configure({ types: ['textStyle'] }),
        FontFamily.configure({ types: ['textStyle'] }),
        FontSize,
        Highlight.configure({ multicolor: true }),
        TextAlign.configure({ types: ['heading', 'paragraph'] }),
        Placeholder.configure({
          placeholder: 'Start typing your document, or insert a field from the toolbar above…',
        }),
        Table.configure({ resizable: true }),
        TableRow,
        TableHeader,
        TableCell,
        FormFieldExtension,
        ParagraphFormatting,
        TabIndent,
        PageFlow.configure({ hasLogo, pageOrientation }),
      ],
      content: normalizeTemplateContent(initialContent) ?? undefined,
      editable,
      editorProps: {
        attributes: {
          class: 'tiptap prose prose-signara max-w-none focus:outline-none',
        },
      },
      onUpdate({ editor }) {
        onDirtyRef.current?.()
        if (debounceTimerRef.current) {
          clearTimeout(debounceTimerRef.current)
        }
        debounceTimerRef.current = setTimeout(() => {
          onChangeRef.current?.(editor.getJSON() as TiptapDocument)
        }, 250)
      },
      immediatelyRender: false,
    },
    []
  )

  useImperativeHandle(
    ref,
    () => ({
      getContent: () => (editor ? (editor.getJSON() as TiptapDocument) : null),
    }),
    [editor]
  )

  useEffect(() => {
    return () => {
      if (debounceTimerRef.current) {
        clearTimeout(debounceTimerRef.current)
      }
    }
  }, [])

  useEffect(() => {
    if (!editor) return
    if (editable !== editor.isEditable) {
      editor.setEditable(editable)
    }
  }, [editor, editable])

  useEffect(() => {
    if (!editor || !canvasRef.current) return

    const getTiptap = () =>
      canvasRef.current?.querySelector<HTMLElement>('.tiptap') ?? null

    let frame = 0

    const measure = () => {
      const tiptap = getTiptap()
      const measured = tiptap ? tiptap.scrollHeight : layout.heightPx
      const nextHeight = Math.max(measured, layout.heightPx)
      setContentHeightPx((current) => (Math.abs(current - nextHeight) > 1 ? nextHeight : current))
    }

    const scheduleMeasure = () => {
      cancelAnimationFrame(frame)
      frame = requestAnimationFrame(measure)
    }

    measure()

    const tiptap = getTiptap()
    if (!tiptap) return

    const resizeObserver = new ResizeObserver(measure)
    resizeObserver.observe(tiptap)

    editor.on('update', scheduleMeasure)

    return () => {
      cancelAnimationFrame(frame)
      resizeObserver.disconnect()
      editor.off('update', scheduleMeasure)
    }
  }, [editor, layout.heightPx])

  if (!editor) return null

  const canvasHeightPx = getCanvasHeightPx(contentHeightPx, layout)

  return (
    <div className="flex flex-col">
      {editable && (
        <TemplateToolbar
          editor={editor}
          defaultTextColor={defaultTextColor}
          useOrganisationLogo={useOrganisationLogo}
          useOrganisationLetterhead={useOrganisationLetterhead}
          logoAvailable={logoAvailable}
          letterheadAvailable={letterheadAvailable}
          pageOrientation={pageOrientation}
          onUseOrganisationLogoChange={onUseOrganisationLogoChange}
          onUseOrganisationLetterheadChange={onUseOrganisationLetterheadChange}
        />
      )}

      <div
        className="rounded-b-lg border border-t-0 border-signara-steel/30 bg-[#dde1e6] py-6"
        onClick={() => editor.commands.focus()}
      >
        <div
          ref={canvasRef}
          className="relative mx-auto shadow-md"
          style={{ width: layout.widthPx, minHeight: canvasHeightPx }}
        >
          <TemplatePageBackgrounds
            letterheadUrl={letterheadUrl}
            contentHeightPx={contentHeightPx}
            layout={layout}
          />
          <TemplatePageLogos
            logoUrl={logoUrl}
            contentHeightPx={contentHeightPx}
            layout={layout}
          />
          <TemplatePageGuide contentHeightPx={contentHeightPx} layout={layout} />
          <div
            className={`template-page-content relative z-[1] ${hasLetterhead ? 'bg-transparent' : ''}`}
            data-has-logo={hasLogo ? 'true' : 'false'}
            data-page-orientation={pageOrientation}
            style={{ minHeight: canvasHeightPx }}
          >
            <EditorContent editor={editor} />
          </div>
        </div>
        <TemplatePageCountBadge contentHeightPx={contentHeightPx} layout={layout} />
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
            #ffffff ${layout.heightPx}px,
            #dde1e6 ${layout.heightPx}px,
            #dde1e6 ${layout.heightPx + layout.pageGapPx}px
          )`
          };
          background-size: 100% ${layout.heightPx + layout.pageGapPx}px;
        }

        .tiptap {
          position: relative;
          z-index: 1;
          min-height: ${layout.heightPx}px;
          padding: ${hasLogo ? layout.logoBlockHeightPx : layout.paddingYPx}px ${layout.paddingXPx}px ${layout.paddingYPx}px;
          color: ${defaultTextColor};
          font-size: ${DEFAULT_TEMPLATE_FONT_SIZE_PT};
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
          color: var(--signara-brand);
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
          font-size: 20pt;
          font-weight: 700;
          margin-top: 1.5rem;
          margin-bottom: 0.5rem;
          line-height: 1.2;
        }

        .tiptap h2 {
          font-size: 15pt;
          font-weight: 600;
          margin-top: 1.25rem;
          margin-bottom: 0.375rem;
          line-height: 1.3;
        }

        .tiptap h3 {
          font-size: 13pt;
          font-weight: 600;
          margin-top: 1rem;
          margin-bottom: 0.25rem;
          line-height: 1.35;
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

        .tiptap ul {
          list-style-type: disc;
        }

        .tiptap ol {
          list-style-type: decimal;
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
})
