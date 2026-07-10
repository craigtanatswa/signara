import { createAdminClient } from '@/lib/supabase/admin'
import type { NotificationType } from '@/lib/notifications/notification-href'

export interface CreateNotificationInput {
  userId: string
  documentId?: string | null
  type: NotificationType | string
  title: string
  message: string
}

/**
 * Inserts an in-app notification. Errors are logged and never thrown so
 * callers can keep advancing the workflow when notification delivery fails.
 */
export async function createNotification(input: CreateNotificationInput): Promise<void> {
  try {
    const supabase = createAdminClient()
    const { error } = await supabase.from('notifications').insert({
      user_id: input.userId,
      document_id: input.documentId ?? null,
      type: input.type,
      title: input.title,
      message: input.message,
    })

    if (error) {
      console.error('[createNotification]', error.message)
    }
  } catch (err) {
    console.error('[createNotification]', err)
  }
}

/** Notify every admin in an organisation (e.g. unresolvable approver). */
export async function notifyOrganisationAdmins(input: {
  organisationId: string
  documentId?: string | null
  type: NotificationType | string
  title: string
  message: string
}): Promise<void> {
  try {
    const supabase = createAdminClient()
    const { data: admins, error } = await supabase
      .from('users')
      .select('id')
      .eq('organisation_id', input.organisationId)
      .eq('role', 'admin')

    if (error) {
      console.error('[notifyOrganisationAdmins]', error.message)
      return
    }

    await Promise.all(
      (admins ?? []).map((admin) =>
        createNotification({
          userId: admin.id,
          documentId: input.documentId,
          type: input.type,
          title: input.title,
          message: input.message,
        })
      )
    )
  } catch (err) {
    console.error('[notifyOrganisationAdmins]', err)
  }
}
