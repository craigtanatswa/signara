import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { createClient } from '@/lib/supabase/server'
import { initiatePaynowTransaction } from '@/lib/billing/paynow'

const initiateSchema = z.object({
  planId: z.enum(['starter', 'growth', 'enterprise']),
})

function getAppUrl(): string {
  const url = process.env.NEXT_PUBLIC_APP_URL?.replace(/\/$/, '')
  if (!url) throw new Error('NEXT_PUBLIC_APP_URL is not configured')
  return url
}

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
      .select('id, email, role, organisation_id')
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

    const { planId } = parsed.data

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

    const appUrl = getAppUrl()
    const result = await initiatePaynowTransaction({
      organisationId: currentUser.organisation_id,
      planId,
      amount: Number(plan.price_usd),
      description: `Signara ${plan.name} subscription`,
      adminEmail: currentUser.email,
      returnUrl: `${appUrl}/dashboard/settings/billing?paynow=pending`,
      resultUrl: `${appUrl}/api/billing/paynow/callback`,
    })

    const { error: updateError } = await supabase
      .from('organisations')
      .update({
        paynow_reference: result.reference,
        updated_at: new Date().toISOString(),
      })
      .eq('id', currentUser.organisation_id)

    if (updateError) {
      console.error('[paynow/initiate] failed to store reference', updateError.message)
      return NextResponse.json({ error: 'Failed to prepare payment' }, { status: 500 })
    }

    return NextResponse.json({ redirectUrl: result.redirectUrl })
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Failed to initiate payment'
    // Never expose the Integration Key
    const safeMessage = message.includes('PAYNOW_INTEGRATION_KEY')
      ? 'Paynow credentials not configured'
      : message
    console.error('[paynow/initiate]', safeMessage)
    return NextResponse.json({ error: safeMessage }, { status: 500 })
  }
}
