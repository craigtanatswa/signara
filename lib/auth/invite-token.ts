import { randomBytes } from 'crypto'

/** URL-safe random token for invites and join links. */
export function generateInviteToken(bytes = 24): string {
  return randomBytes(bytes).toString('base64url')
}

export function inviteExpiresAt(days = 14): string {
  const d = new Date()
  d.setDate(d.getDate() + days)
  return d.toISOString()
}

export function isJoinLinkAtCapacity(link: {
  max_uses: number | null
  approved_count: number
}): boolean {
  return link.max_uses != null && link.approved_count >= link.max_uses
}
