'use client'

import type { ReactNode } from 'react'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Checkbox } from '@/components/ui/checkbox'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { getFieldDisplayLabel } from '@/lib/tiptap/field-utils'
import type { FormFieldAttrs } from '@/types/database'

export function DocumentFormFieldShell({
  label,
  required,
  children,
}: {
  label: string
  required: boolean
  children: ReactNode
}) {
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

/**
 * Disabled form controls that mirror how fields appear when a document is filled in.
 * Shared by the template editor (WYSIWYG), admin preview, and initiation preview.
 */
export function DocumentFormFieldPreview({ attrs }: { attrs: FormFieldAttrs }) {
  const displayLabel = getFieldDisplayLabel(attrs)
  const isRequired = attrs.required || attrs.fieldType === 'signature'

  if (attrs.fieldType === 'signature') {
    return (
      <span className="mx-1 inline-flex items-center gap-1.5 rounded-md border border-dashed border-signara-steel/50 bg-signara-steel/10 px-3 py-1.5 align-middle text-xs text-signara-steel">
        <span aria-hidden>✍️</span>
        <span>
          {displayLabel}
          <span className="ml-0.5 text-red-500">*</span>
        </span>
      </span>
    )
  }

  if (attrs.fieldType === 'checkbox') {
    return (
      <span className="my-1 inline-flex items-center gap-2 align-middle">
        <Checkbox id={`field-preview-${attrs.fieldId}`} disabled checked={false} />
        <Label
          htmlFor={`field-preview-${attrs.fieldId}`}
          className="text-sm font-normal text-signara-navy"
        >
          {attrs.label}
          {attrs.required && <span className="ml-0.5 text-red-500">*</span>}
        </Label>
      </span>
    )
  }

  if (attrs.fieldType === 'dropdown') {
    const options = (attrs.options ?? []).filter((option) => option.trim().length > 0)

    return (
      <DocumentFormFieldShell label={attrs.label} required={attrs.required}>
        <Select disabled>
          <SelectTrigger className="w-full border-signara-steel opacity-90">
            <SelectValue placeholder={options.length > 0 ? 'Select an option' : 'Add options…'} />
          </SelectTrigger>
          {options.length > 0 && (
            <SelectContent>
              {options.map((option) => (
                <SelectItem key={option} value={option}>
                  {option}
                </SelectItem>
              ))}
            </SelectContent>
          )}
        </Select>
      </DocumentFormFieldShell>
    )
  }

  if (attrs.fieldType === 'file') {
    return (
      <DocumentFormFieldShell label={attrs.label} required={isRequired}>
        <Input type="file" disabled className="border-signara-steel text-xs opacity-90" />
      </DocumentFormFieldShell>
    )
  }

  const inputType =
    attrs.fieldType === 'number' ? 'number' : attrs.fieldType === 'date' ? 'date' : 'text'

  return (
    <DocumentFormFieldShell label={attrs.label} required={attrs.required}>
      <Input
        type={inputType}
        disabled
        placeholder={attrs.fieldType === 'date' ? undefined : attrs.label}
        className="border-signara-steel opacity-90"
      />
    </DocumentFormFieldShell>
  )
}
