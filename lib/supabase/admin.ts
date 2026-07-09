import { createClient } from '@supabase/supabase-js'

/**
 * Service-role Supabase client for trusted server-side operations.
 * Uses @supabase/supabase-js directly (no cookie/session storage) so
 * logged-in users' JWTs cannot narrow queries via RLS.
 */
export function createAdminClient() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    {
      auth: {
        autoRefreshToken: false,
        persistSession: false,
      },
    }
  )
}
