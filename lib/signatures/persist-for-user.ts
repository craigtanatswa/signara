import type { SignatureCaptureMethod, UserSignature } from '@/types/database'

const MAX_SIGNATURES = 10
const MAX_IMAGE_DATA_CHARS = 2_500_000

/** Minimal Supabase surface needed for signature persistence. */
type SignatureDb = {
  from: (table: string) => any
}

function isValidSignatureDataUrl(value: string): boolean {
  return value.startsWith('data:image/') && value.length < MAX_IMAGE_DATA_CHARS
}

/**
 * Persist a signature to the user's library. Safe to call from other server
 * actions (approve / submit) so the client only needs one round-trip.
 * Never redirects — returns an error object instead.
 */
export async function persistSignatureForUser(input: {
  userId: string
  imageData: string
  method: SignatureCaptureMethod
  label?: string
  setAsDefault?: boolean
  replaceIfFull?: boolean
  /** Optional pre-built client (admin or user-scoped). */
  supabase: SignatureDb
}): Promise<{ signature?: UserSignature; error?: string; alreadySaved?: boolean }> {
  if (!isValidSignatureDataUrl(input.imageData)) {
    return { error: 'Invalid signature image.' }
  }

  if (!['draw', 'type', 'upload'].includes(input.method)) {
    return { error: 'Invalid signature method.' }
  }

  const { supabase, userId } = input

  const { data: duplicate } = await supabase
    .from('user_signatures')
    .select('*')
    .eq('user_id', userId)
    .eq('image_data', input.imageData)
    .maybeSingle()

  if (duplicate) {
    return { signature: duplicate as UserSignature, alreadySaved: true }
  }

  const { count } = await supabase
    .from('user_signatures')
    .select('id', { count: 'exact', head: true })
    .eq('user_id', userId)

  const label = (input.label?.trim() || 'My signature').slice(0, 80)
  const setAsDefault = Boolean(input.setAsDefault) || (count ?? 0) === 0

  if ((count ?? 0) >= MAX_SIGNATURES) {
    if (!input.replaceIfFull) {
      return {
        error: `You can save up to ${MAX_SIGNATURES} signatures. Delete one before adding another.`,
      }
    }

    const { data: toReplace } = await supabase
      .from('user_signatures')
      .select('id')
      .eq('user_id', userId)
      .order('is_default', { ascending: false })
      .order('updated_at', { ascending: false })
      .limit(1)
      .maybeSingle()

    if (!toReplace) {
      return { error: 'Could not update your saved signature.' }
    }

    if (setAsDefault) {
      await supabase
        .from('user_signatures')
        .update({ is_default: false, updated_at: new Date().toISOString() })
        .eq('user_id', userId)
        .eq('is_default', true)
    }

    const { data: updated, error: updateError } = await supabase
      .from('user_signatures')
      .update({
        label,
        method: input.method,
        image_data: input.imageData,
        is_default: setAsDefault || true,
        updated_at: new Date().toISOString(),
      })
      .eq('id', toReplace.id)
      .select('*')
      .single()

    if (updateError) {
      return { error: updateError.message }
    }

    return { signature: updated as UserSignature }
  }

  if (setAsDefault) {
    await supabase
      .from('user_signatures')
      .update({ is_default: false, updated_at: new Date().toISOString() })
      .eq('user_id', userId)
      .eq('is_default', true)
  }

  const { data, error } = await supabase
    .from('user_signatures')
    .insert({
      user_id: userId,
      label,
      method: input.method,
      image_data: input.imageData,
      is_default: setAsDefault,
    })
    .select('*')
    .single()

  if (error) {
    return { error: error.message }
  }

  return { signature: data as UserSignature }
}

/** Best-effort library save used after approve/submit — never throws or blocks. */
export async function tryPersistSignatureForFutureUse(input: {
  userId: string
  imageData: string | null | undefined
  method?: SignatureCaptureMethod
  supabase: SignatureDb
}): Promise<void> {
  if (!input.imageData?.startsWith('data:image/')) return

  try {
    const result = await persistSignatureForUser({
      userId: input.userId,
      imageData: input.imageData,
      method: input.method ?? 'draw',
      setAsDefault: true,
      replaceIfFull: true,
      supabase: input.supabase,
    })
    if (result.error) {
      console.error('[tryPersistSignatureForFutureUse]', result.error)
    }
  } catch (err) {
    console.error('[tryPersistSignatureForFutureUse]', err)
  }
}
