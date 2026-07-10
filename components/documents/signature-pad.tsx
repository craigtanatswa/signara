'use client'

import { useRef } from 'react'
import SignatureCanvas from 'react-signature-canvas'
import { Eraser } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Label } from '@/components/ui/label'

interface SignaturePadProps {
  onChange: (dataUrl: string | null) => void
  /** When set, shows the saved signature instead of an empty pad until cleared. */
  value?: string | null
  label?: string
}

export function SignaturePad({
  onChange,
  value = null,
  label = 'Your signature',
}: SignaturePadProps) {
  const canvasRef = useRef<SignatureCanvas>(null)
  const hasSavedValue = Boolean(value && value.startsWith('data:image/'))

  function handleEnd() {
    const canvas = canvasRef.current
    if (!canvas || canvas.isEmpty()) {
      onChange(null)
      return
    }
    onChange(canvas.getTrimmedCanvas().toDataURL('image/png'))
  }

  function handleClear() {
    canvasRef.current?.clear()
    onChange(null)
  }

  if (hasSavedValue) {
    return (
      <div className="space-y-1.5">
        <div className="flex items-center justify-between">
          <Label className="font-medium text-signara-navy">{label}</Label>
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
        <div className="rounded-md border border-signara-steel bg-white p-3">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={value!} alt={label} className="max-h-32 w-auto" />
        </div>
      </div>
    )
  }

  return (
    <div className="space-y-1.5">
      <div className="flex items-center justify-between">
        <Label className="font-medium text-signara-navy">{label}</Label>
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
      <div className="rounded-md border border-signara-steel bg-signara-background/40">
        <SignatureCanvas
          ref={canvasRef}
          penColor="#0F2C59"
          canvasProps={{ className: 'h-40 w-full touch-none' }}
          onEnd={handleEnd}
        />
      </div>
      <span className="block text-xs text-signara-steel">
        Draw your signature above using your mouse or touchscreen.
      </span>
    </div>
  )
}
