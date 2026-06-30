/** @deprecated Import from `@/lib/tiptap/page-size` instead. Re-exports for backward compatibility. */
export {
  PORTRAIT_PAGE_WIDTH_PX as A4_PAGE_WIDTH_PX,
  PORTRAIT_PAGE_HEIGHT_PX as A4_PAGE_HEIGHT_PX,
  PAGE_GAP_PX as A4_PAGE_GAP_PX,
  PAGE_PADDING_X_PX as A4_PAGE_PADDING_X_PX,
  PAGE_PADDING_Y_PX as A4_PAGE_PADDING_Y_PX,
  ORG_LOGO_BLOCK_HEIGHT_PX,
  ORG_LOGO_MAX_HEIGHT_PX,
  ORG_LOGO_MAX_WIDTH_PORTRAIT_PX as ORG_LOGO_MAX_WIDTH_PX,
  getPageLayout,
  getPageCount as getA4PageCount,
  getCanvasHeightPx as getA4CanvasHeightPx,
} from '@/lib/tiptap/page-size'

import { getPageLayout } from '@/lib/tiptap/page-size'

const portraitLayout = getPageLayout('portrait')

/** @deprecated Use `getPageLayout('portrait').pageCyclePx` */
export const A4_PAGE_CYCLE_PX = portraitLayout.pageCyclePx
