/** Known in-app notification types. */
export type NotificationType =
  | 'welcome'
  | 'approval_required'
  | 'approval_assignment_needed'
  | 'document_completed'
  | 'document_rejected'
  | 'template_request'
  | 'template_request_fulfilled'
  | 'template_request_dismissed'
  | 'billing'

export interface NotificationAction {
  href: string
  label: string
}

/** Primary CTA for a notification — label + destination. */
export function getNotificationAction(
  type: string,
  documentId?: string | null
): NotificationAction | null {
  switch (type as NotificationType | string) {
    case 'approval_required':
      return {
        href: documentId ? `/dashboard/documents/${documentId}` : '/dashboard/documents',
        label: 'Review & approve',
      }
    case 'approval_assignment_needed':
      return {
        href: documentId ? `/dashboard/documents/${documentId}` : '/dashboard/documents',
        label: 'Assign approver',
      }
    case 'document_completed':
      return {
        href: documentId ? `/dashboard/documents/${documentId}` : '/dashboard/documents',
        label: 'View document',
      }
    case 'document_rejected':
      return {
        href: documentId ? `/dashboard/documents/${documentId}` : '/dashboard/documents',
        label: 'View rejection',
      }
    case 'template_request':
      return {
        href: '/dashboard/requests',
        label: 'Review request',
      }
    case 'template_request_fulfilled':
      return {
        href: '/dashboard/requests',
        label: 'View request',
      }
    case 'template_request_dismissed':
      return {
        href: '/dashboard/requests',
        label: 'View request',
      }
    case 'welcome':
      return {
        href: '/dashboard/documents/new',
        label: 'Start a document',
      }
    case 'billing':
      return {
        href: '/dashboard/settings/billing',
        label: 'View billing',
      }
    default:
      return null
  }
}

/** Routes opened when a notification is clicked. */
export function getNotificationHref(type: string, documentId?: string | null): string | null {
  return getNotificationAction(type, documentId)?.href ?? null
}

export function isTemplateRequestNotification(type: string): boolean {
  return (
    type === 'template_request' ||
    type === 'template_request_fulfilled' ||
    type === 'template_request_dismissed'
  )
}
