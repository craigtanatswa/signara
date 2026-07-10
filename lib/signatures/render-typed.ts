import { scaleSignatureDataUrl } from '@/lib/signatures/scale-signature'

/** Cursive fonts suitable for typed signatures (loaded via Google Fonts CSS). */
export const SIGNATURE_FONTS = [
  { id: 'great-vibes', family: 'Great Vibes', label: 'Great Vibes' },
  { id: 'dancing-script', family: 'Dancing Script', label: 'Dancing Script' },
  { id: 'allura', family: 'Allura', label: 'Allura' },
  { id: 'pacifico', family: 'Pacifico', label: 'Pacifico' },
] as const

export type SignatureFontId = (typeof SIGNATURE_FONTS)[number]['id']

const FONT_CSS =
  'https://fonts.googleapis.com/css2?family=Allura&family=Dancing+Script:wght@500;700&family=Great+Vibes&family=Pacifico&display=swap'

let fontsPromise: Promise<void> | null = null

/** Ensure signature fonts are available before rendering to canvas. */
export function ensureSignatureFonts(): Promise<void> {
  if (typeof document === 'undefined') return Promise.resolve()
  if (fontsPromise) return fontsPromise

  fontsPromise = (async () => {
    if (!document.querySelector('link[data-signara-signature-fonts]')) {
      const link = document.createElement('link')
      link.rel = 'stylesheet'
      link.href = FONT_CSS
      link.setAttribute('data-signara-signature-fonts', 'true')
      document.head.appendChild(link)
    }

    await Promise.all(
      SIGNATURE_FONTS.map(async (font) => {
        try {
          await document.fonts.load(`48px "${font.family}"`)
        } catch {
          // Fall through — canvas will use a fallback if the font fails.
        }
      })
    )
  })()

  return fontsPromise
}

export function getSignatureFontFamily(fontId: SignatureFontId): string {
  return SIGNATURE_FONTS.find((f) => f.id === fontId)?.family ?? 'Great Vibes'
}

/**
 * Render typed name as a transparent PNG data URL using a cursive font.
 */
export async function renderTypedSignature(
  text: string,
  fontId: SignatureFontId = 'great-vibes'
): Promise<string | null> {
  const trimmed = text.trim()
  if (!trimmed) return null

  await ensureSignatureFonts()

  const family = getSignatureFontFamily(fontId)
  const fontSize = 64
  const paddingX = 24
  const paddingY = 20

  const measure = document.createElement('canvas')
  const mctx = measure.getContext('2d')
  if (!mctx) return null

  mctx.font = `${fontSize}px "${family}", cursive`
  const metrics = mctx.measureText(trimmed)
  const textWidth = Math.ceil(metrics.width)
  const ascent = Math.ceil(metrics.actualBoundingBoxAscent || fontSize * 0.8)
  const descent = Math.ceil(metrics.actualBoundingBoxDescent || fontSize * 0.3)

  const canvas = document.createElement('canvas')
  canvas.width = Math.max(1, textWidth + paddingX * 2)
  canvas.height = Math.max(1, ascent + descent + paddingY * 2)
  const ctx = canvas.getContext('2d')
  if (!ctx) return null

  ctx.clearRect(0, 0, canvas.width, canvas.height)
  ctx.font = `${fontSize}px "${family}", cursive`
  ctx.fillStyle = '#0F2C59'
  ctx.textBaseline = 'alphabetic'
  ctx.fillText(trimmed, paddingX, paddingY + ascent)

  return scaleSignatureDataUrl(canvas.toDataURL('image/png'))
}
