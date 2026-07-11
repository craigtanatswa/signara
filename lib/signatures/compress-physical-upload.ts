/**
 * Shrink large phone photos before upload so physical-signature approve stays fast.
 * PDFs and already-small images are returned unchanged.
 */
export async function compressPhysicalSignatureFile(file: File): Promise<File> {
  if (!file.type.startsWith('image/')) return file
  if (file.size < 900_000) return file

  try {
    const bitmap = await createImageBitmap(file)
    const maxEdge = 2000
    const scale = Math.min(1, maxEdge / Math.max(bitmap.width, bitmap.height))
    const width = Math.max(1, Math.round(bitmap.width * scale))
    const height = Math.max(1, Math.round(bitmap.height * scale))

    const canvas = document.createElement('canvas')
    canvas.width = width
    canvas.height = height
    const ctx = canvas.getContext('2d')
    if (!ctx) {
      bitmap.close()
      return file
    }

    ctx.drawImage(bitmap, 0, 0, width, height)
    bitmap.close()

    const blob = await new Promise<Blob | null>((resolve) =>
      canvas.toBlob(resolve, 'image/jpeg', 0.82)
    )
    if (!blob || blob.size >= file.size) return file

    const baseName = file.name.replace(/\.[^.]+$/, '') || 'signed-document'
    return new File([blob], `${baseName}.jpg`, { type: 'image/jpeg' })
  } catch {
    return file
  }
}
