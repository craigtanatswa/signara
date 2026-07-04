export interface Plan {
  id: string
  name: string
  max_users: number | null
  max_documents: number | null
  price_usd: number | null
  created_at: string
}

import type { BrandTheme } from '@/lib/brand-themes'

export interface Organisation {
  id: string
  name: string
  logo_url: string | null
  letterhead_url: string | null
  letterhead_landscape_url: string | null
  brand_theme: BrandTheme
  plan_id: string | null
  trial_ends_at: string | null
  created_at: string
  updated_at: string
}

export type PageOrientation = 'portrait' | 'landscape'

export interface OrganisationBranding {
  logoUrl: string | null
  letterheadUrl: string | null
  letterheadLandscapeUrl: string | null
}

export interface User {
  id: string
  email: string
  full_name: string
  organisation_id: string
  role: 'admin' | 'member'
  avatar_url: string | null
  department: string | null
  must_change_password: boolean
  created_at: string
  updated_at: string
}

// ─── Tiptap document types ───────────────────────────────────────────────────

export type FieldType =
  | 'text'
  | 'number'
  | 'date'
  | 'dropdown'
  | 'checkbox'
  | 'file'
  | 'signature'

export interface FormFieldAttrs {
  fieldId: string
  fieldType: FieldType
  label: string
  required: boolean
  options: string[]
  configured?: boolean
}

export interface TiptapMark {
  type: string
  attrs?: Record<string, unknown>
}

export interface TiptapNode {
  type: string
  attrs?: Record<string, unknown>
  content?: TiptapNode[]
  marks?: TiptapMark[]
  text?: string
}

export interface TiptapDocument {
  type: 'doc'
  attrs?: {
    textColor?: string
    useOrganisationLogo?: boolean
    useOrganisationLetterhead?: boolean
    pageOrientation?: PageOrientation
  }
  content: TiptapNode[]
}

// ─── Template ────────────────────────────────────────────────────────────────

export interface Template {
  id: string
  organisation_id: string
  name: string
  description: string | null
  content: TiptapDocument | null
  workflow: WorkflowStep[]
  created_by: string
  version: number
  is_active: boolean
  created_at: string
  updated_at: string
}

export interface WorkflowStep {
  id: string
  label: string
  assignee_user_id: string | null
  order: number
}

export interface Document {
  id: string
  organisation_id: string
  template_id: string | null
  title: string
  status: 'draft' | 'in_progress' | 'completed' | 'rejected' | 'cancelled'
  initiated_by: string
  data: Record<string, unknown> | null
  completed_at: string | null
  created_at: string
  updated_at: string
}

export interface DocumentStep {
  id: string
  document_id: string
  step_order: number
  assignee_user_id: string
  status: 'pending' | 'approved' | 'rejected' | 'skipped'
  signed_at: string | null
  signature_url: string | null
  notes: string | null
  created_at: string
  updated_at: string
}

export interface Notification {
  id: string
  user_id: string
  document_id: string | null
  type: string
  title: string | null
  message: string
  read: boolean
  created_at: string
}
