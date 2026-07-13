import type { Document } from '@/types/database'

export const DOCUMENT_PAGE_SIZE = 20

export const FILTERABLE_STATUSES = [
  'draft',
  'in_progress',
  'completed',
  'rejected',
] as const satisfies ReadonlyArray<Document['status']>

export type FilterableStatus = (typeof FILTERABLE_STATUSES)[number]

export type DocumentsTab = 'mine' | 'awaiting' | 'all'

export interface DocumentListFilters {
  search: string
  templateIds: string[]
  statuses: FilterableStatus[]
  dateFrom: string | null
  dateTo: string | null
  initiatedBy: string | null
  showArchived: boolean
  page: number
  tab: DocumentsTab
}

function asSingle(value: string | string[] | undefined): string | undefined {
  if (Array.isArray(value)) return value[0]
  return value
}

function parseCsv(value: string | undefined): string[] {
  if (!value?.trim()) return []
  return value
    .split(',')
    .map((part) => part.trim())
    .filter(Boolean)
}

function isFilterableStatus(value: string): value is FilterableStatus {
  return (FILTERABLE_STATUSES as readonly string[]).includes(value)
}

export function parseDocumentListFilters(
  searchParams: { [key: string]: string | string[] | undefined },
  options?: { isAdmin?: boolean; defaultTab?: DocumentsTab }
): DocumentListFilters {
  const isAdmin = options?.isAdmin ?? false
  const rawTab = asSingle(searchParams.tab)
  const tab: DocumentsTab =
    rawTab === 'awaiting' || rawTab === 'mine' || (rawTab === 'all' && isAdmin)
      ? rawTab
      : (options?.defaultTab ?? 'mine')

  const statuses = parseCsv(asSingle(searchParams.status)).filter(isFilterableStatus)
  const pageRaw = Number.parseInt(asSingle(searchParams.page) ?? '1', 10)
  const page = Number.isFinite(pageRaw) && pageRaw > 0 ? pageRaw : 1

  const dateFrom = asSingle(searchParams.from)?.trim() || null
  const dateTo = asSingle(searchParams.to)?.trim() || null

  return {
    search: (asSingle(searchParams.q) ?? '').trim(),
    templateIds: parseCsv(asSingle(searchParams.template)),
    statuses,
    dateFrom,
    dateTo,
    initiatedBy: isAdmin ? asSingle(searchParams.initiatedBy)?.trim() || null : null,
    showArchived: asSingle(searchParams.showArchived) === '1',
    page,
    tab,
  }
}

export function documentFiltersActive(filters: DocumentListFilters): boolean {
  return Boolean(
    filters.search ||
      filters.templateIds.length > 0 ||
      filters.statuses.length > 0 ||
      filters.dateFrom ||
      filters.dateTo ||
      filters.initiatedBy ||
      filters.showArchived
  )
}

export function paginationRange(page: number, pageSize = DOCUMENT_PAGE_SIZE) {
  const start = (page - 1) * pageSize
  const end = start + pageSize - 1
  return { start, end, pageSize }
}

/**
 * Inclusive end-of-day ISO for a YYYY-MM-DD `to` filter so the whole day is included.
 */
export function dateToExclusiveUpperBound(dateTo: string): string {
  const end = new Date(`${dateTo}T00:00:00.000Z`)
  end.setUTCDate(end.getUTCDate() + 1)
  return end.toISOString()
}
