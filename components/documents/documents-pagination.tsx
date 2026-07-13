'use client'

import Link from 'next/link'
import { usePathname, useRouter, useSearchParams } from 'next/navigation'
import { ChevronLeft, ChevronRight } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { DOCUMENT_PAGE_SIZE } from '@/lib/documents/document-filters'

interface DocumentsPaginationProps {
  page: number
  total: number
  pageSize?: number
}

export function DocumentsPagination({
  page,
  total,
  pageSize = DOCUMENT_PAGE_SIZE,
}: DocumentsPaginationProps) {
  const router = useRouter()
  const pathname = usePathname()
  const searchParams = useSearchParams()

  const totalPages = Math.max(1, Math.ceil(total / pageSize))
  if (total === 0 || totalPages <= 1) return null

  function goTo(nextPage: number) {
    const params = new URLSearchParams(searchParams.toString())
    if (nextPage <= 1) params.delete('page')
    else params.set('page', String(nextPage))
    const qs = params.toString()
    router.push(qs ? `${pathname}?${qs}` : pathname)
  }

  return (
    <div className="flex items-center justify-between gap-3 pt-2">
      <p className="text-sm text-signara-steel">
        Page {page} of {totalPages}
        <span className="ml-2 text-signara-steel/80">({total} total)</span>
      </p>
      <div className="flex items-center gap-2">
        <Button
          type="button"
          variant="outline"
          size="sm"
          className="border-signara-navy text-signara-navy"
          disabled={page <= 1}
          onClick={() => goTo(page - 1)}
        >
          <ChevronLeft className="mr-1 size-4" />
          Previous
        </Button>
        <Button
          type="button"
          variant="outline"
          size="sm"
          className="border-signara-navy text-signara-navy"
          disabled={page >= totalPages}
          onClick={() => goTo(page + 1)}
        >
          Next
          <ChevronRight className="ml-1 size-4" />
        </Button>
      </div>
    </div>
  )
}

/** Link-style clear used in filtered empty states. */
export function ClearFiltersLink() {
  const pathname = usePathname()
  const searchParams = useSearchParams()

  const params = new URLSearchParams(searchParams.toString())
  for (const key of [
    'q',
    'template',
    'status',
    'from',
    'to',
    'initiatedBy',
    'showArchived',
    'page',
  ]) {
    params.delete(key)
  }
  const qs = params.toString()
  const href = qs ? `${pathname}?${qs}` : pathname

  return (
    <Link href={href} className="text-signara-gold hover:underline">
      Clear filters
    </Link>
  )
}
