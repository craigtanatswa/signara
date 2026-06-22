'use client'

import { Bell, CheckCheck } from 'lucide-react'
import { useRouter } from 'next/navigation'
import { useState, useEffect } from 'react'
import { createClient } from '@/lib/supabase/client'
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
    createClient()
      .from('notifications')
      .select('id', { count: 'exact', head: true })
      .eq('user_id', user.id)
      .eq('read', false)
      .then(({ count }) => {
        if (!cancelled) setUnreadCount(count ?? 0)
      })
    return () => {
      cancelled = true
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
                <Bell className="size-8 text-signara-steel/30 mb-2" />
                <p className="text-sm font-medium text-signara-navy">You&apos;re all caught up</p>
                <p className="text-xs text-signara-steel mt-0.5">No notifications yet.</p>
              </div>
            ) : (
              <ul className="divide-y divide-border">
                {notifications.map((notification) => (
                  <li
                    key={notification.id}
                    className={cn(
                      'relative px-4 py-3 transition-colors hover:bg-signara-background/50',
                      !notification.read && 'bg-signara-gold/5'
                    )}
                  >
                    {!notification.read && (
                      <span className="absolute left-2 top-1/2 -translate-y-1/2 size-1.5 rounded-full bg-signara-gold" />
                    )}
                    <div className={cn('min-w-0', !notification.read && 'pl-2')}>
                      {notification.title && (
                        <p className={cn('text-sm font-medium truncate', notification.read ? 'text-signara-steel' : 'text-signara-navy')}>
                          {notification.title}
                        </p>
                      )}
                      <p className={cn('text-xs mt-0.5 line-clamp-2', notification.read ? 'text-signara-steel/70' : 'text-signara-steel')}>
                        {notification.message}
                      </p>
                      <p className="text-[10px] text-signara-steel/50 mt-1">
                        {timeAgo(notification.created_at)}
                      </p>
                    </div>
                  </li>
                ))}
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
                <AvatarFallback className="bg-signara-navy text-white text-xs font-bold">
                  {initials}
                </AvatarFallback>
              </Avatar>
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-48">
            <div className="px-3 py-2">
              <p className="text-sm font-medium text-signara-navy truncate">
                {user.full_name}
              </p>
              <p className="text-xs text-signara-steel truncate">{user.email}</p>
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
