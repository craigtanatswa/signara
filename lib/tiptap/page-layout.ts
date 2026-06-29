import {
  A4_PAGE_CYCLE_PX,
  A4_PAGE_HEIGHT_PX,
  A4_PAGE_PADDING_Y_PX,
  ORG_LOGO_BLOCK_HEIGHT_PX,
} from '@/lib/tiptap/a4-layout'

export function getPageTopInset(hasLogo: boolean): number {
  return hasLogo ? ORG_LOGO_BLOCK_HEIGHT_PX : A4_PAGE_PADDING_Y_PX
}

export function getPageBottomInset(): number {
  return A4_PAGE_PADDING_Y_PX
}

export function getPageContentEnd(cycleIndex: number): number {
  return (
    cycleIndex * A4_PAGE_CYCLE_PX + A4_PAGE_HEIGHT_PX - getPageBottomInset()
  )
}

export function getNextPageContentStart(blockTop: number, hasLogo: boolean): number {
  const cycleIndex = Math.floor(blockTop / A4_PAGE_CYCLE_PX)
  return (cycleIndex + 1) * A4_PAGE_CYCLE_PX + getPageTopInset(hasLogo)
}

export function blockOverlapsPageGap(
  blockTop: number,
  blockHeight: number,
  hasLogo: boolean
): boolean {
  if (blockHeight <= 0) return false

  const blockBottom = blockTop + blockHeight
  const startCycle = Math.floor(blockTop / A4_PAGE_CYCLE_PX)
  const endCycle = Math.floor(Math.max(0, blockBottom - 0.001) / A4_PAGE_CYCLE_PX)

  for (let cycleIndex = startCycle; cycleIndex <= endCycle; cycleIndex++) {
    const pageStart = cycleIndex * A4_PAGE_CYCLE_PX
    const greyStart = pageStart + A4_PAGE_HEIGHT_PX
    const greyEnd = pageStart + A4_PAGE_CYCLE_PX
    const contentStart = pageStart + getPageTopInset(hasLogo)
    const contentEnd = getPageContentEnd(cycleIndex)

    // Block starts inside the grey gap zone between two pages.
    if (blockTop >= greyStart && blockTop < greyEnd) {
      return true
    }

    // Block straddles the grey gap zone.
    if (blockBottom > greyStart && blockTop < greyEnd) {
      return true
    }

    // Block starts in the bottom-margin zone (past contentEnd, before the grey gap).
    if (blockTop >= contentEnd && blockTop < greyStart) {
      return true
    }

    // Block starts in the writable area but overflows past the bottom margin.
    if (blockTop >= contentStart && blockTop < contentEnd && blockBottom > contentEnd + 0.5) {
      return true
    }

    // Block starts inside the logo band of page 2+ (cycle > 0).
    // Cycle 0's logo area is protected by CSS padding-top on .tiptap; for all
    // subsequent pages the spacer must push the block down to contentStart.
    if (hasLogo && cycleIndex > 0 && blockTop >= pageStart && blockTop < contentStart) {
      return true
    }
  }

  return false
}

export function calcPageGapSpacerHeight(blockTop: number, hasLogo: boolean): number {
  const cycleIndex = Math.floor(blockTop / A4_PAGE_CYCLE_PX)
  const pageStart = cycleIndex * A4_PAGE_CYCLE_PX
  const contentStart = pageStart + getPageTopInset(hasLogo)

  // Block is inside the logo band of THIS cycle's page (page 2+) → push it
  // down to the writable area of the same page, not to the next page.
  if (hasLogo && cycleIndex > 0 && blockTop < contentStart) {
    return Math.max(1, Math.ceil(contentStart - blockTop))
  }

  // Block overlaps the grey gap or bottom margin → push to the NEXT page's
  // writable area start.
  return Math.max(1, Math.ceil(getNextPageContentStart(blockTop, hasLogo) - blockTop))
}

/**
 * Total spacer height needed before a block when laid out at `flowTop`.
 * Simulates the push-down pass without reading DOM positions (avoids feedback
 * loops where existing spacers hide the need for new ones, or vice versa).
 */
export function calcRequiredSpacerHeight(
  flowTop: number,
  blockHeight: number,
  hasLogo: boolean
): number {
  let total = 0
  let y = flowTop
  let guard = 0

  while (blockOverlapsPageGap(y, blockHeight, hasLogo) && guard++ < 10) {
    const step = calcPageGapSpacerHeight(y, hasLogo)
    total += step
    y += step
  }

  return total
}

/** Collapsed vertical gap between two consecutive block siblings. */
export function getCollapsedBlockGap(
  previous: HTMLElement | null,
  current: HTMLElement
): number {
  if (!previous) return 0

  const currentMarginTop = parseFloat(getComputedStyle(current).marginTop) || 0
  const previousMarginBottom = parseFloat(getComputedStyle(previous).marginBottom) || 0
  return Math.max(previousMarginBottom, currentMarginTop)
}

export function getCanvasRelativeTop(element: HTMLElement, canvas: HTMLElement): number {
  const elementRect = element.getBoundingClientRect()
  const canvasRect = canvas.getBoundingClientRect()
  return elementRect.top - canvasRect.top + canvas.scrollTop
}
