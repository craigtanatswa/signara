'use client'

import Link from 'next/link'
import Image from 'next/image'
import { usePathname, useRouter } from 'next/navigation'
import {
  LayoutDashboard,
  FileText,
  FileEdit,
  Inbox,
  Users,
  Settings,
  LogOut,
  Archive,
} from 'lucide-react'
import { createClient } from '@/lib/supabase/client'
import type { User, Organisation } from '@/types/database'
import { cn } from '@/lib/utils'
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar'
import { Badge } from '@/components/ui/badge'

interface NavItem {
  href: string
  label: string
  icon: React.ComponentType<{ className?: string }>
  adminOnly?: boolean
}

const navItems: NavItem[] = [
  { href: '/dashboard', label: 'Dashboard', icon: LayoutDashboard },
  { href: '/dashboard/documents', label: 'Documents', icon: FileText },
  { href: '/dashboard/archive', label: 'Archive', icon: Archive },
  { href: '/dashboard/requests', label: 'Requests', icon: Inbox },
  {
    href: '/dashboard/templates',
    label: 'Templates',
    icon: FileEdit,
    adminOnly: true,
  },
  { href: '/dashboard/team', label: 'Team', icon: Users, adminOnly: true },
  { href: '/dashboard/settings', label: 'Settings', icon: Settings },
]

interface SidebarProps {
  user: User
  organisation: Organisation
}

export function Sidebar({ user, organisation }: SidebarProps) {
  const pathname = usePathname()
  const router = useRouter()

  const visibleItems = navItems.filter(
    (item) => !item.adminOnly || user.role === 'admin'
  )

  async function handleSignOut() {
    const supabase = createClient()
    await supabase.auth.signOut()
    router.push('/login')
    router.refresh()
  }

  const initials = user.full_name
    .split(' ')
    .map((n) => n[0])
    .join('')
    .toUpperCase()
    .slice(0, 2)

  return (
    <aside className="flex h-full min-h-0 w-60 flex-col bg-signara-navy">
      {/* Logo — Signara branding (org logo in sidebar disabled for now) */}
      <div className="flex h-16 shrink-0 items-center justify-center border-b border-r border-border bg-signara-offwhite">
        <Image
          src="/assets/logo-signara-sidebar.png"
          alt="Signara"
          width={368}
          height={160}
          priority
          className="h-4/5 w-4/5 object-contain"
        />
        {/* {organisation.logo_url ? (
          <img
            src={organisation.logo_url}
            alt={organisation.name}
            className="h-4/5 max-h-12 w-4/5 object-contain"
          />
        ) : (
          <Image
            src="/assets/logo-signara-sidebar.png"
            alt="Signara"
            width={368}
            height={160}
            priority
            className="h-4/5 w-4/5 object-contain"
          />
        )} */}
      </div>

      {/* Org name */}
      <div className="border-b border-white/10 px-5 py-3">
        <p className="text-xs font-medium uppercase tracking-wider text-white/40">
          Organisation
        </p>
        <p className="mt-0.5 truncate text-sm font-semibold text-white">
          {organisation.name}
        </p>
      </div>

      {/* Navigation */}
      <nav className="flex-1 space-y-0.5 overflow-y-auto px-3 py-4">
        {visibleItems.map((item) => {
          const isActive =
            item.href === '/dashboard'
              ? pathname === '/dashboard'
              : pathname.startsWith(item.href)
          return (
            <Link
              key={item.href}
              href={item.href}
              className={cn(
                'flex items-center gap-3 rounded-md px-3 py-2 text-sm font-medium transition-colors',
                isActive
                  ? 'border-l-2 border-signara-gold bg-white/10 text-white'
                  : 'text-white/70 hover:bg-white/10 hover:text-white'
              )}
            >
              <item.icon className="size-4 shrink-0" />
              {item.label}
            </Link>
          )
        })}
      </nav>

      {/* User profile + sign out */}
      <div className="border-t border-white/10 p-4">
        <div className="flex items-start gap-3">
          <Avatar className="size-8 shrink-0">
            <AvatarImage src={user.avatar_url ?? undefined} />
            <AvatarFallback className="bg-signara-gold text-signara-navy text-xs font-bold">
              {initials}
            </AvatarFallback>
          </Avatar>
          <div className="min-w-0 flex-1">
            <p className="truncate text-sm font-medium text-white">
              {user.full_name}
            </p>
            <p className="truncate text-xs text-white/50">{user.email}</p>
            <Badge
              variant="secondary"
              className="mt-1 h-4 bg-signara-gold/20 px-1.5 text-[10px] text-signara-gold"
            >
              {user.role}
            </Badge>
          </div>
        </div>
        <button
          onClick={handleSignOut}
          className="mt-3 flex w-full items-center gap-2 rounded-md px-3 py-2 text-sm text-white/60 transition-colors hover:bg-white/10 hover:text-white"
        >
          <LogOut className="size-4" />
          Sign out
        </button>
      </div>
    </aside>
  )
}
