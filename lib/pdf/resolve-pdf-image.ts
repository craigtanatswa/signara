import 'server-only'

import { createCanvas, loadImage } from '@napi-rs/canvas'

const resolvedImageCache = new Map<string, string>()

/** Cap embedded PDF images so letterheads don't blow up render time/memory. */
const MAX_PDF_IMAGE_WIDTH = 1200

async function downscaleImageBuffer(
  buffer: Buffer,
  contentType: string,
  maxWidth = MAX_PDF_IMAGE_WIDTH
): Promise<{ buffer: Buffer; contentType: string }> {
  if (!contentType.startsWith('image/')) return { buffer, contentType }

  try {
    const img = await loadImage(buffer)
    if (img.width <= maxWidth) return { buffer, contentType }

    const height = Math.max(1, Math.round((img.height * maxWidth) / img.width))
    const canvas = createCanvas(maxWidth, height)
    const ctx = canvas.getContext('2d')
    ctx.drawImage(img, 0, 0, maxWidth, height)

    // Keep PNG when source has transparency (logos/signatures); JPEG for letterheads.
    if (contentType.includes('png') || contentType.includes('webp')) {
      return { buffer: canvas.toBuffer('image/png'), contentType: 'image/png' }
    }

    return {
      buffer: canvas.toBuffer('image/jpeg', 0.82),
      contentType: 'image/jpeg',
    }
  } catch {
    return { buffer, contentType }
  }
}

export async function resolvePdfImageSrc(url: string | null | undefined): Promise<string | null> {
  if (!url) return null

  // Already embeddable for @react-pdf/renderer Image
  if (url.startsWith('data:image/')) return url

  // Physical / print signature sentinel — not an image
  if (url === 'physical') return null

  const cached = resolvedImageCache.get(url)
  if (cached) return cached

  try {
    const response = await fetch(url)
    if (!response.ok) return null

    const rawBuffer = Buffer.from(await response.arrayBuffer())
    const rawType = response.headers.get('content-type') ?? 'image/png'
    const { buffer, contentType } = await downscaleImageBuffer(rawBuffer, rawType)
    const dataUri = `data:${contentType};base64,${buffer.toString('base64')}`
    resolvedImageCache.set(url, dataUri)
    return dataUri
  } catch {
    return null
  }
}

export async function resolveOrganisationBrandingForPdf(
  branding: {
    logoUrl: string | null
    letterheadUrl: string | null
    letterheadLandscapeUrl?: string | null
  } | null | undefined
): Promise<{
  logoUrl: string | null
  letterheadUrl: string | null
  letterheadLandscapeUrl: string | null
}> {
  const source = branding ?? {
    logoUrl: null,
    letterheadUrl: null,
    letterheadLandscapeUrl: null,
  }

  const [logoUrl, letterheadUrl, letterheadLandscapeUrl] = await Promise.all([
    resolvePdfImageSrc(source.logoUrl),
    resolvePdfImageSrc(source.letterheadUrl),
    resolvePdfImageSrc(source.letterheadLandscapeUrl ?? null),
  ])

  return { logoUrl, letterheadUrl, letterheadLandscapeUrl }
}

/**
 * Resolve only the branding assets the template actually uses (and only the
 * letterhead orientation needed). Cuts unnecessary storage/network fetches.
 */
export async function resolveOrganisationBrandingForTemplate(input: {
  logoUrl: string | null
  letterheadUrl: string | null
  letterheadLandscapeUrl?: string | null
  useLogo: boolean
  useLetterhead: boolean
  orientation: 'portrait' | 'landscape'
}): Promise<{
  logoUrl: string | null
  letterheadUrl: string | null
  letterheadLandscapeUrl: string | null
}> {
  const isLandscape = input.orientation === 'landscape'
  const letterheadSource = isLandscape
    ? input.letterheadLandscapeUrl || input.letterheadUrl
    : input.letterheadUrl

  const [logoUrl, letterheadResolved] = await Promise.all([
    input.useLogo ? resolvePdfImageSrc(input.logoUrl) : Promise.resolve(null),
    input.useLetterhead ? resolvePdfImageSrc(letterheadSource) : Promise.resolve(null),
  ])

  return {
    logoUrl,
    letterheadUrl: isLandscape ? null : letterheadResolved,
    letterheadLandscapeUrl: isLandscape ? letterheadResolved : null,
  }
}
