import { createAdminClient } from '@/lib/supabase/admin'
import {
  clearMinimumPlanIfSatisfied,
  recordPlanDowngrade,
} from '@/lib/billing/plan-upgrade-lock'
import { planRank } from '@/lib/billing/plans'
import { createNotification } from '@/lib/notifications/create'
import { sendPaymentReceipt } from '@/lib/billing/receipts'

/**
 * Activate a paid plan from a verified Paynow payment.
 * Idempotent when billing_payments.status is already paid.
 */
export async function activatePaidSubscription(input: {
  organisationId: string
  planId: string
  reference: string
  paynowReference: string | null
  amount?: number | null
}): Promise<{ activated: boolean; alreadyPaid: boolean }> {
  const supabase = createAdminClient()

  const { data: payment } = await supabase
    .from('billing_payments')
    .select('*')
    .eq('reference', input.reference)
    .maybeSingle()

  if (payment?.status === 'paid') {
    return { activated: false, alreadyPaid: true }
  }

  const { data: plan, error: planError } = await supabase
    .from('plans')
    .select('id, name')
    .eq('id', input.planId)
    .single()

  if (planError || !plan) {
    throw new Error(`Plan not found: ${input.planId}`)
  }

  const renewalDate = new Date()
  renewalDate.setDate(renewalDate.getDate() + 30)

  const { data: orgBefore } = await supabase
    .from('organisations')
    .select('plan_id, name')
    .eq('id', input.organisationId)
    .single()

  const previousPlanId = orgBefore?.plan_id ?? null
  if (previousPlanId && planRank(input.planId) < planRank(previousPlanId)) {
    await recordPlanDowngrade(input.organisationId, previousPlanId, input.planId)
  }

  const paynowOwnReference = input.paynowReference ?? input.reference

  const { error: updateError } = await supabase
    .from('organisations')
    .update({
      plan_id: input.planId,
      subscription_status: 'active',
      payment_method: 'paynow',
      paynow_renewal_date: renewalDate.toISOString(),
      paynow_reference: paynowOwnReference,
      updated_at: new Date().toISOString(),
    })
    .eq('id', input.organisationId)

  if (updateError) {
    throw new Error(updateError.message)
  }

  await clearMinimumPlanIfSatisfied(input.organisationId, input.planId)

  if (payment) {
    await supabase
      .from('billing_payments')
      .update({
        status: 'paid',
        paynow_reference: paynowOwnReference,
        updated_at: new Date().toISOString(),
      })
      .eq('id', payment.id)
  }

  const payerUserId = payment?.user_id as string | undefined
  let notifyUserId = payerUserId

  if (!notifyUserId) {
    const { data: admin } = await supabase
      .from('users')
      .select('id')
      .eq('organisation_id', input.organisationId)
      .eq('role', 'admin')
      .limit(1)
      .maybeSingle()
    notifyUserId = admin?.id
  }

  if (notifyUserId) {
    const formattedDate = renewalDate.toLocaleDateString('en-GB', {
      day: 'numeric',
      month: 'long',
      year: 'numeric',
    })
    await createNotification({
      userId: notifyUserId,
      type: 'billing',
      title: 'Payment received',
      message: `Your ${plan.name} plan is now active. Next renewal: ${formattedDate}.`,
    })
  }

  // Receipt email for every successful payment
  if (!payment || !payment.receipt_sent_at) {
    const userId = payment?.user_id ?? notifyUserId
    const { data: user } = userId
      ? await supabase
          .from('users')
          .select('id, email, full_name, billing_receipt_email')
          .eq('id', userId)
          .maybeSingle()
      : { data: null }

    const to =
      (payment?.receipt_email as string | undefined) ||
      user?.billing_receipt_email ||
      user?.email

    if (to && user) {
      await sendPaymentReceipt({
        to,
        fullName: user.full_name,
        organisationName: orgBefore?.name ?? 'Your organisation',
        planName: plan.name,
        amount: Number(input.amount ?? payment?.amount ?? 0),
        currency: (payment?.currency as string) || 'USD',
        method: (payment?.method as 'ecocash' | 'card') || 'card',
        reference: input.reference,
        paynowReference: paynowOwnReference,
        paidAt: new Date(),
      })

      if (payment) {
        await supabase
          .from('billing_payments')
          .update({ receipt_sent_at: new Date().toISOString() })
          .eq('id', payment.id)
      }
    }
  }

  return { activated: true, alreadyPaid: false }
}

export async function markPaymentFailed(reference: string, errorMessage?: string) {
  const supabase = createAdminClient()
  await supabase
    .from('billing_payments')
    .update({
      status: 'failed',
      error_message: errorMessage ?? 'Payment failed',
      updated_at: new Date().toISOString(),
    })
    .eq('reference', reference)
    .neq('status', 'paid')
}
