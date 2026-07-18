'use client'

import { useMemo, useState } from 'react'
import { Check, ChevronsUpDown } from 'lucide-react'
import { Button } from '@/components/ui/button'
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from '@/components/ui/command'
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover'
import { cn } from '@/lib/utils'
import type { DepartmentOption } from '@/types/org-structure'

interface DepartmentComboboxProps {
  departments: DepartmentOption[]
  value: string
  onChange: (departmentId: string, departmentName: string) => void
  /** Called when the user commits a free-text name that is not in the list yet. */
  onCreateName?: (name: string) => void
  placeholder?: string
  disabled?: boolean
}

export function DepartmentCombobox({
  departments,
  value,
  onChange,
  onCreateName,
  placeholder = 'Select or type a department',
  disabled,
}: DepartmentComboboxProps) {
  const [open, setOpen] = useState(false)
  const [search, setSearch] = useState('')

  const selected = departments.find((d) => d.id === value)

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase()
    if (!q) return departments
    return departments.filter((d) => d.name.toLowerCase().includes(q))
  }, [departments, search])

  const exactMatch = useMemo(() => {
    const q = search.trim().toLowerCase()
    if (!q) return null
    return departments.find((d) => d.name.toLowerCase() === q) ?? null
  }, [departments, search])

  const canCreate = search.trim().length > 0 && !exactMatch

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          type="button"
          variant="outline"
          role="combobox"
          aria-expanded={open}
          disabled={disabled}
          className="w-full justify-between border-signara-steel font-normal text-signara-navy hover:bg-white"
        >
          <span className={cn('truncate', !selected && 'text-signara-steel')}>
            {selected?.name ?? placeholder}
          </span>
          <ChevronsUpDown className="ml-2 size-4 shrink-0 opacity-50" />
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-[var(--radix-popover-trigger-width)] p-0" align="start">
        <Command shouldFilter={false}>
          <CommandInput
            placeholder="Search or create…"
            value={search}
            onValueChange={setSearch}
          />
          <CommandList>
            <CommandEmpty>
              {canCreate ? (
                <button
                  type="button"
                  className="w-full px-2 py-3 text-left text-sm text-signara-navy hover:bg-accent"
                  onClick={() => {
                    onCreateName?.(search.trim())
                    setSearch('')
                    setOpen(false)
                  }}
                >
                  Create &ldquo;{search.trim()}&rdquo;
                </button>
              ) : (
                'No department found.'
              )}
            </CommandEmpty>
            <CommandGroup>
              {filtered.map((department) => (
                <CommandItem
                  key={department.id}
                  value={department.id}
                  onSelect={() => {
                    onChange(department.id, department.name)
                    setSearch('')
                    setOpen(false)
                  }}
                >
                  <Check
                    className={cn(
                      'mr-2 size-4',
                      value === department.id ? 'opacity-100' : 'opacity-0'
                    )}
                  />
                  {department.name}
                </CommandItem>
              ))}
              {canCreate && filtered.length > 0 && (
                <CommandItem
                  value={`__create__${search.trim()}`}
                  onSelect={() => {
                    onCreateName?.(search.trim())
                    setSearch('')
                    setOpen(false)
                  }}
                >
                  Create &ldquo;{search.trim()}&rdquo;
                </CommandItem>
              )}
            </CommandGroup>
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  )
}
