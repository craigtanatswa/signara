'use client'

import { useEffect, useMemo, useRef, useState, type CSSProperties, type ReactNode } from 'react'
import {
  TemplatePageBackgrounds,
  TemplatePageLogos,
} from '@/components/templates/template-document-branding'
import { DocumentFormFieldPreview } from '@/components/documents/document-form-field-preview'
import {
  getTemplatePageOrientation,
  getTemplateTextColor,
  getTemplateUsesOrganisationLetterhead,
  getTemplateUsesOrganisationLogo,
  normalizeFormFieldAttrs,
} from '@/lib/tiptap/field-utils'
import { DEFAULT_TEMPLATE_FONT_SIZE_PT } from '@/lib/tiptap/font-size'
import {
  getCanvasHeightPx,
  getPageLayout,
  resolveLetterheadUrl,
} from '@/lib/tiptap/page-size'
import type {
  FormFieldAttrs,
  OrganisationBranding,
  TiptapDocument,
  TiptapMark,
  TiptapNode,
} from '@/types/database'

interface DocumentContentViewProps {
  content: TiptapDocument | null
  organisationBranding?: OrganisationBranding | null
  /** Interactive fields for initiation; omit to show disabled document-style controls. */
  renderField?: (attrs: FormFieldAttrs) => ReactNode
  className?: string
}

/**
 * Branded A4 document canvas shared by the initiation fill-details step and the
 * admin "preview as document" view — letterhead, logo, and page layout match
 * the template editor.
 */
export function DocumentContentView({
  content,
  organisationBranding = null,
  renderField,
  className,
}: DocumentContentViewProps) {
  const pageOrientation = getTemplatePageOrientation(content)
  const layout = useMemo(() => getPageLayout(pageOrientation), [pageOrientation])
  const useLogo = getTemplateUsesOrganisationLogo(content)
  const useLetterhead = getTemplateUsesOrganisationLetterhead(content)
  const logoUrl = useLogo ? organisationBranding?.logoUrl ?? null : null
  const letterheadUrl = useLetterhead
    ? resolveLetterheadUrl(organisationBranding, pageOrientation)
    : null
  const hasLetterhead = Boolean(letterheadUrl)
  const hasLogo = Boolean(logoUrl)
  const textColor = getTemplateTextColor(content)

  const contentRef = useRef<HTMLDivElement>(null)
  const [contentHeightPx, setContentHeightPx] = useState(layout.heightPx)

  useEffect(() => {
    const node = contentRef.current
    if (!node) return

    const measure = () => {
      const nextHeight = Math.max(node.scrollHeight, layout.heightPx)
      setContentHeightPx((current) => (Math.abs(current - nextHeight) > 1 ? nextHeight : current))
    }

    measure()
    const observer = new ResizeObserver(measure)
    observer.observe(node)
    return () => observer.disconnect()
  }, [layout.heightPx, content])

  const canvasHeightPx = getCanvasHeightPx(contentHeightPx, layout)
  const hasContent = Boolean(content?.content?.length)

  const fieldRenderer =
    renderField ??
    ((attrs: FormFieldAttrs) => <DocumentFormFieldPreview attrs={attrs} />)

  return (
    <div className={className ?? 'overflow-x-auto rounded-lg border border-signara-steel/30 bg-[#dde1e6] py-6'}>
      <div
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
        <div
          ref={contentRef}
          className="relative z-[1] leading-relaxed"
          style={{
            minHeight: canvasHeightPx,
            paddingTop: hasLogo ? layout.logoBlockHeightPx : layout.paddingYPx,
            paddingBottom: layout.paddingYPx,
            paddingLeft: layout.paddingXPx,
            paddingRight: layout.paddingXPx,
            color: textColor,
            fontSize: DEFAULT_TEMPLATE_FONT_SIZE_PT,
            backgroundColor: hasLetterhead ? 'transparent' : '#ffffff',
            backgroundImage: hasLetterhead
              ? 'none'
              : `repeating-linear-gradient(
                  to bottom,
                  #ffffff 0px,
                  #ffffff ${layout.heightPx}px,
                  #dde1e6 ${layout.heightPx}px,
                  #dde1e6 ${layout.heightPx + layout.pageGapPx}px
                )`,
            backgroundSize: `100% ${layout.heightPx + layout.pageGapPx}px`,
          }}
        >
          {hasContent ? (
            renderBlocks(content?.content, fieldRenderer, 'root')
          ) : (
            <p className="text-sm text-signara-steel">This template has no content.</p>
          )}
        </div>
      </div>
    </div>
  )
}

