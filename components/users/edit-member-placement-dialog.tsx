'use client'

import { useEffect, useState } from 'react'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { Loader2, Pencil } from 'lucide-react'
import { toast } from 'sonner'
import { updateMemberPlacement } from '@/app/actions/team'
import { ErrorMessage } from '@/components/ui/error-message'
import { ActionIconTooltip } from '@/components/ui/action-icon-tooltip'
import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Label } from '@/components/ui/label'
import { Input } from '@/components/ui/input'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import {
  getJobLevelsForDepartment,
  JOB_LEVEL_LABELS,
  JOB_LEVELS,
  type DepartmentOption,
  type JobLevel,
} from '@/types/org-structure'
import type { UserWithDepartment } from '@/types/database'
import { OverseenDepartmentsField } from '@/components/users/overseen-departments-field'

const editPlacementSchema = z.object({
  position: z.string().max(120, { message: 'Position must be 120 characters or fewer' }),
  department_id: z.string().uuid({ message: 'Select a department' }),
  job_level: z.enum(JOB_LEVELS, { message: 'Select a job level' }),
})

type EditPlacementFormValues = z.infer<typeof editPlacementSchema>

interface EditMemberPlacementDialogProps {
  member: UserWithDepartment
  departments: DepartmentOption[]
  hasManagingDirector: boolean
  onSuccess: () => void
}

