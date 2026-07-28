import type { Metadata } from 'next'
import { Fraunces } from 'next/font/google'
import { MarketingMotionProvider } from '@/components/marketing/motion-provider'

const display = Fraunces({
  subsets: ['latin'],
  variable: '--font-signara-display',
  display: 'swap',
})

export const metadata: Metadata = {
  title: 'Signara — Approve and sign documents in hours, not weeks',
  description:
    'Signara replaces paper-heavy approvals with secure digital document workflows: reusable templates, multi-step routing, digital and physical signing, full audit trails and a searchable archive. Free trial, plans from $50 a month.',
  openGraph: {
    type: 'website',
    siteName: 'Signara',
    title: 'Signara — Approve and sign documents in hours, not weeks',
    description:
      'Secure digital document workflows for organisations in Zimbabwe and the SADC region. Templates, approval routing, digital and physical signing, audit trails and archive.',
  },
}

export default function MarketingLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <div
      className={`${display.variable} min-h-dvh bg-signara-background text-signara-navy`}
    >
      <MarketingMotionProvider>{children}</MarketingMotionProvider>
    </div>
  )
}
