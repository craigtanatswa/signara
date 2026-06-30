import type { OrganisationBranding, PageOrientation } from '@/types/database'

/** Visual A4 layout at 96 DPI — aligned with PDF preview margins (48pt / 56pt). */
export const PORTRAIT_PAGE_WIDTH_PX = 794
export const PORTRAIT_PAGE_HEIGHT_PX = 1123
export const PAGE_GAP_PX = 24
export const PAGE_PADDING_X_PX = 56
export const PAGE_PADDING_Y_PX = 48

export const PORTRAIT_WIDTH_PT = 595.28
export const PORTRAIT_HEIGHT_PT = 841.89

/** Reserved height at the top of each page for the organisation logo band. */
export const ORG_LOGO_BLOCK_HEIGHT_PX = 117
export const ORG_LOGO_MAX_HEIGHT_PX = 80
export const ORG_LOGO_MAX_WIDTH_PORTRAIT_PX = 280
export const ORG_LOGO_MAX_WIDTH_LANDSCAPE_PX = 400

export const LETTERHEAD_RENDER_DPI = 300
export const LETTERHEAD_SCREEN_DPI = 96

export interface PageLayout {
  orientation: PageOrientation
  widthPx: number
  heightPx: number
  widthPt: number
  heightPt: number
  paddingXPx: number
  paddingYPx: number
  pageGapPx: number
  pageCyclePx: number
  logoBlockHeightPx: number
  logoMaxHeightPx: number
  logoMaxWidthPx: number
  letterheadWidthPx: number
  letterheadHeightPx: number
}

function letterheadPx(pageWidthPx: number, pageHeightPx: number) {
  return {
    letterheadWidthPx: Math.round(
      pageWidthPx * (LETTERHEAD_RENDER_DPI / LETTERHEAD_SCREEN_DPI)
    ),
    letterheadHeightPx: Math.round(
      pageHeightPx * (LETTERHEAD_RENDER_DPI / LETTERHEAD_SCREEN_DPI)
    ),
  }
}

export function getPageLayout(orientation: PageOrientation = 'portrait'): PageLayout {
  const isLandscape = orientation === 'landscape'
  const widthPx = isLandscape ? PORTRAIT_PAGE_HEIGHT_PX : PORTRAIT_PAGE_WIDTH_PX
  const heightPx = isLandscape ? PORTRAIT_PAGE_WIDTH_PX : PORTRAIT_PAGE_HEIGHT_PX
  const widthPt = isLandscape ? PORTRAIT_HEIGHT_PT : PORTRAIT_WIDTH_PT
  const heightPt = isLandscape ? PORTRAIT_WIDTH_PT : PORTRAIT_HEIGHT_PT
  const { letterheadWidthPx, letterheadHeightPx } = letterheadPx(widthPx, heightPx)

  return {
    orientation,
    widthPx,
    heightPx,
    widthPt,
    heightPt,
    paddingXPx: PAGE_PADDING_X_PX,
    paddingYPx: PAGE_PADDING_Y_PX,
    pageGapPx: PAGE_GAP_PX,
    pageCyclePx: heightPx + PAGE_GAP_PX,
    logoBlockHeightPx: ORG_LOGO_BLOCK_HEIGHT_PX,
    logoMaxHeightPx: ORG_LOGO_MAX_HEIGHT_PX,
    logoMaxWidthPx: isLandscape
      ? ORG_LOGO_MAX_WIDTH_LANDSCAPE_PX
      : ORG_LOGO_MAX_WIDTH_PORTRAIT_PX,
    letterheadWidthPx,
    letterheadHeightPx,
  }
}

export function getPageCount(contentHeightPx: number, layout: PageLayout): number {
  return Math.max(1, Math.ceil(contentHeightPx / layout.pageCyclePx))
}

export function getCanvasHeightPx(contentHeightPx: number, layout: PageLayout): number {
  const pageCount = getPageCount(contentHeightPx, layout)
  return pageCount * layout.heightPx + (pageCount - 1) * layout.pageGapPx
}

export function resolveLetterheadUrl(
  branding: OrganisationBranding | null | undefined,
  orientation: PageOrientation
): string | null {
  if (!branding) return null
  if (orientation === 'landscape') {
    return branding.letterheadLandscapeUrl ?? null
  }
  return branding.letterheadUrl ?? null
}

export function hasLetterheadForOrientation(
  branding: OrganisationBranding | null | undefined,
  orientation: PageOrientation
): boolean {
  return Boolean(resolveLetterheadUrl(branding, orientation))
}

export function formatPageOrientationLabel(orientation: PageOrientation): string {
  return orientation === 'landscape' ? 'Landscape' : 'Portrait'
}
