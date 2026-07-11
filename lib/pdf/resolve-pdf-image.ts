const resolvedImageCache = new Map<string, string>()

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

    const buffer = Buffer.from(await response.arrayBuffer())
    const contentType = response.headers.get('content-type') ?? 'image/png'
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
