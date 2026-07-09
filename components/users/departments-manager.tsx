'use client'

import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { Loader2, Plus, Trash2 } from 'lucide-react'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Badge } from '@/components/ui/badge'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { createDepartment, deleteDepartment } from '@/app/actions/departments'
import type { Department } from '@/types/database'

interface DepartmentsManagerProps {
  departments: Pick<Department, 'id' | 'name' | 'slug' | 'is_executive'>[]
  memberCounts: Record<string, number>
}

export function DepartmentsManager({ departments, memberCounts }: DepartmentsManagerProps) {
  const router = useRouter()
  const [isPending, startTransition] = useTransition()
  const [newName, setNewName] = useState('')
  const [deleteTarget, setDeleteTarget] = useState<Pick<Department, 'id' | 'name'> | null>(null)

  function handleCreate() {
    const trimmed = newName.trim()
    if (!trimmed) {
      toast.error('Enter a department name.')
      return
    }

    startTransition(async () => {
      const result = await createDepartment(trimmed)
      if (result.error) {
        toast.error(result.error)
        return
      }
      toast.success(`Department "${trimmed}" created`)
      setNewName('')
      router.refresh()
    })
  }

  function handleDelete() {
    if (!deleteTarget) return

    startTransition(async () => {
      const result = await deleteDepartment(deleteTarget.id)
      if (result.error) {
        toast.error(result.error)
        return
      }
      toast.success(`Department "${deleteTarget.name}" deleted`)
      setDeleteTarget(null)
      router.refresh()
    })
  }

  return (
    <>
      <div className="rounded-lg border border-signara-steel/30 bg-white shadow-sm">
        <div className="border-b border-signara-steel/20 px-6 py-4">
          <h3 className="font-semibold text-signara-navy">Departments</h3>
          <p className="mt-0.5 text-sm text-signara-steel">
            Manage departments for your organisation. Executive is reserved for leadership roles.
          </p>
        </div>

        <div className="space-y-4 p-6">
          <div className="flex flex-col gap-2 sm:flex-row">
            <Input
              value={newName}
              onChange={(e) => setNewName(e.target.value)}
              placeholder="e.g. Finance, Human Resources"
              className="border-signara-steel focus-visible:ring-signara-navy"
              disabled={isPending}
            />
            <Button
              type="button"
              variant="signara"
              onClick={handleCreate}
              disabled={isPending}
              className="shrink-0"
            >
              {isPending ? <Loader2 className="size-4 animate-spin" /> : <Plus className="mr-1.5 size-4" />}
              Add department
            </Button>
          </div>

          <ul className="divide-y divide-signara-steel/15 rounded-md border border-signara-steel/25">
            {departments.map((department) => (
              <li
                key={department.id}
                className="flex items-center justify-between gap-3 px-4 py-3"
              >
                <div className="min-w-0">
                  <div className="flex items-center gap-2">
                    <span className="font-medium text-signara-navy">{department.name}</span>
                    {department.is_executive && (
                      <Badge variant="outline" className="border-signara-gold/40 bg-signara-gold/10 text-signara-navy">
                        Executive
                      </Badge>
                    )}
                  </div>
                  <p className="text-xs text-signara-steel">
                    {memberCounts[department.id] ?? 0} member
                    {(memberCounts[department.id] ?? 0) === 1 ? '' : 's'}
                  </p>
                </div>

                {!department.is_executive && (
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    className="text-signara-steel hover:text-destructive"
                    onClick={() => setDeleteTarget({ id: department.id, name: department.name })}
                    disabled={isPending}
                    aria-label={`Delete ${department.name}`}
                  >
                    <Trash2 className="size-4" />
                  </Button>
                )}
              </li>
            ))}
          </ul>
        </div>
      </div>

      <Dialog open={deleteTarget !== null} onOpenChange={(open) => !open && setDeleteTarget(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Delete {deleteTarget?.name}?</DialogTitle>
            <DialogDescription>
              This department can only be deleted when no members are assigned to it.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDeleteTarget(null)} disabled={isPending}>
              Cancel
            </Button>
            <Button variant="destructive" onClick={handleDelete} disabled={isPending}>
              Delete department
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  )
}
