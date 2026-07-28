import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import {
  buildPaymentReference,
  initiatePaynowMobileTransaction,
  initiatePaynowTransaction,
  normaliseZimbabwePhone,
} from '@/lib/billing/paynow'
import { resolvePublicAppUrl } from '@/lib/app-url'
import { rememberReceiptEmail } from '@/lib/billing/receipts'

const initiateSchema = z.object({
  planId: z.enum(['starter', 'growth', 'enterprise']),
  method: z.enum(['ecocash', 'card']),
  receiptEmail: z.string().email(),
  phone: z.string().optional(),
})

export async function POST(request: NextRequest) {
  try {
    const supabase = await createClient()
    const {
      data: { user: authUser },
    } = await supabase.auth.getUser()

    if (!authUser) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { data: currentUser, error: userError } = await supabase
      .from('users')
      .select('id, email, role, organisation_id, full_name')
      .eq('id', authUser.id)
      .single()

    if (userError || !currentUser) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 })
    }

    if (currentUser.role !== 'admin') {
      return NextResponse.json({ error: 'Forbidden: admin access required' }, { status: 403 })
    }

    const body = await request.json()
    const parsed = initiateSchema.safeParse(body)
    if (!parsed.success) {
      return NextResponse.json(
        { error: parsed.error.issues[0]?.message ?? 'Invalid request body' },
        { status: 400 }
      )
    }

    const { planId, method, receiptEmail } = parsed.data

    if (method === 'ecocash') {
      const phone = normaliseZimbabwePhone(parsed.data.phone ?? '')
      if (!phone) {
        return NextResponse.json(
          { error: 'Enter a valid EcoCash number (e.g. 0771234567)' },
          { status: 400 }
        )
      }
    }

    const { data: plan, error: planError } = await supabase
      .from('plans')
      .select('id, name, price_usd')
      .eq('id', planId)
      .single()

    if (planError || !plan) {
      return NextResponse.json({ error: 'Plan not found' }, { status: 404 })
    }

    if (plan.price_usd == null || plan.price_usd <= 0) {
      return NextResponse.json({ error: 'Plan is not available for purchase' }, { status: 400 })
    }

    const appUrl = resolvePublicAppUrl(request)
    const reference = buildPaymentReference(currentUser.organisation_id, planId)
    const amount = Number(plan.price_usd)
    const description = `Signara ${plan.name} subscription`
    const resultUrl = `${appUrl}/api/billing/paynow/callback`
    const returnUrl = `${appUrl}/dashboard/settings/billing/checkout/${method}?planId=${planId}&reference=${encodeURIComponent(reference)}&status=return`

    await rememberReceiptEmail(currentUser.id, receiptEmail)

    const admin = createAdminClient()
    const phone =
      method === 'ecocash' ? normaliseZimbabwePhone(parsed.data.phone ?? '') : null

    if (method === 'ecocash') {
      const result = await initiatePaynowMobileTransaction({
        organisationId: currentUser.organisation_id,
        planId,
        amount,
        description,
        adminEmail: currentUser.email,
        returnUrl,
        resultUrl,
        reference,
        phone: phone!,
        method: 'ecocash',
      })

      const { data: payment, error: insertError } = await admin
        .from('billing_payments')
        .insert({
          organisation_id: currentUser.organisation_id,
          user_id: currentUser.id,
          plan_id: planId,
          method: 'ecocash',
          reference: result.reference,
          poll_url: result.pollUrl,
          amount,
          receipt_email: receiptEmail.trim().toLowerCase(),
          phone,
          status: 'pending',
        })
        .select('id, reference')
        .single()

      if (insertError || !payment) {
        console.error('[paynow/initiate] insert failed', insertError?.message)
        return NextResponse.json({ error: 'Failed to prepare payment' }, { status: 500 })
      }

      await admin
        .from('organisations')
        .update({
          paynow_reference: result.reference,
          updated_at: new Date().toISOString(),
        })
        .eq('id', currentUser.organisation_id)

      return NextResponse.json({
        paymentId: payment.id,
        reference: result.reference,
        pollUrl: result.pollUrl,
        instructions:
          result.instructions ??
          'Check your phone for the EcoCash prompt and enter your PIN to complete payment.',
      })
    }

    // Card — redirect to Paynow hosted card page (PCI-safe)
    const result = await initiatePaynowTransaction({
      organisationId: currentUser.organisation_id,
      planId,
      amount,
      description,
      adminEmail: currentUser.email,
      returnUrl,
      resultUrl,
      reference,
    })

    const { data: payment, error: insertError } = await admin
      .from('billing_payments')
      .insert({
        organisation_id: currentUser.organisation_id,
        user_id: currentUser.id,
        plan_id: planId,
        method: 'card',
        reference: result.reference,
        poll_url: result.pollUrl,
        amount,
        receipt_email: receiptEmail.trim().toLowerCase(),
        status: 'pending',
      })
      .select('id, reference')
      .single()

    if (insertError || !payment) {
      console.error('[paynow/initiate] insert failed', insertError?.message)
      return NextResponse.json({ error: 'Failed to prepare payment' }, { status: 500 })
    }

    await admin
      .from('organisations')
      .update({
        paynow_reference: result.reference,
        updated_at: new Date().toISOString(),
      })
      .eq('id', currentUser.organisation_id)

    return NextResponse.json({
      paymentId: payment.id,
      reference: result.reference,
      redirectUrl: result.redirectUrl,
    })
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Failed to initiate payment'
    const safeMessage = message.includes('PAYNOW_INTEGRATION_KEY')
      ? 'Paynow credentials not configured'
      : message
    console.error('[paynow/initiate]', safeMessage)
    return NextResponse.json({ error: safeMessage }, { status: 500 })
  }
}
