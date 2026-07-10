'use client'

import { useMemo, useRef, useState } from 'react'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { FileUp, Loader2, Paperclip, X } from 'lucide-react'
import { toast } from 'sonner'
import { useRouter } from 'next/navigation'
import {
  createTemplateRequest,
  uploadTemplateRequestAttachment,
} from '@/app/actions/template-requests'
import { ErrorMessage } from '@/components/ui/error-message'
import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import type { DepartmentOption } from '@/types/org-structure'

const requestSchema = z.object({
  title: z.string().min(2, { message: 'Enter a short name for the form' }),
  description: z.string().optional(),
  department_id: z.string().uuid({ message: 'Select a department' }),
})

type RequestFormValues = z.infer<typeof requestSchema>

interface RequestTemplateDialogProps {
  departments: DepartmentOption[]
  defaultDepartmentId: string | null
  /** When true, render only the trigger-less dialog controlled externally — unused; always shows trigger. */
  triggerLabel?: string
  triggerVariant?: 'signara' | 'outline'
  triggerClassName?: string
}

export function RequestTemplateDialog({
  departments,
  defaultDepartmentId,
  triggerLabel = 'Request a template',
  triggerVariant = 'signara',
  triggerClassName,
}: RequestTemplateDialogProps) {
  const router = useRouter()
  const [open, setOpen] = useState(false)
  const [draftId] = useState(() => crypto.randomUUID())
  const [serverError, setServerError] = useState<string | null>(null)
  const [attachmentPath, setAttachmentPath] = useState('')
  const [attachmentFilename, setAttachmentFilename] = useState('')
  const [isUploading, setIsUploading] = useState(false)
  const [uploadError, setUploadError] = useState<string | null>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)

  const resolvedDefaultDepartmentId = useMemo(
    () =>
      defaultDepartmentId && departments.some((d) => d.id === defaultDepartmentId)
        ? defaultDepartmentId
        : (departments.find((d) => !d.is_executive)?.id ?? departments[0]?.id ?? ''),
    [defaultDepartmentId, departments]
  )

  const {
    register,
    handleSubmit,
    setValue,
    watch,
    reset,
    formState: { errors, isSubmitting },
  } = useForm<RequestFormValues>({
    resolver: zodResolver(requestSchema),
    defaultValues: {
      title: '',
      description: '',
      department_id: resolvedDefaultDepartmentId,
    },
  })

  const selectedDepartmentId = watch('department_id')

  function handleOpenChange(next: boolean) {
    setOpen(next)
    if (!next) {
      setServerError(null)
      setUploadError(null)
      setAttachmentPath('')
      setAttachmentFilename('')
      if (fileInputRef.current) fileInputRef.current.value = ''
      reset({
        title: '',
        description: '',
        department_id: resolvedDefaultDepartmentId,
      })
    }
  }

  async function handleFileChange(event: React.ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0]
    if (!file) return

    setIsUploading(true)
    setUploadError(null)

    const formData = new FormData()
    formData.append('file', file)
    formData.append('draftId', draftId)

    const result = await uploadTemplateRequestAttachment(formData)
    setIsUploading(false)

    if ('error' in result) {
      setUploadError(result.error)
      setAttachmentPath('')
      setAttachmentFilename('')
      return
    }

    setAttachmentPath(result.path)
    setAttachmentFilename(result.filename)
  }

  function handleRemoveFile() {
    setAttachmentPath('')
    setAttachmentFilename('')
    setUploadError(null)
    if (fileInputRef.current) fileInputRef.current.value = ''
  }

  async function onSubmit(values: RequestFormValues) {
    setServerError(null)

    if (!attachmentPath || !attachmentFilename) {
      setServerError('Please upload a PDF or image of the physical form.')
      return
    }

    const result = await createTemplateRequest({
      title: values.title,
      description: values.description,
      departmentId: values.department_id,
      attachmentPath,
      attachmentFilename,
    })

    if ('error' in result) {
      setServerError(result.error)
      return
    }

    toast.success('Request sent to your administrators')
    handleOpenChange(false)
    router.refresh()
  }

  if (departments.length === 0) {
    return null
  }

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogTrigger asChild>
        <Button type="button" variant={triggerVariant} className={triggerClassName}>
          <FileUp className="mr-1.5 size-4" />
          {triggerLabel}
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="text-signara-navy">Request a department template</DialogTitle>
          <DialogDescription>
            Upload a scan or photo of the paper form you want replaced. An administrator will
            digitise it for your department.
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
          <div className="space-y-1.5">
            <Label htmlFor="request-title" className="text-signara-navy font-medium">
              Form name <span className="text-red-500">*</span>
            </Label>
            <Input
              id="request-title"
              placeholder="e.g. Leave request form"
              {...register('title')}
              className="border-signara-steel focus-visible:ring-signara-navy"
              aria-invalid={Boolean(errors.title)}
            />
            {errors.title && <p className="text-xs text-red-600">{errors.title.message}</p>}
          </div>

          <div className="space-y-1.5">
            <Label className="text-signara-navy font-medium">
              Department <span className="text-red-500">*</span>
            </Label>
            <Select
              value={selectedDepartmentId}
              onValueChange={(value) => setValue('department_id', value, { shouldValidate: true })}
            >
              <SelectTrigger className="w-full border-signara-steel focus:ring-signara-navy">
                <SelectValue placeholder="Select department" />
              </SelectTrigger>
              <SelectContent>
                {departments.map((department) => (
                  <SelectItem key={department.id} value={department.id}>
                    {department.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            {errors.department_id && (
              <p className="text-xs text-red-600">{errors.department_id.message}</p>
            )}
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="request-description" className="text-signara-navy font-medium">
              Notes for the admin
            </Label>
            <Textarea
              id="request-description"
              placeholder="Anything the admin should know (fields, approvers, frequency of use…)"
              rows={3}
              {...register('description')}
              className="border-signara-steel focus-visible:ring-signara-navy"
            />
          </div>

          <div className="space-y-1.5">
            <Label className="text-signara-navy font-medium">
              Physical form (PDF or image) <span className="text-red-500">*</span>
            </Label>
            {attachmentFilename ? (
              <div className="flex items-center gap-2 rounded-md border border-signara-steel/40 bg-signara-background px-3 py-2 text-sm text-signara-navy">
                <Paperclip className="size-3.5 shrink-0" />
                <span className="truncate">{attachmentFilename}</span>
                <button
                  type="button"
                  onClick={handleRemoveFile}
                  className="ml-auto shrink-0 text-signara-steel hover:text-red-500"
                  aria-label="Remove file"
                >
                  <X className="size-3.5" />
                </button>
              </div>
            ) : (
              <Input
                ref={fileInputRef}
                type="file"
                accept="application/pdf,image/png,image/jpeg,image/webp,image/gif"
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
            {uploadError && <p className="text-xs text-red-600">{uploadError}</p>}
            <p className="text-xs text-signara-steel">PDF, PNG, JPEG, WebP, or GIF — max 15 MB.</p>
          </div>

          {serverError && <ErrorMessage>{serverError}</ErrorMessage>}

          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => handleOpenChange(false)}>
              Cancel
            </Button>
            <Button type="submit" variant="signara" disabled={isSubmitting || isUploading}>
              {isSubmitting ? (
                <>
                  <Loader2 className="mr-2 size-4 animate-spin" />
                  Sending…
                </>
              ) : (
                'Send request'
              )}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}
