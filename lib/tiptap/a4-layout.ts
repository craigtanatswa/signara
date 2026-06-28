/** Visual A4 layout constants — aligned with PDF preview margins (48pt / 56pt). */
export const A4_PAGE_WIDTH_PX = 794
export const A4_PAGE_HEIGHT_PX = 1123
export const A4_PAGE_GAP_PX = 24
export const A4_PAGE_PADDING_X_PX = 56
export const A4_PAGE_PADDING_Y_PX = 48

export const A4_PAGE_CYCLE_PX = A4_PAGE_HEIGHT_PX + A4_PAGE_GAP_PX

/** Reserved height at the top of each page for the organisation logo band. */
export const ORG_LOGO_BLOCK_HEIGHT_PX = 117
export const ORG_LOGO_MAX_HEIGHT_PX = 80
export const ORG_LOGO_MAX_WIDTH_PX = 280

export function getA4PageCount(contentHeightPx: number): number {
  return Math.max(1, Math.ceil(contentHeightPx / A4_PAGE_CYCLE_PX))
}

/** Full visual canvas height for N pages (white pages + grey gaps between). */
export function getA4CanvasHeightPx(contentHeightPx: number): number {
  const pageCount = getA4PageCount(contentHeightPx)
  return pageCount * A4_PAGE_HEIGHT_PX + (pageCount - 1) * A4_PAGE_GAP_PX
}
