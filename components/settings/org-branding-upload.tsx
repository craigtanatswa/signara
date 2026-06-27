'use client'

import { useRef, useState } from 'react'
import { Loader2, Trash2, Upload } from 'lucide-react'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { Label } from '@/components/ui/label'

interface OrgBrandingUploadProps {
  label: string
  description: string
  currentUrl: string | null
  accept: string
  emptyHint: string
  previewAlt: string
  previewClassName?: string
  onUpload: (formData: FormData) => Promise<{ success: boolean; url?: string; error?: string; message?: string }>
  onRemove: () => Promise<{ success: boolean; error?: string; message?: string }>
}

export function OrgBrandingUpload({
  label,
  description,
  currentUrl,
  accept,
  emptyHint,
  previewAlt,
  previewClassName,
  onUpload,
  onRemove,
}: OrgBrandingUploadProps) {
  const inputRef = useRef<HTMLInputElement>(null)
  const [previewUrl, setPreviewUrl] = useState<string | null>(currentUrl)
  const [isUploading, setIsUploading] = useState(false)
  const [isRemoving, setIsRemoving] = useState(false)

  async function handleFileChange(event: React.ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0]
    if (!file) return

    setIsUploading(true)
    const formData = new FormData()
    formData.set('file', file)

    const result = await onUpload(formData)
    setIsUploading(false)

    if (!result.success) {
      toast.error(result.error ?? 'Upload failed')
      return
    }

    setPreviewUrl(result.url ?? null)
    toast.success(result.message ?? 'Uploaded successfully')
    if (inputRef.current) inputRef.current.value = ''
  }

  async function handleRemove() {
    setIsRemoving(true)
    const result = await onRemove()
    setIsRemoving(false)

    if (!result.success) {
      toast.error(result.error ?? 'Failed to remove')
      return
    }

    setPreviewUrl(null)
    toast.success(result.message ?? 'Removed')
    if (inputRef.current) inputRef.current.value = ''
  }

  return (
    <div className="space-y-2">
      <div>
        <Label className="text-signara-navy font-medium">{label}</Label>
        <p className="mt-0.5 text-xs text-signara-steel">{description}</p>
      </div>

      <div className="overflow-hidden rounded-lg border border-signara-steel/30 bg-signara-background/40">
        {previewUrl ? (
          <div className="relative flex min-h-[8rem] items-center justify-center bg-white p-4">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={previewUrl}
              alt={previewAlt}
              className={previewClassName ?? 'max-h-24 max-w-full object-contain'}
            />
          </div>
        ) : (
          <div className="flex min-h-[8rem] flex-col items-center justify-center gap-2 p-6 text-center">
            <Upload className="size-6 text-signara-steel/50" />
            <p className="text-sm text-signara-steel">{emptyHint}</p>
          </div>
        )}

        <div className="flex flex-wrap gap-2 border-t border-signara-steel/20 bg-white px-4 py-3">
          <input
            ref={inputRef}
            type="file"
            accept={accept}
            className="hidden"
            onChange={handleFileChange}
          />
          <Button
            type="button"
            variant="outline"
            size="sm"
            disabled={isUploading || isRemoving}
            className="border-signara-navy text-signara-navy hover:bg-signara-navy hover:text-white"
            onClick={() => inputRef.current?.click()}
          >
            {isUploading ? (
              <>
                <Loader2 className="mr-1.5 size-3.5 animate-spin" />
                Uploading…
              </>
            ) : (
              <>
                <Upload className="mr-1.5 size-3.5" />
                {previewUrl ? 'Replace' : 'Upload'}
              </>
            )}
          </Button>

          {previewUrl && (
            <Button
              type="button"
              variant="ghost"
              size="sm"
              disabled={isUploading || isRemoving}
              className="text-destructive hover:text-destructive"
              onClick={handleRemove}
            >
              {isRemoving ? (
                <Loader2 className="mr-1.5 size-3.5 animate-spin" />
              ) : (
                <Trash2 className="mr-1.5 size-3.5" />
              )}
              Remove
            </Button>
          )}
        </div>
      </div>
    </div>
  )
}
