'use client'

import { useEffect, useMemo, useState } from 'react'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { Check, Copy, Loader2, UserPlus } from 'lucide-react'
import { toast } from 'sonner'
import { ErrorMessage } from '@/components/ui/error-message'
import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
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
import { OverseenDepartmentsField } from '@/components/users/overseen-departments-field'

const inviteSchema = z.object({
  full_name: z.string().min(2, { message: 'Full name must be at least 2 characters' }),
  email: z.union([
    z.literal(''),
    z.string().email({ message: 'Please enter a valid email address' }),
  ]),
  role: z.enum(['admin', 'member'], { message: 'Please select a system role' }),
  department_id: z.string().uuid({ message: 'Select a department' }),
  job_level: z.enum(JOB_LEVELS, { message: 'Select a job level' }),
})

type InviteFormValues = z.infer<typeof inviteSchema>

interface CreatedCredentials {
  fullName: string
  email: string
  tempPassword: string
}

interface InviteUserDialogProps {
  departments: DepartmentOption[]
  hasManagingDirector: boolean
  onSuccess: () => void
}

export function InviteUserDialog({
  departments,
  hasManagingDirector,
  onSuccess,
}: InviteUserDialogProps) {
  const [open, setOpen] = useState(false)
  const [credentialsOpen, setCredentialsOpen] = useState(false)
  const [createdCredentials, setCreatedCredentials] = useState<CreatedCredentials | null>(null)
  const [copiedField, setCopiedField] = useState<'email' | 'password' | 'all' | null>(null)
  const [serverError, setServerError] = useState<string | null>(null)
  const [overseenDepartmentIds, setOverseenDepartmentIds] = useState<string[]>([])

  const defaultDepartmentId = useMemo(
    () => departments.find((d) => !d.is_executive)?.id ?? departments[0]?.id ?? '',
    [departments]
  )

  const {
    register,
    handleSubmit,
    setValue,
    watch,
    reset,
    formState: { errors, isSubmitting },
  } = useForm<InviteFormValues>({
    resolver: zodResolver(inviteSchema),
    defaultValues: {
      email: '',
      role: 'member',
      department_id: defaultDepartmentId,
      job_level: 'staff',
    },
  })

  const selectedDepartmentId = watch('department_id')
  const selectedJobLevel = watch('job_level')
  const selectedDepartment = departments.find((d) => d.id === selectedDepartmentId)
  const availableJobLevels = getJobLevelsForDepartment(selectedDepartment?.is_executive ?? false).filter(
    (level) => !(level === 'managing_director' && hasManagingDirector)
  )

  useEffect(() => {
    if (!selectedDepartment) return
    const allowed = getJobLevelsForDepartment(selectedDepartment.is_executive).filter(
      (level) => !(level === 'managing_director' && hasManagingDirector)
    )
    const current = watch('job_level')
    if (!allowed.includes(current)) {
      setValue('job_level', allowed[0] ?? 'staff')
    }
  }, [selectedDepartment, hasManagingDirector, setValue, watch])

  useEffect(() => {
    setOverseenDepartmentIds((prev) =>
      prev.filter((id) => id !== selectedDepartmentId)
    )
  }, [selectedDepartmentId])

  useEffect(() => {
    if (selectedJobLevel !== 'director' && selectedJobLevel !== 'manager') {
      setOverseenDepartmentIds([])
    }
  }, [selectedJobLevel])

  async function copyToClipboard(text: string, field: 'email' | 'password' | 'all') {
    try {
      await navigator.clipboard.writeText(text)
      setCopiedField(field)
      setTimeout(() => setCopiedField(null), 2000)
    } catch {
      toast.error('Could not copy to clipboard')
    }
  }

  function handleCredentialsClose() {
    setCredentialsOpen(false)
    setCreatedCredentials(null)
    setCopiedField(null)
  }

  async function onSubmit(values: InviteFormValues) {
    setServerError(null)

    const response = await fetch('/api/users/invite', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        ...values,
        overseen_department_ids: overseenDepartmentIds,
      }),
    })

    const data = await response.json()

    if (!response.ok) {
      setServerError(data.error ?? 'Something went wrong. Please try again.')
      return
    }

    reset({
      email: '',
      role: 'member',
      department_id: defaultDepartmentId,
      job_level: 'staff',
    })
    setOverseenDepartmentIds([])
    setOpen(false)
    onSuccess()

    if (data.email && data.tempPassword) {
      setCreatedCredentials({
        fullName: values.full_name,
        email: data.email,
        tempPassword: data.tempPassword,
      })
      setCredentialsOpen(true)
    } else {
      toast.success(`${values.full_name} added to your team.`)
    }
  }

  function handleOpenChange(isOpen: boolean) {
    if (!isOpen) {
      reset({
        email: '',
        role: 'member',
        department_id: defaultDepartmentId,
        job_level: 'staff',
      })
      setOverseenDepartmentIds([])
      setServerError(null)
    }
    setOpen(isOpen)
  }

  return (
    <>
      <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogTrigger asChild>
        <Button variant="signara">
          <UserPlus className="mr-2 size-4" />
          Invite member
        </Button>
      </DialogTrigger>

      <DialogContent className="flex max-h-[calc(100dvh-2rem)] flex-col gap-0 overflow-hidden p-0 sm:max-w-[520px]">
        <DialogHeader className="shrink-0 border-b border-signara-steel/20 px-6 pt-6 pb-4">
          <DialogTitle className="text-signara-navy">Invite team member</DialogTitle>
          <DialogDescription className="text-signara-steel">
            Assign their department and job level — this determines which approval steps they can
            receive.
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit(onSubmit)} className="flex min-h-0 flex-1 flex-col">
          <div className="min-h-0 flex-1 space-y-4 overflow-y-auto overscroll-y-contain px-6 py-4">
          <div className="space-y-1.5">
            <Label htmlFor="full_name" className="text-signara-navy font-medium">
              Full name <span className="text-destructive">*</span>
            </Label>
            <Input
              id="full_name"
              placeholder="Jane Smith"
              {...register('full_name')}
              aria-invalid={!!errors.full_name}
              className="border-signara-steel focus-visible:ring-signara-navy"
            />
            {errors.full_name && (
              <p className="text-destructive text-xs">{errors.full_name.message}</p>
            )}
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="invite_email" className="text-signara-navy font-medium">
              Email address
            </Label>
            <Input
              id="invite_email"
              type="email"
              placeholder="Leave blank for test users"
              {...register('email')}
              aria-invalid={!!errors.email}
              className="border-signara-steel focus-visible:ring-signara-navy"
            />
            <p className="text-xs text-signara-steel">
              Optional for testing — a login email is generated automatically if left blank.
            </p>
            {errors.email && <p className="text-destructive text-xs">{errors.email.message}</p>}
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
                value={watch('job_level')}
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

          <div className="space-y-1.5">
            <Label className="text-signara-navy font-medium">
              Signara access <span className="text-destructive">*</span>
            </Label>
            <Select
              defaultValue="member"
              onValueChange={(value) => setValue('role', value as 'admin' | 'member')}
            >
              <SelectTrigger className="border-signara-steel focus:ring-signara-navy">
                <SelectValue placeholder="Select access level" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="member">Member</SelectItem>
                <SelectItem value="admin">Admin</SelectItem>
              </SelectContent>
            </Select>
            <p className="text-xs text-signara-steel">
              Admin can manage templates, team, and departments. Job level controls approval routing.
            </p>
          </div>

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
                  Adding…
                </>
              ) : (
                'Add member'
              )}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>

      <Dialog open={credentialsOpen} onOpenChange={(isOpen) => !isOpen && handleCredentialsClose()}>
        <DialogContent className="sm:max-w-[480px]">
          <DialogHeader>
            <DialogTitle className="text-signara-navy">Test user created</DialogTitle>
            <DialogDescription className="text-signara-steel">
              Save these login details for {createdCredentials?.fullName}. They will not be shown
              again.
            </DialogDescription>
          </DialogHeader>

          {createdCredentials && (
            <div className="space-y-4 py-2">
              <div className="space-y-1.5">
                <Label className="text-signara-navy font-medium">Email</Label>
                <div className="flex gap-2">
                  <Input
                    readOnly
                    value={createdCredentials.email}
                    className="border-signara-steel bg-signara-background font-mono text-sm"
                  />
                  <Button
                    type="button"
                    variant="outline"
                    size="icon"
                    className="shrink-0 border-signara-navy text-signara-navy hover:bg-signara-navy hover:text-white"
                    onClick={() => copyToClipboard(createdCredentials.email, 'email')}
                    aria-label="Copy email"
                  >
                    {copiedField === 'email' ? (
                      <Check className="size-4" />
                    ) : (
                      <Copy className="size-4" />
                    )}
                  </Button>
                </div>
              </div>

              <div className="space-y-1.5">
                <Label className="text-signara-navy font-medium">Temporary password</Label>
                <div className="flex gap-2">
                  <Input
                    readOnly
                    value={createdCredentials.tempPassword}
                    className="border-signara-steel bg-signara-background font-mono text-sm"
                  />
                  <Button
                    type="button"
                    variant="outline"
                    size="icon"
                    className="shrink-0 border-signara-navy text-signara-navy hover:bg-signara-navy hover:text-white"
                    onClick={() => copyToClipboard(createdCredentials.tempPassword, 'password')}
                    aria-label="Copy password"
                  >
                    {copiedField === 'password' ? (
                      <Check className="size-4" />
                    ) : (
                      <Copy className="size-4" />
                    )}
                  </Button>
                </div>
              </div>

              <Button
                type="button"
                variant="outline"
                className="w-full border-signara-navy text-signara-navy hover:bg-signara-navy hover:text-white"
                onClick={() =>
                  copyToClipboard(
                    `Email: ${createdCredentials.email}\nPassword: ${createdCredentials.tempPassword}`,
                    'all'
                  )
                }
              >
                {copiedField === 'all' ? (
                  <>
                    <Check className="mr-2 size-4" />
                    Copied
                  </>
                ) : (
                  <>
                    <Copy className="mr-2 size-4" />
                    Copy all login details
                  </>
                )}
              </Button>
            </div>
          )}

          <DialogFooter>
            <Button type="button" variant="signara" onClick={handleCredentialsClose}>
              Done
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  )
}
