/**
 * Seed demo org + users for a fresh Signara Supabase project.
 *
 * Prerequisites:
 *   1. Run supabase/seed/fresh_project_bootstrap.sql in the SQL Editor
 *   2. .env.local points at the new project (URL + anon + service role)
 *
 * Usage:
 *   node scripts/seed-demo-users.mjs
 *
 * All demo accounts use password: SignaraDemo1!
 */

import { createClient } from '@supabase/supabase-js'
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import ws from 'ws'

const DEMO_PASSWORD = 'SignaraDemo1!'

function loadEnvLocal() {
  const path = resolve(process.cwd(), '.env.local')
  const raw = readFileSync(path, 'utf8')
  for (const line of raw.split(/\r?\n/)) {
    const trimmed = line.trim()
    if (!trimmed || trimmed.startsWith('#')) continue
    const eq = trimmed.indexOf('=')
    if (eq === -1) continue
    const key = trimmed.slice(0, eq)
    let value = trimmed.slice(eq + 1)
    if (
      (value.startsWith('"') && value.endsWith('"')) ||
      (value.startsWith("'") && value.endsWith("'"))
    ) {
      value = value.slice(1, -1)
    }
    if (!process.env[key]) process.env[key] = value
  }
}

loadEnvLocal()

const url = process.env.NEXT_PUBLIC_SUPABASE_URL
const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY

if (!url || !serviceKey) {
  console.error('Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY in .env.local')
  process.exit(1)
}

const admin = createClient(url, serviceKey, {
  auth: { autoRefreshToken: false, persistSession: false },
  // Node 20 has no native WebSocket; supabase-js realtime requires one.
  realtime: { transport: ws },
})

const DEMO_USERS = [
  {
    email: 'md@test.signara.local',
    full_name: 'Alex Managing Director',
    role: 'admin',
    job_level: 'managing_director',
    department_slug: 'executive',
    position: 'Managing Director',
  },
  {
    email: 'finance.director@test.signara.local',
    full_name: 'Blair Finance Director',
    role: 'member',
    job_level: 'director',
    department_slug: 'finance',
    position: 'Finance Director',
  },
  {
    email: 'hr.manager@test.signara.local',
    full_name: 'Casey HR Manager',
    role: 'member',
    job_level: 'manager',
    department_slug: 'human-resources',
    position: 'HR Manager',
  },
  {
    email: 'ops.supervisor@test.signara.local',
    full_name: 'Drew Ops Supervisor',
    role: 'member',
    job_level: 'supervisor',
    department_slug: 'operations',
    position: 'Operations Supervisor',
  },
  {
    email: 'finance.staff@test.signara.local',
    full_name: 'Eden Finance Staff',
    role: 'member',
    job_level: 'staff',
    department_slug: 'finance',
    position: 'Finance Officer',
  },
]

async function ensureAuthUser(email, password, fullName) {
  const { data: listed, error: listError } = await admin.auth.admin.listUsers({
    page: 1,
    perPage: 200,
  })
  if (listError) throw listError

  const existing = listed.users.find((u) => u.email?.toLowerCase() === email.toLowerCase())
  if (existing) {
    const { error: updateError } = await admin.auth.admin.updateUserById(existing.id, {
      password,
      email_confirm: true,
      user_metadata: { full_name: fullName },
    })
    if (updateError) throw updateError
    return existing.id
  }

  const { data, error } = await admin.auth.admin.createUser({
    email,
    password,
    email_confirm: true,
    user_metadata: { full_name: fullName },
  })
  if (error || !data.user) throw error ?? new Error(`Failed to create ${email}`)
  return data.user.id
}

