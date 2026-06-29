import { isAllowedOrganisationAssetUrl } from '@/lib/pdf/branding-asset-url'

export async function GET(request: Request) {
  const src = new URL(request.url).searchParams.get('src')
  if (!src || !isAllowedOrganisationAssetUrl(src)) {
    return new Response('Forbidden', { status: 403 })
  }

  try {
    const upstream = await fetch(src, { cache: 'force-cache' })
    if (!upstream.ok) {
      return new Response('Asset not found', { status: upstream.status })
    }

    const contentType = upstream.headers.get('content-type') ?? 'application/octet-stream'
    const buffer = await upstream.arrayBuffer()

    return new Response(buffer, {
      status: 200,
      headers: {
        'Content-Type': contentType,
        'Cache-Control': 'public, max-age=3600, stale-while-revalidate=86400',
      },
    })
  } catch {
    return new Response('Failed to load asset', { status: 502 })
  }
}
