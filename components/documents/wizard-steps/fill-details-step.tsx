'use client'

import { forwardRef, useImperativeHandle, useRef, useState, type ReactNode } from 'react'
import { Controller, useForm, type Control } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { Loader2, Paperclip, X } from 'lucide-react'
import { toast } from 'sonner'
import { DocumentContentView } from '@/components/documents/document-content-view'
import { SignaturePad } from '@/components/documents/signature-pad'
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
import {
  buildFieldValuesSchema,
  getFieldDefaultValue,
  isFillDetailsField,
  normalizeFieldValue,
} from '@/lib/tiptap/field-schema'
import { getFieldDisplayLabel, listTemplateFieldsWithRoles } from '@/lib/tiptap/field-utils'
import { getAttachmentFilename } from '@/lib/storage/document-attachments'
import { uploadDocumentAttachment } from '@/app/actions/documents'
import type { FormFieldAttrs, OrganisationBranding, TiptapDocument } from '@/types/database'

export interface FillDetailsStepHandle {
  requestContinue: () => Promise<boolean>
}

interface FillDetailsStepProps {
  templateContent: TiptapDocument | null
  organisationBranding?: OrganisationBranding | null
  draftId: string
  defaultValues: Record<string, unknown>
  onContinue: (values: Record<string, unknown>) => void
}

