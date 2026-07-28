import { Suspense } from 'react'
import { redirect, notFound } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { Header } from '@/components/layout/header'
import { DashboardPageBody } from '@/components/layout/dashboard-page-body'
import { BackLink } from '@/components/layout/back-link'
import { CheckoutClient } from '@/components/billing/checkout-client'
import { listReceiptEmails } from '@/lib/billing/receipts'
import { planFeatures, type PaidPlanId } from '@/lib/billing/plans'
import type { Plan, User } from '@/types/database'

interface CheckoutPageProps {
  params: Promise<{ method: string }>
  searchParams: Promise<{ planId?: string }>
}

export default async function BillingCheckoutPage({ params, searchParams }: CheckoutPageProps) {
  const { method: methodParam } = await params
  const { planId } = await searchParams

  if (methodParam !== 'ecocash' && methodParam !== 'card') notFound()
  if (!planId || !['starter', 'growth', 'enterprise'].includes(planId)) {
    redirect('/dashboard/settings/billing')
  }

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
  const currentUser = userProfile as User & { billing_receipt_email?: string | null }

  if (currentUser.role !== 'admin') {
    redirect('/dashboard/settings/billing')
  }

  const { data: planData } = await supabase
    .from('plans')
    .select('id, name, max_users, max_documents_per_month, price_usd, features')
    .eq('id', planId)
    .single()

  if (!planData) redirect('/dashboard/settings/billing')
  const plan = planData as Plan

  // Seed account email into receipt history if empty
  const admin = createAdminClient()
  const { count } = await admin
    .from('billing_receipt_emails')
    .select('id', { count: 'exact', head: true })
    .eq('user_id', currentUser.id)

  if ((count ?? 0) === 0) {
    await admin.from('billing_receipt_emails').insert({
      user_id: currentUser.id,
      email: currentUser.email.toLowerCase(),
      last_used_at: new Date().toISOString(),
    })
  }

  const history = await listReceiptEmails(currentUser.id)
  const defaultReceiptEmail =
    currentUser.billing_receipt_email?.trim() ||
    history[0] ||
    currentUser.email

  return (
    <>
      <Header
        pageTitle={methodParam === 'ecocash' ? 'EcoCash checkout' : 'Card checkout'}
        user={currentUser}
      />
      <DashboardPageBody>
        <div className="mx-auto max-w-4xl space-y-6">
          <BackLink href="/dashboard/settings/billing" label="Back to billing" />
          <Suspense fallback={<p className="text-sm text-signara-steel">Loading checkout…</p>}>
            <CheckoutClient
              method={methodParam}
              plan={{
                id: plan.id as PaidPlanId,
                name: plan.name,
                price_usd: plan.price_usd,
                max_users: plan.max_users,
                max_documents_per_month: plan.max_documents_per_month,
                features: planFeatures(plan.features),
              }}
              defaultReceiptEmail={defaultReceiptEmail}
              receiptEmailHistory={history}
            />
          </Suspense>
        </div>
      </DashboardPageBody>
    </>
  )
}
