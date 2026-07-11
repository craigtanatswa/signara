/** Browser-safe branding image resolver for client PDF preview/download. */

const resolvedImageCache = new Map<string, string>()

/** Cap embedded PDF images so letterheads don't blow up render time/memory. */
const MAX_PDF_IMAGE_WIDTH = 1200

function arrayBufferToBase64(buffer: ArrayBuffer): string {
  const bytes = new Uint8Array(buffer)
  let binary = ''
  const chunk = 0x8000
  for (let i = 0; i < bytes.length; i += chunk) {
    binary += String.fromCharCode(...bytes.subarray(i, i + chunk))
  }
  return btoa(binary)
}

function proxiedAssetUrl(url: string): string {
  // Same-origin proxy avoids CORS when fetching Supabase public assets in the browser.
  return `/api/branding-asset?src=${encodeURIComponent(url)}`
}

async function downscaleImageBlob(
  blob: Blob,
  contentType: string,
  maxWidth = MAX_PDF_IMAGE_WIDTH
): Promise<{ dataUri: string; contentType: string }> {
  if (!contentType.startsWith('image/') || typeof createImageBitmap === 'undefined') {
    const buffer = await blob.arrayBuffer()
    return {
      dataUri: `data:${contentType};base64,${arrayBufferToBase64(buffer)}`,
      contentType,
    }
  }

  try {
    const bitmap = await createImageBitmap(blob)
    if (bitmap.width <= maxWidth) {
      bitmap.close()
      const buffer = await blob.arrayBuffer()
      return {
        dataUri: `data:${contentType};base64,${arrayBufferToBase64(buffer)}`,
        contentType,
      }
    }

    const height = Math.max(1, Math.round((bitmap.height * maxWidth) / bitmap.width))
    const canvas = document.createElement('canvas')
    canvas.width = maxWidth
    canvas.height = height
    const ctx = canvas.getContext('2d')
    if (!ctx) {
      bitmap.close()
      const buffer = await blob.arrayBuffer()
      return {
        dataUri: `data:${contentType};base64,${arrayBufferToBase64(buffer)}`,
        contentType,
      }
    }

    ctx.drawImage(bitmap, 0, 0, maxWidth, height)
    bitmap.close()

    const keepPng = contentType.includes('png') || contentType.includes('webp')
    const outputType = keepPng ? 'image/png' : 'image/jpeg'
    const dataUri = canvas.toDataURL(outputType, keepPng ? undefined : 0.82)
    return { dataUri, contentType: outputType }
  } catch {
    const buffer = await blob.arrayBuffer()
    return {
      dataUri: `data:${contentType};base64,${arrayBufferToBase64(buffer)}`,
      contentType,
    }
  }
}

async function resolvePdfImageSrc(url: string | null | undefined): Promise<string | null> {
  if (!url) return null
  if (url.startsWith('data:image/')) return url
  if (url === 'physical') return null

  const cached = resolvedImageCache.get(url)
  if (cached) return cached

  try {
    const response = await fetch(proxiedAssetUrl(url))
    if (!response.ok) return null

    const blob = await response.blob()
    const contentType = response.headers.get('content-type') ?? blob.type ?? 'image/png'
    const { dataUri } = await downscaleImageBlob(blob, contentType)
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
