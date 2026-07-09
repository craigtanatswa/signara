export interface Plan {
  id: string
  name: string
  max_users: number | null
  max_documents: number | null
  price_usd: number | null
  created_at: string
}

import type { BrandTheme } from '@/lib/brand-themes'
import type { Workflow } from '@/types/workflow'
import type { JobLevel } from '@/types/org-structure'

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

export interface Department {
  id: string
  organisation_id: string
  name: string
  slug: string
  is_executive: boolean
  created_at: string
  updated_at: string
}

export interface User {
  id: string
  email: string
  full_name: string
  organisation_id: string
  role: 'admin' | 'member'
  avatar_url: string | null
  /** @deprecated Legacy free-text department — prefer department_id */
  department: string | null
  department_id: string | null
  job_level: JobLevel
  must_change_password: boolean
  created_at: string
  updated_at: string
}

export type UserWithDepartment = User & {
  departments?: Pick<Department, 'id' | 'name' | 'is_executive'> | null
  overseen_departments?: Pick<Department, 'id' | 'name'>[]
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

export type SignatureRole = 'initiator' | 'approver'

export interface FormFieldAttrs {
  fieldId: string
  fieldType: FieldType
  label: string
  required: boolean
  options: string[]
  configured?: boolean
  /** Only for signature fields — who fills this signature on a document instance. */
  signatureRole?: SignatureRole
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

/** Organisation templates are usable by any member; department templates only by that department. */
export type TemplateScope = 'organisation' | 'department'

export interface Template {
  id: string
  organisation_id: string
  name: string
  description: string | null
  content: TiptapDocument | null
  workflow: Workflow
  scope: TemplateScope
  department_id: string | null
  created_by: string
  version: number
  is_active: boolean
  created_at: string
  updated_at: string
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
  /** 'waiting' = a prior step hasn't been approved yet; only one step is 'pending' at a time. */
  status: 'waiting' | 'pending' | 'approved' | 'rejected' | 'skipped'
  signed_at: string | null
  signature_url: string | null
  /** Signature field in the template content this step's sign-off is tied to, if any. */
  signature_field_id: string | null
  /** The template workflow step this was resolved from, for provenance. */
  workflow_step_id: string | null
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
