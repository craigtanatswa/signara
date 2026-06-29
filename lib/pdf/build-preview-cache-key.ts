import { createHash } from 'node:crypto'
import type { OrganisationBranding, TiptapDocument } from '@/types/database'

export type PreviewRenderMode = 'fast' | 'full'

export interface PreviewCacheInput {
  content: TiptapDocument
  name: string
  textColor: string
  organisationBranding: OrganisationBranding | null
  mode: PreviewRenderMode
}

export function buildPreviewCacheKey(input: PreviewCacheInput): string {
  return createHash('sha256')
    .update(
      JSON.stringify({
        content: input.content,
        name: input.name.trim(),
        textColor: input.textColor,
        organisationBranding: input.organisationBranding,
        mode: input.mode,
      })
    )
    .digest('hex')
}
