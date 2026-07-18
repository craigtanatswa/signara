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
  /** Soft-archive completed/rejected docs older than this many months (default 12). */
  archive_policy_months?: number
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
  /** Optional job title shown when mentioning the user (e.g. "Human Resources Officer"). */
  position?: string | null
  organisation_id: string
  role: 'admin' | 'member'
  avatar_url: string | null
  /** @deprecated Legacy free-text department — prefer department_id */
  department: string | null
  department_id: string | null
  job_level: JobLevel
  must_change_password: boolean
  /** False when an admin has deactivated the account — blocks login. */
  is_active: boolean
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

/** How a template's body is authored. Defaults to tiptap when unset. */
export type TemplateType = 'tiptap' | 'uploaded_document'

/**
 * Field overlay on an uploaded PDF template.
 * Coordinates are percentages (0–1) relative to the page, top-left origin.
 * `page` is 0-indexed to match pdf-lib's `getPage()`.
 */
export interface FieldPosition {
  fieldId: string
  fieldType: FieldType
  label: string
  page: number
  x: number
  y: number
  width: number
  height: number
  required?: boolean
  options?: string[]
  signatureRole?: SignatureRole
}

export interface Template {
  id: string
  organisation_id: string
  name: string
  description: string | null
  content: TiptapDocument | null
  workflow: Workflow
  scope: TemplateScope
  /** Access restriction when scope is `department`; null for organisation-wide access. */
  department_id: string | null
  /**
   * Department names allowed to use this template. Null = everyone in the organisation.
   * Preferred over single `department_id` when multiple departments should have access.
   */
  allowed_departments?: string[] | null
  /**
   * Department whose archive completed documents from this template are filed under.
   * Null means organisation-wide (visible to anyone with archive access).
   * Independent of `scope` / `department_id` access control.
   */
  archive_department_id?: string | null
  created_by: string
  version: number
  is_active: boolean
  /** Present when Phase 2 Part 7 uploaded-document templates are enabled. */
  template_type?: TemplateType | null
  /** Original uploaded PDF URL (uploaded_document templates only). */
  source_file_url?: string | null
  /** Overlay field positions (uploaded_document templates only). */
  field_positions?: FieldPosition[] | null
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
  /** Index of the currently active step (legacy / sync column). */
  current_step?: number | null
  rejection_reason?: string | null
  /**
   * Storage path of the immutable final PDF in `document-attachments`
   * (e.g. `{orgId}/{documentId}/final.pdf`), set when the document completes.
   */
  final_pdf_url?: string | null
  /**
   * Storage path of the physically signed scan (print-and-sign), when completed
   * via physical upload. Same bucket as attachments.
   */
  physical_signature_url?: string | null
  /** True once the document is filed in the department archive. */
  archived?: boolean
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
  /** Last time a deadline reminder email was sent for this pending step. */
  last_reminder_sent_at?: string | null
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

// ─── Saved signatures ────────────────────────────────────────────────────────

export type SignatureCaptureMethod = 'draw' | 'type' | 'upload'

/** A reusable signature belonging to a user (draw, typed, or uploaded). */
export interface UserSignature {
  id: string
  user_id: string
  label: string
  method: SignatureCaptureMethod
  /** PNG data URL (`data:image/png;base64,...`). */
  image_data: string
  is_default: boolean
  created_at: string
  updated_at: string
}

// ─── Template requests ───────────────────────────────────────────────────────

export type TemplateRequestStatus = 'pending' | 'fulfilled' | 'dismissed'

/** A senior+ member asking an admin to digitise a physical form for their department. */
export interface TemplateRequest {
  id: string
  organisation_id: string
  requested_by: string
  department_id: string
  title: string
  description: string | null
  attachment_path: string
  attachment_filename: string
  status: TemplateRequestStatus
  admin_notes: string | null
  reviewed_by: string | null
  reviewed_at: string | null
  resulting_template_id: string | null
  created_at: string
  updated_at: string
}
