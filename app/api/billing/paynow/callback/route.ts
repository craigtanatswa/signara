import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'
import {
  isPaynowPaidStatus,
  parsePlanFromReference,
  verifyPaynowHash,
} from '@/lib/billing/paynow'
import {
  clearMinimumPlanIfSatisfied,
  recordPlanDowngrade,
} from '@/lib/billing/plan-upgrade-lock'
import { planRank } from '@/lib/billing/plans'
import { createNotification } from '@/lib/notifications/create'

/**
 * Paynow result_url callback — no user session.
 * Always return HTTP 200 so Paynow does not retry and re-activate plans.
 */
export async function POST(request: NextRequest) {
  try {
    const formData = await request.formData()
    const fields: Record<string, string> = {}
    for (const [key, value] of formData.entries()) {
      fields[key.toLowerCase()] = typeof value === 'string' ? value : String(value)
    }

    const key = process.env.PAYNOW_INTEGRATION_KEY
    if (!key) {
      console.error('[paynow/callback] PAYNOW_INTEGRATION_KEY not configured')
      return new NextResponse('OK', { status: 200 })
    }

    if (!verifyPaynowHash(fields, key)) {
      console.error('[paynow/callback] hash verification failed', {
        reference: fields.reference,
        status: fields.status,
      })
      return new NextResponse('OK', { status: 200 })
    }

    const status = fields.status ?? ''
    if (!isPaynowPaidStatus(status)) {
      console.info('[paynow/callback] non-paid status', { status, reference: fields.reference })
      return new NextResponse('OK', { status: 200 })
    }

    const reference = fields.reference ?? ''
    const parsed = parsePlanFromReference(reference)
    if (!parsed) {
      console.error('[paynow/callback] could not parse reference', { reference })
      return new NextResponse('OK', { status: 200 })
    }

    const supabase = createAdminClient()

    const { data: plan, error: planError } = await supabase
      .from('plans')
      .select('id, name')
      .eq('id', parsed.planId)
      .single()

    if (planError || !plan) {
      console.error('[paynow/callback] plan not found', { planId: parsed.planId })
      return new NextResponse('OK', { status: 200 })
    }

    const renewalDate = new Date()
    renewalDate.setDate(renewalDate.getDate() + 30)

    const paynowOwnReference = fields.paynowreference ?? fields.paynow_reference ?? reference

    const { data: orgBefore } = await supabase
      .from('organisations')
      .select('plan_id')
      .eq('id', parsed.organisationId)
      .single()

    const previousPlanId = orgBefore?.plan_id ?? null
    if (
      previousPlanId &&
      planRank(parsed.planId) < planRank(previousPlanId)
    ) {
      await recordPlanDowngrade(parsed.organisationId, previousPlanId, parsed.planId)
    }

    const { error: updateError } = await supabase
      .from('organisations')
      .update({
        plan_id: parsed.planId,
        subscription_status: 'active',
        payment_method: 'paynow',
        paynow_renewal_date: renewalDate.toISOString(),
        paynow_reference: paynowOwnReference,
        updated_at: new Date().toISOString(),
      })
      .eq('id', parsed.organisationId)

    if (updateError) {
      console.error('[paynow/callback] org update failed', updateError.message)
      return new NextResponse('OK', { status: 200 })
    }

    await clearMinimumPlanIfSatisfied(parsed.organisationId, parsed.planId)

    const { data: admin } = await supabase
      .from('users')
      .select('id')
      .eq('organisation_id', parsed.organisationId)
      .eq('role', 'admin')
      .limit(1)
      .maybeSingle()

    if (admin) {
      const formattedDate = renewalDate.toLocaleDateString('en-GB', {
        day: 'numeric',
        month: 'long',
        year: 'numeric',
      })
      await createNotification({
        userId: admin.id,
        type: 'billing',
        title: 'Payment received',
        message: `Your ${plan.name} plan is now active. Next renewal: ${formattedDate}.`,
      })
    }

    console.info('[paynow/callback] plan activated', {
      organisationId: parsed.organisationId,
      planId: parsed.planId,
      paynowReference: paynowOwnReference,
    })

    return new NextResponse('OK', { status: 200 })
  } catch (err) {
    console.error('[paynow/callback]', err)
    return new NextResponse('OK', { status: 200 })
  }
}
