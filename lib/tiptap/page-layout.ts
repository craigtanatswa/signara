import type { PageLayout } from '@/lib/tiptap/page-size'

export function getPageTopInset(layout: PageLayout, hasLogo: boolean): number {
  return hasLogo ? layout.logoBlockHeightPx : layout.paddingYPx
}

export function getPageBottomInset(layout: PageLayout): number {
  return layout.paddingYPx
}

export function getPageContentEnd(layout: PageLayout, cycleIndex: number): number {
  return (
    cycleIndex * layout.pageCyclePx + layout.heightPx - getPageBottomInset(layout)
  )
}

export function getNextPageContentStart(
  layout: PageLayout,
  blockTop: number,
  hasLogo: boolean
): number {
  const cycleIndex = Math.floor(blockTop / layout.pageCyclePx)
  return (cycleIndex + 1) * layout.pageCyclePx + getPageTopInset(layout, hasLogo)
}

export function blockOverlapsPageGap(
  layout: PageLayout,
  blockTop: number,
  blockHeight: number,
  hasLogo: boolean
): boolean {
  if (blockHeight <= 0) return false

  const blockBottom = blockTop + blockHeight
  const startCycle = Math.floor(blockTop / layout.pageCyclePx)
  const endCycle = Math.floor(Math.max(0, blockBottom - 0.001) / layout.pageCyclePx)

  for (let cycleIndex = startCycle; cycleIndex <= endCycle; cycleIndex++) {
    const pageStart = cycleIndex * layout.pageCyclePx
    const greyStart = pageStart + layout.heightPx
    const greyEnd = pageStart + layout.pageCyclePx
    const contentStart = pageStart + getPageTopInset(layout, hasLogo)
    const contentEnd = getPageContentEnd(layout, cycleIndex)

    if (blockTop >= greyStart && blockTop < greyEnd) {
      return true
    }

    if (blockBottom > greyStart && blockTop < greyEnd) {
      return true
    }

    if (blockTop >= contentEnd && blockTop < greyStart) {
      return true
    }

    if (blockTop >= contentStart && blockTop < contentEnd && blockBottom > contentEnd + 0.5) {
      return true
    }

    if (hasLogo && cycleIndex > 0 && blockTop >= pageStart && blockTop < contentStart) {
      return true
    }
  }

  return false
}

export function calcPageGapSpacerHeight(
  layout: PageLayout,
  blockTop: number,
  hasLogo: boolean
): number {
  const cycleIndex = Math.floor(blockTop / layout.pageCyclePx)
  const pageStart = cycleIndex * layout.pageCyclePx
  const contentStart = pageStart + getPageTopInset(layout, hasLogo)

  if (hasLogo && cycleIndex > 0 && blockTop < contentStart) {
    return Math.max(1, Math.ceil(contentStart - blockTop))
  }

  return Math.max(1, Math.ceil(getNextPageContentStart(layout, blockTop, hasLogo) - blockTop))
}

export function calcRequiredSpacerHeight(
  layout: PageLayout,
  flowTop: number,
  blockHeight: number,
  hasLogo: boolean
): number {
  let total = 0
  let y = flowTop
  let guard = 0

  while (blockOverlapsPageGap(layout, y, blockHeight, hasLogo) && guard++ < 10) {
    const step = calcPageGapSpacerHeight(layout, y, hasLogo)
    total += step
    y += step
  }

  return total
}

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
