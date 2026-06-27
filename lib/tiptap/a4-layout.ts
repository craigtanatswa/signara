/** Visual A4 layout constants — aligned with PDF preview margins (48pt / 56pt). */
export const A4_PAGE_WIDTH_PX = 794
export const A4_PAGE_HEIGHT_PX = 1123
export const A4_PAGE_GAP_PX = 24
export const A4_PAGE_PADDING_X_PX = 56
export const A4_PAGE_PADDING_Y_PX = 48

export const A4_PAGE_CYCLE_PX = A4_PAGE_HEIGHT_PX + A4_PAGE_GAP_PX

export function getA4PageCount(contentHeightPx: number): number {
  return Math.max(1, Math.ceil(contentHeightPx / A4_PAGE_CYCLE_PX))
}
