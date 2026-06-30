import type { PageOrientation } from '@/types/database'
import { getPageLayout } from '@/lib/tiptap/page-size'

export { LETTERHEAD_RENDER_DPI, LETTERHEAD_SCREEN_DPI } from '@/lib/tiptap/page-size'

export function getLetterheadDimensions(orientation: PageOrientation = 'portrait') {
  const layout = getPageLayout(orientation)
  return {
    widthPx: layout.letterheadWidthPx,
    heightPx: layout.letterheadHeightPx,
  }
}

/** @deprecated Use getLetterheadDimensions('portrait') */
export const A4_LETTERHEAD_WIDTH_PX = getLetterheadDimensions('portrait').widthPx
/** @deprecated Use getLetterheadDimensions('portrait') */
export const A4_LETTERHEAD_HEIGHT_PX = getLetterheadDimensions('portrait').heightPx
