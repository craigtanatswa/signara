'use client'

import '@xyflow/react/dist/style.css'
import { useCallback, useEffect, useMemo, useRef, type MouseEvent } from 'react'
import {
  Background,
  Controls,
  MiniMap,
  Panel,
  ReactFlow,
  ReactFlowProvider,
  useReactFlow,
  useEdgesState,
  useNodesState,
  type Node,
  type OnNodeDrag,
} from '@xyflow/react'
import { Maximize2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { workflowNodeTypes } from '@/components/workflow/workflow-nodes'
import {
  buildWorkflowGraph,
  CANVAS_X,
  orderStepIdsByNodePositions,
} from '@/lib/workflow/layout'
import { cn } from '@/lib/utils'
import type { DepartmentOption } from '@/types/org-structure'
import type { TemplateFieldOption, WorkflowStep } from '@/types/workflow'

interface WorkflowCanvasProps {
  steps: WorkflowStep[]
  departments: DepartmentOption[]
  signatureFields: TemplateFieldOption[]
  onEditStep: (stepId: string) => void
  onDeleteStep?: (stepId: string) => void
  onStepsReorder?: (orderedStepIds: string[]) => void
  lockedToSignatures?: boolean
  className?: string
  onMaximize?: () => void
}

function FitViewOnChange({ triggerKey }: { triggerKey: string }) {
  const { fitView } = useReactFlow()

  useEffect(() => {
    const frame = requestAnimationFrame(() => {
      fitView({ padding: 0.35, duration: 200 })
    })
    return () => cancelAnimationFrame(frame)
  }, [triggerKey, fitView])

  return null
}

function WorkflowCanvasInner({
  steps,
  departments,
  signatureFields,
  onEditStep,
  onDeleteStep,
  onStepsReorder,
  lockedToSignatures = false,
  className,
  onMaximize,
}: WorkflowCanvasProps) {
  const departmentsById = useMemo(
    () => new Map(departments.map((department) => [department.id, department])),
    [departments]
  )
  const isDraggingRef = useRef(false)
  const stepOrderKey = steps.map((step) => step.id).join('|')

  const graph = useMemo(
    () =>
      buildWorkflowGraph(steps, departmentsById, signatureFields, {
        onEdit: onEditStep,
        onDelete: onDeleteStep,
        lockedToSignatures,
      }),
    [steps, departmentsById, signatureFields, onEditStep, onDeleteStep, lockedToSignatures]
  )

  const [nodes, setNodes, onNodesChange] = useNodesState(graph.nodes)
  const [edges, setEdges, onEdgesChange] = useEdgesState(graph.edges)

  useEffect(() => {
    if (isDraggingRef.current) return
    setNodes(graph.nodes)
    setEdges(graph.edges)
  }, [graph.nodes, graph.edges, setNodes, setEdges])

  const onNodeDragStart = useCallback(() => {
    if (lockedToSignatures) return
    isDraggingRef.current = true
  }, [lockedToSignatures])

  const onNodeDrag: OnNodeDrag = useCallback(
    (_event, node) => {
      if (lockedToSignatures || node.type !== 'approvalStep') return

      setNodes((current) =>
        current.map((entry) =>
          entry.id === node.id ? { ...entry, position: { x: CANVAS_X, y: node.position.y } } : entry
        )
      )
    },
    [lockedToSignatures, setNodes]
  )

  const onNodeDragStop: OnNodeDrag = useCallback(
    (_event, node) => {
      if (lockedToSignatures || !onStepsReorder) return

      isDraggingRef.current = false

      setNodes((currentNodes) => {
        const positionedNodes = currentNodes.map((entry) =>
          entry.id === node.id
            ? { ...entry, position: { x: CANVAS_X, y: node.position.y } }
            : entry
        )

        const orderedIds = orderStepIdsByNodePositions(positionedNodes)
        const currentIds = steps.map((step) => step.id)

        const orderChanged =
          orderedIds.length === currentIds.length &&
          orderedIds.some((id, index) => id !== currentIds[index])

        if (orderChanged) {
          requestAnimationFrame(() => onStepsReorder(orderedIds))
        }

        return positionedNodes
      })
    },
    [lockedToSignatures, onStepsReorder, setNodes, steps]
  )

  const onNodeClick = useCallback(
    (_event: MouseEvent, node: Node) => {
      if (node.type === 'approvalStep') {
        onEditStep(node.id)
      }
    },
    [onEditStep]
  )

  return (
    <div
      className={cn(
        'relative w-full overflow-hidden rounded-lg border border-signara-steel/25 bg-white',
        className ?? 'h-[65vh] min-h-[420px]'
      )}
    >
      <ReactFlow
        nodes={nodes}
        edges={edges}
        nodeTypes={workflowNodeTypes}
        onNodesChange={onNodesChange}
        onEdgesChange={onEdgesChange}
        onNodeDragStart={lockedToSignatures ? undefined : onNodeDragStart}
        onNodeDrag={lockedToSignatures ? undefined : onNodeDrag}
        onNodeDragStop={lockedToSignatures ? undefined : onNodeDragStop}
        onNodeClick={onNodeClick}
        nodesDraggable={!lockedToSignatures}
        nodesConnectable={false}
        elementsSelectable={false}
        panOnDrag={false}
        panOnScroll
        zoomOnScroll
        zoomOnPinch
        fitView
        fitViewOptions={{ padding: 0.35 }}
        proOptions={{ hideAttribution: true }}
        className="bg-signara-background/30"
      >
        <Background color="#A1A8A2" gap={24} />
        <Controls showInteractive={false} className="!border-signara-steel/30 !shadow-sm" />
        <MiniMap
          pannable
          zoomable
          nodeColor="#0F2C59"
          maskColor="rgba(248,249,250,0.7)"
          className="!border-signara-steel/30 !shadow-sm"
        />
        {onMaximize && (
          <Panel position="top-right" className="m-2">
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={onMaximize}
              className="border-signara-steel/40 bg-white text-signara-navy shadow-sm hover:bg-signara-background"
            >
              <Maximize2 className="mr-1.5 size-3.5" />
              Maximise
            </Button>
          </Panel>
        )}
        <FitViewOnChange triggerKey={stepOrderKey} />
      </ReactFlow>
    </div>
  )
}

export function WorkflowCanvas(props: WorkflowCanvasProps) {
  return (
    <ReactFlowProvider>
      <WorkflowCanvasInner {...props} />
    </ReactFlowProvider>
  )
}
