import crypto from 'crypto'

const PAYNOW_INITIATE_URL = 'https://www.paynow.co.zw/interface/initiatetransaction'
const PAYNOW_MOBILE_URL = 'https://www.paynow.co.zw/interface/remotetransaction'

function generateHash(values: Record<string, string>, integrationKey: string): string {
  const concatenated = Object.entries(values)
    .filter(([key]) => key.toLowerCase() !== 'hash')
    .map(([, value]) => value)
    .join('')

  return crypto
    .createHash('sha512')
    .update(concatenated + integrationKey)
    .digest('hex')
    .toUpperCase()
}

export function verifyPaynowHash(
  fields: Record<string, string>,
  integrationKey: string
): boolean {
  const received = fields['hash']
  if (!received) return false
  const { hash: _h, ...without } = fields
  return generateHash(without, integrationKey) === received.toUpperCase()
}

function parsePaynowResponse(text: string): Record<string, string> {
  const result: Record<string, string> = {}
  for (const pair of text.split('&')) {
    const [key, ...rest] = pair.split('=')
    if (key) result[key.toLowerCase()] = decodeURIComponent(rest.join('=').replace(/\+/g, ' '))
  }
  return result
}

function getCredentials() {
  const id = process.env.PAYNOW_INTEGRATION_ID
  const key = process.env.PAYNOW_INTEGRATION_KEY
  if (!id || !key) throw new Error('Paynow credentials not configured')
  return { id, key }
}

export function buildPaymentReference(organisationId: string, planId: string): string {
  return `signara-${organisationId}-${planId}-${Date.now()}`
}

export interface PaynowInitiateParams {
  organisationId: string
  planId: string
  amount: number
  description: string
  adminEmail: string
  returnUrl: string
  resultUrl: string
  reference?: string
}

export interface PaynowInitiateResult {
  redirectUrl: string
  pollUrl: string
  reference: string
}

export interface PaynowMobileInitiateParams extends PaynowInitiateParams {
  phone: string
  method?: 'ecocash' | 'onemoney'
}

export interface PaynowMobileInitiateResult {
  pollUrl: string
  reference: string
  instructions: string | null
}

export interface PaynowPollResult {
  status: string
  paid: boolean
  failed: boolean
  amount: string | null
  paynowReference: string | null
  raw: Record<string, string>
}

/** Web / card hosted checkout — customer enters card details on Paynow. */
export async function initiatePaynowTransaction(
  params: PaynowInitiateParams
): Promise<PaynowInitiateResult> {
  const { id, key } = getCredentials()
  const reference = params.reference ?? buildPaymentReference(params.organisationId, params.planId)

  const fields: Record<string, string> = {
    id,
    reference,
    amount: params.amount.toFixed(2),
    additionalinfo: params.description,
    returnurl: params.returnUrl,
    resulturl: params.resultUrl,
    authemail: params.adminEmail,
    status: 'Message',
  }

  fields.hash = generateHash(fields, key)

  const response = await fetch(PAYNOW_INITIATE_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams(fields).toString(),
  })

  const parsed = parsePaynowResponse(await response.text())

  if (parsed.status?.toLowerCase() !== 'ok') {
    throw new Error(`Paynow error: ${parsed.error || parsed.status || 'Unknown'}`)
  }

  if (!verifyPaynowHash(parsed, key)) {
    throw new Error('Paynow response hash mismatch — possible MITM attack')
  }

  return { redirectUrl: parsed.browserurl, pollUrl: parsed.pollurl, reference }
}

/** EcoCash express checkout — USSD prompt pushed to the phone. */
export async function initiatePaynowMobileTransaction(
  params: PaynowMobileInitiateParams
): Promise<PaynowMobileInitiateResult> {
  const { id, key } = getCredentials()
  const reference = params.reference ?? buildPaymentReference(params.organisationId, params.planId)
  const phone = normaliseZimbabwePhone(params.phone)
  if (!phone) throw new Error('Enter a valid Zimbabwe mobile number (e.g. 0771234567)')

  const fields: Record<string, string> = {
    id,
    reference,
    amount: params.amount.toFixed(2),
    additionalinfo: params.description,
    returnurl: params.returnUrl,
    resulturl: params.resultUrl,
    authemail: params.adminEmail,
    phone,
    method: params.method ?? 'ecocash',
    status: 'Message',
  }

  fields.hash = generateHash(fields, key)

  const response = await fetch(PAYNOW_MOBILE_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams(fields).toString(),
  })

  const parsed = parsePaynowResponse(await response.text())

  if (parsed.status?.toLowerCase() !== 'ok') {
    throw new Error(`Paynow error: ${parsed.error || parsed.status || 'Unknown'}`)
  }

  if (!verifyPaynowHash(parsed, key)) {
    throw new Error('Paynow response hash mismatch — possible MITM attack')
  }

  return {
    pollUrl: parsed.pollurl,
    reference,
    instructions: parsed.instructions ?? parsed.message ?? null,
  }
}

export async function pollPaynowTransaction(pollUrl: string): Promise<PaynowPollResult> {
  const key = process.env.PAYNOW_INTEGRATION_KEY
  if (!key) throw new Error('Paynow credentials not configured')

  const response = await fetch(pollUrl, { method: 'POST' })
  const parsed = parsePaynowResponse(await response.text())

  if (parsed.hash && !verifyPaynowHash(parsed, key)) {
    throw new Error('Paynow poll hash mismatch — possible MITM attack')
  }

  const status = parsed.status ?? ''
  const paid = isPaynowPaidStatus(status)
  const failed = ['failed', 'cancelled', 'canceled', 'closed'].includes(status.toLowerCase())

  return {
    status,
    paid,
    failed,
    amount: parsed.amount ?? null,
    paynowReference: parsed.paynowreference ?? parsed.paynow_reference ?? null,
    raw: parsed,
  }
}

/** Normalise local numbers to 07xxxxxxxx / 2637xxxxxxxx accepted by Paynow. */
export function normaliseZimbabwePhone(input: string): string | null {
  const digits = input.replace(/\D/g, '')
  if (/^07\d{8}$/.test(digits)) return digits
  if (/^2637\d{8}$/.test(digits)) return `0${digits.slice(3)}`
  if (/^7\d{8}$/.test(digits)) return `0${digits}`
  return null
}

export function parsePlanFromReference(reference: string): {
  organisationId: string
  planId: string
} | null {
  const prefix = 'signara-'
  if (!reference.startsWith(prefix)) return null
  const rest = reference.slice(prefix.length)
  const uuidLen = 36
  if (rest.length < uuidLen + 2) return null
  const organisationId = rest.slice(0, uuidLen)
  const remainder = rest.slice(uuidLen + 1)
  const lastDash = remainder.lastIndexOf('-')
  if (lastDash === -1) return null
  return { organisationId, planId: remainder.slice(0, lastDash) }
}

export function isPaynowPaidStatus(status: string): boolean {
  return ['paid', 'awaiting delivery', 'delivered'].includes(status.toLowerCase())
}

export function isPaynowFailedStatus(status: string): boolean {
  return ['failed', 'cancelled', 'canceled', 'closed'].includes(status.toLowerCase())
}