export function EditMemberPlacementDialog({
  member,
  departments,
  hasManagingDirector,
  onSuccess,
}: EditMemberPlacementDialogProps) {
  const [open, setOpen] = useState(false)
  const [serverError, setServerError] = useState<string | null>(null)
  const [overseenDepartmentIds, setOverseenDepartmentIds] = useState<string[]>(
    () => member.overseen_departments?.map((d) => d.id) ?? []
  )

  const defaultDepartmentId =
    member.department_id ?? departments.find((d) => !d.is_executive)?.id ?? departments[0]?.id ?? ''

  const {
    register,
    handleSubmit,
    setValue,
    watch,
    reset,
    formState: { errors, isSubmitting },
  } = useForm<EditPlacementFormValues>({
    resolver: zodResolver(editPlacementSchema),
    defaultValues: {
      position: member.position ?? '',
      department_id: defaultDepartmentId,
      job_level: member.job_level,
    },
  })

  const selectedDepartmentId = watch('department_id')
  const selectedJobLevel = watch('job_level')
  const selectedDepartment = departments.find((d) => d.id === selectedDepartmentId)
  const memberIsManagingDirector = member.job_level === 'managing_director'

  const availableJobLevels = getJobLevelsForDepartment(selectedDepartment?.is_executive ?? false).filter(
    (level) =>
      !(level === 'managing_director' && hasManagingDirector && !memberIsManagingDirector)
  )

  useEffect(() => {
    if (!open || !selectedDepartment) return

    const allowed = getJobLevelsForDepartment(selectedDepartment.is_executive).filter(
      (level) =>
        !(level === 'managing_director' && hasManagingDirector && !memberIsManagingDirector)
    )

    if (!allowed.includes(selectedJobLevel)) {
      setValue('job_level', allowed[0] ?? 'staff')
    }
  }, [open, selectedDepartment, hasManagingDirector, memberIsManagingDirector, selectedJobLevel, setValue])

  useEffect(() => {
    if (!open) return
    setOverseenDepartmentIds((prev) =>
      prev.filter((id) => id !== selectedDepartmentId)
    )
  }, [open, selectedDepartmentId])

  useEffect(() => {
    if (!open) return
    if (selectedJobLevel !== 'director' && selectedJobLevel !== 'manager') {
      setOverseenDepartmentIds([])
    }
  }, [open, selectedJobLevel])

  function handleOpenChange(isOpen: boolean) {
    if (isOpen) {
      reset({
        position: member.position ?? '',
        department_id: defaultDepartmentId,
        job_level: member.job_level,
      })
      setOverseenDepartmentIds(member.overseen_departments?.map((d) => d.id) ?? [])
      setServerError(null)
    }
    setOpen(isOpen)
  }

  async function onSubmit(values: EditPlacementFormValues) {
    setServerError(null)

    const result = await updateMemberPlacement({
      userId: member.id,
      position: values.position.trim() || null,
      department_id: values.department_id,
      job_level: values.job_level,
      overseen_department_ids: overseenDepartmentIds,
    })

    if (result.error) {
      setServerError(result.error)
      return
    }

    toast.success(`${member.full_name}'s details updated`)
    setOpen(false)
    onSuccess()
  }

  return (
    <>
      <ActionIconTooltip label="Edit member">
        <Button
          type="button"
          variant="ghost"
          size="icon"
          className="text-signara-steel hover:text-signara-navy"
          onClick={() => handleOpenChange(true)}
          aria-label={`Edit ${member.full_name}'s position, department and job level`}
        >
          <Pencil className="size-4" />
        </Button>
      </ActionIconTooltip>

      <Dialog open={open} onOpenChange={handleOpenChange}>
        <DialogContent className="flex max-h-[calc(100dvh-2rem)] flex-col gap-0 overflow-hidden p-0 sm:max-w-[480px]">
          <DialogHeader className="shrink-0 border-b border-signara-steel/20 px-6 pt-6 pb-4">
            <DialogTitle className="text-signara-navy">Edit member</DialogTitle>
            <DialogDescription className="text-signara-steel">
              Update {member.full_name}&apos;s position and where they sit in your organisation.
              Position appears when they are mentioned; department and job level affect approval
              routing.
            </DialogDescription>
          </DialogHeader>

          <form onSubmit={handleSubmit(onSubmit)} className="flex min-h-0 flex-1 flex-col">
            <div className="min-h-0 flex-1 space-y-4 overflow-y-auto overscroll-y-contain px-6 py-4">
            <div className="rounded-md border border-signara-steel/25 bg-signara-background/60 px-4 py-3">
              <p className="text-sm font-medium text-signara-navy">{member.full_name}</p>
              <p className="text-xs text-signara-steel">{member.email}</p>
            </div>

            <div className="space-y-1.5">
              <Label htmlFor={`position-${member.id}`} className="text-signara-navy font-medium">
                Position
              </Label>
              <Input
                id={`position-${member.id}`}
                placeholder="e.g. Human Resources Officer"
                {...register('position')}
                aria-invalid={!!errors.position}
                className="border-signara-steel focus-visible:ring-signara-navy"
              />
              <p className="text-xs text-signara-steel">
                Optional — shown when they are mentioned (e.g. {member.full_name} - Human Resources
                Officer).
              </p>
              {errors.position && (
                <p className="text-destructive text-xs">{errors.position.message}</p>
              )}
            </div>

            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-1.5">
                <Label className="text-signara-navy font-medium">
                  Primary department <span className="text-destructive">*</span>
                </Label>
                <Select
                  value={selectedDepartmentId}
                  onValueChange={(value) => setValue('department_id', value)}
                >
                  <SelectTrigger className="w-full border-signara-steel focus:ring-signara-navy">
                    <SelectValue placeholder="Select department" />
                  </SelectTrigger>
                  <SelectContent>
                    {departments.map((department) => (
                      <SelectItem key={department.id} value={department.id}>
                        {department.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                {errors.department_id && (
                  <p className="text-destructive text-xs">{errors.department_id.message}</p>
                )}
              </div>

              <div className="space-y-1.5">
                <Label className="text-signara-navy font-medium">
                  Job level <span className="text-destructive">*</span>
                </Label>
                <Select
                  value={selectedJobLevel}
                  onValueChange={(value) => setValue('job_level', value as JobLevel)}
                >
                  <SelectTrigger className="w-full border-signara-steel focus:ring-signara-navy">
                    <SelectValue placeholder="Select job level" />
                  </SelectTrigger>
                  <SelectContent>
                    {availableJobLevels.map((level) => (
                      <SelectItem key={level} value={level}>
                        {JOB_LEVEL_LABELS[level]}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                {errors.job_level && (
                  <p className="text-destructive text-xs">{errors.job_level.message}</p>
                )}
              </div>
            </div>

            <OverseenDepartmentsField
              jobLevel={selectedJobLevel}
              primaryDepartmentId={selectedDepartmentId}
              departments={departments}
              selectedIds={overseenDepartmentIds}
              onChange={setOverseenDepartmentIds}
            />

            {memberIsManagingDirector && selectedJobLevel !== 'managing_director' && (
              <p className="rounded-md border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-800">
                Demoting the Managing Director will leave your organisation without one until you
                assign the role to someone else.
              </p>
            )}

            {serverError && <ErrorMessage>{serverError}</ErrorMessage>}
            </div>

            <DialogFooter className="shrink-0 border-t border-signara-steel/20 px-6 py-4">
              <Button
                type="button"
                variant="outline"
                onClick={() => handleOpenChange(false)}
                className="border-signara-navy text-signara-navy hover:bg-signara-navy hover:text-white"
              >
                Cancel
              </Button>
              <Button type="submit" disabled={isSubmitting || departments.length === 0} variant="signara">
                {isSubmitting ? (
                  <>
                    <Loader2 className="mr-2 size-4 animate-spin" />
                    Saving…
                  </>
                ) : (
                  'Save changes'
                )}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </>
  )
}