function getMarkStyle(marks: TiptapMark[] | undefined): { className: string; style: CSSProperties } {
  const types = new Set((marks ?? []).map((mark) => mark.type))
  const classes: string[] = []
  if (types.has('bold')) classes.push('font-bold')
  if (types.has('italic')) classes.push('italic')
  if (types.has('underline')) classes.push('underline')
  if (types.has('strike')) classes.push('line-through')

  const style: CSSProperties = {}
  const textStyle = marks?.find((mark) => mark.type === 'textStyle')
  if (typeof textStyle?.attrs?.color === 'string') style.color = textStyle.attrs.color
  if (typeof textStyle?.attrs?.fontSize === 'string') style.fontSize = textStyle.attrs.fontSize
  if (typeof textStyle?.attrs?.fontFamily === 'string') style.fontFamily = textStyle.attrs.fontFamily

  const highlight = marks?.find((mark) => mark.type === 'highlight')
  if (typeof highlight?.attrs?.color === 'string') style.backgroundColor = highlight.attrs.color

  return { className: classes.join(' '), style }
}

function renderInline(
  nodes: TiptapNode[] | undefined,
  renderField: (attrs: FormFieldAttrs) => ReactNode,
  keyPrefix: string
): ReactNode {
  if (!nodes?.length) return null

  return nodes.map((node, index) => {
    const key = `${keyPrefix}-i-${index}`

    if (node.type === 'text') {
      const { className, style } = getMarkStyle(node.marks)
      return (
        <span key={key} className={className || undefined} style={style}>
          {node.text}
        </span>
      )
    }

    if (node.type === 'hardBreak') {
      return <br key={key} />
    }

    if (node.type === 'formField') {
      // Use a div so block-level field UIs (e.g. SignaturePad) are valid HTML.
      return <div key={key} className="inline-block align-middle">{renderField(normalizeFormFieldAttrs(node.attrs))}</div>
    }

    return null
  })
}

function paragraphContainsFormField(nodes: TiptapNode[] | undefined): boolean {
  return Boolean(nodes?.some((node) => node.type === 'formField'))
}

function renderBlocks(
  nodes: TiptapNode[] | undefined,
  renderField: (attrs: FormFieldAttrs) => ReactNode,
  keyPrefix: string
): ReactNode {
  if (!nodes?.length) return null

  return nodes.map((node, index) => {
    const key = `${keyPrefix}-b-${index}`

    switch (node.type) {
      case 'heading': {
        const level = (node.attrs?.level as number) ?? 1
        const sizeClass =
          level === 1 ? 'text-2xl font-bold' : level === 2 ? 'text-xl font-semibold' : 'text-lg font-semibold'
        // Headings cannot contain block-level field UIs; use a div when a form field is present.
        if (paragraphContainsFormField(node.content)) {
          return (
            <div key={key} className={`mt-4 mb-2 text-signara-navy ${sizeClass}`}>
              {renderInline(node.content, renderField, key)}
            </div>
          )
        }
        const HeadingTag = level === 1 ? 'h1' : level === 2 ? 'h2' : 'h3'
        return (
          <HeadingTag key={key} className={`mt-4 mb-2 text-signara-navy ${sizeClass}`}>
            {renderInline(node.content, renderField, key)}
          </HeadingTag>
        )
      }
      case 'paragraph':
        // Always use a div: paragraphs may contain SignaturePad / form controls with nested <div>/<p>.
        return (
          <div key={key} className="mb-3">
            {renderInline(node.content, renderField, key) ?? '\u00A0'}
          </div>
        )
      case 'bulletList':
        return (
          <ul key={key} className="mb-3 ml-5 list-disc space-y-1">
            {(node.content ?? []).map((item, itemIndex) => (
              <li key={itemIndex}>{renderBlocks(item.content, renderField, `${key}-li-${itemIndex}`)}</li>
            ))}
          </ul>
        )
      case 'orderedList':
        return (
          <ol key={key} className="mb-3 ml-5 list-decimal space-y-1">
            {(node.content ?? []).map((item, itemIndex) => (
              <li key={itemIndex}>{renderBlocks(item.content, renderField, `${key}-li-${itemIndex}`)}</li>
            ))}
          </ol>
        )
      case 'horizontalRule':
        return <hr key={key} className="my-4 border-signara-steel/30" />
      case 'blockquote':
        return (
          <blockquote key={key} className="my-3 border-l-2 border-signara-gold pl-4 text-signara-steel">
            {renderBlocks(node.content, renderField, key)}
          </blockquote>
        )
      case 'table':
        return (
          <table key={key} className="my-3 w-full border border-signara-steel/30 text-sm">
            <tbody>
              {(node.content ?? []).map((row, rowIndex) => (
                <tr key={rowIndex} className="border-b border-signara-steel/20">
                  {(row.content ?? []).map((cell, cellIndex) => {
                    const isHeader = cell.type === 'tableHeader'
                    const CellTag = isHeader ? 'th' : 'td'
                    return (
                      <CellTag
                        key={cellIndex}
                        className={`border-r border-signara-steel/20 p-2 text-left ${isHeader ? 'bg-signara-background font-semibold' : ''}`}
                      >
                        {renderBlocks(cell.content, renderField, `${key}-c-${rowIndex}-${cellIndex}`)}
                      </CellTag>
                    )
                  })}
                </tr>
              ))}
            </tbody>
          </table>
        )
      default:
        return node.content?.length ? (
          <div key={key}>{renderBlocks(node.content, renderField, key)}</div>
        ) : null
    }
  })
}
