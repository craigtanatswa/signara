'use client'

import { useRef } from 'react'
import SignatureCanvas from 'react-signature-canvas'
import { Eraser } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Label } from '@/components/ui/label'

interface SignaturePadProps {
  onChange: (dataUrl: string | null) => void
}

export function SignaturePad({ onChange }: SignaturePadProps) {
  const canvasRef = useRef<SignatureCanvas>(null)

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

  return (
    <div className="space-y-1.5">
      <div className="flex items-center justify-between">
        <Label className="text-signara-navy font-medium">Your signature</Label>
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
      <p className="text-xs text-signara-steel">Draw your signature above using your mouse or touchscreen.</p>
    </div>
  )
}
