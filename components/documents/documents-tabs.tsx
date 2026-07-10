'use client'

import { useState } from 'react'
import Link from 'next/link'
import { FileText } from 'lucide-react'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Badge } from '@/components/ui/badge'
import { Checkbox } from '@/components/ui/checkbox'
import { BulkApprovalBar } from '@/components/documents/bulk-approval-bar'
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

/** Document awaiting the current user's action, with step metadata for bulk approve. */
export interface AwaitingDocumentRow extends DocumentRow {
  stepId: string
  requiresSignature: boolean
}

interface DocumentsTabsProps {
  myDocuments: DocumentRow[]
  awaitingMyAction: AwaitingDocumentRow[]
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

function AwaitingDocumentsTable({
  rows,
  selectedIds,
  onToggle,
  onToggleAll,
}: {
  rows: AwaitingDocumentRow[]
  selectedIds: Set<string>
  onToggle: (id: string) => void
  onToggleAll: (checked: boolean) => void
}) {
  if (rows.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center rounded-lg border border-dashed border-signara-steel/40 bg-white py-16 text-center">
        <FileText className="size-12 text-signara-steel/30" />
        <p className="mt-4 max-w-sm text-sm text-signara-steel">
          Nothing is waiting on you right now.
        </p>
      </div>
    )
  }

  const allSelected = rows.every((row) => selectedIds.has(row.id))
  const someSelected = rows.some((row) => selectedIds.has(row.id))

  return (
    <div className="overflow-hidden rounded-lg border border-signara-steel/30 bg-white shadow-sm">
      <table className="w-full">
        <thead>
          <tr className="border-b border-signara-steel/20">
            <th className="w-12 px-4 py-3">
              <Checkbox
                checked={allSelected ? true : someSelected ? 'indeterminate' : false}
                onCheckedChange={(checked) => onToggleAll(checked === true)}
                aria-label="Select all awaiting documents"
              />
            </th>
            <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wider text-signara-steel">
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
          {rows.map((row) => {
            const checked = selectedIds.has(row.id)
            return (
              <tr
                key={row.id}
                className={checked ? 'bg-signara-gold/5' : 'hover:bg-signara-background/50'}
              >
                <td className="px-4 py-4">
                  <Checkbox
                    checked={checked}
                    onCheckedChange={() => onToggle(row.id)}
                    aria-label={`Select ${row.title}`}
                  />
                </td>
                <td className="px-4 py-4">
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
            )
          })}
        </tbody>
      </table>
    </div>
  )
}

export function DocumentsTabs({ myDocuments, awaitingMyAction, allDocuments }: DocumentsTabsProps) {
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set())

  const selectedRows = awaitingMyAction.filter((row) => selectedIds.has(row.id))

  function toggle(id: string) {
    setSelectedIds((prev) => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }

  function toggleAll(checked: boolean) {
    setSelectedIds(checked ? new Set(awaitingMyAction.map((row) => row.id)) : new Set())
  }

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

      <TabsContent value="awaiting" className="space-y-4">
        <AwaitingDocumentsTable
          rows={awaitingMyAction}
          selectedIds={selectedIds}
          onToggle={toggle}
          onToggleAll={toggleAll}
        />
        <BulkApprovalBar
          selected={selectedRows}
          onClearSelection={() => setSelectedIds(new Set())}
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
