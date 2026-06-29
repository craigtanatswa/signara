/** Shared A4 letterhead dimensions for Node workers (keep in sync with constants.ts). */
export const LETTERHEAD_RENDER_DPI = 300
export const LETTERHEAD_SCREEN_DPI = 96
export const A4_PAGE_WIDTH_PX = 794
export const A4_PAGE_HEIGHT_PX = 1123

export const A4_LETTERHEAD_WIDTH_PX = Math.round(
  A4_PAGE_WIDTH_PX * (LETTERHEAD_RENDER_DPI / LETTERHEAD_SCREEN_DPI)
)
export const A4_LETTERHEAD_HEIGHT_PX = Math.round(
  A4_PAGE_HEIGHT_PX * (LETTERHEAD_RENDER_DPI / LETTERHEAD_SCREEN_DPI)
)

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
