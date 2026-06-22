import { redirect } from 'next/navigation'
import Link from 'next/link'
import { createClient } from '@/lib/supabase/server'
import { Header } from '@/components/layout/header'
import { DashboardPageBody } from '@/components/layout/dashboard-page-body'
import { Badge } from '@/components/ui/badge'
import { User, Building2, CreditCard, ChevronRight } from 'lucide-react'
import type { User as UserType } from '@/types/database'

export default async function SettingsPage() {
  const supabase = await createClient()

  const {
    data: { user: authUser },
  } = await supabase.auth.getUser()

  if (!authUser) redirect('/login')

  const { data: userProfile } = await supabase
    .from('users')
    .select('*')
    .eq('id', authUser.id)
    .single()

  if (!userProfile) redirect('/login')

  const currentUser = userProfile as UserType

  const settingsCards = [
    {
      href: '/dashboard/settings/profile',
      icon: User,
      title: 'Profile',
      description: 'Update your name, department, and password.',
      adminOnly: false,
      placeholder: false,
    },
    {
      href: '/dashboard/settings/organisation',
      icon: Building2,
      title: 'Organisation',
      description: 'Manage your organisation name, logo, and plan.',
      adminOnly: true,
      placeholder: false,
    },
    {
      href: '/dashboard/settings/billing',
      icon: CreditCard,
      title: 'Plan & Billing',
      description: 'View your current plan and billing information.',
      adminOnly: false,
      placeholder: true,
    },
  ]

  return (
    <>
      <Header pageTitle="Settings" user={currentUser} />

      <DashboardPageBody>
        <div className="max-w-2xl space-y-4">
          {settingsCards.map((card) => {
            if (card.adminOnly && currentUser.role !== 'admin') return null

            return (
              <Link
                key={card.href}
                href={card.placeholder ? '#' : card.href}
                className={`flex items-center gap-5 rounded-lg border border-signara-steel/30 bg-white p-5 shadow-sm transition-colors group ${
                  card.placeholder
                    ? 'cursor-not-allowed opacity-60'
                    : 'hover:border-signara-navy/30 hover:shadow-md'
                }`}
              >
                <div className="flex size-10 shrink-0 items-center justify-center rounded-lg bg-signara-navy/10">
                  <card.icon className="size-5 text-signara-navy" />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <p className="font-semibold text-signara-navy">{card.title}</p>
                    {card.adminOnly && (
                      <Badge
                        className="bg-signara-gold/10 text-signara-navy border-signara-gold/30 text-[10px]"
                        variant="outline"
                      >
                        Admin only
                      </Badge>
                    )}
                    {card.placeholder && (
                      <Badge
                        className="bg-signara-steel/10 text-signara-steel border-signara-steel/20 text-[10px]"
                        variant="outline"
                      >
                        Coming soon
                      </Badge>
                    )}
                  </div>
                  <p className="mt-0.5 text-sm text-signara-steel">{card.description}</p>
                </div>
                {!card.placeholder && (
                  <ChevronRight className="size-5 shrink-0 text-signara-steel group-hover:text-signara-navy transition-colors" />
                )}
              </Link>
            )
          })}
        </div>
      </DashboardPageBody>
    </>
  )
}
