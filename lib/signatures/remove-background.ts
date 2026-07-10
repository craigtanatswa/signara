/**
 * Client-side signature image cleanup: remove paper/scan backgrounds and
 * produce a transparent PNG cropped tightly around the ink.
 *
 * Strategy:
 * 1. Estimate background from corner samples (typical for scanned signatures).
 * 2. Soft-threshold pixels by colour distance to that background and by
 *    luminance — light paper becomes transparent; dark ink stays opaque.
 * 3. Auto-crop empty margins.
 */

const MAX_DIMENSION = 1200
const CORNER_SAMPLE = 8
const BG_DISTANCE_HARD = 38
const BG_DISTANCE_SOFT = 72
const LUMINANCE_HARD = 235
const LUMINANCE_SOFT = 210
const MIN_INK_ALPHA = 12

function luminance(r: number, g: number, b: number): number {
  return 0.299 * r + 0.587 * g + 0.114 * b
}

function colourDistance(
  r: number,
  g: number,
  b: number,
  br: number,
  bg: number,
  bb: number
): number {
  const dr = r - br
  const dg = g - bg
  const db = b - bb
  return Math.sqrt(dr * dr + dg * dg + db * db)
}

function estimateBackground(data: Uint8ClampedArray, width: number, height: number) {
  const samples: Array<[number, number, number]> = []
  const corners: Array<[number, number]> = [
    [0, 0],
    [Math.max(0, width - CORNER_SAMPLE), 0],
    [0, Math.max(0, height - CORNER_SAMPLE)],
    [Math.max(0, width - CORNER_SAMPLE), Math.max(0, height - CORNER_SAMPLE)],
  ]

  for (const [sx, sy] of corners) {
    for (let y = sy; y < Math.min(sy + CORNER_SAMPLE, height); y++) {
      for (let x = sx; x < Math.min(sx + CORNER_SAMPLE, width); x++) {
        const i = (y * width + x) * 4
        samples.push([data[i], data[i + 1], data[i + 2]])
      }
    }
  }

  // Median per channel — robust against stray ink in a corner.
  const channel = (idx: 0 | 1 | 2) => {
    const values = samples.map((s) => s[idx]).sort((a, b) => a - b)
    return values[Math.floor(values.length / 2)] ?? 255
  }

  return { r: channel(0), g: channel(1), b: channel(2) }
}

function loadImage(src: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image()
    img.onload = () => resolve(img)
    img.onerror = () => reject(new Error('Could not load the image.'))
    img.src = src
  })
}

function readFileAsDataUrl(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = () => {
      if (typeof reader.result === 'string') resolve(reader.result)
      else reject(new Error('Could not read the file.'))
    }
    reader.onerror = () => reject(new Error('Could not read the file.'))
    reader.readAsDataURL(file)
  })
}

function trimTransparent(canvas: HTMLCanvasElement): HTMLCanvasElement {
  const ctx = canvas.getContext('2d')
  if (!ctx) return canvas

  const { width, height } = canvas
  const { data } = ctx.getImageData(0, 0, width, height)

  let top = height
  let left = width
  let right = 0
  let bottom = 0
  let found = false

  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      if (data[(y * width + x) * 4 + 3] > MIN_INK_ALPHA) {
        found = true
        if (x < left) left = x
        if (x > right) right = x
        if (y < top) top = y
        if (y > bottom) bottom = y
      }
    }
  }

  if (!found) return canvas

  const pad = 4
  const cropX = Math.max(0, left - pad)
  const cropY = Math.max(0, top - pad)
  const cropW = Math.min(width - cropX, right - left + 1 + pad * 2)
  const cropH = Math.min(height - cropY, bottom - top + 1 + pad * 2)

  const trimmed = document.createElement('canvas')
  trimmed.width = cropW
  trimmed.height = cropH
  const tctx = trimmed.getContext('2d')
  if (!tctx) return canvas
  tctx.drawImage(canvas, cropX, cropY, cropW, cropH, 0, 0, cropW, cropH)
  return trimmed
}

/**
 * Process an uploaded signature image into a transparent, cropped PNG data URL.
 */
export async function processSignatureUpload(file: File): Promise<string> {
  if (!file.type.startsWith('image/')) {
    throw new Error('Please upload an image file (PNG, JPG, or WebP).')
  }
  if (file.size > 8 * 1024 * 1024) {
    throw new Error('Image must be smaller than 8 MB.')
  }

  const dataUrl = await readFileAsDataUrl(file)
  const img = await loadImage(dataUrl)

  let width = img.naturalWidth || img.width
  let height = img.naturalHeight || img.height
  if (width < 1 || height < 1) {
    throw new Error('Invalid image dimensions.')
  }

  const scale = Math.min(1, MAX_DIMENSION / Math.max(width, height))
  width = Math.max(1, Math.round(width * scale))
  height = Math.max(1, Math.round(height * scale))

  const canvas = document.createElement('canvas')
  canvas.width = width
  canvas.height = height
  const ctx = canvas.getContext('2d', { willReadFrequently: true })
  if (!ctx) throw new Error('Could not process the image.')

  ctx.drawImage(img, 0, 0, width, height)
  const imageData = ctx.getImageData(0, 0, width, height)
  const { data } = imageData
  const bg = estimateBackground(data, width, height)

  for (let i = 0; i < data.length; i += 4) {
    const r = data[i]
    const g = data[i + 1]
    const b = data[i + 2]
    const a = data[i + 3]
    if (a === 0) continue

    const dist = colourDistance(r, g, b, bg.r, bg.g, bg.b)
    const lum = luminance(r, g, b)

    // Fully transparent if clearly background / near-white paper.
    if (dist <= BG_DISTANCE_HARD || lum >= LUMINANCE_HARD) {
      data[i + 3] = 0
      continue
    }

    // Soft edge: fade alpha as we approach background colour / light paper.
    let alpha = a
    if (dist < BG_DISTANCE_SOFT) {
      const t = (dist - BG_DISTANCE_HARD) / (BG_DISTANCE_SOFT - BG_DISTANCE_HARD)
      alpha = Math.round(alpha * Math.max(0, Math.min(1, t)))
    }
    if (lum > LUMINANCE_SOFT) {
      const t = (LUMINANCE_HARD - lum) / (LUMINANCE_HARD - LUMINANCE_SOFT)
      alpha = Math.round(alpha * Math.max(0, Math.min(1, t)))
    }

    // Darken remaining ink slightly toward navy for a cleaner stamp look.
    if (alpha > 0) {
      const inkStrength = 1 - Math.min(1, lum / 255)
      data[i] = Math.round(r * (1 - inkStrength * 0.35) + 15 * inkStrength * 0.35)
      data[i + 1] = Math.round(g * (1 - inkStrength * 0.35) + 44 * inkStrength * 0.35)
      data[i + 2] = Math.round(b * (1 - inkStrength * 0.35) + 89 * inkStrength * 0.35)
      data[i + 3] = alpha
    } else {
      data[i + 3] = 0
    }
  }

  ctx.putImageData(imageData, 0, 0)
  const trimmed = trimTransparent(canvas)
  return trimmed.toDataURL('image/png')
}