async function main() {
  console.log(`Seeding demo data into ${url}`)

  // Organisation (reuse if already seeded)
  let orgId
  const { data: existingOrg } = await admin
    .from('organisations')
    .select('id')
    .eq('name', 'Acme Holdings Demo')
    .maybeSingle()

  if (existingOrg?.id) {
    orgId = existingOrg.id
    console.log('Reusing organisation', orgId)
  } else {
    const { data: org, error: orgError } = await admin
      .from('organisations')
      .insert({
        name: 'Acme Holdings Demo',
        plan_id: 'growth',
        subscription_status: 'active',
        trial_ends_at: null,
        payment_method: 'none',
        brand_theme: 'navy',
      })
      .select('id')
      .single()
    if (orgError || !org) throw orgError ?? new Error('Failed to create organisation')
    orgId = org.id
    console.log('Created organisation', orgId)
  }

  const departmentDefs = [
    { name: 'Executive', slug: 'executive', is_executive: true },
    { name: 'Finance', slug: 'finance', is_executive: false },
    { name: 'Human Resources', slug: 'human-resources', is_executive: false },
    { name: 'Operations', slug: 'operations', is_executive: false },
  ]

  const deptBySlug = {}
  for (const dept of departmentDefs) {
    const { data: existing } = await admin
      .from('departments')
      .select('id')
      .eq('organisation_id', orgId)
      .eq('slug', dept.slug)
      .maybeSingle()

    if (existing?.id) {
      deptBySlug[dept.slug] = existing.id
      continue
    }

    const { data, error } = await admin
      .from('departments')
      .insert({
        organisation_id: orgId,
        name: dept.name,
        slug: dept.slug,
        is_executive: dept.is_executive,
      })
      .select('id')
      .single()
    if (error || !data) throw error ?? new Error(`Failed to create department ${dept.slug}`)
    deptBySlug[dept.slug] = data.id
  }
  console.log('Departments ready')

  const userIds = {}
  for (const person of DEMO_USERS) {
    const authId = await ensureAuthUser(person.email, DEMO_PASSWORD, person.full_name)
    userIds[person.email] = authId

    const departmentId = deptBySlug[person.department_slug]
    const departmentName = departmentDefs.find((d) => d.slug === person.department_slug)?.name ?? null

    const { error: upsertError } = await admin.from('users').upsert(
      {
        id: authId,
        email: person.email,
        full_name: person.full_name,
        organisation_id: orgId,
        role: person.role,
        job_level: person.job_level,
        department_id: departmentId,
        department: departmentName,
        position: person.position,
        must_change_password: false,
        is_active: true,
      },
      { onConflict: 'id' }
    )
    if (upsertError) throw upsertError
    console.log(`  ✓ ${person.email} (${person.job_level})`)
  }

  // Optional: Finance Director also oversees Operations
  const financeDirectorId = userIds['finance.director@test.signara.local']
  const operationsId = deptBySlug.operations
  if (financeDirectorId && operationsId) {
    await admin.from('user_overseen_departments').upsert(
      {
        user_id: financeDirectorId,
        department_id: operationsId,
        organisation_id: orgId,
      },
      { onConflict: 'user_id,department_id' }
    )
  }

  // Sample leave-request template with HR → Finance workflow
  const mdId = userIds['md@test.signara.local']
  const hrDeptId = deptBySlug['human-resources']
  const sigInitiator = 'field-sig-initiator'
  const sigHr = 'field-sig-hr'
  const sigFinance = 'field-sig-finance'
  const stepHrId = 'step-hr'
  const stepFinanceId = 'step-finance'

  const content = {
    type: 'doc',
    content: [
      {
        type: 'heading',
        attrs: { level: 1 },
        content: [{ type: 'text', text: 'Leave Request' }],
      },
      {
        type: 'paragraph',
        content: [
          { type: 'text', text: 'Employee name: ' },
          {
            type: 'formField',
            attrs: {
              fieldId: 'field-employee-name',
              fieldType: 'text',
              label: 'Employee name',
              required: true,
              options: [],
              configured: true,
            },
          },
        ],
      },
      {
        type: 'paragraph',
        content: [
          { type: 'text', text: 'Leave dates: ' },
          {
            type: 'formField',
            attrs: {
              fieldId: 'field-leave-dates',
              fieldType: 'text',
              label: 'Leave dates',
              required: true,
              options: [],
              configured: true,
            },
          },
        ],
      },
      {
        type: 'paragraph',
        content: [
          { type: 'text', text: 'Initiator signature: ' },
          {
            type: 'formField',
            attrs: {
              fieldId: sigInitiator,
              fieldType: 'signature',
              label: 'Initiator signature',
              required: true,
              options: [],
              configured: true,
              signatureRole: 'initiator',
            },
          },
        ],
      },
      {
        type: 'paragraph',
        content: [
          { type: 'text', text: 'HR approval: ' },
          {
            type: 'formField',
            attrs: {
              fieldId: sigHr,
              fieldType: 'signature',
              label: 'HR approval',
              required: true,
              options: [],
              configured: true,
              signatureRole: 'approver',
            },
          },
        ],
      },
      {
        type: 'paragraph',
        content: [
          { type: 'text', text: 'Finance approval: ' },
          {
            type: 'formField',
            attrs: {
              fieldId: sigFinance,
              fieldType: 'signature',
              label: 'Finance approval',
              required: true,
              options: [],
              configured: true,
              signatureRole: 'approver',
            },
          },
        ],
      },
    ],
  }

  const workflow = {
    steps: [
      {
        id: stepHrId,
        stepIndex: 0,
        signatureFieldId: sigHr,
        minJobLevel: 'manager',
        departmentScope: 'fixed',
        assigneeDepartmentId: hrDeptId,
        authorityText: 'HR Manager review',
        deadlineHours: 48,
        allowDelegate: false,
      },
      {
        id: stepFinanceId,
        stepIndex: 1,
        signatureFieldId: sigFinance,
        minJobLevel: 'director',
        departmentScope: 'fixed',
        assigneeDepartmentId: deptBySlug.finance,
        authorityText: 'Finance Director sign-off',
        deadlineHours: 48,
        allowDelegate: false,
      },
    ],
  }

  const { data: existingTemplate } = await admin
    .from('templates')
    .select('id')
    .eq('organisation_id', orgId)
    .eq('name', 'Leave Request')
    .maybeSingle()

  if (existingTemplate?.id) {
    const { error } = await admin
      .from('templates')
      .update({
        content,
        workflow,
        is_active: true,
        scope: 'organisation',
        department_id: null,
        allowed_departments: null,
        archive_department_id: hrDeptId,
        updated_at: new Date().toISOString(),
      })
      .eq('id', existingTemplate.id)
    if (error) throw error
    console.log('Updated Leave Request template', existingTemplate.id)
  } else {
    const { data: template, error } = await admin
      .from('templates')
      .insert({
        organisation_id: orgId,
        name: 'Leave Request',
        description: 'Demo leave request with HR then Finance approval.',
        content,
        workflow,
        scope: 'organisation',
        department_id: null,
        allowed_departments: null,
        archive_department_id: hrDeptId,
        created_by: mdId,
        version: 1,
        is_active: true,
      })
      .select('id')
      .single()
    if (error || !template) throw error ?? new Error('Failed to create template')
    console.log('Created Leave Request template', template.id)
  }

  console.log('\nDemo logins (password for all: SignaraDemo1!)')
  console.log('─────────────────────────────────────────────')
  for (const person of DEMO_USERS) {
    console.log(`${person.email.padEnd(40)} ${person.role} / ${person.job_level}`)
  }
  console.log('\nSuggested smoke test:')
  console.log('  1. Login as finance.staff@test.signara.local → New Document → Leave Request')
  console.log('  2. Assign HR step to Casey, Finance step to Blair → submit')
  console.log('  3. Login as hr.manager@test.signara.local → approve')
  console.log('  4. Login as finance.director@test.signara.local → approve / complete')
  console.log('  5. Login as md@test.signara.local → Team, Templates, Billing, Branding')
}

main().catch((err) => {
  console.error(err)
  process.exit(1)
})
