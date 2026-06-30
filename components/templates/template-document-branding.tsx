'use client'

import {
  getPageCount,
  getPageLayout,
  type PageLayout,
} from '@/lib/tiptap/page-size'
import type { OrganisationBranding } from '@/types/database'

interface TemplatePageBackgroundsProps {
  letterheadUrl: string | null
  contentHeightPx: number
  layout: PageLayout
}

export function TemplatePageBackgrounds({
  letterheadUrl,
  contentHeightPx,
  layout,
}: TemplatePageBackgroundsProps) {
  if (!letterheadUrl) return null

  const pageCount = getPageCount(contentHeightPx, layout)

  return (
    <div className="pointer-events-none absolute inset-x-0 top-0 z-0" aria-hidden>
      {Array.from({ length: pageCount }, (_, index) => (
        <div
          key={index}
          className="absolute inset-x-0 overflow-hidden bg-white"
          style={{
            top: index * layout.pageCyclePx,
            height: layout.heightPx,
          }}
        >
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={letterheadUrl}
            alt=""
            className="size-full object-contain object-top"
          />
        </div>
      ))}
    </div>
  )
}

interface TemplatePageLogosProps {
  logoUrl: string | null
  contentHeightPx: number
  layout: PageLayout
}

export function TemplatePageLogos({
  logoUrl,
  contentHeightPx,
  layout,
}: TemplatePageLogosProps) {
  if (!logoUrl) return null

  const pageCount = getPageCount(contentHeightPx, layout)

  return (
    <div className="pointer-events-none absolute inset-x-0 top-0 z-[2]" aria-hidden>
      {Array.from({ length: pageCount }, (_, index) => (
        <div
          key={index}
          className="absolute inset-x-0 flex items-center justify-center border-b border-dashed border-signara-steel/25 px-6"
          style={{
            top: index * layout.pageCyclePx,
            height: layout.logoBlockHeightPx,
          }}
        >
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={logoUrl}
            alt="Organisation logo"
            className="object-contain"
            style={{
              maxHeight: layout.logoMaxHeightPx,
              maxWidth: layout.logoMaxWidthPx,
            }}
          />
        </div>
      ))}
    </div>
  )
}

export function hasOrganisationBranding(
  branding: OrganisationBranding | null | undefined
): branding is OrganisationBranding {
  return Boolean(
    branding?.logoUrl || branding?.letterheadUrl || branding?.letterheadLandscapeUrl
  )
}

export { getPageLayout }
