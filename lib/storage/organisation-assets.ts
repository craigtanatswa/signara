export const ORGANISATION_ASSETS_BUCKET = 'organisation-assets'

export const LOGO_MAX_BYTES = 2 * 1024 * 1024
export const LETTERHEAD_MAX_BYTES = 5 * 1024 * 1024

export const BRANDING_IMAGE_TYPES = [
  'image/png',
  'image/jpeg',
  'image/webp',
  'image/gif',
] as const

export const LETTERHEAD_UPLOAD_TYPES = [
  ...BRANDING_IMAGE_TYPES,
  'application/pdf',
] as const

export type BrandingAssetKind = 'logo' | 'letterhead'
export type LetterheadUploadMime = (typeof LETTERHEAD_UPLOAD_TYPES)[number]

export function getOrganisationAssetPath(
  organisationId: string,
  kind: BrandingAssetKind,
  extension: string
): string {
  return `${organisationId}/${kind}.${extension}`
}

export function getExtensionFromMime(mime: string): string | null {
  switch (mime) {
    case 'image/png':
      return 'png'
    case 'image/jpeg':
      return 'jpg'
    case 'image/webp':
      return 'webp'
    case 'image/gif':
      return 'gif'
    case 'application/pdf':
      return 'png'
    default:
      return null
  }
}

export function isLetterheadUploadMime(mime: string): mime is LetterheadUploadMime {
  return LETTERHEAD_UPLOAD_TYPES.includes(mime as LetterheadUploadMime)
}

export function getPublicAssetUrl(supabaseUrl: string, path: string): string {
  return `${supabaseUrl}/storage/v1/object/public/${ORGANISATION_ASSETS_BUCKET}/${path}`
}
