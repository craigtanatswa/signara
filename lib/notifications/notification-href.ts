/** Routes opened when a notification is clicked. */
export function getNotificationHref(type: string, documentId?: string | null): string | null {
  switch (type) {
    case 'template_request':
    case 'template_request_fulfilled':
    case 'template_request_dismissed':
      return '/dashboard/requests'
    case 'approval_required':
    case 'document_completed':
    case 'document_rejected':
      return documentId ? `/dashboard/documents/${documentId}` : '/dashboard/documents'
    case 'welcome':
      return '/dashboard'
    default:
      return null
  }
}
