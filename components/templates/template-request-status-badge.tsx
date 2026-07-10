import { Badge } from '@/components/ui/badge'
import { cn } from '@/lib/utils'
import type { TemplateRequestStatus } from '@/types/database'

export const TEMPLATE_REQUEST_STATUS_LABELS: Record<TemplateRequestStatus, string> = {
  pending: 'Pending',
  fulfilled: 'Satisfied',
  dismissed: 'Declined',
}

const STATUS_CLASS: Record<TemplateRequestStatus, string> = {
  pending: 'border-signara-gold/50 bg-signara-gold/15 text-signara-navy',
  fulfilled: 'border-emerald-200 bg-emerald-50 text-emerald-800',
  dismissed: 'border-red-200 bg-red-50 text-red-800',
}

export function TemplateRequestStatusBadge({
  status,
  className,
}: {
  status: TemplateRequestStatus
  className?: string
}) {
  return (
    <Badge
      variant="outline"
      className={cn('font-medium', STATUS_CLASS[status], className)}
    >
      {TEMPLATE_REQUEST_STATUS_LABELS[status]}
    </Badge>
  )
}
