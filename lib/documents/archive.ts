import type { Document } from '@/types/database'

/**
 * Whether a completed/rejected document is old enough to be soft-archived
 * under the organisation's retention policy.
 *
 * Informational / job logic only — actual archiving is done server-side
 * (scheduled Edge Function or admin bulk action). Archiving never deletes
 * data or blocks PDF downloads; it only changes default list visibility.
 */
export function shouldArchive(
  document: Pick<Document, 'status' | 'completed_at' | 'created_at'>,
  policyMonths: number
): boolean {
  if (policyMonths <= 0) return false
  if (document.status !== 'completed' && document.status !== 'rejected') {
    return false
  }

  const anchor =
    document.status === 'completed' && document.completed_at
      ? document.completed_at
      : document.created_at

  const cutoff = new Date()
  cutoff.setMonth(cutoff.getMonth() - policyMonths)

  return new Date(anchor).getTime() < cutoff.getTime()
}
