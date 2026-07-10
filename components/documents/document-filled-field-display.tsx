'use client'

import type { ReactNode } from 'react'
import { getFieldDisplayLabel } from '@/lib/tiptap/field-utils'
import { formatPreviewFileLabel } from '@/lib/documents/build-preview-context'
import { Checkbox } from '@/components/ui/checkbox'
import { Label } from '@/components/ui/label'
import type { FormFieldAttrs } from '@/types/database'

interface DocumentFilledFieldDisplayProps {
  attrs: FormFieldAttrs
  value: unknown
  signatureDataUrl?: string | null
  fileUrl?: string | null
}

function ReadOnlyValue({ children }: { children: ReactNode }) {
  return (
    <span className="inline-block min-w-[8rem] rounded-md border border-signara-steel/40 bg-white/90 px-2.5 py-1.5 text-sm text-signara-navy">
      {children}
    </span>
  )
}

function FieldShell({ label, required, children }: { label: string; required: boolean; children: ReactNode }) {
  return (
    <span className="my-1 inline-flex min-w-56 max-w-sm flex-col gap-1 align-middle">
      <Label className="text-xs font-medium text-signara-navy">
        {label}
        {required && <span className="ml-0.5 text-red-500">*</span>}
      </Label>
      {children}
    </span>
  )
}

function formatScalarValue(attrs: FormFieldAttrs, value: unknown): string {
  if (value === undefined || value === null || value === '') return '—'

  if (attrs.fieldType === 'checkbox') {
    return value ? 'Yes' : 'No'
  }

  if (attrs.fieldType === 'date' && typeof value === 'string') {
    const parsed = new Date(value)
    return Number.isNaN(parsed.getTime()) ? value : parsed.toLocaleDateString('en-GB')
  }

  return String(value)
}

export function DocumentFilledFieldDisplay({
  attrs,
  value,
  signatureDataUrl,
  fileUrl,
}: DocumentFilledFieldDisplayProps) {
  const displayLabel = getFieldDisplayLabel(attrs)

  if (attrs.fieldType === 'signature') {
    if (signatureDataUrl) {
      return (
        <span className="mx-1 inline-flex flex-col gap-1 align-middle">
          <span className="text-xs font-medium text-signara-navy">{displayLabel}</span>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={signatureDataUrl}
            alt={displayLabel}
            className="max-h-20 max-w-[220px] object-contain"
          />
        </span>
      )
    }

    const isApprover = attrs.signatureRole !== 'initiator'
    return (
      <span className="mx-1 inline-flex min-h-12 min-w-[140px] items-center justify-center rounded-md border border-dashed border-signara-steel/50 bg-signara-steel/5 px-3 py-2 align-middle text-xs text-signara-steel">
        {isApprover ? `${displayLabel} — awaiting signature` : `${displayLabel} — not signed`}
      </span>
    )
  }

  if (attrs.fieldType === 'checkbox') {
    const checked = Boolean(value)
    return (
      <span className="my-1 inline-flex items-center gap-2 align-middle">
        <Checkbox checked={checked} disabled id={`filled-${attrs.fieldId}`} />
        <Label htmlFor={`filled-${attrs.fieldId}`} className="text-sm font-normal text-signara-navy">
          {attrs.label}
          {attrs.required && <span className="ml-0.5 text-red-500">*</span>}
        </Label>
      </span>
    )
  }

  if (attrs.fieldType === 'file') {
    const filename = formatPreviewFileLabel(typeof value === 'string' ? value : null)
    return (
      <FieldShell label={attrs.label} required={attrs.required}>
        {filename && fileUrl ? (
          <a
            href={fileUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="text-sm text-signara-gold hover:underline"
          >
            {filename}
          </a>
        ) : (
          <ReadOnlyValue>{filename ?? '—'}</ReadOnlyValue>
        )}
      </FieldShell>
    )
  }

  return (
    <FieldShell label={attrs.label} required={attrs.required}>
      <ReadOnlyValue>{formatScalarValue(attrs, value)}</ReadOnlyValue>
    </FieldShell>
  )
}
