import Link from 'next/link'
import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { Header } from '@/components/layout/header'
import { DashboardPageBody } from '@/components/layout/dashboard-page-body'
import { FileText, Clock, CheckCircle2 } from 'lucide-react'
import { loadAwaitingApprovalsForUser } from '@/lib/documents/load-for-viewer'
import type { User } from '@/types/database'

function getGreeting() {
  const hour = new Date().getHours()
  if (hour < 12) return 'Good morning'
  if (hour < 17) return 'Good afternoon'
  return 'Good evening'
}

export default async function DashboardPage() {
  const supabase = await createClient()

  const {
    data: { user: authUser },
  } = await supabase.auth.getUser()

  if (!authUser) {
    redirect('/login')
  }

  const { data: userProfile } = await supabase
    .from('users')
    .select('*')
    .eq('id', authUser.id)
    .single()

  if (!userProfile) {
    redirect('/login')
  }

  const user: User = userProfile as User
  const admin = createAdminClient()

  const now = new Date()
  const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1).toISOString()

  // Use admin client for assignee-visible data — member RLS often hides
  // documents the user did not initiate.
  const [awaitingRows, sentResult, completedResult, initiatedDocsResult, stepDocIdsResult] =
    await Promise.all([
      loadAwaitingApprovalsForUser({
        userId: authUser.id,
        organisationId: user.organisation_id,
      }),
      admin
        .from('documents')
        .select('id', { count: 'exact', head: true })
        .eq('initiated_by', authUser.id)
        .eq('organisation_id', user.organisation_id),
      admin
        .from('documents')
        .select('id', { count: 'exact', head: true })
        .eq('organisation_id', user.organisation_id)
        .eq('status', 'completed')
        .gte('completed_at', startOfMonth),
      admin
        .from('documents')
        .select('id, title, status, created_at')
        .eq('initiated_by', authUser.id)
        .eq('organisation_id', user.organisation_id)
        .order('created_at', { ascending: false })
        .limit(5),
      admin
        .from('document_steps')
        .select('document_id')
        .eq('assignee_user_id', authUser.id),
    ])

  const pendingCount = awaitingRows.length
  const sentCount = sentResult.count ?? 0
  const completedCount = completedResult.count ?? 0

  const stepDocIds = Array.from(
    new Set((stepDocIdsResult.data ?? []).map((r: { document_id: string }) => r.document_id))
  )
  const initiatedDocs = initiatedDocsResult.data ?? []

  let recentDocuments = initiatedDocs

  if (stepDocIds.length > 0) {
    const { data: stepDocs } = await admin
      .from('documents')
      .select('id, title, status, created_at')
      .in('id', stepDocIds)
      .eq('organisation_id', user.organisation_id)
      .order('created_at', { ascending: false })
      .limit(5)

    const seen = new Set(initiatedDocs.map((d: { id: string }) => d.id))
    const merged = [...initiatedDocs]
    for (const doc of stepDocs ?? []) {
      if (!seen.has(doc.id)) merged.push(doc)
    }
    recentDocuments = merged
      .sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime())
      .slice(0, 5)
  }

  const stats = [
    {
      label: 'Pending signatures',
      value: pendingCount,
      icon: Clock,
      description: 'Awaiting your signature',
      accent: 'text-signara-gold',
      href: '/dashboard/documents',
    },
    {
      label: 'Documents sent',
      value: sentCount,
      icon: FileText,
      description: 'Total documents initiated',
      accent: 'text-signara-navy',
      href: '/dashboard/documents',
    },
    {
      label: 'Completed this month',
      value: completedCount,
      icon: CheckCircle2,
      description: 'Fully signed this month',
      accent: 'text-green-600',
      href: '/dashboard/documents',
    },
  ]

  const statusLabels: Record<string, { label: string; className: string }> = {
    draft: { label: 'Draft', className: 'bg-signara-steel/20 text-signara-steel' },
    in_progress: { label: 'In Progress', className: 'bg-signara-gold/20 text-signara-navy' },
    completed: { label: 'Completed', className: 'bg-green-100 text-green-700' },
    rejected: { label: 'Rejected', className: 'bg-red-100 text-red-700' },
    cancelled: { label: 'Cancelled', className: 'bg-gray-100 text-gray-600' },
  }

  return (
    <>
      <Header pageTitle="Dashboard" user={user} />

      <DashboardPageBody>
      <div className="space-y-8">
        <div>
          <h2 className="text-2xl font-bold text-signara-navy">
            {getGreeting()}, {user.full_name.split(' ')[0]}
          </h2>
          <p className="mt-1 text-signara-steel">
            Here&apos;s what&apos;s happening with your documents today.
          </p>
        </div>

        <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
          {stats.map((stat) => (
            <Link
              key={stat.label}
              href={stat.href}
              className="rounded-lg border border-signara-steel/30 bg-white p-6 shadow-sm transition-colors hover:border-signara-gold/50"
            >
              <div className="flex items-center justify-between">
                <p className="text-sm font-medium text-signara-steel">
                  {stat.label}
                </p>
                <stat.icon className={`size-5 ${stat.accent}`} />
              </div>
              <p className="mt-3 text-3xl font-bold text-signara-navy">
                {stat.value}
              </p>
              <p className="mt-1 text-xs text-signara-steel">
                {stat.description}
              </p>
            </Link>
          ))}
        </div>

        <div className="rounded-lg border border-signara-steel/30 bg-white shadow-sm">
          <div className="border-b border-signara-steel/20 px-6 py-4">
            <h3 className="font-semibold text-signara-navy">Recent activity</h3>
          </div>

          {recentDocuments.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-16 text-center">
              <FileText className="size-12 text-signara-steel/40" />
              <p className="mt-4 font-medium text-signara-navy">
                No documents yet
              </p>
              <p className="mt-1 text-sm text-signara-steel">
                Start by creating a template
              </p>
            </div>
          ) : (
            <ul className="divide-y divide-signara-steel/10">
              {recentDocuments.map(
                (doc: {
                  id: string
                  title: string
                  status: string
                  created_at: string
                }) => {
                  const statusInfo = statusLabels[doc.status] ?? {
                    label: doc.status,
                    className: 'bg-gray-100 text-gray-600',
                  }
                  return (
                    <li key={doc.id}>
                      <Link
                        href={`/dashboard/documents/${doc.id}`}
                        className="flex items-center justify-between px-6 py-4 transition-colors hover:bg-signara-background/50"
                      >
                        <div className="flex items-center gap-3">
                          <FileText className="size-4 shrink-0 text-signara-steel" />
                          <span className="text-sm font-medium text-signara-navy">
                            {doc.title}
                          </span>
                        </div>
                        <span
                          className={`rounded-full px-2.5 py-0.5 text-xs font-medium ${statusInfo.className}`}
                        >
                          {statusInfo.label}
                        </span>
                      </Link>
                    </li>
                  )
                }
              )}
            </ul>
          )}
        </div>
      </div>
      </DashboardPageBody>
    </>
  )
}
