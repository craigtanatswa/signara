'use client'

import { useState } from 'react'
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetFooter,
  SheetHeader,
  SheetTitle,
} from '@/components/ui/sheet'
import { Button } from '@/components/ui/button'
import { Label } from '@/components/ui/label'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { Switch } from '@/components/ui/switch'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from '@/components/ui/accordion'
import { JOB_LEVELS, JOB_LEVEL_LABELS, type DepartmentOption, type JobLevel } from '@/types/org-structure'
import {
  CONDITION_OPERATOR_OPTIONS,
  DEADLINE_HOUR_OPTIONS,
  INITIATOR_DEPARTMENT_LABEL,
  INITIATOR_DEPARTMENT_SELECT_VALUE,
  ORGANISATION_WIDE_LABEL,
  ORGANISATION_WIDE_SELECT_VALUE,
  type ConditionOperator,
  type StepDepartmentScope,
  type TemplateFieldOption,
  type WorkflowStep,
} from '@/types/workflow'
import { getSignatureFieldLabel } from '@/lib/workflow/signature-fields'

interface StepConfigPanelProps {
  step: WorkflowStep | null
  stepNumber: number
  open: boolean
  onOpenChange: (open: boolean) => void
  departments: DepartmentOption[]
  departmentsLoading: boolean
  templateFields: TemplateFieldOption[]
  signatureFields: TemplateFieldOption[]
  onSave: (step: WorkflowStep) => void
}

interface ConditionFormState {
  fieldId: string
  operator: ConditionOperator
  value: string
}

const EMPTY_CONDITION: ConditionFormState = { fieldId: '', operator: 'equals', value: '' }

