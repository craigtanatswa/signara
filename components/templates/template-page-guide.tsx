'use client'

import {
  A4_PAGE_GAP_PX,
  A4_PAGE_HEIGHT_PX,
  getA4PageCount,
} from '@/lib/tiptap/a4-layout'

interface TemplatePageGuideProps {
  contentHeightPx: number
}

function getPageBreakTopPx(afterPageNumber: number): number {
  return (
    afterPageNumber * A4_PAGE_HEIGHT_PX +
    (afterPageNumber - 1) * A4_PAGE_GAP_PX +
    A4_PAGE_GAP_PX / 2
  )
}

export function TemplatePageGuide({ contentHeightPx }: TemplatePageGuideProps) {
  const pageCount = getA4PageCount(contentHeightPx)

  if (pageCount <= 1) return null

  return (
    <div className="pointer-events-none absolute inset-x-0 top-0 z-[3]" aria-hidden>
      {Array.from({ length: pageCount - 1 }, (_, index) => {
        const afterPage = index + 1
        const top = getPageBreakTopPx(afterPage)

        return (
          <div
            key={afterPage}
            className="absolute left-0 right-0 flex -translate-y-1/2 items-center gap-3 px-2"
            style={{ top }}
          >
            <div className="h-px flex-1 border-t border-dashed border-signara-steel/50" />
            <span className="rounded-full bg-signara-navy/90 px-2.5 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-white">
              Page {afterPage + 1}
            </span>
            <div className="h-px flex-1 border-t border-dashed border-signara-steel/50" />
          </div>
        )
      })}
    </div>
  )
}

export function TemplatePageCountBadge({ contentHeightPx }: TemplatePageGuideProps) {
  const pageCount = getA4PageCount(contentHeightPx)

  return (
    <p className="mt-3 text-center text-xs font-medium text-signara-steel">
      {pageCount} {pageCount === 1 ? 'page' : 'pages'} (A4 preview)
    </p>
  )
}

export { A4_PAGE_CYCLE_PX } from '@/lib/tiptap/a4-layout'
