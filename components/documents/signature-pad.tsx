'use client'

import { useEffect, useRef, useState, useTransition, type ChangeEvent } from 'react'
import SignatureCanvas from 'react-signature-canvas'
import {
  Eraser,
  Loader2,
  PenLine,
  Type,
  Upload,
  Library,
  Save,
  Star,
  Trash2,
} from 'lucide-react'
import { toast } from 'sonner'
import {
  deleteUserSignature,
  listMySignatures,
  saveUserSignature,
  setDefaultUserSignature,
} from '@/app/actions/signatures'
import { processSignatureUpload } from '@/lib/signatures/remove-background'
import {
  SIGNATURE_PREVIEW_CLASS,
  SIGNATURE_SAVED_THUMB_CLASS,
} from '@/lib/signatures/constants'
import { scaleSignatureDataUrl } from '@/lib/signatures/scale-signature'
import {
  ensureSignatureFonts,
  renderTypedSignature,
  SIGNATURE_FONTS,
  type SignatureFontId,
} from '@/lib/signatures/render-typed'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import type { SignatureCaptureMethod, UserSignature } from '@/types/database'
import { cn } from '@/lib/utils'

type CaptureMode = SignatureCaptureMethod | 'saved'

interface SignaturePadProps {
  onChange: (dataUrl: string | null, method?: SignatureCaptureMethod) => void
  /** When set on mount / after save, shows a compact preview until cleared. */
  value?: string | null
  label?: string
  /**
   * Called when the user clicks Save — use to persist the signature on the
   * current document. Library save for reuse runs at the same time.
   */
  onSave?: (dataUrl: string, method: SignatureCaptureMethod) => void | Promise<void>
  /**
   * @deprecated Auto-save on draw/type/upload is disabled. Signatures are only
   * saved to the library when Save (or Approve) is pressed.
   */
  autoSaveToLibrary?: boolean
  /** Offer the Save button. Default true. */
  showSaveButton?: boolean
  /** Prefer the Saved tab / auto-apply default when the user has one. Default true. */
  preferSaved?: boolean
}

function SignaturePreview({
  src,
  alt,
  className,
}: {
  src: string
  alt: string
  className?: string
}) {
  return (
    // eslint-disable-next-line @next/next/no-img-element
    <img
      src={src}
      alt={alt}
      className={cn(
        SIGNATURE_PREVIEW_CLASS,
        'bg-[linear-gradient(45deg,#f0f0f0_25%,transparent_25%,transparent_75%,#f0f0f0_75%),linear-gradient(45deg,#f0f0f0_25%,transparent_25%,transparent_75%,#f0f0f0_75%)] bg-[length:16px_16px] bg-[position:0_0,8px_8px]',
        className
      )}
    />
  )
}

