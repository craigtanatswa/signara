import type { Workflow } from '@/types/workflow'

export interface OnboardingProgressItem {
  id: string
  label: string
  href: string
  description: string
  complete: boolean
}

export function buildOnboardingItems(input: {
  userCount: number
  templateCount: number
  hasWorkflow: boolean
  lifetimeDocCount: number
  hasLogo: boolean
}): OnboardingProgressItem[] {
  return [
    {
      id: 'invite',
      label: 'Invite your team',
      href: '/dashboard/team',
      description: 'Add colleagues so they can request and approve documents.',
      complete: input.userCount > 1,
    },
    {
      id: 'template',
      label: 'Create your first template',
      href: '/dashboard/templates',
      description: 'Templates are reusable document layouts for your organisation.',
      complete: input.templateCount > 0,
    },
    {
      id: 'workflow',
      label: 'Set up an approval chain',
      href: '/dashboard/templates',
      description: 'Define who must review and sign each template.',
      complete: input.hasWorkflow,
    },
    {
      id: 'document',
      label: 'Send your first document',
      href: '/dashboard/documents/new',
      description: 'Start a document from a template and send it for approval.',
      complete: input.lifetimeDocCount > 0,
    },
    {
      id: 'logo',
      label: 'Add your organisation logo',
      href: '/dashboard/settings/organisation',
      description: 'Brand your documents with your organisation logo.',
      complete: input.hasLogo,
    },
  ]
}

export function templateHasWorkflow(workflow: Workflow | null | undefined): boolean {
  return (workflow?.steps?.length ?? 0) > 0
}
