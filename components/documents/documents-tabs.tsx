'use client'

import { useState } from 'react'
import Link from 'next/link'
import { usePathname, useRouter, useSearchParams } from 'next/navigation'
import { FileText } from 'lucide-react'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Badge } from '@/components/ui/badge'
import { Checkbox } from '@/components/ui/checkbox'
import { BulkApprovalBar } from '@/components/documents/bulk-approval-bar'
import { BulkActionsBar } from '@/components/documents/bulk-actions-bar'
import {
  ClearFiltersLink,
  DocumentsPagination,
} from '@/components/documents/documents-pagination'
import { cn } from '@/lib/utils'
import type { Document } from '@/types/database'

export interface DocumentRow {
  id: string
  title: string
  templateName: string
  status: Document['status']
  initiatorName: string
  createdAt: string
  archived: boolean
  stepProgress: { current: number; total: number } | null
}

/** Document awaiting the current user's action, with step metadata for bulk approve. */
export interface AwaitingDocumentRow extends DocumentRow {
  stepId: string
  requiresSignature: boolean
}

export interface DocumentTabResult {
  rows: DocumentRow[]
  total: number
}

export interface AwaitingTabResult {
  rows: AwaitingDocumentRow[]
  total: number
}

interface DocumentsTabsProps {
  myDocuments: DocumentTabResult
  awaitingMyAction: AwaitingTabResult
  allDocuments: DocumentTabResult | null
  /** Unfiltered awaiting count for the tab badge. */
  awaitingBadgeCount: number
  page: number
  filtersActive: boolean
  defaultTab: 'mine' | 'awaiting' | 'all'
  /** Changes when the result set identity changes — remounts selection state. */
  selectionResetKey: string
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
    <div className="flex flex-wrap items-center gap-1.5">
      <Badge variant="outline" className={STATUS_BADGE_CLASS[row.status]}>
        {label}
      </Badge>
      {row.archived && (
        <Badge
          variant="outline"
          className="border-signara-steel/40 bg-signara-steel/10 text-signara-steel"
        >
          Archived
        </Badge>
      )}
    </div>
  )
}

function EmptyState({
  filtersActive,
  emptyMessage,
}: {
  filtersActive: boolean
  emptyMessage: string
}) {
  return (
    <div className="flex flex-col items-center justify-center rounded-lg border border-dashed border-signara-steel/40 bg-white py-16 text-center">
      <FileText className="size-12 text-signara-steel/30" />
      {filtersActive ? (
        <>
          <p className="mt-4 max-w-sm text-sm text-signara-navy">
            No documents match your filters
          </p>
          <p className="mt-2 text-sm text-signara-steel">
            <ClearFiltersLink />
          </p>
        </>
      ) : (
        <p className="mt-4 max-w-sm text-sm text-signara-steel">{emptyMessage}</p>
      )}
    </div>
  )
}

