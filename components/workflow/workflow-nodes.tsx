'use client'

import { Handle, Position, type NodeProps } from '@xyflow/react'
import { CheckCircle2, FileText, GripVertical, PenLine, Pencil, X } from 'lucide-react'
import { Badge } from '@/components/ui/badge'
import { cn } from '@/lib/utils'
import type { WorkflowStep } from '@/types/workflow'

export interface ApprovalStepNodeData extends Record<string, unknown> {
  step: WorkflowStep
  stepNumber: number
  assigneeLabel?: string
  signatureLabel?: string
  onEdit: (stepId: string) => void
  onDelete?: (stepId: string) => void
  allowReorder?: boolean
}

const handleStyle = { background: '#A1A8A2', width: 8, height: 8, border: 'none' }

export function StartNode() {
  return (
    <div className="nopan nodrag flex w-52 flex-col items-center gap-1 rounded-lg border border-dashed border-signara-steel/40 bg-signara-background px-4 py-3 text-center">
      <FileText className="size-5 text-signara-navy" />
      <span className="text-xs font-semibold uppercase tracking-wide text-signara-navy">Start</span>
      <span className="text-xs text-signara-steel">Document is created</span>
      <Handle type="source" position={Position.Bottom} style={handleStyle} />
    </div>
  )
}

export function EndNode() {
  return (
    <div className="nopan nodrag relative flex w-52 flex-col items-center gap-1 rounded-lg border border-dashed border-signara-steel/40 bg-signara-background px-4 py-3 text-center">
      <Handle type="target" position={Position.Top} style={handleStyle} />
      <CheckCircle2 className="size-5 text-green-600" />
      <span className="text-xs font-semibold uppercase tracking-wide text-signara-navy">End</span>
      <span className="text-xs text-signara-steel">Document is fully approved</span>
    </div>
  )
}

export function ApprovalStepNode({ data }: NodeProps) {
  const { step, stepNumber, assigneeLabel, signatureLabel, onEdit, onDelete, allowReorder = true } =
    data as ApprovalStepNodeData

  const authorityText = step.authorityText?.trim()

  return (
    <div className="group relative flex w-72 rounded-lg border border-signara-steel/30 border-l-4 border-l-signara-gold bg-white shadow-sm transition-shadow hover:shadow-md">
      <Handle type="target" position={Position.Top} style={handleStyle} />

      {allowReorder && (
        <div
          className="step-drag-handle flex w-8 shrink-0 cursor-grab flex-col items-center justify-center rounded-l-md border-r border-signara-steel/20 bg-signara-background/80 active:cursor-grabbing"
          title="Drag up or down to reorder"
        >
          <GripVertical className="size-4 text-signara-steel" />
        </div>
      )}

      <div className={cn('relative min-w-0 flex-1 p-3', !allowReorder && 'pl-4')}>
        {onDelete && (
          <button
            type="button"
            onClick={(event) => {
              event.stopPropagation()
              onDelete(step.id)
            }}
            aria-label="Delete step"
            className="nopan nodrag absolute -right-2 -top-2 z-10 flex size-5 items-center justify-center rounded-full border border-signara-steel/40 bg-white text-signara-steel opacity-0 shadow-sm transition-all hover:border-destructive hover:text-destructive group-hover:opacity-100"
          >
            <X className="size-3" />
          </button>
        )}

        <button
          type="button"
          onClick={(event) => {
            event.stopPropagation()
            onEdit(step.id)
          }}
          className={cn(
            'nopan nodrag flex w-full flex-col items-start gap-2 rounded-md text-left',
            'outline-none focus-visible:ring-2 focus-visible:ring-signara-navy/40'
          )}
        >
          <div className="flex w-full items-center justify-between gap-2">
            <span className="flex size-6 shrink-0 items-center justify-center rounded-full bg-signara-navy text-xs font-bold text-white">
              {stepNumber}
            </span>
            <span className="flex items-center gap-1 text-xs text-signara-steel opacity-0 transition-opacity group-hover:opacity-100">
              <Pencil className="size-3" />
              Edit
            </span>
          </div>

          <Badge
            variant="outline"
            className="max-w-full truncate border-signara-navy/20 bg-signara-navy/5 text-signara-navy"
          >
            {assigneeLabel || 'Select department & minimum level'}
          </Badge>

          <div className="flex items-center gap-1 text-xs text-signara-steel">
            <PenLine className="size-3 shrink-0" />
            <span className="truncate">{signatureLabel || 'Link a signature field'}</span>
          </div>

          <p className="line-clamp-2 w-full text-xs text-signara-steel">
            {authorityText || 'Add authority text describing this approval'}
          </p>
        </button>
      </div>

      <Handle type="source" position={Position.Bottom} style={handleStyle} />
    </div>
  )
}

export const workflowNodeTypes = {
  start: StartNode,
  end: EndNode,
  approvalStep: ApprovalStepNode,
}
