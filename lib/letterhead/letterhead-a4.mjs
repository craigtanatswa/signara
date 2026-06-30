/** Shared A4 letterhead dimensions for Node workers (keep in sync with page-size.ts). */
export const LETTERHEAD_RENDER_DPI = 300
export const LETTERHEAD_SCREEN_DPI = 96
export const PORTRAIT_PAGE_WIDTH_PX = 794
export const PORTRAIT_PAGE_HEIGHT_PX = 1123

export function getLetterheadDimensions(orientation = 'portrait') {
  const isLandscape = orientation === 'landscape'
  const pageWidthPx = isLandscape ? PORTRAIT_PAGE_HEIGHT_PX : PORTRAIT_PAGE_WIDTH_PX
  const pageHeightPx = isLandscape ? PORTRAIT_PAGE_WIDTH_PX : PORTRAIT_PAGE_HEIGHT_PX

  return {
    widthPx: Math.round(pageWidthPx * (LETTERHEAD_RENDER_DPI / LETTERHEAD_SCREEN_DPI)),
    heightPx: Math.round(pageHeightPx * (LETTERHEAD_RENDER_DPI / LETTERHEAD_SCREEN_DPI)),
  }
}

/** @deprecated Use getLetterheadDimensions('portrait') */
export const A4_PAGE_WIDTH_PX = PORTRAIT_PAGE_WIDTH_PX
/** @deprecated Use getLetterheadDimensions('portrait') */
export const A4_PAGE_HEIGHT_PX = PORTRAIT_PAGE_HEIGHT_PX

const portraitLetterhead = getLetterheadDimensions('portrait')
/** @deprecated Use getLetterheadDimensions */
export const A4_LETTERHEAD_WIDTH_PX = portraitLetterhead.widthPx
/** @deprecated Use getLetterheadDimensions */
export const A4_LETTERHEAD_HEIGHT_PX = portraitLetterhead.heightPx

/** Match CSS object-contain + object-top used in the template editor. */
export function drawContainTop(context, sourceCanvas, targetWidth, targetHeight) {
  const sourceWidth = sourceCanvas.width
  const sourceHeight = sourceCanvas.height
  const scale = Math.min(targetWidth / sourceWidth, targetHeight / sourceHeight)
  const drawWidth = sourceWidth * scale
  const drawHeight = sourceHeight * scale
  const offsetX = (targetWidth - drawWidth) / 2
  const offsetY = 0

  context.drawImage(sourceCanvas, offsetX, offsetY, drawWidth, drawHeight)
}
