import { ORGANISATION_ASSETS_BUCKET } from '@/lib/storage/organisation-assets'

export function isAllowedOrganisationAssetUrl(src: string): boolean {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
  if (!supabaseUrl) return false

  try {
    const url = new URL(src)
    const allowedOrigin = new URL(supabaseUrl).origin
    return (
      url.origin === allowedOrigin &&
      url.pathname.startsWith(`/storage/v1/object/public/${ORGANISATION_ASSETS_BUCKET}/`)
    )
  } catch {
    return false
  }
}
