/**
 * Workflow step helpers for print-and-sign and sequential routing UI.
 */

/**
 * True when this step is the last in the approval chain.
 * Only the final signatory may be offered print-and-sign.
 *
 * @param stepIndex - Zero-based index (matches `document_steps.step_order`)
 * @param totalSteps - Total number of steps in the chain
 */
export function isFinalStep(stepIndex: number, totalSteps: number): boolean {
  if (totalSteps <= 0) return false
  return stepIndex === totalSteps - 1
}
