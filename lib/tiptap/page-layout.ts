import {
  A4_PAGE_CYCLE_PX,
  A4_PAGE_GAP_PX,
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

    if (blockTop >= greyStart && blockTop < greyEnd) {
      return true
    }

    if (blockBottom > greyStart && blockTop < greyEnd) {
      return true
    }

    if (blockTop >= contentStart && blockTop < contentEnd && blockBottom > contentEnd + 0.5) {
      return true
    }
  }

  return false
}

export function calcPageGapSpacerHeight(blockTop: number, hasLogo: boolean): number {
  return Math.max(1, Math.ceil(getNextPageContentStart(blockTop, hasLogo) - blockTop))
}

export function getCanvasRelativeTop(element: HTMLElement, canvas: HTMLElement): number {
  const elementRect = element.getBoundingClientRect()
  const canvasRect = canvas.getBoundingClientRect()
  return elementRect.top - canvasRect.top + canvas.scrollTop
}
