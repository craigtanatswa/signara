import 'server-only'

const MAX_ENTRIES = 24
const MAX_AGE_MS = 10 * 60 * 1000

interface CacheEntry {
  buffer: Buffer
  filename?: string
  createdAt: number
}

const previewCache = new Map<string, CacheEntry>()

export function getCachedPreviewPdf(cacheKey: string): Buffer | null {
  const entry = previewCache.get(cacheKey)
  if (!entry) return null

  if (Date.now() - entry.createdAt > MAX_AGE_MS) {
    previewCache.delete(cacheKey)
    return null
  }

  return entry.buffer
}

export function setCachedPreviewPdf(cacheKey: string, buffer: Buffer): void {
  if (previewCache.size >= MAX_ENTRIES) {
    const oldestKey = previewCache.keys().next().value
    if (oldestKey) previewCache.delete(oldestKey)
  }

  previewCache.set(cacheKey, {
    buffer,
    createdAt: Date.now(),
  })
}

export function getCachedPdf(
  cacheKey: string
): { buffer: Buffer; filename?: string } | null {
  const entry = previewCache.get(cacheKey)
  if (!entry) return null

  if (Date.now() - entry.createdAt > MAX_AGE_MS) {
    previewCache.delete(cacheKey)
    return null
  }

  return { buffer: entry.buffer, filename: entry.filename }
}

export function setCachedPdf(
  cacheKey: string,
  buffer: Buffer,
  filename?: string
): void {
  if (previewCache.size >= MAX_ENTRIES) {
    const oldestKey = previewCache.keys().next().value
    if (oldestKey) previewCache.delete(oldestKey)
  }

  previewCache.set(cacheKey, {
    buffer,
    filename,
    createdAt: Date.now(),
  })
}
