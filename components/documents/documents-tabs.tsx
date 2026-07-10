'use client'

import Link from 'next/link'
import { FileText } from 'lucide-react'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Badge } from '@/components/ui/badge'
import type { Document } from '@/types/database'

export interface DocumentRow {
  id: string
  title: string
  templateName: string
  status: Document['status']
  initiatorName: string
  createdAt: string
  stepProgress: { current: number; total: number } | null
}

interface DocumentsTabsProps {
  myDocuments: DocumentRow[]
  awaitingMyAction: DocumentRow[]
  allDocuments: DocumentRow[] | null
}

const STATUS_BADGE_CLASS: Record<Document['status'], string> = {
  draft: 'border-signara-steel/40 bg-signara-steel/10 text-signara-steel',
  in_progress: 'border-blue-200 bg-blue-50 text-blue-700',
  completed: 'border-green-200 bg-green-50 text-green-700',
  rejected: 'border-red-200 bg-red-50 text-red-700',
  cancelled: 'border-signara-steel/40 bg-signara-steel/10 text-signara-steel',
}

const STATUS_LABEL: Record<Document['status'], string> = {
  draft: 'Draft',
  in_progress: 'In progress',
  completed: 'Completed',
  rejected: 'Rejected',
  cancelled: 'Cancelled',
}

function StatusBadge({ row }: { row: DocumentRow }) {
  const label =
    row.status === 'in_progress' && row.stepProgress
      ? `${STATUS_LABEL.in_progress} — Step ${row.stepProgress.current} of ${row.stepProgress.total}`
      : STATUS_LABEL[row.status]

  return (
    <Badge variant="outline" className={STATUS_BADGE_CLASS[row.status]}>
      {label}
    </Badge>
  )
}

function DocumentsTable({ rows, emptyMessage }: { rows: DocumentRow[]; emptyMessage: string }) {
  if (rows.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center rounded-lg border border-dashed border-signara-steel/40 bg-white py-16 text-center">
        <FileText className="size-12 text-signara-steel/30" />
        <p className="mt-4 max-w-sm text-sm text-signara-steel">{emptyMessage}</p>
      </div>
    )
  }

  return (
    <div className="overflow-hidden rounded-lg border border-signara-steel/30 bg-white shadow-sm">
      <table className="w-full">
        <thead>
          <tr className="border-b border-signara-steel/20">
            <th className="px-6 py-3 text-left text-xs font-semibold uppercase tracking-wider text-signara-steel">
              Title
            </th>
            <th className="px-6 py-3 text-left text-xs font-semibold uppercase tracking-wider text-signara-steel">
              Template
            </th>
            <th className="px-6 py-3 text-left text-xs font-semibold uppercase tracking-wider text-signara-steel">
              Status
            </th>
            <th className="px-6 py-3 text-left text-xs font-semibold uppercase tracking-wider text-signara-steel">
              Initiated by
            </th>
            <th className="px-6 py-3 text-left text-xs font-semibold uppercase tracking-wider text-signara-steel">
              Created
            </th>
          </tr>
        </thead>
        <tbody className="divide-y divide-signara-steel/10">
          {rows.map((row) => (
            <tr key={row.id} className="hover:bg-signara-background/50">
              <td className="px-6 py-4">
                <Link
                  href={`/dashboard/documents/${row.id}`}
                  className="font-medium text-signara-navy hover:text-signara-gold"
                >
                  {row.title}
                </Link>
              </td>
              <td className="px-6 py-4 text-sm text-signara-steel">{row.templateName}</td>
              <td className="px-6 py-4">
                <StatusBadge row={row} />
              </td>
              <td className="px-6 py-4 text-sm text-signara-steel">{row.initiatorName}</td>
              <td className="px-6 py-4 text-sm text-signara-steel">
                {new Date(row.createdAt).toLocaleDateString('en-GB')}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}

export function DocumentsTabs({ myDocuments, awaitingMyAction, allDocuments }: DocumentsTabsProps) {
  return (
    <Tabs defaultValue="mine" className="gap-4">
      <TabsList>
        <TabsTrigger value="mine">My documents</TabsTrigger>
        <TabsTrigger value="awaiting">
          Awaiting my action
          {awaitingMyAction.length > 0 && (
            <Badge className="ml-1.5 h-5 min-w-5 justify-center bg-signara-gold px-1 text-signara-navy">
              {awaitingMyAction.length}
            </Badge>
          )}
        </TabsTrigger>
        {allDocuments && <TabsTrigger value="all">All</TabsTrigger>}
      </TabsList>

      <TabsContent value="mine">
        <DocumentsTable
          rows={myDocuments}
          emptyMessage="You haven't started any documents yet. Start one from an active template."
        />
      </TabsContent>

      <TabsContent value="awaiting">
        <DocumentsTable
          rows={awaitingMyAction}
          emptyMessage="Nothing is waiting on you right now."
        />
      </TabsContent>

      {allDocuments && (
        <TabsContent value="all">
          <DocumentsTable rows={allDocuments} emptyMessage="No documents in your organisation yet." />
        </TabsContent>
      )}
    </Tabs>
  )
}
