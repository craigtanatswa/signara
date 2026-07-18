import Link from 'next/link'
import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { Header } from '@/components/layout/header'
import { DashboardPageBody } from '@/components/layout/dashboard-page-body'
import { BackLink } from '@/components/layout/back-link'
import { Badge } from '@/components/ui/badge'
import { PaynowCheckoutButton } from '@/components/billing/paynow-checkout-button'
import {
  PAID_PLAN_ORDER,
  type PaidPlanId,
  planFeatures,
  planRank,
  formatDocumentLimit,
  formatUserLimit,
} from '@/lib/billing/plans'
import { Check } from 'lucide-react'
import type { Plan, User } from '@/types/database'

function formatDate(iso: string | null | undefined): string {
  if (!iso) return '—'
  return new Date(iso).toLocaleDateString('en-GB', {
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  })
}

function daysRemaining(trialEndsAt: string | null | undefined): number {
  if (!trialEndsAt) return 0
  const ms = new Date(trialEndsAt).getTime() - Date.now()
  return Math.max(0, Math.ceil(ms / 86400000))
}

export default async function BillingPage({
  searchParams,
}: {
  searchParams: Promise<{ paynow?: string; trial?: string }>
}) {
  const params = await searchParams
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

  const currentUser = userProfile as User
  const isAdmin = currentUser.role === 'admin'

  const { data: org } = await supabase
    .from('organisations')
    .select(
      'id, plan_id, subscription_status, trial_ends_at, paynow_renewal_date, payment_method'
    )
    .eq('id', currentUser.organisation_id)
    .single()

  if (!org) redirect('/dashboard')

  const [{ data: plansData }, { data: trialPlan }] = await Promise.all([
    supabase
      .from('plans')
      .select(
        'id, name, max_users, max_documents_per_month, price_usd, price_zwg, features, created_at'
      )
      .in('id', [...PAID_PLAN_ORDER]),
    org.plan_id === 'trial'
      ? supabase
          .from('plans')
          .select(
            'id, name, max_users, max_documents_per_month, price_usd, price_zwg, features, created_at'
          )
          .eq('id', 'trial')
          .maybeSingle()
      : Promise.resolve({ data: null }),
  ])

  const plans = (plansData ?? []) as Plan[]
  plans.sort(
    (a, b) =>
      PAID_PLAN_ORDER.indexOf(a.id as PaidPlanId) - PAID_PLAN_ORDER.indexOf(b.id as PaidPlanId)
  )

  const currentRank = planRank(org.plan_id)
  const onTrial = org.plan_id === 'trial'
  const trialActive =
    onTrial &&
    org.trial_ends_at != null &&
    new Date(org.trial_ends_at).getTime() > Date.now()
  const trialExpired =
    params.trial === 'expired' ||
    (onTrial &&
      org.subscription_status === 'trialing' &&
      org.trial_ends_at != null &&
      new Date(org.trial_ends_at).getTime() <= Date.now())
  const isActive = org.subscription_status === 'active' && !onTrial
  const isPastDue =
    org.subscription_status === 'past_due' || org.subscription_status === 'canceled'
  const currentPaidPlan = plans.find((p) => p.id === org.plan_id)

  return (
    <>
      <Header pageTitle="Plan & Billing" user={currentUser} />

      <DashboardPageBody>
        <div className="mx-auto max-w-5xl space-y-6">
          <BackLink href="/dashboard/settings" label="Back to Settings" />

          {params.paynow === 'pending' && (
            <div className="rounded-lg border border-signara-navy/20 bg-signara-navy/5 px-4 py-3 text-sm text-signara-navy">
              Your payment is being confirmed. This usually takes a few seconds — refresh the page
              or wait for your confirmation notification.
            </div>
          )}

          {trialExpired && (
            <div className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800">
              Your trial has ended. Choose a plan to continue using Signara.
              {!isAdmin && ' Ask your organisation admin to upgrade.'}
            </div>
          )}

          {onTrial && (
            <div
              className={`rounded-lg border bg-white p-5 shadow-sm ${
                trialExpired
                  ? 'border-red-200 border-t-2 border-t-red-400'
                  : 'border-signara-gold border-t-2 border-t-signara-gold'
              }`}
            >
              <div className="flex flex-wrap items-center gap-2">
                <Badge
                  className={
                    trialExpired
                      ? 'bg-red-100 text-red-800 border-red-200'
                      : 'bg-signara-gold/15 text-signara-navy border-signara-gold/40'
                  }
                  variant="outline"
                >
                  {trialExpired ? 'Trial ended' : 'Current plan'}
                </Badge>
                <span className="text-lg font-semibold text-signara-navy">
                  {trialPlan?.name ?? 'Free Trial'}
                </span>
              </div>
              <p className="mt-2 text-sm text-signara-steel">
                {trialExpired
                  ? 'Your free trial is over. Pick a paid plan below to keep using Signara.'
                  : trialActive
                    ? `${daysRemaining(org.trial_ends_at)} day(s) remaining — ends ${formatDate(org.trial_ends_at)}.`
                    : 'You are on a free trial.'}
              </p>
              {(trialPlan?.max_users != null || trialPlan?.max_documents_per_month != null) && (
                <p className="mt-2 text-sm text-signara-navy">
                  Includes up to {formatUserLimit(trialPlan?.max_users)} users and{' '}
                  {formatDocumentLimit(trialPlan?.max_documents_per_month)} documents per month.
                </p>
              )}
            </div>
          )}

          {isActive && (
            <div className="rounded-lg border border-green-200 bg-green-50 px-4 py-3 space-y-2">
              <div className="flex items-center gap-2">
                <Badge className="bg-green-100 text-green-800 border-green-200" variant="outline">
                  Active
                </Badge>
                <span className="text-sm font-medium text-signara-navy">
                  Current plan: {currentPaidPlan?.name ?? org.plan_id ?? '—'}
                </span>
              </div>
              {org.payment_method === 'paynow' && (
                <>
                  <p className="text-sm text-signara-navy">
                    Next renewal due: <strong>{formatDate(org.paynow_renewal_date)}</strong>
                  </p>
                  <p className="rounded-md border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-900">
                    Your Paynow plan renews manually. You&apos;ll receive a reminder 3 days before
                    it&apos;s due.
                  </p>
                </>
              )}
            </div>
          )}

          {isPastDue && (
            <div className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800">
              Your subscription needs attention. Pay again below to restore full access.
              {!isAdmin && ' Ask your organisation admin to renew.'}
            </div>
          )}

          <div className="space-y-4">
            <div>
              <h2 className="text-lg font-semibold text-signara-navy">
                {onTrial ? 'Choose a plan' : 'Available plans'}
              </h2>
              <p className="mt-1 text-sm text-signara-steel">
                {onTrial
                  ? 'Upgrade from your trial to unlock ongoing access. All plans are billed monthly.'
                  : 'Compare plans and upgrade when you need more capacity.'}
              </p>
            </div>

            <div id="plans" className="grid gap-4 md:grid-cols-3">
              {plans.length === 0 ? (
                <div className="md:col-span-3 rounded-lg border border-signara-steel/30 bg-white p-6 text-sm text-signara-steel">
                  Plans could not be loaded. Please refresh or contact support.
                </div>
              ) : (
                plans.map((plan) => {
                  const isCurrent = org.plan_id === plan.id
                  const canUpgrade = isAdmin && planRank(plan.id) > currentRank
                  const canRenewCurrent =
                    isAdmin &&
                    isCurrent &&
                    (org.payment_method === 'paynow' || isPastDue || isActive)
                  const showCheckout = canUpgrade || canRenewCurrent
                  const features = planFeatures(plan.features)

                  return (
                    <div
                      key={plan.id}
                      className={`flex flex-col rounded-lg border bg-white p-5 shadow-sm transition-all duration-200 hover:-translate-y-1 hover:shadow-md ${
                        isCurrent
                          ? 'border-signara-gold border-t-2 border-t-signara-gold hover:border-signara-gold'
                          : 'border-signara-steel/30 hover:border-signara-gold/50'
                      }`}
                    >
                      <div className="flex items-center justify-between gap-2">
                        <h3 className="text-lg font-semibold text-signara-navy">{plan.name}</h3>
                        {isCurrent && (
                          <Badge
                            className="bg-signara-gold/15 text-signara-navy border-signara-gold/40"
                            variant="outline"
                          >
                            Current
                          </Badge>
                        )}
                      </div>
                      <p className="mt-2 text-2xl font-bold text-signara-navy">
                        ${plan.price_usd ?? 0}
                        <span className="text-sm font-normal text-signara-steel"> / month</span>
                      </p>
                      <ul className="mt-4 space-y-2 text-sm text-signara-navy flex-1">
                        <li>Users: {formatUserLimit(plan.max_users)}</li>
                        <li>
                          Documents / month: {formatDocumentLimit(plan.max_documents_per_month)}
                        </li>
                        {features.map((feature) => (
                          <li key={feature} className="flex gap-2">
                            <Check className="mt-0.5 size-3.5 shrink-0 text-signara-gold" />
                            <span>{feature}</span>
                          </li>
                        ))}
                      </ul>
                      <div className="mt-5">
                        {showCheckout ? (
                          <PaynowCheckoutButton planId={plan.id as PaidPlanId} />
                        ) : isCurrent ? (
                          <p className="text-center text-xs text-signara-steel">Your current plan</p>
                        ) : !isAdmin ? (
                          <p className="text-center text-xs text-signara-steel">
                            Contact an admin to upgrade
                          </p>
                        ) : (
                          <p className="text-center text-xs text-signara-steel">Lower or same tier</p>
                        )}
                      </div>
                    </div>
                  )
                })
              )}
            </div>
          </div>

          {!isAdmin && (
            <p className="text-sm text-signara-steel">
              Only organisation admins can purchase or renew a plan.{' '}
              <Link href="/dashboard/settings" className="text-signara-gold hover:underline">
                Back to settings
              </Link>
            </p>
          )}
        </div>
      </DashboardPageBody>
    </>
  )
}
