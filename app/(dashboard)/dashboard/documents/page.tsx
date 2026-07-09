import Link from 'next/link'
import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { Header } from '@/components/layout/header'
import { DashboardPageBody } from '@/components/layout/dashboard-page-body'
import { Button } from '@/components/ui/button'
import { FileText, Plus } from 'lucide-react'
import type { User, Document } from '@/types/database'

export default async function DocumentsPage() {
  const supabase = await createClient()
  const {
    data: { user: authUser },
  } = await supabase.auth.getUser()
  if (!authUser) redirect('/login')

  const { data: profile } = await supabase
    .from('users')
    .select('*')
    .eq('id', authUser.id)
    .single()
  if (!profile) redirect('/login')

  const user = profile as User

  const { data: documents } = await supabase
    .from('documents')
    .select('id, title, status, created_at, updated_at')
    .eq('organisation_id', profile.organisation_id)
    .order('created_at', { ascending: false })
    .limit(50)

  const items = (documents ?? []) as Pick<Document, 'id' | 'title' | 'status' | 'created_at'>[]

  return (
    <>
      <Header pageTitle="Documents" user={user} />
      <DashboardPageBody>
        <div className="space-y-6">
          <div className="flex items-center justify-between gap-4">
            <div>
              <h2 className="text-xl font-bold text-signara-navy">Documents</h2>
              <p className="mt-0.5 text-sm text-signara-steel">
                Submit forms and track approval progress.
              </p>
            </div>
            <Button asChild variant="signara">
              <Link href="/dashboard/documents/new">
                <Plus className="mr-1.5 size-4" />
                New document
              </Link>
            </Button>
          </div>

          {items.length === 0 ? (
            <div className="flex flex-col items-center justify-center rounded-lg border border-dashed border-signara-steel/40 bg-white py-20 text-center">
              <FileText className="size-14 text-signara-steel/40" />
              <h3 className="mt-4 font-semibold text-signara-navy">No documents yet</h3>
              <p className="mt-1 max-w-sm text-sm text-signara-steel">
                Start a document from an active template to begin an approval flow.
              </p>
              <Button asChild variant="signara" className="mt-6">
                <Link href="/dashboard/documents/new">
                  <Plus className="mr-1.5 size-4" />
                  New document
                </Link>
              </Button>
            </div>
          ) : (
            <div className="overflow-hidden rounded-lg border border-signara-steel/30 bg-white shadow-sm">
              <table className="w-full">
                <thead>
                  <tr className="border-b border-signara-steel/20">
                    <th className="px-6 py-3 text-left text-xs font-semibold uppercase tracking-wider text-signara-steel">
                      Title
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-semibold uppercase tracking-wider text-signara-steel">
                      Status
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-semibold uppercase tracking-wider text-signara-steel">
                      Created
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-signara-steel/10">
                  {items.map((document) => (
                    <tr key={document.id} className="hover:bg-signara-background/50">
                      <td className="px-6 py-4">
                        <Link
                          href={`/dashboard/documents/${document.id}`}
                          className="font-medium text-signara-navy hover:text-signara-gold"
                        >
                          {document.title}
                        </Link>
                      </td>
                      <td className="px-6 py-4 text-sm capitalize text-signara-steel">
                        {document.status.replace('_', ' ')}
                      </td>
                      <td className="px-6 py-4 text-sm text-signara-steel">
                        {new Date(document.created_at).toLocaleDateString('en-GB')}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </DashboardPageBody>
    </>
  )
}