function DocumentsTable({
  rows,
  emptyMessage,
  filtersActive,
  selectable = false,
  selectedIds,
  onToggle,
  onToggleAll,
}: {
  rows: DocumentRow[]
  emptyMessage: string
  filtersActive: boolean
  selectable?: boolean
  selectedIds?: Set<string>
  onToggle?: (id: string) => void
  onToggleAll?: (checked: boolean) => void
}) {
  if (rows.length === 0) {
    return <EmptyState filtersActive={filtersActive} emptyMessage={emptyMessage} />
  }

  const allSelected =
    selectable && selectedIds ? rows.every((row) => selectedIds.has(row.id)) : false
  const someSelected =
    selectable && selectedIds ? rows.some((row) => selectedIds.has(row.id)) : false

  return (
    <div className="overflow-hidden rounded-lg border border-signara-steel/30 bg-white shadow-sm">
      <table className="w-full">
        <thead>
          <tr className="border-b border-signara-steel/20">
            {selectable && (
              <th className="w-12 px-4 py-3">
                <Checkbox
                  checked={allSelected ? true : someSelected ? 'indeterminate' : false}
                  onCheckedChange={(checked) => onToggleAll?.(checked === true)}
                  aria-label="Select all documents"
                />
              </th>
            )}
            <th
              className={cn(
                'py-3 text-left text-xs font-semibold uppercase tracking-wider text-signara-steel',
                selectable ? 'px-4' : 'px-6'
              )}
            >
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
            const checked = selectedIds?.has(row.id) ?? false
            return (
              <tr
                key={row.id}
                className={cn(
                  row.archived && 'bg-signara-background/80 text-signara-steel',
                  checked && 'bg-signara-gold/5',
                  !checked && !row.archived && 'hover:bg-signara-background/50'
                )}
              >
                {selectable && (
                  <td className="px-4 py-4">
                    <Checkbox
                      checked={checked}
                      onCheckedChange={() => onToggle?.(row.id)}
                      aria-label={`Select ${row.title}`}
                    />
                  </td>
                )}
                <td className={cn('py-4', selectable ? 'px-4' : 'px-6')}>
                  <Link
                    href={`/dashboard/documents/${row.id}`}
                    className={cn(
                      'font-medium hover:text-signara-gold',
                      row.archived ? 'text-signara-steel' : 'text-signara-navy'
                    )}
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

function AwaitingDocumentsTable({
  rows,
  selectedIds,
  onToggle,
  onToggleAll,
  filtersActive,
}: {
  rows: AwaitingDocumentRow[]
  selectedIds: Set<string>
  onToggle: (id: string) => void
  onToggleAll: (checked: boolean) => void
  filtersActive: boolean
}) {
  if (rows.length === 0) {
    return (
      <EmptyState
        filtersActive={filtersActive}
        emptyMessage="Nothing is waiting on you right now."
      />
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
                className={cn(
                  row.archived && 'bg-signara-background/80',
                  checked ? 'bg-signara-gold/5' : 'hover:bg-signara-background/50'
                )}
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

export function DocumentsTabs({
  myDocuments,
  awaitingMyAction,
  allDocuments,
  awaitingBadgeCount,
  page,
  filtersActive,
  defaultTab,
  selectionResetKey,
}: DocumentsTabsProps) {
  return (
    <DocumentsTabsInner
      key={selectionResetKey}
      myDocuments={myDocuments}
      awaitingMyAction={awaitingMyAction}
      allDocuments={allDocuments}
      awaitingBadgeCount={awaitingBadgeCount}
      page={page}
      filtersActive={filtersActive}
      defaultTab={defaultTab}
    />
  )
}

function DocumentsTabsInner({
  myDocuments,
  awaitingMyAction,
  allDocuments,
  awaitingBadgeCount,
  page,
  filtersActive,
  defaultTab,
}: Omit<DocumentsTabsProps, 'selectionResetKey'>) {
  const router = useRouter()
  const pathname = usePathname()
  const searchParams = useSearchParams()
  const [awaitingSelected, setAwaitingSelected] = useState<Set<string>>(new Set())
  const [adminSelected, setAdminSelected] = useState<Set<string>>(new Set())

  const tabParam = searchParams.get('tab')
  const activeTab =
    tabParam === 'awaiting' || tabParam === 'mine' || (tabParam === 'all' && allDocuments)
      ? tabParam
      : defaultTab

  function setTab(value: string) {
    const params = new URLSearchParams(searchParams.toString())
    params.set('tab', value)
    params.delete('page')
    const qs = params.toString()
    router.push(qs ? `${pathname}?${qs}` : pathname)
  }

  const selectedAwaitingRows = awaitingMyAction.rows.filter((row) =>
    awaitingSelected.has(row.id)
  )

  return (
    <Tabs value={activeTab} onValueChange={setTab} className="gap-4">
      <TabsList>
        <TabsTrigger value="mine">My documents</TabsTrigger>
        <TabsTrigger value="awaiting">
          Awaiting my action
          {awaitingBadgeCount > 0 && (
            <Badge className="ml-1.5 h-5 min-w-5 justify-center bg-signara-gold px-1 text-signara-navy">
              {awaitingBadgeCount}
            </Badge>
          )}
        </TabsTrigger>
        {allDocuments && <TabsTrigger value="all">All</TabsTrigger>}
      </TabsList>

      <TabsContent value="mine" className="space-y-4">
        <DocumentsTable
          rows={myDocuments.rows}
          filtersActive={filtersActive}
          emptyMessage="You haven't started any documents yet. Start one from an active template."
        />
        <DocumentsPagination page={page} total={myDocuments.total} />
      </TabsContent>

      <TabsContent value="awaiting" className="space-y-4">
        <AwaitingDocumentsTable
          rows={awaitingMyAction.rows}
          selectedIds={awaitingSelected}
          filtersActive={filtersActive}
          onToggle={(id) => {
            setAwaitingSelected((prev) => {
              const next = new Set(prev)
              if (next.has(id)) next.delete(id)
              else next.add(id)
              return next
            })
          }}
          onToggleAll={(checked) => {
            setAwaitingSelected(
              checked ? new Set(awaitingMyAction.rows.map((row) => row.id)) : new Set()
            )
          }}
        />
        <DocumentsPagination page={page} total={awaitingMyAction.total} />
        <BulkApprovalBar
          selected={selectedAwaitingRows}
          onClearSelection={() => setAwaitingSelected(new Set())}
        />
      </TabsContent>

      {allDocuments && (
        <TabsContent value="all" className="space-y-4">
          <DocumentsTable
            rows={allDocuments.rows}
            filtersActive={filtersActive}
            emptyMessage="No documents in your organisation yet."
            selectable
            selectedIds={adminSelected}
            onToggle={(id) => {
              setAdminSelected((prev) => {
                const next = new Set(prev)
                if (next.has(id)) next.delete(id)
                else next.add(id)
                return next
              })
            }}
            onToggleAll={(checked) => {
              setAdminSelected(
                checked ? new Set(allDocuments.rows.map((row) => row.id)) : new Set()
              )
            }}
          />
          <DocumentsPagination page={page} total={allDocuments.total} />
          <BulkActionsBar
            selectedIds={Array.from(adminSelected)}
            onClearSelection={() => setAdminSelected(new Set())}
          />
        </TabsContent>
      )}
    </Tabs>
  )
}
