/**
 * Thin aliases matching the Approval Routing naming from the product brief.
 * Prefer the typed exports in `approvals.ts` / `documents.ts` for new code.
 */
export {
  approveDocumentStep as approveStep,
  rejectDocumentStep as rejectStep,
} from '@/app/actions/approvals'

export { resubmitDocument, submitDocumentForApproval } from '@/app/actions/documents'
