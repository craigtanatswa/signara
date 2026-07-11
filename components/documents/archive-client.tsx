'use client'

import { useMemo, useState } from 'react'
import Link from 'next/link'
import { Archive, ClipboardList, Download, Loader2 } from 'lucide-react'
import { toast } from 'sonner'
import { getDocumentAttachmentSignedUrl } from '@/app/actions/documents'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import type { ArchivedDocumentRow } from '@/lib/documents/load-for-viewer'

export interface ArchiveDepartmentOption {
  id: string
  name: string
}

interface ArchiveClientProps {
  rows: ArchivedDocumentRow[]
  departments: ArchiveDepartmentOption[]
  defaultDepartmentId: string | null
  initiatorNameById: Record<string, string>
}

export function ArchiveClient({
  rows,
  departments,
  defaultDepartmentId,
  initiatorNameById,
}: ArchiveClientProps) {
  const [departmentFilter, setDepartmentFilter] = useState<string>(
    defaultDepartmentId && departments.some((d) => d.id === defaultDepartmentId)
      ? defaultDepartmentId
      : 'all'
  )
  const [downloadingId, setDownloadingId] = useState<string | null>(null)

  const filtered = useMemo(() => {
    if (departmentFilter === 'all') return rows
    if (departmentFilter === 'org') {
      return rows.filter((row) => !row.departmentId)
    }
    return rows.filter((row) => row.departmentId === departmentFilter)
  }, [rows, departmentFilter])

  async function downloadPath(path: string | null | undefined, label: string) {
    if (!path) {
      toast.error(`${label} is not available yet.`)
      return
    }
    setDownloadingId(path)
    try {
      const result = await getDocumentAttachmentSignedUrl(path)
      if ('error' in result) {
        toast.error(result.error)
        return
      }
      window.open(result.url, '_blank', 'noopener,noreferrer')
    } catch {
      toast.error(`Could not open ${label.toLowerCase()}.`)
    } finally {
      setDownloadingId(null)
    }
  }

  async function openAuditTrail(documentId: string) {
    const key = `audit:${documentId}`
    if (downloadingId) return
    setDownloadingId(key)
    try {
      const response = await fetch(`/api/documents/${documentId}/audit-trail`)
      if (!response.ok) {
        const body = (await response.json().catch(() => null)) as { error?: string } | null
        throw new Error(body?.error ?? 'Failed to open audit trail.')
      }
      const blob = await response.blob()
      const objectUrl = URL.createObjectURL(blob)
      const opened = window.open(objectUrl, '_blank', 'noopener,noreferrer')
      if (!opened) {
        URL.revokeObjectURL(objectUrl)
        throw new Error('Pop-up blocked. Allow pop-ups to view the audit trail.')
      }
      window.setTimeout(() => URL.revokeObjectURL(objectUrl), 60_000)
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Could not open audit trail.')
    } finally {
      setDownloadingId(null)
    }
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h2 className="text-xl font-bold text-signara-navy">Archive</h2>
          <p className="mt-0.5 text-sm text-signara-steel">
            Completed documents for departments you control, including physically signed uploads.
          </p>
        </div>
        {departments.length > 0 && (
          <div className="w-56 space-y-1">
            <p className="text-xs font-medium text-signara-navy">Department</p>
            <Select value={departmentFilter} onValueChange={setDepartmentFilter}>
              <SelectTrigger className="border-signara-steel">
                <SelectValue placeholder="All departments" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All departments</SelectItem>
                <SelectItem value="org">Organisation-wide</SelectItem>
                {departments.map((dept) => (
                  <SelectItem key={dept.id} value={dept.id}>
                    {dept.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        )}
      </div>

      {filtered.length === 0 ? (
        <div className="flex flex-col items-center justify-center rounded-lg border border-dashed border-signara-steel/40 bg-white py-16 text-center">
          <Archive className="size-12 text-signara-steel/30" />
          <p className="mt-4 max-w-sm text-sm text-signara-steel">
            No completed documents in this archive yet.
          </p>
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
                  Template
                </th>
                <th className="px-6 py-3 text-left text-xs font-semibold uppercase tracking-wider text-signara-steel">
                  Department
                </th>
                <th className="px-6 py-3 text-left text-xs font-semibold uppercase tracking-wider text-signara-steel">
                  Completed
                </th>
                <th className="px-6 py-3 text-left text-xs font-semibold uppercase tracking-wider text-signara-steel">
                  Files
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-signara-steel/10">
              {filtered.map((row) => {
                // Prefer the physically signed upload — it is the real approved document.
                const approvedPath = row.physical_signature_url ?? row.final_pdf_url
                const auditKey = `audit:${row.id}`
                const busy =
                  downloadingId === approvedPath || downloadingId === auditKey
                return (
                  <tr key={row.id} className="hover:bg-signara-background/50">
                    <td className="px-6 py-4">
                      <Link
                        href={`/dashboard/documents/${row.id}`}
                        className="font-medium text-signara-navy hover:text-signara-gold hover:underline"
                      >
                        {row.title}
                      </Link>
                      <p className="mt-0.5 text-xs text-signara-steel">
                        {initiatorNameById[row.initiated_by] ?? 'Unknown'}
                      </p>
                    </td>
                    <td className="px-6 py-4 text-sm text-signara-navy">{row.templateName}</td>
                    <td className="px-6 py-4">
                      <Badge
                        variant="outline"
                        className="border-signara-steel/40 bg-signara-background text-signara-navy"
                      >
                        {row.departmentName ?? '—'}
                      </Badge>
                    </td>
                    <td className="px-6 py-4 text-sm text-signara-navy">
                      {row.completed_at
                        ? new Date(row.completed_at).toLocaleString('en-GB')
                        : '—'}
                    </td>
                    <td className="px-6 py-4">
                      <div className="flex flex-wrap gap-2">
                        <Button
                          type="button"
                          variant="outline"
                          size="sm"
                          disabled={busy || !approvedPath}
                          onClick={() => void downloadPath(approvedPath, 'Approved document')}
                          className="h-8 border-signara-gold text-xs text-signara-navy"
                        >
                          {downloadingId === approvedPath ? (
                            <Loader2 className="mr-1 size-3.5 animate-spin" />
                          ) : (
                            <Download className="mr-1 size-3.5" />
                          )}
                          Approved document
                        </Button>
                        <Button
                          type="button"
                          variant="outline"
                          size="sm"
                          disabled={busy}
                          onClick={() => void openAuditTrail(row.id)}
                          className="h-8 border-signara-navy text-xs text-signara-navy"
                        >
                          {downloadingId === auditKey ? (
                            <Loader2 className="mr-1 size-3.5 animate-spin" />
                          ) : (
                            <ClipboardList className="mr-1 size-3.5" />
                          )}
                          Audit trail
                        </Button>
                      </div>
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}
