import { isRankAtLeastAsSenior } from '@/lib/approval/eligibility'
import { isJobLevel } from '@/types/org-structure'
import { TEMPLATE_REQUEST_MIN_JOB_LEVEL } from '@/lib/storage/template-request-attachments'

/** Seniors, supervisors, managers, directors, and MDs may request department templates. */
export function canRequestTemplate(jobLevel: unknown): boolean {
  if (!isJobLevel(jobLevel)) return false
  return isRankAtLeastAsSenior(jobLevel, TEMPLATE_REQUEST_MIN_JOB_LEVEL)
}
