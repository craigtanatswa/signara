import { A4_PAGE_HEIGHT_PX, A4_PAGE_WIDTH_PX } from '@/lib/tiptap/a4-layout'

export const LETTERHEAD_RENDER_DPI = 300
export const LETTERHEAD_SCREEN_DPI = 96

/** Letterhead PNG dimensions — same aspect ratio as the template editor A4 page. */
export const A4_LETTERHEAD_WIDTH_PX = Math.round(
  A4_PAGE_WIDTH_PX * (LETTERHEAD_RENDER_DPI / LETTERHEAD_SCREEN_DPI)
)
export const A4_LETTERHEAD_HEIGHT_PX = Math.round(
  A4_PAGE_HEIGHT_PX * (LETTERHEAD_RENDER_DPI / LETTERHEAD_SCREEN_DPI)
)
