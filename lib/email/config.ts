/** Sender address for transactional email. Must use a domain verified in Resend. */
export function getResendFromAddress(): string {
  return process.env.RESEND_FROM_EMAIL ?? 'Signara <onboarding@resend.dev>'
}