export function SignaturePad({
  onChange,
  value = null,
  label = 'Your signature',
  onSave,
  showSaveButton = true,
  preferSaved = true,
}: SignaturePadProps) {
  const canvasRef = useRef<SignatureCanvas>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)
  const librarySavedRef = useRef<string | null>(null)
  const appliedDefaultRef = useRef(false)
  const valueRef = useRef(value)
  valueRef.current = value
  const onChangeRef = useRef(onChange)
  onChangeRef.current = onChange

  const [mode, setMode] = useState<CaptureMode>('draw')
  const [isEditing, setIsEditing] = useState(() => !value)
  const [typedText, setTypedText] = useState('')
  const [fontId, setFontId] = useState<SignatureFontId>('great-vibes')
  const [uploadPreview, setUploadPreview] = useState<string | null>(null)
  const [uploadBusy, setUploadBusy] = useState(false)
  const [saved, setSaved] = useState<UserSignature[]>([])
  const [savedLoading, setSavedLoading] = useState(preferSaved)
  const [selectedSavedId, setSelectedSavedId] = useState<string | null>(null)
  const [lastMethod, setLastMethod] = useState<SignatureCaptureMethod>('draw')
  const [isSaving, startSaveTransition] = useTransition()
  const [isManaging, startManageTransition] = useTransition()

  const hasValue = Boolean(value && value.startsWith('data:image/'))

  useEffect(() => {
    void ensureSignatureFonts()
  }, [])

  // Load saved signatures once; auto-apply default so the field is pre-filled.
  useEffect(() => {
    if (!preferSaved) {
      setSavedLoading(false)
      return
    }

    let cancelled = false
    setSavedLoading(true)
    void listMySignatures().then((result) => {
      if (cancelled) return
      setSavedLoading(false)
      if (result.error) {
        // Table may not exist yet — don't block signing.
        return
      }
      setSaved(result.signatures)

      const defaultSig =
        result.signatures.find((s) => s.is_default) ?? result.signatures[0] ?? null

      if (defaultSig) {
        librarySavedRef.current = defaultSig.image_data
      }

      // Pre-fill when the pad is still empty; user can Clear to sign differently.
      if (!appliedDefaultRef.current && !valueRef.current && defaultSig) {
        appliedDefaultRef.current = true
        setSelectedSavedId(defaultSig.id)
        setLastMethod(defaultSig.method)
        setMode('saved')
        setIsEditing(false)
        onChangeRef.current(defaultSig.image_data, defaultSig.method)
      } else if (result.signatures.length > 0 && !valueRef.current) {
        setMode('saved')
      }
    })

    return () => {
      cancelled = true
    }
  }, [preferSaved])

  // Collapse to preview once the parent reflects an auto-applied / selected saved signature.
  useEffect(() => {
    if (!value) {
      // Keep preview pending while a library signature is selected but value hasn't arrived yet.
      if (!selectedSavedId) setIsEditing(true)
      return
    }
    if (selectedSavedId) {
      setIsEditing(false)
    }
  }, [value, selectedSavedId])

  function emit(dataUrl: string | null, method: SignatureCaptureMethod) {
    setLastMethod(method)
    onChange(dataUrl, method)
  }

  function handleClear() {
    canvasRef.current?.clear()
    setTypedText('')
    setUploadPreview(null)
    setSelectedSavedId(null)
    setIsEditing(true)
    appliedDefaultRef.current = true // don't re-auto-apply after explicit clear
    if (fileInputRef.current) fileInputRef.current.value = ''
    onChange(null)
  }

  function handleDrawEnd() {
    const canvas = canvasRef.current
    if (!canvas || canvas.isEmpty()) {
      emit(null, 'draw')
      return
    }
    void (async () => {
      const raw = canvas.getTrimmedCanvas().toDataURL('image/png')
      const dataUrl = await scaleSignatureDataUrl(raw)
      emit(dataUrl, 'draw')
    })()
  }

  async function handleTypedChange(text: string, nextFont: SignatureFontId = fontId) {
    setTypedText(text)

    if (!text.trim()) {
      emit(null, 'type')
      return
    }
    const dataUrl = await renderTypedSignature(text, nextFont)
    emit(dataUrl, 'type')
  }

  async function handleFontChange(next: SignatureFontId) {
    setFontId(next)
    if (typedText.trim()) {
      const dataUrl = await renderTypedSignature(typedText, next)
      emit(dataUrl, 'type')
    }
  }

  async function handleFileChange(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0]
    if (!file) return

    setUploadBusy(true)
    try {
      const processed = await processSignatureUpload(file)
      setUploadPreview(processed)
      emit(processed, 'upload')
      toast.success('Background removed')
    } catch (err) {
      setUploadPreview(null)
      emit(null, 'upload')
      toast.error(err instanceof Error ? err.message : 'Could not process image.')
    } finally {
      setUploadBusy(false)
    }
  }

  function handleSelectSaved(sig: UserSignature) {
    setSelectedSavedId(sig.id)
    setLastMethod(sig.method)
    librarySavedRef.current = sig.image_data
    setIsEditing(false)
    onChange(sig.image_data, sig.method)
  }

  function handleSetDefault(sig: UserSignature) {
    startManageTransition(async () => {
      const result = await setDefaultUserSignature(sig.id)
      if (result.error) {
        toast.error(result.error)
        return
      }
      const refreshed = await listMySignatures()
      if (!refreshed.error) setSaved(refreshed.signatures)
      else setSaved((prev) => prev.map((s) => ({ ...s, is_default: s.id === sig.id })))
      toast.success('Default signature updated')
    })
  }

  function handleDeleteSaved(sig: UserSignature) {
    if (!window.confirm(`Delete “${sig.label}”? This cannot be undone.`)) return

    startManageTransition(async () => {
      const result = await deleteUserSignature(sig.id)
      if (result.error) {
        toast.error(result.error)
        return
      }

      const refreshed = await listMySignatures()
      const remaining = refreshed.error
        ? saved.filter((s) => s.id !== sig.id)
        : refreshed.signatures
      setSaved(remaining)

      if (selectedSavedId === sig.id) {
        const next =
          remaining.find((s) => s.is_default) ?? remaining[0] ?? null
        if (next) {
          handleSelectSaved(next)
        } else {
          setSelectedSavedId(null)
          setIsEditing(true)
          onChange(null)
        }
      }

      toast.success('Signature deleted')
    })
  }

  function handleSave() {
    if (!value?.startsWith('data:image/')) return
    startSaveTransition(async () => {
      const libraryResult = await saveUserSignature({
        imageData: value,
        method: lastMethod,
        setAsDefault: true,
        replaceIfFull: true,
      })

      if (libraryResult.error) {
        toast.error(libraryResult.error)
        return
      }

      librarySavedRef.current = value
      if (libraryResult.signature) {
        setSaved((prev) => {
          const without = prev.filter((s) => s.id !== libraryResult.signature!.id)
          return [libraryResult.signature!, ...without]
        })
        setSelectedSavedId(libraryResult.signature.id)
      }

      if (onSave) {
        try {
          await onSave(value, lastMethod)
          toast.success('Signature saved for this document and future use')
        } catch (err) {
          toast.error(err instanceof Error ? err.message : 'Could not save signature.')
          return
        }
      } else if (!libraryResult.alreadySaved) {
        toast.success('Signature saved for future use')
      }

      setIsEditing(false)
    })
  }

  function handleModeChange(next: string) {
    const nextMode = next as CaptureMode
    setMode(nextMode)
    setSelectedSavedId(null)
    setIsEditing(true)
    appliedDefaultRef.current = true
    onChange(null)
    if (nextMode === 'draw') {
      requestAnimationFrame(() => canvasRef.current?.clear())
    }
  }

  const saveButton = showSaveButton && hasValue && (
    <Button
      type="button"
      variant="outline"
      size="sm"
      disabled={isSaving}
      onClick={handleSave}
      className="h-7 gap-1 border-signara-navy text-xs text-signara-navy hover:bg-signara-navy hover:text-white"
    >
      {isSaving ? <Loader2 className="size-3.5 animate-spin" /> : <Save className="size-3.5" />}
      Save
    </Button>
  )

  if (hasValue && !isEditing) {
    return (
      <div className="space-y-1.5">
        <div className="flex items-center justify-between gap-2">
          <Label className="font-medium text-signara-navy">{label}</Label>
          <div className="flex items-center gap-1">
            {saveButton}
            <Button
              type="button"
              variant="ghost"
              size="sm"
              onClick={handleClear}
              className="h-7 gap-1 text-xs text-signara-steel hover:text-signara-navy"
            >
              <Eraser className="size-3.5" />
              Clear
            </Button>
          </div>
        </div>
        <div className="rounded-md border border-signara-steel bg-white p-3">
          <SignaturePreview src={value!} alt={label} />
        </div>
        <span className="block text-xs text-signara-steel">
          Saved signature applied. Clear to draw, type, or upload a new one.
        </span>
      </div>
    )
  }

  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between gap-2">
        <Label className="font-medium text-signara-navy">{label}</Label>
        <div className="flex items-center gap-1">
          {saveButton}
          <Button
            type="button"
            variant="ghost"
            size="sm"
            onClick={handleClear}
            className="h-7 gap-1 text-xs text-signara-steel hover:text-signara-navy"
          >
            <Eraser className="size-3.5" />
            Clear
          </Button>
        </div>
      </div>

      <Tabs value={mode} onValueChange={handleModeChange} className="gap-3">
        <TabsList className="grid h-auto w-full grid-cols-4 gap-1 bg-signara-background p-1">
          <TabsTrigger
            value="draw"
            className="gap-1 text-xs data-[state=active]:bg-white data-[state=active]:text-signara-navy data-[state=active]:shadow-sm"
          >
            <PenLine className="size-3.5" />
            Draw
          </TabsTrigger>
          <TabsTrigger
            value="type"
            className="gap-1 text-xs data-[state=active]:bg-white data-[state=active]:text-signara-navy data-[state=active]:shadow-sm"
          >
            <Type className="size-3.5" />
            Type
          </TabsTrigger>
          <TabsTrigger
            value="upload"
            className="gap-1 text-xs data-[state=active]:bg-white data-[state=active]:text-signara-navy data-[state=active]:shadow-sm"
          >
            <Upload className="size-3.5" />
            Upload
          </TabsTrigger>
          <TabsTrigger
            value="saved"
            className="gap-1 text-xs data-[state=active]:bg-white data-[state=active]:text-signara-navy data-[state=active]:shadow-sm"
          >
            <Library className="size-3.5" />
            Saved
          </TabsTrigger>
        </TabsList>

        <TabsContent value="draw" className="mt-0 space-y-1.5">
          <div className="rounded-md border border-signara-steel bg-signara-background/40">
            <SignatureCanvas
              ref={canvasRef}
              penColor="#0F2C59"
              canvasProps={{ className: 'h-40 w-full touch-none' }}
              onEnd={handleDrawEnd}
            />
          </div>
          <span className="block text-xs text-signara-steel">
            Draw with your mouse or finger. Press Save (or Approve) to keep it for future use.
          </span>
        </TabsContent>

        <TabsContent value="type" className="mt-0 space-y-3">
          <div className="grid gap-3 sm:grid-cols-[1fr_auto]">
            <div className="space-y-1.5">
              <Label htmlFor="typed-signature" className="text-xs text-signara-steel">
                Full name
              </Label>
              <Input
                id="typed-signature"
                value={typedText}
                onChange={(e) => void handleTypedChange(e.target.value)}
                placeholder="Type your name"
                className="border-signara-steel focus-visible:ring-signara-navy"
                autoComplete="name"
              />
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs text-signara-steel">Style</Label>
              <Select
                value={fontId}
                onValueChange={(v) => void handleFontChange(v as SignatureFontId)}
              >
                <SelectTrigger className="w-full border-signara-steel sm:w-44">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {SIGNATURE_FONTS.map((font) => (
                    <SelectItem key={font.id} value={font.id}>
                      {font.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
          <div className="flex min-h-28 items-center justify-center rounded-md border border-signara-steel bg-white px-4 py-6">
            {typedText.trim() ? (
              <span
                className="text-center text-4xl text-signara-navy"
                style={{
                  fontFamily: `"${SIGNATURE_FONTS.find((f) => f.id === fontId)?.family}", cursive`,
                }}
              >
                {typedText.trim()}
              </span>
            ) : (
              <span className="text-sm text-signara-steel">Preview appears here</span>
            )}
          </div>
        </TabsContent>

        <TabsContent value="upload" className="mt-0 space-y-3">
          <input
            ref={fileInputRef}
            type="file"
            accept="image/png,image/jpeg,image/webp,image/gif"
            className="sr-only"
            onChange={(e) => void handleFileChange(e)}
          />
          <button
            type="button"
            disabled={uploadBusy}
            onClick={() => fileInputRef.current?.click()}
            className={cn(
              'flex w-full flex-col items-center justify-center gap-2 rounded-md border border-dashed border-signara-steel bg-white px-4 py-8 text-center transition-colors',
              'hover:border-signara-navy hover:bg-signara-background/60',
              uploadBusy && 'pointer-events-none opacity-60'
            )}
          >
            {uploadBusy ? (
              <Loader2 className="size-6 animate-spin text-signara-gold" />
            ) : (
              <Upload className="size-6 text-signara-gold" />
            )}
            <span className="text-sm font-medium text-signara-navy">
              {uploadBusy ? 'Removing background…' : 'Upload signature image'}
            </span>
            <span className="text-xs text-signara-steel">
              PNG, JPG, or WebP — paper background is removed automatically
            </span>
          </button>
          {uploadPreview && (
            <div className="rounded-md border border-signara-steel bg-white p-3">
              <SignaturePreview src={uploadPreview} alt="Processed signature" className="mx-auto" />
            </div>
          )}
        </TabsContent>

        <TabsContent value="saved" className="mt-0 space-y-2">
          {savedLoading ? (
            <div className="flex items-center justify-center gap-2 py-10 text-sm text-signara-steel">
              <Loader2 className="size-4 animate-spin" />
              Loading saved signatures…
            </div>
          ) : saved.length === 0 ? (
            <div className="rounded-md border border-dashed border-signara-steel/50 bg-white px-4 py-8 text-center">
              <p className="text-sm text-signara-navy">No saved signatures yet</p>
              <p className="mt-1 text-xs text-signara-steel">
                Draw, type, or upload a signature, then press Save to keep it for next time.
              </p>
            </div>
          ) : (
            <ul className="grid gap-2 sm:grid-cols-2">
              {saved.map((sig) => (
                <li
                  key={sig.id}
                  className={cn(
                    'flex flex-col gap-2 rounded-md border bg-white p-3',
                    selectedSavedId === sig.id
                      ? 'border-signara-gold ring-2 ring-signara-gold/40'
                      : 'border-signara-steel/40'
                  )}
                >
                  <button
                    type="button"
                    onClick={() => handleSelectSaved(sig)}
                    className="flex w-full flex-col gap-2 text-left"
                  >
                    <SignaturePreview
                      src={sig.image_data}
                      alt={sig.label}
                      className={cn('mx-auto', SIGNATURE_SAVED_THUMB_CLASS)}
                    />
                    <div className="flex items-center justify-between gap-2">
                      <span className="truncate text-xs font-medium text-signara-navy">
                        {sig.label}
                      </span>
                      {sig.is_default && (
                        <span className="shrink-0 text-[10px] font-semibold uppercase tracking-wide text-signara-gold">
                          Default
                        </span>
                      )}
                    </div>
                  </button>
                  <div className="flex flex-wrap gap-1.5">
                    {!sig.is_default && (
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        disabled={isManaging}
                        onClick={() => handleSetDefault(sig)}
                        className="h-7 gap-1 border-signara-navy px-2 text-xs text-signara-navy hover:bg-signara-navy hover:text-white"
                      >
                        <Star className="size-3" />
                        Set default
                      </Button>
                    )}
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      disabled={isManaging}
                      onClick={() => handleDeleteSaved(sig)}
                      className="h-7 gap-1 border-destructive px-2 text-xs text-destructive hover:bg-destructive hover:text-white"
                    >
                      <Trash2 className="size-3" />
                      Delete
                    </Button>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </TabsContent>
      </Tabs>
    </div>
  )
}
