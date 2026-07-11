import Image from 'next/image'
import Link from 'next/link'
import { notFound } from 'next/navigation'
import { createAdminClient } from '@/lib/supabase/admin'
import { Badge } from '@/components/ui/badge'
import type { Document } from '@/types/database'

interface VerifyPageProps {
  params: Promise<{ id: string }>
}

const STATUS_LABEL: Record<Document['status'], string> = {
  draft: 'Draft',
  in_progress: 'In progress',
  completed: 'Completed',
  rejected: 'Rejected',
  cancelled: 'Cancelled',
}

const STATUS_BADGE_CLASS: Record<Document['status'], string> = {
  draft: 'border-signara-steel/30 bg-signara-background text-signara-navy',
  in_progress: 'border-amber-200 bg-amber-50 text-amber-800',
  completed: 'border-green-200 bg-green-50 text-green-800',
  rejected: 'border-red-200 bg-red-50 text-red-700',
  cancelled: 'border-gray-200 bg-gray-50 text-gray-600',
}

/**
 * Public verification stamp for printed documents (QR target).
 * Exposes only non-sensitive status metadata — never field values or signatures.
 */
export default async function VerifyDocumentPage({ params }: VerifyPageProps) {
  const { id } = await params
  const admin = createAdminClient()

  const { data: document } = await admin
    .from('documents')
    .select('id, title, status, updated_at, completed_at, organisation_id')
    .eq('id', id)
    .maybeSingle()

  if (!document) notFound()

  const { data: organisation } = await admin
    .from('organisations')
    .select('name')
    .eq('id', document.organisation_id)
    .maybeSingle()

  const { data: steps } = await admin
    .from('document_steps')
    .select('status')
    .eq('document_id', id)

  const actionable = (steps ?? []).filter((s) => s.status !== 'skipped')
  const completedCount = actionable.filter((s) => s.status === 'approved').length
  const totalCount = actionable.length
  const lastUpdated = document.completed_at ?? document.updated_at
  const status = document.status as Document['status']

  return (
    <div className="flex min-h-0 flex-1 flex-col overflow-y-auto bg-signara-background">
      <header className="border-b border-signara-steel/20 bg-white">
        <div className="mx-auto flex max-w-lg items-center px-6 py-5">
          <Image
            src="/assets/logo-signara.png"
            alt="Signara"
            width={160}
            height={70}
            priority
            className="h-12 w-auto object-contain"
          />
        </div>
      </header>

      <main className="mx-auto flex w-full max-w-lg flex-1 flex-col px-6 py-10">
        <p className="text-xs font-medium uppercase tracking-wide text-signara-steel">
          Document verification
        </p>
        <h1 className="mt-2 text-2xl font-bold text-signara-navy">{document.title}</h1>
        <p className="mt-1 text-sm text-signara-steel">
          {organisation?.name ?? 'Organisation'}
        </p>

        <div className="mt-8 rounded-lg border border-signara-steel/30 border-t-2 border-t-signara-gold bg-white p-6 shadow-sm">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <span className="text-sm font-medium text-signara-navy">Status</span>
            <Badge variant="outline" className={STATUS_BADGE_CLASS[status]}>
              {STATUS_LABEL[status]}
            </Badge>
          </div>

          <p className="mt-6 text-sm leading-relaxed text-signara-navy">
            This document was processed through Signara.{' '}
            {totalCount > 0 ? (
              <>
                {completedCount} of {totalCount} signature{totalCount === 1 ? '' : 's'} completed.
              </>
            ) : (
              <>No approval signatures are recorded on this document.</>
            )}
          </p>

          <p className="mt-3 text-sm text-signara-steel">
            Last updated:{' '}
            <span className="font-medium text-signara-navy">
              {new Date(lastUpdated).toLocaleString('en-GB', {
                dateStyle: 'medium',
                timeStyle: 'short',
              })}
            </span>
          </p>
        </div>

        <p className="mt-8 text-center text-xs leading-relaxed text-signara-steel">
          This page confirms authenticity against the Signara record. It does not display the
          document contents or signature images.
        </p>

        <p className="mt-auto pt-12 text-center text-xs text-signara-steel">
          <Link href="/" className="text-signara-gold hover:underline">
            Learn more about Signara
          </Link>
        </p>
      </main>
    </div>
  )
}
