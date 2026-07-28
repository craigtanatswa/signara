import { NextRequest, NextResponse } from 'next/server'
import {
  isPaynowFailedStatus,
  isPaynowPaidStatus,
  parsePlanFromReference,
  verifyPaynowHash,
} from '@/lib/billing/paynow'
import { activatePaidSubscription, markPaymentFailed } from '@/lib/billing/activate-payment'

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
    const reference = fields.reference ?? ''

    if (isPaynowFailedStatus(status)) {
      await markPaymentFailed(reference, status)
      console.info('[paynow/callback] payment failed', { status, reference })
      return new NextResponse('OK', { status: 200 })
    }

    if (!isPaynowPaidStatus(status)) {
      console.info('[paynow/callback] non-paid status', { status, reference })
      return new NextResponse('OK', { status: 200 })
    }

    const parsed = parsePlanFromReference(reference)
    if (!parsed) {
      console.error('[paynow/callback] could not parse reference', { reference })
      return new NextResponse('OK', { status: 200 })
    }

    const paynowOwnReference = fields.paynowreference ?? fields.paynow_reference ?? reference
    const amount = fields.amount ? Number(fields.amount) : null

    await activatePaidSubscription({
      organisationId: parsed.organisationId,
      planId: parsed.planId,
      reference,
      paynowReference: paynowOwnReference,
      amount,
    })

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
