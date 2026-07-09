import type { Edge, Node } from '@xyflow/react'
import type { ApprovalStepNodeData } from '@/components/workflow/workflow-nodes'
import { JOB_LEVEL_LABELS } from '@/types/org-structure'
import type { DepartmentOption } from '@/types/org-structure'
import type { TemplateFieldOption, WorkflowStep } from '@/types/workflow'
import { formatStepPolicyLabel } from '@/types/workflow'
import { getSignatureFieldLabel } from '@/lib/workflow/signature-fields'

export const STEP_SPACING_Y = 160
export const CANVAS_X = 40

export function buildWorkflowGraph(
  steps: WorkflowStep[],
  departmentsById: Map<string, DepartmentOption>,
  signatureFields: TemplateFieldOption[],
  callbacks: {
    onEdit: (stepId: string) => void
    onDelete?: (stepId: string) => void
    lockedToSignatures?: boolean
  }
): { nodes: Node[]; edges: Edge[] } {
  const nodes: Node[] = [
    {
      id: 'start',
      type: 'start',
      position: { x: CANVAS_X, y: 0 },
      draggable: false,
      selectable: false,
      data: {},
    },
  ]
  const edges: Edge[] = []

  let previousId = 'start'
  steps.forEach((step, index) => {
    const assigneeLabel = formatStepPolicyLabel(step, departmentsById, (level) => JOB_LEVEL_LABELS[level])
    const signatureLabel = getSignatureFieldLabel(step.signatureFieldId, signatureFields)

    const data: ApprovalStepNodeData = {
      step,
      stepNumber: index + 1,
      assigneeLabel,
      signatureLabel,
      onEdit: callbacks.onEdit,
      onDelete: callbacks.onDelete,
      allowReorder: !callbacks.lockedToSignatures,
    }

    nodes.push({
      id: step.id,
      type: 'approvalStep',
      position: { x: CANVAS_X, y: (index + 1) * STEP_SPACING_Y },
      draggable: !callbacks.lockedToSignatures,
      dragHandle: callbacks.lockedToSignatures ? undefined : '.step-drag-handle',
      selectable: false,
      data,
    })

    edges.push({
      id: `e-${previousId}-${step.id}`,
      source: previousId,
      target: step.id,
      type: 'smoothstep',
      style: { stroke: '#A1A8A2' },
    })

    previousId = step.id
  })

  nodes.push({
    id: 'end',
    type: 'end',
    position: { x: CANVAS_X, y: (steps.length + 1) * STEP_SPACING_Y },
    draggable: false,
    selectable: false,
    data: {},
  })

  edges.push({
    id: `e-${previousId}-end`,
    source: previousId,
    target: 'end',
    type: 'smoothstep',
    style: { stroke: '#A1A8A2' },
  })

  return { nodes, edges }
}

export function orderStepIdsByNodePositions(nodes: Node[]): string[] {
  return nodes
    .filter((node) => node.type === 'approvalStep')
    .sort((a, b) => a.position.y - b.position.y)
    .map((node) => (node.data as ApprovalStepNodeData).step.id)
}
