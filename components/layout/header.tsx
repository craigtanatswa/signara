'use client'

import { Bell, CheckCheck, ExternalLink } from 'lucide-react'
import { useRouter } from 'next/navigation'
import { useState, useEffect } from 'react'
import { createClient } from '@/lib/supabase/client'
import { getNotificationHref } from '@/lib/notifications/notification-href'
import { Button } from '@/components/ui/button'
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { cn } from '@/lib/utils'
import type { User, Notification } from '@/types/database'

interface HeaderProps {
  pageTitle: string
  user: User
}

function timeAgo(dateStr: string): string {
  const diff = Date.now() - new Date(dateStr).getTime()
  const minutes = Math.floor(diff / 60000)
  if (minutes < 1) return 'just now'
  if (minutes < 60) return `${minutes}m ago`
  const hours = Math.floor(minutes / 60)
  if (hours < 24) return `${hours}h ago`
  const days = Math.floor(hours / 24)
  return `${days}d ago`
}

function isTemplateRequestNotification(type: string): boolean {
  return (
    type === 'template_request' ||
    type === 'template_request_fulfilled' ||
    type === 'template_request_dismissed'
  )
}

export function Header({ pageTitle, user }: HeaderProps) {
  const router = useRouter()
  const [unreadCount, setUnreadCount] = useState(0)
  const [notifications, setNotifications] = useState<Notification[]>([])
  const [bellOpen, setBellOpen] = useState(false)

  const initials = user.full_name
    .split(' ')
    .map((n) => n[0])
    .join('')
    .toUpperCase()
    .slice(0, 2)

  useEffect(() => {
    let cancelled = false
    const supabase = createClient()

    async function refreshUnreadCount() {
      const { count } = await supabase
        .from('notifications')
        .select('id', { count: 'exact', head: true })
        .eq('user_id', user.id)
        .eq('read', false)
      if (!cancelled) setUnreadCount(count ?? 0)
    }

    void refreshUnreadCount()

    const channel = supabase
      .channel(`notifications:${user.id}`)
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'notifications',
          filter: `user_id=eq.${user.id}`,
        },
        (payload) => {
          const notification = payload.new as Notification
          setUnreadCount((prev) => prev + 1)
          setNotifications((prev) => [notification, ...prev].slice(0, 5))
        }
      )
      .subscribe()

    return () => {
      cancelled = true
      void supabase.removeChannel(channel)
    }
  }, [user.id])

  async function fetchNotifications() {
    const supabase = createClient()
    const { data } = await supabase
      .from('notifications')
      .select('*')
      .eq('user_id', user.id)
      .order('created_at', { ascending: false })
      .limit(5)
    setNotifications((data as Notification[]) ?? [])
  }

  async function handleBellOpenChange(open: boolean) {
    setBellOpen(open)
    if (open) {
      await fetchNotifications()
    }
  }

  async function markAllAsRead() {
    const supabase = createClient()
    await supabase
      .from('notifications')
      .update({ read: true })
      .eq('user_id', user.id)
      .eq('read', false)
    setUnreadCount(0)
    setNotifications((prev) => prev.map((n) => ({ ...n, read: true })))
  }

  async function markNotificationRead(notification: Notification) {
    if (notification.read) return
    const supabase = createClient()
    await supabase.from('notifications').update({ read: true }).eq('id', notification.id)
    setUnreadCount((prev) => Math.max(0, prev - 1))
    setNotifications((prev) =>
      prev.map((n) => (n.id === notification.id ? { ...n, read: true } : n))
    )
  }

  async function handleNotificationClick(notification: Notification) {
    await markNotificationRead(notification)
    const href = getNotificationHref(notification.type, notification.document_id)
    setBellOpen(false)
    if (href) {
      router.push(href)
    }
  }

  async function handleSignOut() {
    const supabase = createClient()
    await supabase.auth.signOut()
    router.push('/login')
    router.refresh()
  }

  return (
    <header className="flex h-16 shrink-0 items-center justify-between border-b border-border bg-signara-offwhite px-6">
      <h1 className="text-xl font-medium text-signara-navy">{pageTitle}</h1>

      <div className="flex items-center gap-3">
        {/* Notification bell */}
        <DropdownMenu open={bellOpen} onOpenChange={handleBellOpenChange}>
          <DropdownMenuTrigger asChild>
            <Button
              variant="ghost"
              size="icon"
              className="relative text-signara-steel hover:text-signara-navy"
              aria-label="Notifications"
            >
              <Bell className="size-5" />
              {unreadCount > 0 && (
                <span className="absolute right-1 top-1 flex size-4 items-center justify-center rounded-full bg-signara-gold text-[10px] font-bold text-signara-navy">
                  {unreadCount > 9 ? '9+' : unreadCount}
                </span>
              )}
            </Button>
          </DropdownMenuTrigger>

          <DropdownMenuContent align="end" className="w-80 p-0">
            {/* Header */}
            <div className="flex items-center justify-between border-b border-border px-4 py-3">
              <p className="text-sm font-semibold text-signara-navy">Notifications</p>
              {unreadCount > 0 && (
                <button
                  onClick={markAllAsRead}
                  className="flex items-center gap-1.5 text-xs text-signara-steel hover:text-signara-navy transition-colors"
                >
                  <CheckCheck className="size-3.5" />
                  Mark all as read
                </button>
              )}
            </div>

            {/* Notification list */}
            {notifications.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-8 text-center">
                <Bell className="mb-2 size-8 text-signara-steel/30" />
                <p className="text-sm font-medium text-signara-navy">You&apos;re all caught up</p>
                <p className="mt-0.5 text-xs text-signara-steel">No notifications yet.</p>
              </div>
            ) : (
              <ul className="divide-y divide-border">
                {notifications.map((notification) => {
                  const href = getNotificationHref(notification.type, notification.document_id)
                  const openRequestsLabel = isTemplateRequestNotification(notification.type)

                  return (
                    <li
                      key={notification.id}
                      className={cn(
                        'relative px-4 py-3 transition-colors hover:bg-signara-background/50',
                        !notification.read && 'bg-signara-gold/5'
                      )}
                    >
                      {!notification.read && (
                        <span className="absolute left-2 top-1/2 size-1.5 -translate-y-1/2 rounded-full bg-signara-gold" />
                      )}
                      <button
                        type="button"
                        onClick={() => handleNotificationClick(notification)}
                        className={cn('w-full min-w-0 text-left', !notification.read && 'pl-2')}
                      >
                        {notification.title && (
                          <p
                            className={cn(
                              'truncate text-sm font-medium',
                              notification.read ? 'text-signara-steel' : 'text-signara-navy'
                            )}
                          >
                            {notification.title}
                          </p>
                        )}
                        <p
                          className={cn(
                            'mt-0.5 line-clamp-2 text-xs',
                            notification.read ? 'text-signara-steel/70' : 'text-signara-steel'
                          )}
                        >
                          {notification.message}
                        </p>
                        <div className="mt-1.5 flex items-center justify-between gap-2">
                          <p className="text-[10px] text-signara-steel/50">
                            {timeAgo(notification.created_at)}
                          </p>
                          {href && (
                            <span className="inline-flex items-center gap-1 text-[10px] font-medium text-signara-gold">
                              {openRequestsLabel ? 'Open requests' : 'Open'}
                              <ExternalLink className="size-2.5" />
                            </span>
                          )}
                        </div>
                      </button>
                    </li>
                  )
                })}
              </ul>
            )}
          </DropdownMenuContent>
        </DropdownMenu>

        {/* User avatar dropdown */}
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button
              variant="ghost"
              size="icon"
              className="rounded-full"
              aria-label="User menu"
            >
              <Avatar className="size-8">
                <AvatarImage src={user.avatar_url ?? undefined} />
                <AvatarFallback className="bg-signara-navy text-xs font-bold text-white">
                  {initials}
                </AvatarFallback>
              </Avatar>
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-48">
            <div className="px-3 py-2">
              <p className="truncate text-sm font-medium text-signara-navy">{user.full_name}</p>
              <p className="truncate text-xs text-signara-steel">{user.email}</p>
            </div>
            <DropdownMenuSeparator />
            <DropdownMenuItem onClick={() => router.push('/dashboard/settings/profile')}>
              Profile
            </DropdownMenuItem>
            <DropdownMenuItem onClick={() => router.push('/dashboard/settings')}>
              Settings
            </DropdownMenuItem>
            <DropdownMenuSeparator />
            <DropdownMenuItem
              onClick={handleSignOut}
              className="text-destructive focus:text-destructive"
            >
              Sign out
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
    </header>
  )
}
