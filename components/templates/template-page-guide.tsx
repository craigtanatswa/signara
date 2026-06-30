'use client'

import {
  formatPageOrientationLabel,
  getPageCount,
  getPageLayout,
  type PageLayout,
} from '@/lib/tiptap/page-size'
import type { PageOrientation } from '@/types/database'

interface TemplatePageGuideProps {
  contentHeightPx: number
  layout: PageLayout
}

function getPageBreakTopPx(layout: PageLayout, afterPageNumber: number): number {
  return (
    afterPageNumber * layout.heightPx +
    (afterPageNumber - 1) * layout.pageGapPx +
    layout.pageGapPx / 2
  )
}

export function TemplatePageGuide({ contentHeightPx, layout }: TemplatePageGuideProps) {
  const pageCount = getPageCount(contentHeightPx, layout)

  if (pageCount <= 1) return null

  return (
    <div className="pointer-events-none absolute inset-x-0 top-0 z-[3]" aria-hidden>
      {Array.from({ length: pageCount - 1 }, (_, index) => {
        const afterPage = index + 1
        const top = getPageBreakTopPx(layout, afterPage)

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

export function TemplatePageCountBadge({
  contentHeightPx,
  layout,
}: TemplatePageGuideProps) {
  const pageCount = getPageCount(contentHeightPx, layout)

  return (
    <p className="mt-3 text-center text-xs font-medium text-signara-steel">
      {pageCount} {pageCount === 1 ? 'page' : 'pages'} (A4 {formatPageOrientationLabel(layout.orientation).toLowerCase()} preview)
    </p>
  )
}

export { getPageLayout }
export type { PageOrientation }
