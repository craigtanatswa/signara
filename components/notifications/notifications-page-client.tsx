'use client'

import { useMemo, useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { Bell, CheckCheck, ArrowRight } from 'lucide-react'
import { createClient } from '@/lib/supabase/client'
import {
  getNotificationAction,
  type NotificationAction,
} from '@/lib/notifications/notification-href'
import { getNotificationIcon, timeAgo } from '@/lib/notifications/notification-meta'
import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'
import type { Notification } from '@/types/database'

type Filter = 'all' | 'unread'

export type NotificationListItem = Notification & {
  /** Server-resolved action when it differs from the default (e.g. use template). */
  action?: NotificationAction | null
}

interface NotificationsPageClientProps {
  initialNotifications: NotificationListItem[]
}

export function NotificationsPageClient({
  initialNotifications,
}: NotificationsPageClientProps) {
  const router = useRouter()
  const [notifications, setNotifications] = useState(initialNotifications)
  const [filter, setFilter] = useState<Filter>('all')
  const [isPending, startTransition] = useTransition()

  const unreadCount = useMemo(
    () => notifications.filter((n) => !n.read).length,
    [notifications]
  )

  const visible = useMemo(() => {
    if (filter === 'unread') return notifications.filter((n) => !n.read)
    return notifications
  }, [notifications, filter])

  async function markAsRead(ids: string[]) {
    if (ids.length === 0) return
    const supabase = createClient()
    await supabase.from('notifications').update({ read: true }).in('id', ids)
    setNotifications((prev) =>
      prev.map((n) => (ids.includes(n.id) ? { ...n, read: true } : n))
    )
  }

  function markAllAsRead() {
    const unreadIds = notifications.filter((n) => !n.read).map((n) => n.id)
    startTransition(async () => {
      await markAsRead(unreadIds)
    })
  }

  function resolveAction(notification: NotificationListItem): NotificationAction | null {
    return (
      notification.action ??
      getNotificationAction(notification.type, notification.document_id)
    )
  }

  function handleAction(notification: NotificationListItem) {
    const action = resolveAction(notification)
    startTransition(async () => {
      if (!notification.read) {
        await markAsRead([notification.id])
      }
      if (action) {
        router.push(action.href)
      }
    })
  }

  function handleMarkOneRead(notification: NotificationListItem) {
    if (notification.read) return
    startTransition(async () => {
      await markAsRead([notification.id])
    })
  }

  return (
    <div className="mx-auto max-w-3xl space-y-6">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h2 className="text-xl font-bold text-signara-navy">Notifications</h2>
          <p className="mt-0.5 text-sm text-signara-steel">
            Approvals, document updates, and template requests that need your attention.
          </p>
        </div>
        {unreadCount > 0 && (
          <Button
            type="button"
            variant="outline"
            size="sm"
            disabled={isPending}
            onClick={markAllAsRead}
            className="border-signara-navy text-signara-navy hover:bg-signara-navy hover:text-white"
          >
            <CheckCheck className="size-4" />
            Mark all as read
          </Button>
        )}
      </div>

      <div className="flex flex-wrap items-center gap-2">
        <FilterPill
          active={filter === 'all'}
          onClick={() => setFilter('all')}
          label="All"
          count={notifications.length}
        />
        <FilterPill
          active={filter === 'unread'}
          onClick={() => setFilter('unread')}
          label="Unread"
          count={unreadCount}
        />
      </div>

      {visible.length === 0 ? (
        <div className="flex flex-col items-center justify-center rounded-lg border border-dashed border-signara-steel/40 bg-white py-16 text-center">
          <Bell className="size-12 text-signara-steel/30" />
          <p className="mt-4 font-medium text-signara-navy">
            {filter === 'unread' ? 'No unread notifications' : "You're all caught up"}
          </p>
          <p className="mt-1 max-w-sm text-sm text-signara-steel">
            {filter === 'unread'
              ? 'Switch to All to see earlier notifications.'
              : 'When something needs your attention, it will show up here.'}
          </p>
        </div>
      ) : (
        <ul className="divide-y divide-signara-steel/10 overflow-hidden rounded-lg border border-signara-steel/30 bg-white shadow-sm">
          {visible.map((notification) => (
            <NotificationRow
              key={notification.id}
              notification={notification}
              action={resolveAction(notification)}
              disabled={isPending}
              onAction={() => handleAction(notification)}
              onMarkRead={() => handleMarkOneRead(notification)}
            />
          ))}
        </ul>
      )}
    </div>
  )
}

function FilterPill({
  active,
  onClick,
  label,
  count,
}: {
  active: boolean
  onClick: () => void
  label: string
  count: number
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        'inline-flex items-center gap-2 rounded-md border px-3 py-1.5 text-sm font-medium transition-colors',
        active
          ? 'border-signara-navy bg-signara-navy text-white'
          : 'border-signara-steel/40 bg-white text-signara-navy hover:border-signara-navy'
      )}
    >
      {label}
      <span
        className={cn(
          'rounded-full px-1.5 py-0.5 text-[10px] font-semibold tabular-nums',
          active ? 'bg-signara-gold text-signara-navy' : 'bg-signara-steel/20 text-signara-steel'
        )}
      >
        {count}
      </span>
    </button>
  )
}

function NotificationRow({
  notification,
  action,
  disabled,
  onAction,
  onMarkRead,
}: {
  notification: NotificationListItem
  action: NotificationAction | null
  disabled: boolean
  onAction: () => void
  onMarkRead: () => void
}) {
  const Icon = getNotificationIcon(notification.type)

  return (
    <li
      className={cn(
        'relative px-5 py-4 transition-colors sm:px-6',
        !notification.read && 'bg-signara-gold/5'
      )}
    >
      <div className="flex gap-4">
        <div
          className={cn(
            'mt-0.5 flex size-10 shrink-0 items-center justify-center rounded-md',
            notification.read
              ? 'bg-signara-steel/15 text-signara-steel'
              : 'bg-signara-navy text-signara-gold'
          )}
        >
          <Icon className="size-5" />
        </div>

        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            {notification.title && (
              <p
                className={cn(
                  'font-semibold',
                  notification.read ? 'text-signara-steel' : 'text-signara-navy'
                )}
              >
                {notification.title}
              </p>
            )}
            {!notification.read && (
              <span className="inline-flex items-center rounded-full bg-signara-gold/20 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-signara-navy">
                New
              </span>
            )}
          </div>
          <p
            className={cn(
              'mt-1 text-sm leading-relaxed',
              notification.read ? 'text-signara-steel' : 'text-signara-navy/80'
            )}
          >
            {notification.message}
          </p>
          <p className="mt-1 text-xs text-signara-steel/60">
            {timeAgo(notification.created_at)}
          </p>

          <div className="mt-3 flex flex-wrap items-center gap-2">
            {action && (
              <Button
                type="button"
                variant="signara"
                size="sm"
                disabled={disabled}
                onClick={onAction}
              >
                {action.label}
                <ArrowRight className="size-3.5" />
              </Button>
            )}
            {!notification.read && (
              <Button
                type="button"
                variant="ghost"
                size="sm"
                disabled={disabled}
                onClick={onMarkRead}
                className="text-signara-steel hover:text-signara-navy"
              >
                Mark as read
              </Button>
            )}
          </div>
        </div>
      </div>
    </li>
  )
}
