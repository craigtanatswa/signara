'use client'

import { useCallback, useEffect, useMemo, useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import dynamic from 'next/dynamic'
import { toast } from 'sonner'
import { Loader2, ArrowRight, Eye } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { Switch } from '@/components/ui/switch'
import { Label } from '@/components/ui/label'
import { BackLink } from '@/components/layout/back-link'
import { TemplateEditor } from './template-editor'
import { TemplateUnsavedDialog } from './template-unsaved-dialog'
import { createTemplate, updateTemplate } from '@/app/actions/templates'
import { getOrganisationBrandingForOrg } from '@/app/actions/organisation-branding'
import { useTemplateUnsavedGuard } from '@/hooks/use-template-unsaved-guard'
import {
  normalizeTemplateContent,
  validateTemplateFields,
  getTemplateTextColor,
  getTemplateUsesOrganisationLogo,
  getTemplateUsesOrganisationLetterhead,
  withTemplateBranding,
} from '@/lib/tiptap/field-utils'
import type { OrganisationBranding, Template, TiptapDocument } from '@/types/database'

interface TemplateEditClientProps {
  template?: Template | null
  mode: 'new' | 'edit'
  organisationId: string
  organisationBranding?: OrganisationBranding | null
}

interface TemplateSnapshotInput {
  name: string
  description: string
  isActive: boolean
  content: TiptapDocument | null
}

function buildSnapshot({
  name,
  description,
  isActive,
  content,
}: TemplateSnapshotInput): string {
  return JSON.stringify({
    name: name.trim(),
    description: description.trim(),
    isActive,
    content: JSON.stringify(normalizeTemplateContent(content)),
  })
}

export function TemplateEditClient({
  template,
  mode,
  organisationId,
  organisationBranding,
}: TemplateEditClientProps) {
  const router = useRouter()
  const [isPending, startTransition] = useTransition()

  const [name, setName] = useState(template?.name ?? '')
  const [description, setDescription] = useState(template?.description ?? '')
  const [isActive, setIsActive] = useState(template?.is_active ?? false)
  const [useOrganisationLogo, setUseOrganisationLogo] = useState(() =>
    getTemplateUsesOrganisationLogo(template?.content ?? null)
  )
  const [useOrganisationLetterhead, setUseOrganisationLetterhead] = useState(() =>
    getTemplateUsesOrganisationLetterhead(template?.content ?? null)
  )
  const [content, setContent] = useState<TiptapDocument | null>(() =>
    template?.content
      ? withTemplateBranding(template.content, {
          useOrganisationLogo: getTemplateUsesOrganisationLogo(template.content),
          useOrganisationLetterhead: getTemplateUsesOrganisationLetterhead(template.content),
        })
      : null
  )
  const [savedId, setSavedId] = useState<string | null>(template?.id ?? null)
  const [baselineSnapshot, setBaselineSnapshot] = useState(() =>
    buildSnapshot({
      name: template?.name ?? '',
      description: template?.description ?? '',
      isActive: template?.is_active ?? false,
      content: template?.content
        ? withTemplateBranding(template.content, {
            useOrganisationLogo: getTemplateUsesOrganisationLogo(template.content),
            useOrganisationLetterhead: getTemplateUsesOrganisationLetterhead(template.content),
          })
        : null,
    })
  )

  const [showPdfPreview, setShowPdfPreview] = useState(false)

  function handleContentChange(doc: TiptapDocument) {
    setContent(
      withTemplateBranding(doc, {
        useOrganisationLogo,
        useOrganisationLetterhead,
      })
    )
  }

  function handleUseOrganisationLogoChange(checked: boolean) {
    setUseOrganisationLogo(checked)
    setContent((current) =>
      withTemplateBranding(current, {
        useOrganisationLogo: checked,
        useOrganisationLetterhead,
      })
    )
  }

  function handleUseOrganisationLetterheadChange(checked: boolean) {
    setUseOrganisationLetterhead(checked)
    setContent((current) =>
      withTemplateBranding(current, {
        useOrganisationLogo,
        useOrganisationLetterhead: checked,
      })
    )
  }

  const currentSnapshot = useMemo(
    () => buildSnapshot({ name, description, isActive, content }),
    [name, description, isActive, content]
  )
  const isDirty = currentSnapshot !== baselineSnapshot
  const hasTitle = name.trim().length > 0

  const persistTemplate = useCallback(
    async (options: {
      asDraft: boolean
      validateFields: boolean
      redirectAfterCreate?: boolean
    }) => {
      const trimmedName = name.trim()

      if (!trimmedName) {
        toast.error('Enter a template title before saving.')
        return false
      }

      const normalizedContent = normalizeTemplateContent(
        withTemplateBranding(content, {
          useOrganisationLogo,
          useOrganisationLetterhead,
        })
      )

      if (options.validateFields) {
        const validationError = validateTemplateFields(normalizedContent)
        if (validationError) {
          toast.error(validationError)
          return false
        }
      }

      const payload = {
        name: trimmedName,
        description: description.trim() || null,
        content: normalizedContent,
        is_active: options.asDraft ? false : isActive,
      }

      const templateId = savedId ?? template?.id

      if (mode === 'new' && !templateId) {
        const result = await createTemplate(payload)
        if (result.error) {
          toast.error(`Failed to save: ${result.error}`)
          return false
        }

        setSavedId(result.id!)
        setBaselineSnapshot(
          buildSnapshot({
            name: payload.name,
            description: payload.description ?? '',
            isActive: payload.is_active,
            content: normalizedContent,
          })
        )

        if (options.redirectAfterCreate !== false) {
          router.replace(`/dashboard/templates/${result.id}/edit`)
        }

        return true
      }

      if (!templateId) {
        toast.error('Template not found. Please try saving again.')
        return false
      }

      const result = await updateTemplate(templateId, payload)
      if (result.error) {
        toast.error(`Failed to save: ${result.error}`)
        return false
      }

      setBaselineSnapshot(
        buildSnapshot({
          name: payload.name,
          description: payload.description ?? '',
          isActive: payload.is_active,
          content: normalizedContent,
        })
      )

      if (options.asDraft) {
        setIsActive(false)
      }

      return true
    },
    [
      content,
      isActive,
      mode,
      name,
      description,
      router,
      savedId,
      template,
      useOrganisationLogo,
      useOrganisationLetterhead,
    ]
  )

  const saveAsDraft = useCallback(async () => {
    const saved = await persistTemplate({
      asDraft: true,
      validateFields: false,
      redirectAfterCreate: false,
    })
    if (saved) {
      toast.success('Template saved as draft')
    }
    return saved
  }, [persistTemplate])

  const {
    leaveDialogOpen,
    isSavingDraft,
    handleSaveDraftAndLeave,
    handleDiscardAndLeave,
    handleCancelLeave,
  } = useTemplateUnsavedGuard({
    isDirty,
    onSaveDraft: saveAsDraft,
  })

  function handleSave() {
    startTransition(async () => {
      const saved = await persistTemplate({
        asDraft: false,
        validateFields: true,
        redirectAfterCreate: true,
      })
      if (saved) {
        toast.success('Template saved')
      }
    })
  }

  const templateId = savedId ?? template?.id

  return (
    <div className="flex flex-1 flex-col overflow-hidden">
      <div className="flex shrink-0 items-start justify-between gap-4 border-b border-signara-steel/20 bg-white px-6 py-4">
        <div className="min-w-0 flex-1 space-y-2">
          <BackLink href="/dashboard/templates" label="Back to templates" />
          <Input
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="Template name"
            required
            aria-required="true"
            className="h-[2.75rem] min-h-[2.75rem] border-0 bg-transparent px-3 py-2 text-xl font-bold leading-snug text-signara-navy shadow-none placeholder:font-normal placeholder:text-signara-steel focus-visible:ring-0"
          />
          <Textarea
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            placeholder="Short description (optional)"
            rows={1}
            className="h-[2.75rem] min-h-[2.75rem] resize-none overflow-y-auto border-0 bg-transparent px-3 py-2 text-lg font-normal leading-snug text-signara-navy shadow-none placeholder:text-signara-steel focus-visible:ring-0"
          />
        </div>

        <div className="flex shrink-0 items-center gap-3">
          <div className="flex items-center gap-2">
            <Label htmlFor="template-active" className="text-sm text-signara-steel cursor-pointer">
              {isActive ? 'Active' : 'Draft'}
            </Label>
            <Switch id="template-active" checked={isActive} onCheckedChange={setIsActive} />
          </div>

          <div className="flex items-center gap-2">
            <Label
              htmlFor="template-use-logo"
              className="cursor-pointer text-sm text-signara-steel"
              title={organisationBranding?.logoUrl ? undefined : 'Upload an organisation logo first'}
            >
              Include logo
            </Label>
            <Switch
              id="template-use-logo"
              checked={useOrganisationLogo && Boolean(organisationBranding?.logoUrl)}
              disabled={!organisationBranding?.logoUrl}
              onCheckedChange={handleUseOrganisationLogoChange}
            />
          </div>

          <div className="flex items-center gap-2">
            <Label
              htmlFor="template-use-letterhead"
              className="cursor-pointer text-sm text-signara-steel"
              title={
                organisationBranding?.letterheadUrl
                  ? undefined
                  : 'Upload an organisation letterhead first'
              }
            >
              Include letterhead
            </Label>
            <Switch
              id="template-use-letterhead"
              checked={useOrganisationLetterhead && Boolean(organisationBranding?.letterheadUrl)}
              disabled={!organisationBranding?.letterheadUrl}
              onCheckedChange={handleUseOrganisationLetterheadChange}
            />
          </div>

          {content && (
            <Button
              type="button"
              variant="outline"
              size="sm"
              className="gap-1.5 border-signara-steel/40 text-signara-navy hover:bg-signara-navy/5"
              onClick={() => setShowPdfPreview(true)}
            >
              <Eye className="size-3.5" />
              Preview PDF
            </Button>
          )}

          <Button
            onClick={handleSave}
            disabled={isPending || !hasTitle}
            className="bg-signara-gold text-signara-navy font-semibold hover:bg-[#C49B2E] disabled:opacity-50"
          >
            {isPending ? (
              <>
                <Loader2 className="mr-2 size-4 animate-spin" />
                Saving…
              </>
            ) : (
              'Save'
            )}
          </Button>

          {templateId && (
            <Button
              asChild
              variant="outline"
              size="sm"
              className="gap-1.5 border-signara-navy text-signara-navy hover:bg-signara-navy hover:text-white"
            >
              <Link href={`/dashboard/templates/${templateId}/workflow`}>
                Next: Build approval chain
                <ArrowRight className="size-3.5" />
              </Link>
            </Button>
          )}
        </div>
      </div>

      <div className="flex-1 overflow-y-auto bg-signara-background p-6">
        <div className="mx-auto max-w-[850px]">
          <TemplateEditor
            initialContent={content}
            defaultTextColor={getTemplateTextColor(content)}
            organisationBranding={organisationBranding}
            useOrganisationLogo={useOrganisationLogo}
            useOrganisationLetterhead={useOrganisationLetterhead}
            onChange={handleContentChange}
          />
        </div>
      </div>

      <TemplateUnsavedDialog
        open={leaveDialogOpen}
        isSaving={isSavingDraft}
        onSaveDraft={handleSaveDraftAndLeave}
        onDiscard={handleDiscardAndLeave}
        onCancel={handleCancelLeave}
      />

      {showPdfPreview && content && (
        <PdfPreviewModal
          content={content}
          name={name || 'Template preview'}
          organisationId={organisationId}
          organisationBranding={organisationBranding}
          onClose={() => setShowPdfPreview(false)}
        />
      )}
    </div>
  )
}

const TemplatePdfPreview = dynamic(
  () => import('@/lib/pdf/template-preview').then((m) => m.TemplatePdfPreview),
  {
    ssr: false,
    loading: () => (
      <div className="flex h-full items-center justify-center text-signara-steel">Loading PDF…</div>
    ),
  }
)

function PdfPreviewModal({
  content,
  name,
  organisationId,
  organisationBranding: initialBranding,
  onClose,
}: {
  content: TiptapDocument
  name: string
  organisationId: string
  organisationBranding?: OrganisationBranding | null
  onClose: () => void
}) {
  const [organisationBranding, setOrganisationBranding] = useState(initialBranding ?? null)

  useEffect(() => {
    let cancelled = false

    async function loadBranding() {
      const branding = await getOrganisationBrandingForOrg(organisationId)
      if (!cancelled) {
        setOrganisationBranding(branding)
      }
    }

    loadBranding()

    return () => {
      cancelled = true
    }
  }, [organisationId])

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/50"
      onClick={onClose}
    >
      <div
        className="relative flex h-[90vh] w-[80vw] flex-col overflow-hidden rounded-lg bg-white shadow-xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between border-b border-signara-steel/20 px-5 py-3">
          <p className="font-semibold text-signara-navy">{name} — PDF Preview</p>
          <Button variant="ghost" size="sm" onClick={onClose} className="text-signara-steel">
            Close
          </Button>
        </div>
        <div className="flex-1">
          <TemplatePdfPreview
            key={`${organisationBranding?.logoUrl ?? 'no-logo'}-${organisationBranding?.letterheadUrl ?? 'no-letterhead'}`}
            content={content}
            name={name}
            organisationBranding={organisationBranding}
          />
        </div>
      </div>
    </div>
  )
}
