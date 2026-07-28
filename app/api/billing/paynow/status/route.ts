import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { pollPaynowTransaction } from '@/lib/billing/paynow'
import { activatePaidSubscription, markPaymentFailed } from '@/lib/billing/activate-payment'

const statusSchema = z.object({
  reference: z.string().min(1),
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

    const body = await request.json()
    const parsed = statusSchema.safeParse(body)
    if (!parsed.success) {
      return NextResponse.json({ error: 'Invalid request' }, { status: 400 })
    }

    const admin = createAdminClient()
    const { data: payment } = await admin
      .from('billing_payments')
      .select('*')
      .eq('reference', parsed.data.reference)
      .eq('user_id', authUser.id)
      .maybeSingle()

    if (!payment) {
      return NextResponse.json({ error: 'Payment not found' }, { status: 404 })
    }

    if (payment.status === 'paid') {
      return NextResponse.json({
        status: 'paid',
        paid: true,
        failed: false,
        planId: payment.plan_id,
      })
    }

    if (payment.status === 'failed' || payment.status === 'cancelled') {
      return NextResponse.json({
        status: payment.status,
        paid: false,
        failed: true,
        error: payment.error_message ?? 'Payment failed',
        planId: payment.plan_id,
      })
    }

    if (!payment.poll_url) {
      return NextResponse.json({
        status: 'pending',
        paid: false,
        failed: false,
        planId: payment.plan_id,
      })
    }

    const poll = await pollPaynowTransaction(payment.poll_url)

    if (poll.paid) {
      await activatePaidSubscription({
        organisationId: payment.organisation_id,
        planId: payment.plan_id,
        reference: payment.reference,
        paynowReference: poll.paynowReference,
        amount: poll.amount ? Number(poll.amount) : Number(payment.amount),
      })
      return NextResponse.json({
        status: 'paid',
        paid: true,
        failed: false,
        planId: payment.plan_id,
      })
    }

    if (poll.failed) {
      await markPaymentFailed(payment.reference, poll.status)
      return NextResponse.json({
        status: poll.status,
        paid: false,
        failed: true,
        error: `Payment ${poll.status.toLowerCase()}. Please try again.`,
        planId: payment.plan_id,
      })
    }

    return NextResponse.json({
      status: poll.status || 'pending',
      paid: false,
      failed: false,
      planId: payment.plan_id,
    })
  } catch (err) {
    console.error('[paynow/status]', err)
    return NextResponse.json(
      { error: err instanceof Error ? err.message : 'Failed to check payment status' },
      { status: 500 }
    )
  }
}
