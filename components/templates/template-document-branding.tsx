'use client'

import {
  A4_PAGE_CYCLE_PX,
  A4_PAGE_HEIGHT_PX,
  ORG_LOGO_BLOCK_HEIGHT_PX,
  ORG_LOGO_MAX_HEIGHT_PX,
  ORG_LOGO_MAX_WIDTH_PX,
  getA4PageCount,
} from '@/lib/tiptap/a4-layout'
import type { OrganisationBranding } from '@/types/database'

interface TemplatePageBackgroundsProps {
  letterheadUrl: string | null
  contentHeightPx: number
}

export function TemplatePageBackgrounds({
  letterheadUrl,
  contentHeightPx,
}: TemplatePageBackgroundsProps) {
  if (!letterheadUrl) return null

  const pageCount = getA4PageCount(contentHeightPx)

  return (
    <div className="pointer-events-none absolute inset-x-0 top-0 z-0" aria-hidden>
      {Array.from({ length: pageCount }, (_, index) => (
        <div
          key={index}
          className="absolute inset-x-0 overflow-hidden bg-white"
          style={{
            top: index * A4_PAGE_CYCLE_PX,
            height: A4_PAGE_HEIGHT_PX,
          }}
        >
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={letterheadUrl}
            alt=""
            className="size-full object-cover object-top"
          />
        </div>
      ))}
    </div>
  )
}

interface TemplatePageLogosProps {
  logoUrl: string | null
  contentHeightPx: number
}

export function TemplatePageLogos({ logoUrl, contentHeightPx }: TemplatePageLogosProps) {
  if (!logoUrl) return null

  const pageCount = getA4PageCount(contentHeightPx)

  return (
    <div className="pointer-events-none absolute inset-x-0 top-0 z-[2]" aria-hidden>
      {Array.from({ length: pageCount }, (_, index) => (
        <div
          key={index}
          className="absolute inset-x-0 flex items-center justify-center border-b border-dashed border-signara-steel/25 px-6"
          style={{
            top: index * A4_PAGE_CYCLE_PX,
            height: ORG_LOGO_BLOCK_HEIGHT_PX,
          }}
        >
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={logoUrl}
            alt="Organisation logo"
            className="object-contain"
            style={{
              maxHeight: ORG_LOGO_MAX_HEIGHT_PX,
              maxWidth: ORG_LOGO_MAX_WIDTH_PX,
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
  return Boolean(branding?.logoUrl || branding?.letterheadUrl)
}

export {
  ORG_LOGO_BLOCK_HEIGHT_PX,
  ORG_LOGO_MAX_HEIGHT_PX,
  ORG_LOGO_MAX_WIDTH_PX,
}
