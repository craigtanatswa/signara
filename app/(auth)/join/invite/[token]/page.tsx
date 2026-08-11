import Link from 'next/link'
import { createAdminClient } from '@/lib/supabase/admin'
import { AcceptInviteForm } from './accept-invite-form'

export default async function AcceptInvitePage({
  params,
}: {
  params: Promise<{ token: string }>
}) {
  const { token } = await params
  const admin = createAdminClient()

  const { data: invite } = await admin
    .from('organisation_invites')
    .select('*, organisations(name)')
    .eq('token', token)
    .maybeSingle()

  if (!invite) {
    return (
      <InviteError
        title="Invitation not found"
        message="This invite link is invalid or has been removed."
      />
    )
  }

  if (invite.accepted_at) {
    return (
      <InviteError
        title="Already accepted"
        message="This invitation has already been used. Sign in with your account."
        showLogin
      />
    )
  }

  if (new Date(invite.expires_at).getTime() < Date.now()) {
    return (
      <InviteError
        title="Invitation expired"
        message="Ask your administrator to send a new invitation."
      />
    )
  }

  const orgName =
    (invite.organisations as { name: string } | null)?.name ?? 'the organisation'

  return (
    <AcceptInviteForm
      token={token}
      email={invite.email}
      defaultFullName={invite.full_name}
      orgName={orgName}
    />
  )
}

function InviteError({
  title,
  message,
  showLogin,
}: {
  title: string
  message: string
  showLogin?: boolean
}) {
  return (
    <div className="space-y-4 text-center">
      <h1 className="text-2xl font-bold text-signara-navy">{title}</h1>
      <p className="text-sm text-signara-steel">{message}</p>
      {showLogin && (
        <Link href="/login" className="font-medium text-signara-gold hover:underline">
          Sign in
        </Link>
      )}
    </div>
  )
}
