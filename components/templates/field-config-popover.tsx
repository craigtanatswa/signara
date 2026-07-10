'use client'

import { useState, useRef } from 'react'
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Switch } from '@/components/ui/switch'
import { Badge } from '@/components/ui/badge'
import { Separator } from '@/components/ui/separator'
import { Plus, Trash2 } from 'lucide-react'
import {
  FIELD_TYPE_LABELS,
  getDefaultFieldLabel,
  isFieldLabelValid,
} from '@/lib/tiptap/field-utils'
import type { FieldType, FormFieldAttrs } from '@/types/database'

interface FieldConfigPopoverProps {
  attrs: FormFieldAttrs
  open: boolean
  onOpenChange: (open: boolean) => void
  onUpdate: (attrs: Partial<FormFieldAttrs>) => void
  onDelete: () => void
  children: React.ReactNode
}

export function FieldConfigPopover({
  attrs,
  open,
  onOpenChange,
  onUpdate,
  onDelete,
  children,
}: FieldConfigPopoverProps) {
  const [label, setLabel] = useState(attrs.label)
  const [required, setRequired] = useState(attrs.required)
  const [signatureRole, setSignatureRole] = useState<'initiator' | 'approver'>(
    attrs.signatureRole === 'initiator' ? 'initiator' : 'approver'
  )
  const [options, setOptions] = useState<string[]>(attrs.options ?? [])
  const [labelError, setLabelError] = useState<string | null>(null)
  const labelInputRef = useRef<HTMLInputElement>(null)

  const isSignatureField = attrs.fieldType === 'signature'
  const isConfigured = attrs.configured !== false
  const fieldTypeLabel = FIELD_TYPE_LABELS[attrs.fieldType as FieldType]

  function buildFieldUpdate(
    trimmedLabel: string,
    extra: Partial<FormFieldAttrs> = {}
  ): Partial<FormFieldAttrs> {
    return {
      label: trimmedLabel,
      required: isSignatureField ? true : required,
      options:
        attrs.fieldType === 'dropdown'
          ? options.map((option) => option.trim()).filter(Boolean)
          : [],
      configured: attrs.configured,
      ...extra,
    }
  }

  function previewUpdate(extra: Partial<FormFieldAttrs> = {}) {
    const trimmedLabel = label.trim() || getDefaultFieldLabel(attrs.fieldType)
    onUpdate(
      buildFieldUpdate(
        trimmedLabel,
        isSignatureField ? { signatureRole, ...extra } : extra
      )
    )
  }

  function handleOpenChange(nextOpen: boolean) {
    if (nextOpen) {
      const defaultLabel = getDefaultFieldLabel(attrs.fieldType)
      setLabel(attrs.label?.trim() || defaultLabel)
      setRequired(attrs.required)
      setSignatureRole(attrs.signatureRole === 'initiator' ? 'initiator' : 'approver')
      setOptions(attrs.options ?? [])
      setLabelError(null)
      setTimeout(() => labelInputRef.current?.focus(), 0)
    } else if (!isConfigured) {
      // Keep the field in the document with its current/default label when the
      // popover closes — only the Delete button removes a field.
      const trimmedLabel = label.trim() || getDefaultFieldLabel(attrs.fieldType)
      onUpdate(
        buildFieldUpdate(
          trimmedLabel,
          isSignatureField ? { signatureRole, configured: true } : { configured: true }
        )
      )
    }

    onOpenChange(nextOpen)
  }

  function handleSave() {
    const trimmedLabel = label.trim()

    if (!isFieldLabelValid(trimmedLabel)) {
      setLabelError('Enter a field label before saving.')
      labelInputRef.current?.focus()
      return
    }

    if (attrs.fieldType === 'dropdown') {
      const cleanedOptions = options.map((option) => option.trim()).filter(Boolean)
      if (cleanedOptions.length === 0) {
        setLabelError('Add at least one dropdown option before saving.')
        return
      }

      onUpdate(buildFieldUpdate(trimmedLabel, { options: cleanedOptions, configured: true }))
    } else {
      onUpdate(
        buildFieldUpdate(
          trimmedLabel,
          isSignatureField ? { signatureRole, configured: true } : { configured: true }
        )
      )
    }

    setLabelError(null)
    onOpenChange(false)
  }

  function handleDelete() {
    onDelete()
    onOpenChange(false)
  }

  function addOption() {
    const nextOptions = [...options, '']
    setOptions(nextOptions)
    onUpdate(
      buildFieldUpdate(label.trim() || getDefaultFieldLabel(attrs.fieldType), {
        options: nextOptions.map((option) => option.trim()).filter(Boolean),
      })
    )
  }

  function updateOption(index: number, value: string) {
    const nextOptions = options.map((option, i) => (i === index ? value : option))
    setOptions(nextOptions)
    onUpdate(
      buildFieldUpdate(label.trim() || getDefaultFieldLabel(attrs.fieldType), {
        options: nextOptions.map((option) => option.trim()).filter(Boolean),
      })
    )
  }

  function removeOption(index: number) {
    const nextOptions = options.filter((_, i) => i !== index)
    setOptions(nextOptions)
    onUpdate(
      buildFieldUpdate(label.trim() || getDefaultFieldLabel(attrs.fieldType), {
        options: nextOptions.map((option) => option.trim()).filter(Boolean),
      })
    )
  }

  return (
    <Popover open={open} onOpenChange={handleOpenChange}>
      <PopoverTrigger asChild>{children}</PopoverTrigger>
      <PopoverContent
        className="w-80 p-0"
        side="bottom"
        align="start"
        onClick={(e) => e.stopPropagation()}
        onKeyDown={(e) => e.stopPropagation()}
        onEscapeKeyDown={(e) => {
          if (!isConfigured) {
            e.preventDefault()
            handleOpenChange(false)
          }
        }}
      >
        <div className="border-b border-border px-4 py-3">
          <p className="text-sm font-semibold text-signara-navy">Configure field</p>
          {!isConfigured && (
            <p className="mt-1 text-xs text-signara-steel">
              The field updates in the document as you edit. Click Save when finished.
            </p>
          )}
        </div>

        <div className="space-y-4 p-4">
          <div className="flex items-center justify-between">
            <span className="text-xs font-medium text-signara-steel">
              Field type <span className="text-red-500">*</span>
            </span>
            <Badge
              variant="outline"
              className="border-signara-gold/40 bg-signara-gold/10 text-signara-navy text-xs"
            >
              {fieldTypeLabel}
            </Badge>
          </div>

          <Separator />

          <div className="space-y-1.5">
            <Label htmlFor="field-label" className="text-xs font-medium text-signara-navy">
              Label <span className="text-red-500">*</span>
            </Label>
            <Input
              ref={labelInputRef}
              id="field-label"
              value={label}
              onChange={(e) => {
                const nextLabel = e.target.value
                setLabel(nextLabel)
                if (labelError) setLabelError(null)
                onUpdate(
                  buildFieldUpdate(
                    nextLabel.trim() || getDefaultFieldLabel(attrs.fieldType),
                    isSignatureField ? { signatureRole } : {}
                  )
                )
              }}
              placeholder={`e.g. ${fieldTypeLabel} field`}
              className="h-8 text-sm"
              aria-invalid={Boolean(labelError)}
              onKeyDown={(e) => {
                if (e.key === 'Enter') {
                  e.preventDefault()
                  handleSave()
                }
              }}
            />
            {labelError && <p className="text-xs text-red-600">{labelError}</p>}
          </div>

          {!isSignatureField && (
            <div className="flex items-center justify-between">
              <Label htmlFor="field-required" className="text-xs font-medium text-signara-navy cursor-pointer">
                Required
              </Label>
              <Switch
                id="field-required"
                checked={required}
                onCheckedChange={(checked) => {
                  setRequired(checked)
                  previewUpdate({ required: checked })
                }}
              />
            </div>
          )}

          {isSignatureField && (
            <p className="text-xs text-signara-steel">
              Signatures are always required when this document is filled in or approved.
            </p>
          )}

          {isSignatureField && (
            <>
              <Separator />
              <div className="flex items-center justify-between gap-3">
                <div>
                  <Label htmlFor="initiator-signature" className="text-xs font-medium text-signara-navy cursor-pointer">
                    Initiator signature
                  </Label>
                  <p className="mt-0.5 text-[11px] text-signara-steel">
                    Filled by whoever starts the document, before approval begins.
                  </p>
                </div>
                <Switch
                  id="initiator-signature"
                  checked={signatureRole === 'initiator'}
                  onCheckedChange={(checked) => {
                    const nextRole = checked ? 'initiator' : 'approver'
                    setSignatureRole(nextRole)
                    previewUpdate({ signatureRole: nextRole })
                  }}
                />
              </div>
            </>
          )}

          {attrs.fieldType === 'dropdown' && (
            <>
              <Separator />
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <Label className="text-xs font-medium text-signara-navy">
                    Options <span className="text-red-500">*</span>
                  </Label>
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    onClick={addOption}
                    className="h-6 gap-1 px-2 text-xs text-signara-navy hover:bg-signara-navy/10"
                  >
                    <Plus className="size-3" />
                    Add
                  </Button>
                </div>
                {options.length === 0 && (
                  <p className="text-xs text-signara-steel">Add at least one option.</p>
                )}
                <div className="space-y-1.5">
                  {options.map((option, index) => (
                    <div key={index} className="flex items-center gap-1.5">
                      <Input
                        value={option}
                        onChange={(e) => updateOption(index, e.target.value)}
                        placeholder={`Option ${index + 1}`}
                        className="h-7 flex-1 text-xs"
                      />
                      <button
                        type="button"
                        onClick={() => removeOption(index)}
                        className="text-signara-steel hover:text-red-500 transition-colors"
                        aria-label="Remove option"
                      >
                        <Trash2 className="size-3.5" />
                      </button>
                    </div>
                  ))}
                </div>
              </div>
            </>
          )}

          <Separator />

          <div className="flex gap-2">
            <Button
              onClick={handleSave}
              size="sm"
              disabled={!isFieldLabelValid(label)}
              className="flex-1 h-8 bg-signara-gold text-signara-navy font-semibold hover:bg-[#C49B2E] text-xs disabled:opacity-50"
            >
              Save
            </Button>
            <Button
              onClick={handleDelete}
              size="sm"
              variant="destructive"
              className="h-8 px-3 text-xs"
              aria-label="Delete field"
            >
              <Trash2 className="size-3.5" />
            </Button>
          </div>
        </div>
      </PopoverContent>
    </Popover>
  )
}
