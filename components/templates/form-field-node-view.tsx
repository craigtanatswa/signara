'use client'

import { NodeViewWrapper } from '@tiptap/react'
import type { NodeViewProps } from '@tiptap/react'
import { useCallback, useEffect, useRef, useState } from 'react'
import { FieldConfigPopover } from './field-config-popover'
import { getFieldDisplayLabel, demoteOtherInitiatorSignatures } from '@/lib/tiptap/field-utils'
import type { FieldType, FormFieldAttrs } from '@/types/database'

const FIELD_ICONS: Record<FieldType, string> = {
  text: '✏️',
  number: '🔢',
  date: '📅',
  dropdown: '📋',
  checkbox: '☑️',
  file: '📎',
  signature: '✍️',
}

export function FormFieldNodeView({ node, updateAttributes, deleteNode, selected, editor }: NodeViewProps) {
  const [popoverOpen, setPopoverOpen] = useState(false)
  const fieldRef = useRef<HTMLSpanElement>(null)
  const attrs = node.attrs as FormFieldAttrs
  const displayLabel = getFieldDisplayLabel(attrs)
  const isConfigured = attrs.configured !== false
  const icon = FIELD_ICONS[attrs.fieldType] ?? '📝'

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
        label: getFieldDisplayLabel(attrs),
        configured: true,
      })
    }
  }, [attrs, updateAttributes])

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
      className="inline-block"
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
          className={`
            inline-flex cursor-pointer select-none items-center gap-1.5 rounded-full
            border border-dashed px-2.5 py-0.5 text-xs font-medium transition-colors
            ${!isConfigured
              ? 'border-amber-400 bg-amber-50 text-amber-900'
              : selected
                ? 'border-signara-navy bg-signara-navy/10 text-signara-navy'
                : 'border-signara-gold/60 bg-signara-gold/10 text-signara-navy hover:bg-signara-gold/20'
            }
          `}
          title={isConfigured ? 'Double-click to configure' : 'Click to configure this field'}
        >
          <span>{icon}</span>
          <span>{displayLabel}</span>
          {attrs.required && (
            <span className="text-red-500" aria-label="Required">
              *
            </span>
          )}
          {!isConfigured && (
            <span className="text-[10px] uppercase tracking-wide text-amber-700">Setup</span>
          )}
        </span>
      </FieldConfigPopover>
    </NodeViewWrapper>
  )
}
