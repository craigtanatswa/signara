import { SIGNATURE_DISPLAY_SCALE } from '@/lib/signatures/constants'

function loadImage(src: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image()
    img.onload = () => resolve(img)
    img.onerror = () => reject(new Error('Could not load the signature image.'))
    img.src = src
  })
}

/**
 * Downscale a signature PNG data URL so draw, type, and upload outputs match.
 */
export async function scaleSignatureDataUrl(
  dataUrl: string,
  scale = SIGNATURE_DISPLAY_SCALE
): Promise<string> {
  if (scale >= 1) return dataUrl

  const img = await loadImage(dataUrl)
  const sourceWidth = img.naturalWidth || img.width
  const sourceHeight = img.naturalHeight || img.height
  if (sourceWidth < 1 || sourceHeight < 1) return dataUrl

  const width = Math.max(1, Math.round(sourceWidth * scale))
  const height = Math.max(1, Math.round(sourceHeight * scale))

  const canvas = document.createElement('canvas')
  canvas.width = width
  canvas.height = height
  const ctx = canvas.getContext('2d')
  if (!ctx) return dataUrl

  ctx.drawImage(img, 0, 0, width, height)
  return canvas.toDataURL('image/png')
}
