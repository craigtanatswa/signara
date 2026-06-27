export const ORGANISATION_ASSETS_BUCKET = 'organisation-assets'

export const LOGO_MAX_BYTES = 2 * 1024 * 1024
export const LETTERHEAD_MAX_BYTES = 5 * 1024 * 1024

export const BRANDING_IMAGE_TYPES = [
  'image/png',
  'image/jpeg',
  'image/webp',
  'image/gif',
] as const

export type BrandingAssetKind = 'logo' | 'letterhead'

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
    default:
      return null
  }
}

export function getPublicAssetUrl(supabaseUrl: string, path: string): string {
  return `${supabaseUrl}/storage/v1/object/public/${ORGANISATION_ASSETS_BUCKET}/${path}`
}
