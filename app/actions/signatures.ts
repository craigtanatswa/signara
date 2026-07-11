'use server'

import { redirect } from 'next/navigation'
import { revalidatePath } from 'next/cache'
import { createClient } from '@/lib/supabase/server'
import { persistSignatureForUser } from '@/lib/signatures/persist-for-user'
import type { SignatureCaptureMethod, UserSignature } from '@/types/database'

async function getAuthenticatedUserId() {
  const supabase = await createClient()
  const {
    data: { user: authUser },
  } = await supabase.auth.getUser()
  if (!authUser) redirect('/login')
  return { supabase, userId: authUser.id }
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

  const result = await persistSignatureForUser({
    userId,
    supabase,
    imageData: input.imageData,
    method: input.method,
    label: input.label,
    setAsDefault: input.setAsDefault,
    replaceIfFull: input.replaceIfFull,
  })

  if (result.signature && !result.error) {
    revalidatePath('/dashboard/settings/profile')
  }

  return result
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
