'use client'

import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { toast } from 'sonner'
import { Loader2, Star, Trash2 } from 'lucide-react'
import {
  deleteUserSignature,
  saveUserSignature,
  setDefaultUserSignature,
} from '@/app/actions/signatures'
import { SignaturePad } from '@/components/documents/signature-pad'
import { Button } from '@/components/ui/button'
import { ErrorMessage } from '@/components/ui/error-message'
import type { SignatureCaptureMethod, UserSignature } from '@/types/database'

interface SavedSignaturesManagerProps {
  initialSignatures: UserSignature[]
}

export function SavedSignaturesManager({ initialSignatures }: SavedSignaturesManagerProps) {
  const router = useRouter()
  const [signatures, setSignatures] = useState(initialSignatures)
  const [draft, setDraft] = useState<string | null>(null)
  const [draftMethod, setDraftMethod] = useState<SignatureCaptureMethod>('draw')
  const [error, setError] = useState<string | null>(null)
  const [isPending, startTransition] = useTransition()
  const [padKey, setPadKey] = useState(0)

  function refreshFromServer() {
    router.refresh()
  }

  function handleCreate() {
    if (!draft) return
    setError(null)
    startTransition(async () => {
      const result = await saveUserSignature({
        imageData: draft,
        method: draftMethod,
        setAsDefault: signatures.length === 0,
      })
      if (result.error) {
        setError(result.error)
        return
      }
      if (result.signature) {
        setSignatures((prev) => {
          const next = result.signature!.is_default
            ? prev.map((s) => ({ ...s, is_default: false }))
            : prev
          return [result.signature!, ...next]
        })
      }
      setDraft(null)
      setPadKey((k) => k + 1)
      toast.success('Signature saved')
      refreshFromServer()
    })
  }

  function handleSetDefault(id: string) {
    setError(null)
    startTransition(async () => {
      const result = await setDefaultUserSignature(id)
      if (result.error) {
        setError(result.error)
        return
      }
      setSignatures((prev) =>
        prev.map((s) => ({ ...s, is_default: s.id === id }))
      )
      toast.success('Default signature updated')
      refreshFromServer()
    })
  }

  function handleDelete(id: string) {
    setError(null)
    startTransition(async () => {
      const result = await deleteUserSignature(id)
      if (result.error) {
        setError(result.error)
        return
      }
      setSignatures((prev) => prev.filter((s) => s.id !== id))
      toast.success('Signature deleted')
      refreshFromServer()
    })
  }

  return (
    <div className="space-y-6">
      {signatures.length > 0 && (
        <ul className="grid gap-3 sm:grid-cols-2">
          {signatures.map((sig) => (
            <li
              key={sig.id}
              className="flex flex-col gap-3 rounded-md border border-signara-steel/30 bg-signara-background/40 p-3"
            >
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={sig.image_data}
                alt={sig.label}
                className="mx-auto max-h-20 w-auto bg-white px-2 py-1"
              />
              <div className="flex items-center justify-between gap-2">
                <div className="min-w-0">
                  <p className="truncate text-sm font-medium text-signara-navy">{sig.label}</p>
                  <p className="text-xs capitalize text-signara-steel">{sig.method}</p>
                </div>
                {sig.is_default && (
                  <span className="shrink-0 text-[10px] font-semibold uppercase tracking-wide text-signara-gold">
                    Default
                  </span>
                )}
              </div>
              <div className="flex flex-wrap gap-2">
                {!sig.is_default && (
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    disabled={isPending}
                    onClick={() => handleSetDefault(sig.id)}
                    className="border-signara-navy text-signara-navy hover:bg-signara-navy hover:text-white"
                  >
                    <Star className="mr-1 size-3.5" />
                    Set default
                  </Button>
                )}
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  disabled={isPending}
                  onClick={() => handleDelete(sig.id)}
                  className="border-destructive text-destructive hover:bg-destructive hover:text-white"
                >
                  <Trash2 className="mr-1 size-3.5" />
                  Delete
                </Button>
              </div>
            </li>
          ))}
        </ul>
      )}

      {signatures.length === 0 && (
        <p className="text-sm text-signara-steel">
          You have no saved signatures yet. Create one below to reuse when approving documents.
        </p>
      )}

      <div className="space-y-3 border-t border-signara-steel/20 pt-4">
        <p className="text-sm font-medium text-signara-navy">Add a signature</p>
        <SignaturePad
          key={padKey}
          label="New signature"
          value={null}
          onChange={(dataUrl, method) => {
            setDraft(dataUrl)
            if (method) setDraftMethod(method)
          }}
          autoSaveToLibrary={false}
          showSaveButton={false}
          preferSaved={false}
        />
        <Button
          type="button"
          variant="signara"
          disabled={isPending || !draft}
          onClick={handleCreate}
        >
          {isPending && <Loader2 className="mr-1.5 size-4 animate-spin" />}
          Save signature
        </Button>
      </div>

      {error && <ErrorMessage>{error}</ErrorMessage>}
    </div>
  )
}