export function StepConfigPanel({
  step,
  stepNumber,
  open,
  onOpenChange,
  departments,
  departmentsLoading,
  templateFields,
  signatureFields,
  onSave,
}: StepConfigPanelProps) {
  // NOTE: the parent mounts this component with `key={step.id}`, so each step
  // gets a fresh instance — initial state below is derived once per step,
  // no effect-based sync needed.
  const signatureFieldId = step?.signatureFieldId ?? ''
  const [departmentScope, setDepartmentScope] = useState<StepDepartmentScope>(
    step?.departmentScope ?? 'initiator'
  )
  const [assigneeDepartmentId, setAssigneeDepartmentId] = useState(step?.assigneeDepartmentId ?? '')
  const [minJobLevel, setMinJobLevel] = useState<JobLevel>(step?.minJobLevel ?? 'manager')
  const [authorityText, setAuthorityText] = useState(step?.authorityText ?? '')
  const [deadlineHours, setDeadlineHours] = useState(step?.deadlineHours ?? 48)
  const [allowDelegate, setAllowDelegate] = useState(step?.allowDelegate ?? false)
  const [conditionEnabled, setConditionEnabled] = useState(Boolean(step?.condition))
  const [condition, setCondition] = useState<ConditionFormState>(
    step?.condition
      ? {
          fieldId: step.condition.fieldId,
          operator: step.condition.operator,
          value: String(step.condition.value),
        }
      : EMPTY_CONDITION
  )

  if (!step) return null

  const signatureFieldLabel =
    getSignatureFieldLabel(signatureFieldId, signatureFields) ?? 'Unknown signature field'

  function handleScopeChange(value: string) {
    if (value === INITIATOR_DEPARTMENT_SELECT_VALUE) {
      setDepartmentScope('initiator')
      setAssigneeDepartmentId('')
      return
    }
    if (value === ORGANISATION_WIDE_SELECT_VALUE) {
      setDepartmentScope('organisation')
      setAssigneeDepartmentId('')
      return
    }
    setDepartmentScope('fixed')
    setAssigneeDepartmentId(value)
  }

  function handleSave() {
    if (!step) return

    const trimmedAuthority = authorityText.trim()

    const nextStep: WorkflowStep = {
      id: step.id,
      stepIndex: step.stepIndex,
      signatureFieldId: signatureFieldId || undefined,
      minJobLevel,
      departmentScope,
      assigneeDepartmentId: departmentScope === 'fixed' ? assigneeDepartmentId || undefined : undefined,
      authorityText: trimmedAuthority,
      deadlineHours,
      allowDelegate,
      condition:
        conditionEnabled && condition.fieldId && condition.value.trim()
          ? { fieldId: condition.fieldId, operator: condition.operator, value: condition.value.trim() }
          : undefined,
    }

    onSave(nextStep)
  }

  const canSave =
    authorityText.trim().length > 0 &&
    Boolean(signatureFieldId) &&
    (departmentScope !== 'fixed' || Boolean(assigneeDepartmentId))

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent className="z-[100] flex w-full flex-col gap-0 overflow-y-auto sm:max-w-md">
        <SheetHeader>
          <SheetTitle className="text-signara-navy">Step {stepNumber}</SheetTitle>
          <SheetDescription>
            Define who is allowed to approve this step. The initiator picks the exact
            person from this pool when they start a document.
          </SheetDescription>
        </SheetHeader>

        <div className="flex-1 space-y-6 px-4 pb-4">
          {/* Signature field link (fixed to document order) */}
          <div className="space-y-1.5">
            <Label className="text-signara-navy font-medium">Signature field</Label>
            <div className="rounded-md border border-signara-steel/30 bg-signara-background/60 px-3 py-2 text-sm text-signara-navy">
              {signatureFieldLabel}
            </div>
            <p className="text-xs text-signara-steel">
              Linked automatically to an approver signature field. Initiator signatures are configured
              in the template editor.
            </p>
          </div>

            {/* Department scope */}
            <div className="space-y-1.5">
              <Label className="text-signara-navy font-medium">Who can approve this step?</Label>
              <Select
                value={
                  departmentScope === 'initiator'
                    ? INITIATOR_DEPARTMENT_SELECT_VALUE
                    : departmentScope === 'organisation'
                      ? ORGANISATION_WIDE_SELECT_VALUE
                      : assigneeDepartmentId
                }
                onValueChange={handleScopeChange}
              >
                <SelectTrigger className="w-full border-signara-steel focus:ring-signara-navy">
                  <SelectValue placeholder={departmentsLoading ? 'Loading departments…' : 'Select scope'} />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value={INITIATOR_DEPARTMENT_SELECT_VALUE}>
                    {INITIATOR_DEPARTMENT_LABEL}
                  </SelectItem>
                  <SelectItem value={ORGANISATION_WIDE_SELECT_VALUE}>{ORGANISATION_WIDE_LABEL}</SelectItem>
                  {departments.map((department) => (
                    <SelectItem key={department.id} value={department.id}>
                      {department.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              {departmentScope === 'initiator' && (
                <p className="text-xs text-signara-steel">
                  Matches the initiator&apos;s department at submission time.
                </p>
              )}
              {departmentScope === 'organisation' && (
                <p className="text-xs text-signara-steel">
                  Any eligible person in the organisation, regardless of department.
                </p>
              )}
            </div>

            {/* Minimum job level */}
            <div className="space-y-1.5">
              <Label className="text-signara-navy font-medium">Minimum job level</Label>
              <Select value={minJobLevel} onValueChange={(value) => setMinJobLevel(value as JobLevel)}>
                <SelectTrigger className="w-full border-signara-steel focus:ring-signara-navy">
                  <SelectValue placeholder="Select minimum level" />
                </SelectTrigger>
                <SelectContent>
                  {JOB_LEVELS.map((level) => (
                    <SelectItem key={level} value={level}>
                      {JOB_LEVEL_LABELS[level]}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <p className="text-xs text-signara-steel">
                People at this level and above can be chosen as approvers. Options are the same for
                every initiator in the selected department scope.
              </p>
            </div>

            {step.assigneeRole && (
              <p className="rounded-md border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-800">
                This step was migrated from a legacy configuration (&ldquo;{step.assigneeRole}&rdquo;).
                Review the settings above before saving.
              </p>
            )}

            {/* Authority text */}
            <div className="space-y-1.5">
              <Label htmlFor="authority-text" className="text-signara-navy font-medium">
                What does this approval mean?
              </Label>
              <Textarea
                id="authority-text"
                placeholder="Describe what this approval means, e.g. 'Approves expenditure up to $5,000'"
                value={authorityText}
                onChange={(e) => setAuthorityText(e.target.value)}
                className="min-h-24 border-signara-steel focus-visible:ring-signara-navy"
              />
            </div>

            {/* Deadline */}
            <div className="space-y-1.5">
              <Label className="text-signara-navy font-medium">Send a reminder after</Label>
              <Select value={String(deadlineHours)} onValueChange={(value) => setDeadlineHours(Number(value))}>
                <SelectTrigger className="w-full border-signara-steel focus:ring-signara-navy">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {DEADLINE_HOUR_OPTIONS.map((option) => (
                    <SelectItem key={option.value} value={String(option.value)}>
                      {option.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* Allow delegate */}
            <div className="flex items-start justify-between gap-4 rounded-md border border-signara-steel/30 bg-signara-background/60 p-3">
              <div>
                <Label htmlFor="allow-delegate" className="text-signara-navy font-medium">
                  Allow delegation
                </Label>
                <p className="mt-0.5 text-xs text-signara-steel">
                  Let this person delegate their approval to someone else
                </p>
              </div>
              <Switch id="allow-delegate" checked={allowDelegate} onCheckedChange={setAllowDelegate} />
            </div>

            {/* Conditional skip */}
            <Accordion type="single" collapsible>
              <AccordionItem value="condition" className="border-signara-steel/30">
                <AccordionTrigger className="text-sm font-medium text-signara-navy">
                  Only require this step if… (optional)
                </AccordionTrigger>
                <AccordionContent className="space-y-3">
                  {templateFields.length === 0 ? (
                    <p className="text-xs text-signara-steel">
                      Add a form field to the template first to enable conditional steps.
                    </p>
                  ) : (
                    <>
                      <div className="flex items-center justify-between">
                        <Label htmlFor="condition-enabled" className="text-signara-navy">
                          Skip this step unless the condition is met
                        </Label>
                        <Switch
                          id="condition-enabled"
                          checked={conditionEnabled}
                          onCheckedChange={setConditionEnabled}
                        />
                      </div>

                      {conditionEnabled && (
                        <div className="space-y-2">
                          <Select
                            value={condition.fieldId}
                            onValueChange={(value) => setCondition((prev) => ({ ...prev, fieldId: value }))}
                          >
                            <SelectTrigger className="w-full border-signara-steel">
                              <SelectValue placeholder="Choose a field" />
                            </SelectTrigger>
                            <SelectContent>
                              {templateFields.map((field) => (
                                <SelectItem key={field.fieldId} value={field.fieldId}>
                                  {field.label}
                                </SelectItem>
                              ))}
                            </SelectContent>
                          </Select>

                          <Select
                            value={condition.operator}
                            onValueChange={(value) =>
                              setCondition((prev) => ({ ...prev, operator: value as ConditionOperator }))
                            }
                          >
                            <SelectTrigger className="w-full border-signara-steel">
                              <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                              {CONDITION_OPERATOR_OPTIONS.map((option) => (
                                <SelectItem key={option.value} value={option.value}>
                                  {option.label}
                                </SelectItem>
                              ))}
                            </SelectContent>
                          </Select>

                          <Input
                            placeholder="Value"
                            value={condition.value}
                            onChange={(e) => setCondition((prev) => ({ ...prev, value: e.target.value }))}
                            className="border-signara-steel focus-visible:ring-signara-navy"
                          />
                        </div>
                      )}
                    </>
                  )}
                </AccordionContent>
              </AccordionItem>
            </Accordion>
          </div>

        <SheetFooter className="flex-row justify-end border-t border-signara-steel/20">
          <Button type="button" variant="signara" onClick={handleSave} disabled={!canSave}>
            Save
          </Button>
        </SheetFooter>
      </SheetContent>
    </Sheet>
  )
}