export const FillDetailsStep = forwardRef<FillDetailsStepHandle, FillDetailsStepProps>(
  function FillDetailsStep(
    { templateContent, organisationBranding = null, draftId, defaultValues, onContinue },
    ref
  ) {
    const fields = listTemplateFieldsWithRoles(templateContent).filter(isFillDetailsField)
    const [schema] = useState(() => buildFieldValuesSchema(fields))
    const [rhfDefaults] = useState(() =>
      Object.fromEntries(
        fields.map((field) => [
          field.fieldId,
          defaultValues[field.fieldId] ?? getFieldDefaultValue(field),
        ])
      )
    )

    const {
      register,
      control,
      handleSubmit,
      formState: { errors },
    } = useForm({
      resolver: zodResolver(schema),
      defaultValues: rhfDefaults,
    })

    useImperativeHandle(ref, () => ({
      requestContinue: () =>
        new Promise<boolean>((resolve) => {
          handleSubmit(
            (values) => {
              const normalized: Record<string, unknown> = {}
              for (const field of fields) {
                const raw = (values as Record<string, unknown>)[field.fieldId]
                const normalizedValue = normalizeFieldValue(field, raw)
                if (normalizedValue !== undefined) {
                  normalized[field.fieldId] = normalizedValue
                }
              }
              onContinue(normalized)
              resolve(true)
            },
            (formErrors) => {
              const firstMessage = Object.values(formErrors).find(
                (error) => typeof error?.message === 'string' && error.message.length > 0
              )?.message
              toast.error(
                typeof firstMessage === 'string'
                  ? firstMessage
                  : 'Please complete the required fields before continuing.'
              )
              requestAnimationFrame(() => {
                const firstInvalid = document.querySelector<HTMLElement>(
                  '[aria-invalid="true"], .text-red-600'
                )
                firstInvalid?.scrollIntoView({ behavior: 'smooth', block: 'center' })
              })
              resolve(false)
            }
          )()
        }),
    }))

    function renderField(attrs: FormFieldAttrs): ReactNode {
      if (attrs.fieldType === 'signature') {
        if (attrs.signatureRole !== 'initiator') {
          return (
            <span className="mx-1 inline-flex items-center gap-1.5 rounded-md border border-dashed border-signara-steel/50 bg-signara-steel/10 px-3 py-1.5 align-middle text-xs text-signara-steel">
              ✍️ {getFieldDisplayLabel(attrs)} — signed by approver later
            </span>
          )
        }

        const error = errors[attrs.fieldId]?.message as string | undefined
        return (
          <div className="my-2 inline-flex min-w-64 max-w-md flex-col gap-1 align-middle">
            <Controller
              name={attrs.fieldId}
              control={control}
              render={({ field }) => (
                <SignaturePad
                  label={getFieldDisplayLabel(attrs)}
                  value={(field.value as string) || null}
                  onChange={(dataUrl) => field.onChange(dataUrl ?? '')}
                />
              )}
            />
            {error && <span className="text-xs text-red-600">{error}</span>}
          </div>
        )
      }

      const error = errors[attrs.fieldId]?.message as string | undefined

      switch (attrs.fieldType) {
        case 'number':
          return (
            <FieldShell label={attrs.label} required={attrs.required} error={error}>
              <Input
                type="number"
                step="any"
                {...register(attrs.fieldId)}
                className="border-signara-steel focus-visible:ring-signara-navy"
                aria-invalid={Boolean(error)}
              />
            </FieldShell>
          )
        case 'date':
          return (
            <FieldShell label={attrs.label} required={attrs.required} error={error}>
              <Input
                type="date"
                {...register(attrs.fieldId)}
                className="border-signara-steel focus-visible:ring-signara-navy"
                aria-invalid={Boolean(error)}
              />
            </FieldShell>
          )
        case 'dropdown':
          return (
            <FieldShell label={attrs.label} required={attrs.required} error={error}>
              <Controller
                name={attrs.fieldId}
                control={control}
                render={({ field }) => (
                  <Select value={(field.value as string) || ''} onValueChange={field.onChange}>
                    <SelectTrigger className="w-full border-signara-steel focus:ring-signara-navy">
                      <SelectValue placeholder="Select an option" />
                    </SelectTrigger>
                    <SelectContent>
                      {attrs.options.map((option) => (
                        <SelectItem key={option} value={option}>
                          {option}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                )}
              />
            </FieldShell>
          )
        case 'checkbox':
          return (
            <span className="my-1 inline-flex flex-col gap-1 align-middle">
              <span className="inline-flex items-center gap-2">
                <Controller
                  name={attrs.fieldId}
                  control={control}
                  render={({ field }) => (
                    <Checkbox
                      id={`field-${attrs.fieldId}`}
                      checked={Boolean(field.value)}
                      onCheckedChange={field.onChange}
                      aria-invalid={Boolean(error)}
                    />
                  )}
                />
                <Label
                  htmlFor={`field-${attrs.fieldId}`}
                  className="cursor-pointer text-sm font-normal text-signara-navy"
                >
                  {attrs.label}
                  {attrs.required && <span className="ml-0.5 text-red-500">*</span>}
                </Label>
              </span>
              {error && <span className="text-xs text-red-600">{error}</span>}
            </span>
          )
        case 'file':
          return (
            <FieldShell label={attrs.label} required={attrs.required} error={error}>
              <FileFieldInput fieldId={attrs.fieldId} draftId={draftId} control={control} />
            </FieldShell>
          )
        case 'text':
        default:
          return (
            <FieldShell label={attrs.label} required={attrs.required} error={error}>
              <Input
                type="text"
                {...register(attrs.fieldId)}
                className="border-signara-steel focus-visible:ring-signara-navy"
                aria-invalid={Boolean(error)}
              />
            </FieldShell>
          )
      }
    }

    return (
      <div className="space-y-2">
        <p className="text-xs text-signara-steel">
          <span className="text-red-500">*</span> Required fields. Sign your initiator signature
          below; approver signatures are collected later.
        </p>
        <DocumentContentView
          content={templateContent}
          organisationBranding={organisationBranding}
          renderField={renderField}
          className="overflow-x-auto rounded-lg border border-signara-steel/30 bg-[#dde1e6] py-3"
        />
      </div>
    )
  }
)

function FieldShell({
  label,
  required,
  error,
  children,
}: {
  label: string
  required: boolean
  error?: string
  children: ReactNode
}) {
  return (
    <span className="my-1 inline-flex min-w-56 max-w-sm flex-col gap-1 align-middle">
      <Label className="text-xs font-medium text-signara-navy">
        {label}
        {required && <span className="ml-0.5 text-red-500">*</span>}
      </Label>
      {children}
      {error && <span className="text-xs text-red-600">{error}</span>}
    </span>
  )
}

function FileFieldInput({
  fieldId,
  draftId,
  control,
}: {
  fieldId: string
  draftId: string
  control: Control
}) {
  return (
    <Controller
      name={fieldId}
      control={control}
      render={({ field }) => (
        <FileUploadWidget
          value={(field.value as string) ?? ''}
          onChange={field.onChange}
          draftId={draftId}
        />
      )}
    />
  )
}

function FileUploadWidget({
  value,
  onChange,
  draftId,
}: {
  value: string
  onChange: (value: string) => void
  draftId: string
}) {
  const [isUploading, setIsUploading] = useState(false)
  const [uploadError, setUploadError] = useState<string | null>(null)
  const inputRef = useRef<HTMLInputElement>(null)

  async function handleFileChange(event: React.ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0]
    if (!file) return

    setIsUploading(true)
    setUploadError(null)

    const formData = new FormData()
    formData.append('file', file)
    formData.append('draftId', draftId)

    const result = await uploadDocumentAttachment(formData)
    setIsUploading(false)

    if ('error' in result) {
      setUploadError(result.error)
      return
    }

    onChange(result.path)
  }

  function handleRemove() {
    onChange('')
    if (inputRef.current) inputRef.current.value = ''
  }

  const filename = value ? getAttachmentFilename(value) : null

  return (
    <div className="flex flex-col gap-1.5">
      {filename ? (
        <div className="flex items-center gap-2 rounded-md border border-signara-steel/40 bg-signara-background px-3 py-1.5 text-sm text-signara-navy">
          <Paperclip className="size-3.5 shrink-0" />
          <span className="truncate">{filename}</span>
          <button
            type="button"
            onClick={handleRemove}
            className="ml-auto shrink-0 text-signara-steel hover:text-red-500"
            aria-label="Remove file"
          >
            <X className="size-3.5" />
          </button>
        </div>
      ) : (
        <Input
          ref={inputRef}
          type="file"
          onChange={handleFileChange}
          disabled={isUploading}
          className="border-signara-steel text-xs focus-visible:ring-signara-navy"
        />
      )}
      {isUploading && (
        <span className="flex items-center gap-1 text-xs text-signara-steel">
          <Loader2 className="size-3 animate-spin" />
          Uploading…
        </span>
      )}
      {uploadError && <span className="text-xs text-red-600">{uploadError}</span>}
    </div>
  )
}
