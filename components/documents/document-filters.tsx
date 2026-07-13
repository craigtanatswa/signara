'use client'

import { useCallback, useEffect, useMemo, useState, useTransition } from 'react'
import { usePathname, useRouter, useSearchParams } from 'next/navigation'
import { CalendarIcon, Search, X } from 'lucide-react'
import { format, parseISO } from 'date-fns'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Switch } from '@/components/ui/switch'
import { Calendar } from '@/components/ui/calendar'
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover'
import {
  DropdownMenu,
  DropdownMenuCheckboxItem,
  DropdownMenuContent,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import {
  FILTERABLE_STATUSES,
  type FilterableStatus,
} from '@/lib/documents/document-filters'
import { cn } from '@/lib/utils'

export type FilterTemplateOption = { id: string; name: string }
export type FilterUserOption = { id: string; name: string }

interface DocumentFiltersProps {
  templates: FilterTemplateOption[]
  users?: FilterUserOption[]
  /** When true, show the "Initiated by" filter (admin / All tab context). */
  showInitiatedBy?: boolean
}

const STATUS_LABEL: Record<FilterableStatus, string> = {
  draft: 'Draft',
  in_progress: 'In Progress',
  completed: 'Completed',
  rejected: 'Rejected',
}

function parseCsvParam(value: string | null): string[] {
  if (!value?.trim()) return []
  return value
    .split(',')
    .map((part) => part.trim())
    .filter(Boolean)
}

export function DocumentFilters({
  templates,
  users = [],
  showInitiatedBy = false,
}: DocumentFiltersProps) {
  const router = useRouter()
  const pathname = usePathname()
  const searchParams = useSearchParams()
  const [, startTransition] = useTransition()

  const qFromUrl = searchParams.get('q') ?? ''
  const [searchInput, setSearchInput] = useState(qFromUrl)
  const [urlSearchSnapshot, setUrlSearchSnapshot] = useState(qFromUrl)

  // Sync draft from URL when search params change externally (back/forward, Clear).
  // https://react.dev/learn/you-might-not-need-an-effect#adjusting-some-state-when-a-prop-changes
  if (qFromUrl !== urlSearchSnapshot) {
    setUrlSearchSnapshot(qFromUrl)
    setSearchInput(qFromUrl)
  }

  const selectedTemplates = useMemo(
    () => parseCsvParam(searchParams.get('template')),
    [searchParams]
  )
  const selectedStatuses = useMemo(
    () =>
      parseCsvParam(searchParams.get('status')).filter((s): s is FilterableStatus =>
        (FILTERABLE_STATUSES as readonly string[]).includes(s)
      ),
    [searchParams]
  )
  const dateFrom = searchParams.get('from')
  const dateTo = searchParams.get('to')
  const initiatedBy = searchParams.get('initiatedBy')
  const showArchived = searchParams.get('showArchived') === '1'

  const hasActiveFilters = Boolean(
    qFromUrl ||
      selectedTemplates.length ||
      selectedStatuses.length ||
      dateFrom ||
      dateTo ||
      initiatedBy ||
      showArchived
  )

  const updateParams = useCallback(
    (mutate: (params: URLSearchParams) => void) => {
      const params = new URLSearchParams(searchParams.toString())
      mutate(params)
      // Reset to page 1 whenever filters change
      params.delete('page')
      const qs = params.toString()
      startTransition(() => {
        router.push(qs ? `${pathname}?${qs}` : pathname)
      })
    },
    [pathname, router, searchParams]
  )

  // Debounce title search → URL
  useEffect(() => {
    const trimmed = searchInput.trim()
    if (trimmed === qFromUrl) return

    const timer = window.setTimeout(() => {
      updateParams((params) => {
        if (trimmed) params.set('q', trimmed)
        else params.delete('q')
      })
    }, 300)

    return () => window.clearTimeout(timer)
  }, [searchInput, qFromUrl, updateParams])

  function toggleMulti(param: 'template' | 'status', id: string, checked: boolean) {
    updateParams((params) => {
      const current = new Set(parseCsvParam(params.get(param)))
      if (checked) current.add(id)
      else current.delete(id)
      const next = Array.from(current)
      if (next.length) params.set(param, next.join(','))
      else params.delete(param)
    })
  }

  function clearFilters() {
    startTransition(() => {
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
      router.push(qs ? `${pathname}?${qs}` : pathname)
    })
  }

  const dateLabel =
    dateFrom || dateTo
      ? `${dateFrom ? format(parseISO(dateFrom), 'dd MMM yyyy') : '…'} – ${
          dateTo ? format(parseISO(dateTo), 'dd MMM yyyy') : '…'
        }`
      : 'Date range'

  return (
    <div className="space-y-3 rounded-lg border border-signara-steel/30 bg-white p-4 shadow-sm">
      <div className="flex flex-wrap items-end gap-3">
        <div className="min-w-[200px] flex-1 space-y-1.5">
          <Label htmlFor="document-search" className="text-signara-navy">
            Search
          </Label>
          <div className="relative">
            <Search className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-signara-steel" />
            <Input
              id="document-search"
              value={searchInput}
              onChange={(e) => setSearchInput(e.target.value)}
              placeholder="Search by title…"
              className="border-signara-steel pl-9"
            />
          </div>
        </div>

        <div className="space-y-1.5">
          <Label className="text-signara-navy">Template</Label>
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button
                type="button"
                variant="outline"
                className="min-w-[140px] justify-between border-signara-steel font-normal"
              >
                {selectedTemplates.length
                  ? `${selectedTemplates.length} selected`
                  : 'All templates'}
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="start" className="max-h-64 w-56 overflow-y-auto">
              <DropdownMenuLabel>Templates</DropdownMenuLabel>
              <DropdownMenuSeparator />
              {templates.length === 0 ? (
                <p className="px-2 py-1.5 text-sm text-signara-steel">No templates</p>
              ) : (
                templates.map((template) => (
                  <DropdownMenuCheckboxItem
                    key={template.id}
                    checked={selectedTemplates.includes(template.id)}
                    onCheckedChange={(checked) =>
                      toggleMulti('template', template.id, checked === true)
                    }
                    onSelect={(e) => e.preventDefault()}
                  >
                    {template.name}
                  </DropdownMenuCheckboxItem>
                ))
              )}
            </DropdownMenuContent>
          </DropdownMenu>
        </div>

        <div className="space-y-1.5">
          <Label className="text-signara-navy">Status</Label>
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button
                type="button"
                variant="outline"
                className="min-w-[130px] justify-between border-signara-steel font-normal"
              >
                {selectedStatuses.length
                  ? `${selectedStatuses.length} selected`
                  : 'All statuses'}
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="start" className="w-48">
              <DropdownMenuLabel>Status</DropdownMenuLabel>
              <DropdownMenuSeparator />
              {FILTERABLE_STATUSES.map((status) => (
                <DropdownMenuCheckboxItem
                  key={status}
                  checked={selectedStatuses.includes(status)}
                  onCheckedChange={(checked) =>
                    toggleMulti('status', status, checked === true)
                  }
                  onSelect={(e) => e.preventDefault()}
                >
                  {STATUS_LABEL[status]}
                </DropdownMenuCheckboxItem>
              ))}
            </DropdownMenuContent>
          </DropdownMenu>
        </div>

        <div className="space-y-1.5">
          <Label className="text-signara-navy">Created</Label>
          <Popover>
            <PopoverTrigger asChild>
              <Button
                type="button"
                variant="outline"
                className={cn(
                  'min-w-[180px] justify-start border-signara-steel font-normal',
                  !(dateFrom || dateTo) && 'text-signara-steel'
                )}
              >
                <CalendarIcon className="mr-2 size-4" />
                {dateLabel}
              </Button>
            </PopoverTrigger>
            <PopoverContent className="w-auto p-4" align="start">
              <div className="flex flex-col gap-4 sm:flex-row">
                <div className="space-y-2">
                  <Label className="text-signara-navy">From</Label>
                  <Calendar
                    mode="single"
                    selected={dateFrom ? parseISO(dateFrom) : undefined}
                    onSelect={(day) => {
                      updateParams((params) => {
                        if (day) params.set('from', format(day, 'yyyy-MM-dd'))
                        else params.delete('from')
                      })
                    }}
                  />
                </div>
                <div className="space-y-2">
                  <Label className="text-signara-navy">To</Label>
                  <Calendar
                    mode="single"
                    selected={dateTo ? parseISO(dateTo) : undefined}
                    onSelect={(day) => {
                      updateParams((params) => {
                        if (day) params.set('to', format(day, 'yyyy-MM-dd'))
                        else params.delete('to')
                      })
                    }}
                  />
                </div>
              </div>
              {(dateFrom || dateTo) && (
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  className="mt-2 text-signara-steel"
                  onClick={() =>
                    updateParams((params) => {
                      params.delete('from')
                      params.delete('to')
                    })
                  }
                >
                  Clear dates
                </Button>
              )}
            </PopoverContent>
          </Popover>
        </div>

        {showInitiatedBy && users.length > 0 && (
          <div className="space-y-1.5">
            <Label className="text-signara-navy">Initiated by</Label>
            <Select
              value={initiatedBy ?? 'all'}
              onValueChange={(value) =>
                updateParams((params) => {
                  if (value === 'all') params.delete('initiatedBy')
                  else params.set('initiatedBy', value)
                })
              }
            >
              <SelectTrigger className="min-w-[160px] border-signara-steel">
                <SelectValue placeholder="Anyone" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Anyone</SelectItem>
                {users.map((user) => (
                  <SelectItem key={user.id} value={user.id}>
                    {user.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        )}

        {hasActiveFilters && (
          <Button
            type="button"
            variant="ghost"
            size="sm"
            className="text-signara-steel hover:text-signara-navy"
            onClick={clearFilters}
          >
            <X className="mr-1 size-4" />
            Clear filters
          </Button>
        )}
      </div>

      <div className="flex items-center gap-2 border-t border-signara-steel/20 pt-3">
        <Switch
          id="show-archived"
          checked={showArchived}
          onCheckedChange={(checked) =>
            updateParams((params) => {
              if (checked) params.set('showArchived', '1')
              else params.delete('showArchived')
            })
          }
        />
        <Label htmlFor="show-archived" className="cursor-pointer font-normal text-signara-navy">
          Show archived documents
        </Label>
      </div>
    </div>
  )
}
