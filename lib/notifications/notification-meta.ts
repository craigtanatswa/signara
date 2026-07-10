import {
  CheckCircle2,
  FileCheck2,
  FileX2,
  Inbox,
  PenLine,
  Sparkles,
  type LucideIcon,
} from 'lucide-react'

export function timeAgo(dateStr: string): string {
  const diff = Date.now() - new Date(dateStr).getTime()
  const minutes = Math.floor(diff / 60000)
  if (minutes < 1) return 'just now'
  if (minutes < 60) return `${minutes}m ago`
  const hours = Math.floor(minutes / 60)
  if (hours < 24) return `${hours}h ago`
  const days = Math.floor(hours / 24)
  if (days < 7) return `${days}d ago`
  return new Date(dateStr).toLocaleDateString('en-GB', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  })
}

export function getNotificationIcon(type: string): LucideIcon {
  switch (type) {
    case 'approval_required':
      return PenLine
    case 'approval_assignment_needed':
      return Inbox
    case 'document_completed':
      return CheckCircle2
    case 'document_rejected':
      return FileX2
    case 'template_request':
    case 'template_request_fulfilled':
    case 'template_request_dismissed':
      return Inbox
    case 'welcome':
      return Sparkles
    default:
      return FileCheck2
  }
}
