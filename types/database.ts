export interface Plan {
  id: string
  name: string
  max_users: number | null
  max_documents: number | null
  price_usd: number | null
  created_at: string
}

export interface Organisation {
  id: string
  name: string
  logo_url: string | null
  plan_id: string | null
  trial_ends_at: string | null
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
  department: string | null
  must_change_password: boolean
  created_at: string
  updated_at: string
}

export interface Template {
  id: string
  organisation_id: string
  name: string
  description: string | null
  fields: Record<string, unknown> | null
  steps: Record<string, unknown>[] | null
  created_by: string
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
