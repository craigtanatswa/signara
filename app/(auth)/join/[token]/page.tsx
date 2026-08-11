import { createAdminClient } from '@/lib/supabase/admin'
import { isJoinLinkAtCapacity } from '@/lib/auth/invite-token'
import { ShareableJoinForm } from './shareable-join-form'
import Link from 'next/link'

export default async function ShareableJoinPage({
  params,
}: {
  params: Promise<{ token: string }>
}) {
  const { token } = await params
  const admin = createAdminClient()

  const { data: link } = await admin
    .from('organisation_join_links')
    .select('*, organisations(name)')
    .eq('token', token)
    .maybeSingle()

  if (!link || !link.is_active || link.revoked_at) {
    return (
      <div className="space-y-4 text-center">
        <h1 className="text-2xl font-bold text-signara-navy">Link unavailable</h1>
        <p className="text-sm text-signara-steel">
          This join link is invalid or has been revoked.
        </p>
        <Link href="/login" className="font-medium text-signara-gold hover:underline">
          Sign in
        </Link>
      </div>
    )
  }

  if (isJoinLinkAtCapacity(link)) {
    return (
      <div className="space-y-4 text-center">
        <h1 className="text-2xl font-bold text-signara-navy">Invite full</h1>
        <p className="text-sm text-signara-steel">
          This invite link has reached its member limit. Contact the organisation administrator.
        </p>
      </div>
    )
  }

  const orgName =
    (link.organisations as { name: string } | null)?.name ?? 'the organisation'

  return <ShareableJoinForm token={token} orgName={orgName} />
}
