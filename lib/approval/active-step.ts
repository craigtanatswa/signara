// ─── Sequential execution helpers ───────────────────────────────────────────
//
// Exactly one document step is 'pending' at a time (the active step). Steps
// after it are 'waiting'; steps before it are 'approved', 'rejected', or
// 'skipped'.

import type { DocumentStep } from '@/types/database'

type StepLike = Pick<DocumentStep, 'id' | 'step_order' | 'status'>

/** The step currently awaiting action, or null if none is pending (e.g. document completed/rejected). */
export function getActiveStep<T extends StepLike>(steps: T[]): T | null {
  return steps.find((step) => step.status === 'pending') ?? null
}

/** True if every step before this one has already been approved or skipped. */
export function isStepActionable(step: StepLike, allSteps: StepLike[]): boolean {
  if (step.status !== 'pending') return false
  return allSteps
    .filter((s) => s.step_order < step.step_order)
    .every((s) => s.status === 'approved' || s.status === 'skipped')
}
