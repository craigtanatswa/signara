'use server'

import { revalidatePath } from 'next/cache'
import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import {
  BRANDING_IMAGE_TYPES,
  getExtensionFromMime,
  getOrganisationAssetPath,
  getPublicAssetUrl,
  LETTERHEAD_MAX_BYTES,
  LOGO_MAX_BYTES,
  ORGANISATION_ASSETS_BUCKET,
  type BrandingAssetKind,
} from '@/lib/storage/organisation-assets'
import type { ActionResult } from '@/app/actions/profile'

type BrandingUploadResult =
  | { success: true; url: string; message: string }
  | { success: false; error: string }

async function getAdminOrganisationId() {
  const supabase = await createClient()

  const {
    data: { user: authUser },
  } = await supabase.auth.getUser()

  if (!authUser) redirect('/login')

  const { data: profile } = await supabase
    .from('users')
    .select('organisation_id, role')
    .eq('id', authUser.id)
    .single()

  if (!profile) {
    return { error: 'User not found' as const }
  }

  if (profile.role !== 'admin') {
    return { error: 'Admin access required' as const }
  }

  return { supabase, organisationId: profile.organisation_id as string }
}

function validateBrandingFile(
  file: File,
  kind: BrandingAssetKind
): string | null {
  if (!file || file.size === 0) {
    return 'No file selected.'
  }

  if (!BRANDING_IMAGE_TYPES.includes(file.type as (typeof BRANDING_IMAGE_TYPES)[number])) {
    return 'Please upload a PNG, JPEG, WebP, or GIF image.'
  }

  const maxBytes = kind === 'logo' ? LOGO_MAX_BYTES : LETTERHEAD_MAX_BYTES
  if (file.size > maxBytes) {
    const maxMb = maxBytes / (1024 * 1024)
    return `File must be ${maxMb} MB or smaller.`
  }

  return null
}

async function uploadBrandingAsset(
  formData: FormData,
  kind: BrandingAssetKind
): Promise<BrandingUploadResult> {
  const auth = await getAdminOrganisationId()
  if ('error' in auth) {
    return { success: false, error: auth.error ?? 'Unauthorized' }
  }

  const file = formData.get('file')
  if (!(file instanceof File)) {
    return { success: false, error: 'No file selected.' }
  }

  const validationError = validateBrandingFile(file, kind)
  if (validationError) {
    return { success: false, error: validationError }
  }

  const extension = getExtensionFromMime(file.type)
  if (!extension) {
    return { success: false, error: 'Unsupported image type.' }
  }

  const { supabase, organisationId } = auth
  const path = getOrganisationAssetPath(organisationId, kind, extension)
  const buffer = Buffer.from(await file.arrayBuffer())

  const { error: uploadError } = await supabase.storage
    .from(ORGANISATION_ASSETS_BUCKET)
    .upload(path, buffer, {
      upsert: true,
      contentType: file.type,
      cacheControl: '3600',
    })

  if (uploadError) {
    return { success: false, error: uploadError.message }
  }

  const publicUrl = getPublicAssetUrl(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    `${path}?v=${Date.now()}`
  )

  const column = kind === 'logo' ? 'logo_url' : 'letterhead_url'
  const { error: updateError } = await supabase
    .from('organisations')
    .update({ [column]: publicUrl })
    .eq('id', organisationId)

  if (updateError) {
    return { success: false, error: updateError.message }
  }

  revalidatePath('/dashboard/settings/organisation')
  revalidatePath('/dashboard/templates/new')
  revalidatePath('/dashboard/templates')

  return {
    success: true,
    url: publicUrl,
    message: kind === 'logo' ? 'Logo uploaded successfully.' : 'Letterhead uploaded successfully.',
  }
}

export async function uploadOrganisationLogo(
  formData: FormData
): Promise<BrandingUploadResult> {
  return uploadBrandingAsset(formData, 'logo')
}

export async function uploadOrganisationLetterhead(
  formData: FormData
): Promise<BrandingUploadResult> {
  return uploadBrandingAsset(formData, 'letterhead')
}

export async function removeOrganisationLogo(): Promise<ActionResult> {
  const auth = await getAdminOrganisationId()
  if ('error' in auth) {
    return { success: false, error: auth.error ?? 'Unauthorized' }
  }

  const { supabase, organisationId } = auth
  const { error } = await supabase
    .from('organisations')
    .update({ logo_url: null })
    .eq('id', organisationId)

  if (error) {
    return { success: false, error: error.message }
  }

  revalidatePath('/dashboard/settings/organisation')
  revalidatePath('/dashboard/templates/new')
  revalidatePath('/dashboard/templates')

  return { success: true, message: 'Logo removed.' }
}

export async function removeOrganisationLetterhead(): Promise<ActionResult> {
  const auth = await getAdminOrganisationId()
  if ('error' in auth) {
    return { success: false, error: auth.error ?? 'Unauthorized' }
  }

  const { supabase, organisationId } = auth
  const { error } = await supabase
    .from('organisations')
    .update({ letterhead_url: null })
    .eq('id', organisationId)

  if (error) {
    return { success: false, error: error.message }
  }

  revalidatePath('/dashboard/settings/organisation')
  revalidatePath('/dashboard/templates/new')
  revalidatePath('/dashboard/templates')

  return { success: true, message: 'Letterhead removed.' }
}

export async function getOrganisationBrandingForOrg(
  organisationId: string
): Promise<{ logoUrl: string | null; letterheadUrl: string | null }> {
  const supabase = await createClient()

  const { data } = await supabase
    .from('organisations')
    .select('logo_url, letterhead_url')
    .eq('id', organisationId)
    .single()

  return {
    logoUrl: data?.logo_url ?? null,
    letterheadUrl: data?.letterhead_url ?? null,
  }
}
