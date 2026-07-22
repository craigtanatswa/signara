import type { NextRequest } from 'next/server'

/** Canonical production URL for Signara (Paynow callbacks, emails, links). */
export const PRODUCTION_APP_URL = 'https://signaraflow.com'

function stripTrailingSlash(url: string): string {
  return url.replace(/\/$/, '')
}

function isLocalhostUrl(url: string): boolean {
  return /localhost|127\.0\.0\.1/i.test(url)
}

/**
 * Absolute base URL for the app (no trailing slash).
 * Prefer NEXT_PUBLIC_APP_URL; fall back to production domain on Vercel production.
 */
export function getAppBaseUrl(): string {
  const configured = process.env.NEXT_PUBLIC_APP_URL?.trim()
  if (configured) return stripTrailingSlash(configured)

  if (process.env.VERCEL_ENV === 'production') {
    return PRODUCTION_APP_URL
  }

  const vercelProduction = process.env.VERCEL_PROJECT_PRODUCTION_URL?.trim()
  if (vercelProduction) {
    const host = vercelProduction.replace(/^https?:\/\//, '')
    return stripTrailingSlash(`https://${host}`)
  }

  return 'http://localhost:3000'
}

/**
 * Resolve the public app URL for Paynow return/result URLs.
 * Uses the request host when the site is hit via a public domain so callbacks
 * work even if NEXT_PUBLIC_APP_URL is still set to localhost in some env.
 */
export function resolvePublicAppUrl(request: NextRequest): string {
  const host = request.headers.get('x-forwarded-host') ?? request.headers.get('host')
  const protoHeader = request.headers.get('x-forwarded-proto')
  const proto = protoHeader === 'http' || protoHeader === 'https' ? protoHeader : 'https'

  if (host && !isLocalhostUrl(host)) {
    return stripTrailingSlash(`${proto}://${host}`)
  }

  const configured = process.env.NEXT_PUBLIC_APP_URL?.trim()
  if (configured && !isLocalhostUrl(configured)) {
    return stripTrailingSlash(configured)
  }

  if (process.env.VERCEL_ENV === 'production') {
    return PRODUCTION_APP_URL
  }

  if (configured) return stripTrailingSlash(configured)

  return PRODUCTION_APP_URL
}
