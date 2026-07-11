/**
 * Shared coordinate helpers for uploaded-document field overlays.
 *
 * Field positions are stored as percentages (0–1) with a **top-left** origin
 * (matching the placement / fill-step UIs). pdf-lib uses a **bottom-left**
 * origin, so Y must be flipped when converting to PDF points.
 */

export interface PercentRect {
  x: number
  y: number
  width: number
  height: number
}

export interface PixelRect {
  left: number
  top: number
  width: number
  height: number
}

export interface PdfPointRect {
  pdfX: number
  pdfY: number
  pdfWidth: number
  pdfHeight: number
}

/** Convert percentage coords → CSS pixel box (top-left origin). */
export function percentToPixels(
  field: PercentRect,
  containerWidth: number,
  containerHeight: number
): PixelRect {
  return {
    left: field.x * containerWidth,
    top: field.y * containerHeight,
    width: field.width * containerWidth,
    height: field.height * containerHeight,
  }
}

/** Convert a CSS pixel box → percentage coords (top-left origin). */
export function pixelsToPercent(
  rect: PixelRect,
  containerWidth: number,
  containerHeight: number
): PercentRect {
  if (containerWidth <= 0 || containerHeight <= 0) {
    return { x: 0, y: 0, width: 0, height: 0 }
  }
  return {
    x: rect.left / containerWidth,
    y: rect.top / containerHeight,
    width: rect.width / containerWidth,
    height: rect.height / containerHeight,
  }
}

/**
 * Convert percentage coords (top-left origin) → pdf-lib points (bottom-left origin).
 *
 * ```
 * pdfX = field.x * pageWidth
 * pdfY = pageHeight - (field.y * pageHeight) - (field.height * pageHeight)
 * ```
 */
export function percentToPdfPoints(
  field: PercentRect,
  pageWidth: number,
  pageHeight: number
): PdfPointRect {
  const pdfWidth = field.width * pageWidth
  const pdfHeight = field.height * pageHeight
  const pdfX = field.x * pageWidth
  const pdfY = pageHeight - field.y * pageHeight - pdfHeight
  return { pdfX, pdfY, pdfWidth, pdfHeight }
}
