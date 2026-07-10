import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { Header } from '@/components/layout/header'
import { DashboardPageBody } from '@/components/layout/dashboard-page-body'
import {
  NotificationsPageClient,
  type NotificationListItem,
} from '@/components/notifications/notifications-page-client'
import { getNotificationAction } from '@/lib/notifications/notification-href'
import type { Notification, User } from '@/types/database'

export default async function NotificationsPage() {
  const supabase = await createClient()
  const {
    data: { user: authUser },
  } = await supabase.auth.getUser()
  if (!authUser) redirect('/login')

  const { data: profile } = await supabase
    .from('users')
    .select('*')
    .eq('id', authUser.id)
    .single()
  if (!profile) redirect('/login')

  const user = profile as User

  const [{ data: notificationsRaw }, { data: fulfilledRequests }] = await Promise.all([
    supabase
      .from('notifications')
      .select('*')
      .eq('user_id', user.id)
      .order('created_at', { ascending: false })
      .limit(100),
    supabase
      .from('template_requests')
      .select('title, resulting_template_id, reviewed_at')
      .eq('requested_by', user.id)
      .eq('status', 'fulfilled')
      .not('resulting_template_id', 'is', null)
      .order('reviewed_at', { ascending: false })
      .limit(50),
  ])

  const notifications = (notificationsRaw ?? []) as Notification[]
  const templateByTitle = new Map<string, string>()
  for (const request of fulfilledRequests ?? []) {
    if (request.title && request.resulting_template_id && !templateByTitle.has(request.title)) {
      templateByTitle.set(request.title, request.resulting_template_id as string)
    }
  }

  const items: NotificationListItem[] = notifications.map((notification) => {
    const defaultAction = getNotificationAction(notification.type, notification.document_id)

    if (notification.type === 'template_request_fulfilled') {
      const matchedTitle = [...templateByTitle.keys()].find((title) =>
        notification.message.includes(`"${title}"`)
      )
      const templateId = matchedTitle ? templateByTitle.get(matchedTitle) : null
      if (templateId) {
        return {
          ...notification,
          action: {
            href: `/dashboard/templates/${templateId}/start`,
            label: 'Use template',
          },
        }
      }
    }

    return {
      ...notification,
      action: defaultAction,
    }
  })

  return (
    <>
      <Header pageTitle="Notifications" user={user} />
      <DashboardPageBody>
        <NotificationsPageClient initialNotifications={items} />
      </DashboardPageBody>
    </>
  )
}
