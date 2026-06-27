'use client'

import { useEffect, useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { format, formatDistanceToNow } from 'date-fns'
import { MoreHorizontal, Pencil, Copy, Archive, Trash2, CheckCircle2, Loader2 } from 'lucide-react'
import { toast } from 'sonner'
import { Badge } from '@/components/ui/badge'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import {
  deleteTemplate,
  duplicateTemplate,
  toggleTemplateActive,
} from '@/app/actions/templates'
import type { Template } from '@/types/database'

interface TemplateCardProps {
  template: Template
}

function TemplateUpdatedAt({ updatedAt }: { updatedAt: string }) {
  const staticLabel = format(new Date(updatedAt), 'dd MMM yyyy')
  const [label, setLabel] = useState(staticLabel)

  useEffect(() => {
    setLabel(formatDistanceToNow(new Date(updatedAt), { addSuffix: true }))
  }, [updatedAt])

  return <span>{label}</span>
}

export function TemplateCard({ template }: TemplateCardProps) {
  const router = useRouter()
  const [isPending, startTransition] = useTransition()
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false)
  const [isDeleting, setIsDeleting] = useState(false)

  function handleEdit() {
    router.push(`/dashboard/templates/${template.id}/edit`)
  }

  function handleDuplicate() {
    startTransition(async () => {
      const result = await duplicateTemplate(template.id)
      if (result.error) {
        toast.error('Failed to duplicate template')
      } else {
        toast.success('Template duplicated')
        router.push(`/dashboard/templates/${result.id}/edit`)
      }
    })
  }

  function handleToggleActive() {
    startTransition(async () => {
      const result = await toggleTemplateActive(template.id, !template.is_active)
      if (result.error) {
        toast.error('Failed to update template status')
      } else {
        toast.success(template.is_active ? 'Template archived' : 'Template activated')
      }
    })
  }

  async function handleDelete() {
    setIsDeleting(true)
    const result = await deleteTemplate(template.id)
    setIsDeleting(false)
    if (result.error) {
      toast.error('Failed to delete template')
    } else {
      toast.success('Template deleted')
      setDeleteDialogOpen(false)
    }
  }

  const isLoading = isPending

  return (
    <>
      <div className="group relative flex flex-col rounded-lg border border-signara-steel/30 bg-white shadow-sm transition-shadow hover:shadow-md">
        {/* Gold accent bar on top */}
        <div className="h-0.5 rounded-t-lg bg-signara-gold/40" />

        <div className="flex flex-1 flex-col p-5">
          {/* Header row */}
          <div className="flex items-start justify-between gap-2">
            <div className="min-w-0 flex-1">
              <Link
                href={`/dashboard/templates/${template.id}/edit`}
                className="block truncate font-semibold text-signara-navy hover:text-signara-gold transition-colors"
              >
                {template.name}
              </Link>
              {template.description && (
                <p className="mt-0.5 line-clamp-2 text-xs text-signara-steel">
                  {template.description}
                </p>
              )}
            </div>

            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button
                  variant="ghost"
                  size="icon"
                  className="size-7 shrink-0 opacity-0 group-hover:opacity-100 transition-opacity"
                  disabled={isLoading}
                >
                  {isLoading ? (
                    <Loader2 className="size-3.5 animate-spin" />
                  ) : (
                    <MoreHorizontal className="size-3.5" />
                  )}
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-44">
                <DropdownMenuItem onClick={handleEdit} className="gap-2">
                  <Pencil className="size-3.5" />
                  Edit
                </DropdownMenuItem>
                <DropdownMenuItem onClick={handleDuplicate} className="gap-2">
                  <Copy className="size-3.5" />
                  Duplicate
                </DropdownMenuItem>
                <DropdownMenuSeparator />
                <DropdownMenuItem onClick={handleToggleActive} className="gap-2">
                  {template.is_active ? (
                    <>
                      <Archive className="size-3.5" />
                      Archive
                    </>
                  ) : (
                    <>
                      <CheckCircle2 className="size-3.5" />
                      Activate
                    </>
                  )}
                </DropdownMenuItem>
                <DropdownMenuSeparator />
                <DropdownMenuItem
                  onClick={() => setDeleteDialogOpen(true)}
                  className="gap-2 text-destructive focus:text-destructive"
                >
                  <Trash2 className="size-3.5" />
                  Delete
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>

          {/* Footer */}
          <div className="mt-4 flex items-center justify-between">
            <Badge
              variant="outline"
              className={
                template.is_active
                  ? 'border-green-200 bg-green-50 text-green-700 text-xs'
                  : 'border-signara-steel/30 bg-signara-background text-signara-steel text-xs'
              }
            >
              {template.is_active ? 'Active' : 'Draft'}
            </Badge>
            <div className="flex items-center gap-2 text-xs text-signara-steel">
              <span>v{template.version}</span>
              <span>·</span>
              <TemplateUpdatedAt updatedAt={template.updated_at} />
            </div>
          </div>
        </div>
      </div>

      {/* Delete confirmation dialog */}
      <Dialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Delete template</DialogTitle>
            <DialogDescription>
              This will permanently delete <strong>&ldquo;{template.name}&rdquo;</strong>. Documents
              already created from it will not be affected.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setDeleteDialogOpen(false)}
              disabled={isDeleting}
            >
              Cancel
            </Button>
            <Button variant="destructive" onClick={handleDelete} disabled={isDeleting}>
              {isDeleting ? (
                <>
                  <Loader2 className="mr-2 size-4 animate-spin" />
                  Deleting…
                </>
              ) : (
                'Delete template'
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  )
}
