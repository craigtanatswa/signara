'use client'

import { NodeViewWrapper } from '@tiptap/react'
import type { NodeViewProps } from '@tiptap/react'
import { useCallback, useEffect, useRef, useState } from 'react'
import { DocumentFormFieldPreview } from '@/components/documents/document-form-field-preview'
import { FieldConfigPopover } from './field-config-popover'
import { demoteOtherInitiatorSignatures } from '@/lib/tiptap/field-utils'
import { cn } from '@/lib/utils'
import type { FormFieldAttrs } from '@/types/database'

export function FormFieldNodeView({ node, updateAttributes, deleteNode, selected, editor }: NodeViewProps) {
  const [popoverOpen, setPopoverOpen] = useState(false)
  const fieldRef = useRef<HTMLSpanElement>(null)
  const attrs = node.attrs as FormFieldAttrs
  const isConfigured = attrs.configured !== false

  const scrollFieldIntoView = useCallback(() => {
    requestAnimationFrame(() => {
      fieldRef.current?.scrollIntoView({ behavior: 'smooth', block: 'center', inline: 'nearest' })
    })
  }, [])

  function handlePopoverOpenChange(open: boolean) {
    setPopoverOpen(open)
  }

  const confirmUnconfiguredField = useCallback(() => {
    if (attrs.configured === false) {
      updateAttributes({
        configured: true,
      })
    }
  }, [attrs.configured, updateAttributes])

  useEffect(() => {
    const openHandler = (e: Event) => {
      const detail = (e as CustomEvent<{ fieldId: string }>).detail
      if (detail.fieldId === attrs.fieldId) {
        setPopoverOpen(true)
        scrollFieldIntoView()
      }
    }

    const closeHandler = () => {
      confirmUnconfiguredField()
      setPopoverOpen(false)
    }

    window.addEventListener('tiptap:open-field', openHandler)
    window.addEventListener('tiptap:close-field-popovers', closeHandler)
    return () => {
      window.removeEventListener('tiptap:open-field', openHandler)
      window.removeEventListener('tiptap:close-field-popovers', closeHandler)
    }
  }, [attrs.fieldId, confirmUnconfiguredField, scrollFieldIntoView])

  useEffect(() => {
    if (popoverOpen) {
      scrollFieldIntoView()
    }
  }, [popoverOpen, scrollFieldIntoView])

  function handleUpdate(updated: Partial<FormFieldAttrs>) {
    if (
      updated.signatureRole === 'initiator' &&
      attrs.fieldType === 'signature' &&
      editor
    ) {
      demoteOtherInitiatorSignatures(editor, attrs.fieldId)
    }
    updateAttributes(updated)
    scrollFieldIntoView()
  }

  return (
    <NodeViewWrapper
      as="span"
      className="inline-block align-middle"
      onDoubleClick={(e: React.MouseEvent) => {
        e.preventDefault()
        e.stopPropagation()
        setPopoverOpen(true)
      }}
    >
      <FieldConfigPopover
        attrs={attrs}
        open={popoverOpen}
        onOpenChange={handlePopoverOpenChange}
        onUpdate={handleUpdate}
        onDelete={deleteNode}
      >
        <span
          ref={fieldRef}
          role="button"
          tabIndex={0}
          className={cn(
            'relative inline-block cursor-pointer rounded-sm align-middle transition-shadow',
            'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-signara-navy focus-visible:ring-offset-1',
            !isConfigured && 'ring-2 ring-amber-400/70 ring-offset-1',
            isConfigured && selected && 'ring-2 ring-signara-navy/50 ring-offset-1',
            popoverOpen && 'ring-2 ring-signara-gold ring-offset-1'
          )}
          title={isConfigured ? 'Click to configure field' : 'Configure this field'}
          onClick={(e) => {
            e.preventDefault()
            e.stopPropagation()
            setPopoverOpen(true)
          }}
          onKeyDown={(e) => {
            if (e.key === 'Enter' || e.key === ' ') {
              e.preventDefault()
              setPopoverOpen(true)
            }
          }}
        >
          <span className="pointer-events-none select-none">
            <DocumentFormFieldPreview attrs={attrs} />
          </span>
          {!isConfigured && (
            <span className="pointer-events-none absolute -top-2 right-0 rounded-full bg-amber-500 px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-white shadow-sm">
              Setup
            </span>
          )}
        </span>
      </FieldConfigPopover>
    </NodeViewWrapper>
  )
}
