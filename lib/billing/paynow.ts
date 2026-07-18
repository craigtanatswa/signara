import crypto from 'crypto'

const PAYNOW_INITIATE_URL = 'https://www.paynow.co.zw/interface/initiatetransaction'

// Hash: concatenate all field values in order (skip the hash field itself),
// append the Integration Key, SHA512, return UPPERCASE HEX
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

// Verify a hash on an incoming message from Paynow (callbacks and initiate responses)
export function verifyPaynowHash(
  fields: Record<string, string>,
  integrationKey: string
): boolean {
  const received = fields['hash']
  if (!received) return false
  const { hash: _h, ...without } = fields
  return generateHash(without, integrationKey) === received.toUpperCase()
}

// Parse Paynow's URL-encoded response string into a plain object
function parsePaynowResponse(text: string): Record<string, string> {
  const result: Record<string, string> = {}
  for (const pair of text.split('&')) {
    const [key, ...rest] = pair.split('=')
    if (key) result[key.toLowerCase()] = decodeURIComponent(rest.join('=').replace(/\+/g, ' '))
  }
  return result
}

export interface PaynowInitiateParams {
  organisationId: string
  planId: string
  amount: number
  description: string
  adminEmail: string
  returnUrl: string
  resultUrl: string
}

export interface PaynowInitiateResult {
  redirectUrl: string
  pollUrl: string
  reference: string
}

// Initiate a web transaction with Paynow
// Returns the redirectUrl to send the customer to, and a pollUrl for status checks
export async function initiatePaynowTransaction(
  params: PaynowInitiateParams
): Promise<PaynowInitiateResult> {
  const id = process.env.PAYNOW_INTEGRATION_ID!
  const key = process.env.PAYNOW_INTEGRATION_KEY!
  if (!id || !key) throw new Error('Paynow credentials not configured')

  // reference format: signara-{uuid}-{planId}-{timestamp}
  const reference = `signara-${params.organisationId}-${params.planId}-${Date.now()}`

  // Field order matters for hashing — do not reorder
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

  // Verify the hash on the response before trusting the redirect URL
  if (!verifyPaynowHash(parsed, key)) {
    throw new Error('Paynow response hash mismatch — possible MITM attack')
  }

  return { redirectUrl: parsed.browserurl, pollUrl: parsed.pollurl, reference }
}

// Parse organisationId and planId out of a reference string
// reference format: signara-{36-char-uuid}-{planId}-{timestamp}
export function parsePlanFromReference(reference: string): {
  organisationId: string
  planId: string
} | null {
  const prefix = 'signara-'
  if (!reference.startsWith(prefix)) return null
  const rest = reference.slice(prefix.length)
  const uuidLen = 36 // UUID is always 36 chars: 8-4-4-4-12
  if (rest.length < uuidLen + 2) return null
  const organisationId = rest.slice(0, uuidLen)
  const remainder = rest.slice(uuidLen + 1)
  const lastDash = remainder.lastIndexOf('-')
  if (lastDash === -1) return null
  return { organisationId, planId: remainder.slice(0, lastDash) }
}

// Check whether a status string represents a successful payment
export function isPaynowPaidStatus(status: string): boolean {
  return ['paid', 'awaiting delivery', 'delivered'].includes(status.toLowerCase())
}
