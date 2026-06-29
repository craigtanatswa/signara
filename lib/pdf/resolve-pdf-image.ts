/**
 * react-pdf often cannot render remote storage URLs (CORS). Fetch and convert to a
 * data URI so logos and letterheads appear reliably in PDFViewer.
 */
const resolvedImageCache = new Map<string, string>()

export async function resolvePdfImageSrc(url: string | null): Promise<string | null> {
  if (!url) return null
  if (url.startsWith('data:')) return url

  const cached = resolvedImageCache.get(url)
  if (cached) return cached

  try {
    const response = await fetch(url, { mode: 'cors', cache: 'no-store' })
    if (!response.ok) {
      return url
    }

    const blob = await response.blob()
    const dataUri = await new Promise<string>((resolve, reject) => {
      const reader = new FileReader()
      reader.onloadend = () => {
        if (typeof reader.result === 'string') {
          resolve(reader.result)
        } else {
          reject(new Error('Failed to read image'))
        }
      }
      reader.onerror = () => reject(reader.error)
      reader.readAsDataURL(blob)
    })
    resolvedImageCache.set(url, dataUri)
    return dataUri
  } catch {
    return url
  }
}

export async function resolveOrganisationBrandingForPdf(
  branding: { logoUrl: string | null; letterheadUrl: string | null } | null | undefined
): Promise<{ logoUrl: string | null; letterheadUrl: string | null }> {
  const source = branding ?? { logoUrl: null, letterheadUrl: null }

  const [logoUrl, letterheadUrl] = await Promise.all([
    resolvePdfImageSrc(source.logoUrl),
    resolvePdfImageSrc(source.letterheadUrl),
  ])

  return { logoUrl, letterheadUrl }
}
