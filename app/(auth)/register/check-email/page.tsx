import Link from 'next/link'
import { Mail } from 'lucide-react'

export default async function CheckEmailPage({
  searchParams,
}: {
  searchParams: Promise<{ email?: string; devConfirmUrl?: string }>
}) {
  const params = await searchParams
  const email = params.email?.trim()
  const devConfirmUrl = params.devConfirmUrl?.trim()

  return (
    <div className="space-y-6 text-center">
      <div className="mx-auto flex size-14 items-center justify-center rounded-full bg-signara-gold/15">
        <Mail className="size-7 text-signara-gold" />
      </div>
      <div className="space-y-2">
        <h1 className="text-2xl font-bold text-signara-navy">Check your email</h1>
        <p className="text-sm text-signara-steel">
          We sent a verification link
          {email ? (
            <>
              {' '}
              to <span className="font-medium text-signara-navy">{email}</span>
            </>
          ) : null}
          . Open it to activate your organisation and continue setup.
        </p>
      </div>

      {devConfirmUrl ? (
        <div className="rounded-lg border border-signara-steel/30 bg-signara-background p-4 text-left">
          <p className="mb-2 text-xs font-medium uppercase tracking-wide text-signara-steel">
            Dev mode — Resend not configured
          </p>
          <a
            href={devConfirmUrl}
            className="break-all text-sm font-medium text-signara-gold hover:underline"
          >
            {devConfirmUrl}
          </a>
        </div>
      ) : null}

      <p className="text-sm text-signara-steel">
        Didn&apos;t get it? Check spam, or{' '}
        <Link href="/register" className="font-medium text-signara-gold hover:underline">
          try registering again
        </Link>
        .
      </p>
      <p className="text-sm text-signara-steel">
        Already verified?{' '}
        <Link href="/login" className="font-medium text-signara-gold hover:underline">
          Sign in
        </Link>
      </p>
    </div>
  )
}
