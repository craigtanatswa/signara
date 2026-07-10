'use server'

import { redirect } from 'next/navigation'
import { revalidatePath } from 'next/cache'
import { createClient } from '@/lib/supabase/server'
import type { SignatureCaptureMethod, UserSignature } from '@/types/database'

const MAX_SIGNATURES = 10
const MAX_IMAGE_DATA_CHARS = 2_500_000 // ~1.8 MB base64 PNG

async function getAuthenticatedUserId() {
  const supabase = await createClient()
  const {
    data: { user: authUser },
  } = await supabase.auth.getUser()
  if (!authUser) redirect('/login')
  return { supabase, userId: authUser.id }
}

function isValidSignatureDataUrl(value: string): boolean {
  return value.startsWith('data:image/') && value.length < MAX_IMAGE_DATA_CHARS
}

export async function listMySignatures(): Promise<{
  signatures: UserSignature[]
  error?: string
}> {
  const { supabase, userId } = await getAuthenticatedUserId()

  const { data, error } = await supabase
    .from('user_signatures')
    .select('*')
    .eq('user_id', userId)
    .order('is_default', { ascending: false })
    .order('created_at', { ascending: false })

  if (error) {
    return { signatures: [], error: error.message }
  }

  return { signatures: (data ?? []) as UserSignature[] }
}

export async function saveUserSignature(input: {
  imageData: string
  method: SignatureCaptureMethod
  label?: string
  setAsDefault?: boolean
  /** When at the signature limit, update the default (or newest) instead of erroring. */
  replaceIfFull?: boolean
}): Promise<{ signature?: UserSignature; error?: string; alreadySaved?: boolean }> {
  const { supabase, userId } = await getAuthenticatedUserId()

  if (!isValidSignatureDataUrl(input.imageData)) {
    return { error: 'Invalid signature image.' }
  }

  if (!['draw', 'type', 'upload'].includes(input.method)) {
    return { error: 'Invalid signature method.' }
  }

  // Reuse an identical saved image instead of inserting a duplicate.
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

    revalidatePath('/dashboard/settings/profile')
    revalidatePath('/dashboard/documents')
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

  revalidatePath('/dashboard/settings/profile')
  revalidatePath('/dashboard/documents')

  return { signature: data as UserSignature }
}

export async function setDefaultUserSignature(
  signatureId: string
): Promise<{ error?: string }> {
  const { supabase, userId } = await getAuthenticatedUserId()

  const { data: existing } = await supabase
    .from('user_signatures')
    .select('id')
    .eq('id', signatureId)
    .eq('user_id', userId)
    .maybeSingle()

  if (!existing) {
    return { error: 'Signature not found.' }
  }

  await supabase
    .from('user_signatures')
    .update({ is_default: false, updated_at: new Date().toISOString() })
    .eq('user_id', userId)
    .eq('is_default', true)

  const { error } = await supabase
    .from('user_signatures')
    .update({ is_default: true, updated_at: new Date().toISOString() })
    .eq('id', signatureId)
    .eq('user_id', userId)

  if (error) {
    return { error: error.message }
  }

  revalidatePath('/dashboard/settings/profile')
  return {}
}

export async function deleteUserSignature(
  signatureId: string
): Promise<{ error?: string }> {
  const { supabase, userId } = await getAuthenticatedUserId()

  const { data: existing } = await supabase
    .from('user_signatures')
    .select('id, is_default')
    .eq('id', signatureId)
    .eq('user_id', userId)
    .maybeSingle()

  if (!existing) {
    return { error: 'Signature not found.' }
  }

  const { error } = await supabase
    .from('user_signatures')
    .delete()
    .eq('id', signatureId)
    .eq('user_id', userId)

  if (error) {
    return { error: error.message }
  }

  // If the default was deleted, promote the newest remaining signature.
  if (existing.is_default) {
    const { data: nextDefault } = await supabase
      .from('user_signatures')
      .select('id')
      .eq('user_id', userId)
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle()

    if (nextDefault) {
      await supabase
        .from('user_signatures')
        .update({ is_default: true, updated_at: new Date().toISOString() })
        .eq('id', nextDefault.id)
        .eq('user_id', userId)
    }
  }

  revalidatePath('/dashboard/settings/profile')
  revalidatePath('/dashboard/documents')
  return {}
}

export async function updateUserSignatureLabel(input: {
  signatureId: string
  label: string
}): Promise<{ error?: string }> {
  const { supabase, userId } = await getAuthenticatedUserId()
  const label = input.label.trim().slice(0, 80)

  if (!label) {
    return { error: 'Label is required.' }
  }

  const { error } = await supabase
    .from('user_signatures')
    .update({ label, updated_at: new Date().toISOString() })
    .eq('id', input.signatureId)
    .eq('user_id', userId)

  if (error) {
    return { error: error.message }
  }

  revalidatePath('/dashboard/settings/profile')
  return {}
}
