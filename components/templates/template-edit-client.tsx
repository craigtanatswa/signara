'use client'

import { useCallback, useMemo, useRef, useState, useTransition } from 'react'
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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { BackLink } from '@/components/layout/back-link'
import { TemplateEditor, type TemplateEditorHandle } from './template-editor'
import { TemplateOrientationDialog } from './template-orientation-dialog'
import { TemplateUnsavedDialog } from './template-unsaved-dialog'
import { createTemplate, updateTemplate } from '@/app/actions/templates'
import { useTemplateUnsavedGuard } from '@/hooks/use-template-unsaved-guard'
import {
  normalizeTemplateContent,
  validateTemplateFields,
  getTemplateTextColor,
  getTemplateUsesOrganisationLogo,
  getTemplateUsesOrganisationLetterhead,
  getTemplatePageOrientation,
  withTemplateBranding,
} from '@/lib/tiptap/field-utils'
import { hasLetterheadForOrientation } from '@/lib/tiptap/page-size'
import type { OrganisationBranding, PageOrientation, Template, TiptapDocument } from '@/types/database'

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
  organisationBranding,
}: TemplateEditClientProps) {
  const router = useRouter()
  const [isPending, startTransition] = useTransition()
  const editorRef = useRef<TemplateEditorHandle>(null)

  const [name, setName] = useState(template?.name ?? '')
  const [description, setDescription] = useState(template?.description ?? '')
  const [isActive, setIsActive] = useState(template?.is_active ?? false)
  const [useOrganisationLogo, setUseOrganisationLogo] = useState(() =>
    getTemplateUsesOrganisationLogo(template?.content ?? null)
  )
  const [useOrganisationLetterhead, setUseOrganisationLetterhead] = useState(() =>
    getTemplateUsesOrganisationLetterhead(template?.content ?? null)
  )
  const [pageOrientation, setPageOrientation] = useState<PageOrientation>(() =>
    getTemplatePageOrientation(template?.content ?? null)
  )
  const [content, setContent] = useState<TiptapDocument | null>(() =>
    template?.content
      ? withTemplateBranding(template.content, {
          useOrganisationLogo: getTemplateUsesOrganisationLogo(template.content),
          useOrganisationLetterhead: getTemplateUsesOrganisationLetterhead(template.content),
          pageOrientation: getTemplatePageOrientation(template.content),
        })
      : null
  )
  const [savedId, setSavedId] = useState<string | null>(template?.id ?? null)
  const [isContentDirty, setIsContentDirty] = useState(false)
  const [baselineSnapshot, setBaselineSnapshot] = useState(() =>
    buildSnapshot({
      name: template?.name ?? '',
      description: template?.description ?? '',
      isActive: template?.is_active ?? false,
      content: template?.content
        ? withTemplateBranding(template.content, {
            useOrganisationLogo: getTemplateUsesOrganisationLogo(template.content),
            useOrganisationLetterhead: getTemplateUsesOrganisationLetterhead(template.content),
            pageOrientation: getTemplatePageOrientation(template.content),
          })
        : null,
    })
  )

  const [showPdfPreview, setShowPdfPreview] = useState(false)
  const [previewContent, setPreviewContent] = useState<TiptapDocument | null>(null)
  const [orientationDialogOpen, setOrientationDialogOpen] = useState(false)
  const [pendingOrientation, setPendingOrientation] = useState<PageOrientation | null>(null)

  const letterheadAvailable = hasLetterheadForOrientation(
    organisationBranding,
    pageOrientation
  )

  function handleContentChange(doc: TiptapDocument) {
    setContent(
      withTemplateBranding(doc, {
        useOrganisationLogo,
        useOrganisationLetterhead,
        pageOrientation,
      })
    )
  }

  const getCurrentEditorContent = useCallback(
    () => editorRef.current?.getContent() ?? content,
    [content]
  )

  const getCurrentBrandedContent = useCallback(
    () =>
      withTemplateBranding(getCurrentEditorContent(), {
        useOrganisationLogo,
        useOrganisationLetterhead,
        pageOrientation,
      }),
    [getCurrentEditorContent, useOrganisationLogo, useOrganisationLetterhead, pageOrientation]
  )

  function handleUseOrganisationLogoChange(checked: boolean) {
    setUseOrganisationLogo(checked)
    setIsContentDirty(true)
    setContent((current) =>
      withTemplateBranding(current, {
        useOrganisationLogo: checked,
        useOrganisationLetterhead,
        pageOrientation,
      })
    )
  }

  function handleUseOrganisationLetterheadChange(checked: boolean) {
    setUseOrganisationLetterhead(checked)
    setIsContentDirty(true)
    setContent((current) =>
      withTemplateBranding(current, {
        useOrganisationLogo,
        useOrganisationLetterhead: checked,
        pageOrientation,
      })
    )
  }

  function applyPageOrientation(nextOrientation: PageOrientation) {
    setPageOrientation(nextOrientation)
    setIsContentDirty(true)

    const nextUseLetterhead = hasLetterheadForOrientation(organisationBranding, nextOrientation)
      ? useOrganisationLetterhead
      : false

    if (!nextUseLetterhead) {
      setUseOrganisationLetterhead(false)
    }

    setContent((current) =>
      withTemplateBranding(current, {
        useOrganisationLogo,
        useOrganisationLetterhead: nextUseLetterhead,
        pageOrientation: nextOrientation,
      })
    )
  }

  function handlePageOrientationChange(nextOrientation: PageOrientation) {
    if (nextOrientation === pageOrientation) return

    const hasContent =
      isContentDirty ||
      Boolean(content?.content?.some((node) => node.type !== 'paragraph' || node.content?.length))

    if (hasContent) {
      setPendingOrientation(nextOrientation)
      setOrientationDialogOpen(true)
      return
    }

    applyPageOrientation(nextOrientation)
  }

  function handleConfirmOrientationChange() {
    if (pendingOrientation) {
      applyPageOrientation(pendingOrientation)
    }
    setPendingOrientation(null)
    setOrientationDialogOpen(false)
  }

  function handleCancelOrientationChange() {
    setPendingOrientation(null)
    setOrientationDialogOpen(false)
  }

  const currentSnapshot = useMemo(
    () => buildSnapshot({ name, description, isActive, content }),
    [name, description, isActive, content]
  )
  const isDirty = isContentDirty || currentSnapshot !== baselineSnapshot
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

      const normalizedContent = normalizeTemplateContent(getCurrentBrandedContent())

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
        setContent(normalizedContent)
        setIsContentDirty(false)

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
      setContent(normalizedContent)
      setIsContentDirty(false)

      if (options.asDraft) {
        setIsActive(false)
      }

      return true
    },
    [
      getCurrentBrandedContent,
      isActive,
      mode,
      name,
      description,
      router,
      savedId,
      template,
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

  function handlePreview() {
    setPreviewContent(normalizeTemplateContent(getCurrentBrandedContent()))
    setShowPdfPreview(true)
  }

  const templateId = savedId ?? template?.id

  return (
    <div className="flex flex-1 flex-col overflow-hidden">
      <header className="shrink-0 border-b border-signara-steel/25 bg-white shadow-sm">
        <div className="border-b border-signara-steel/10 px-6 py-1">
          <BackLink href="/dashboard/templates" label="Back to templates" />
        </div>

        <div className="grid gap-4 px-6 pb-3 pt-1.5 lg:grid-cols-[minmax(0,1fr)_auto_auto] lg:items-start">
          {/* Template metadata */}
          <div className="min-w-0 space-y-3">
            <Input
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Template name"
              required
              aria-required="true"
              className="h-11 border-signara-steel/30 bg-white px-3 text-xl font-bold text-signara-navy shadow-none placeholder:font-normal placeholder:text-signara-steel focus-visible:border-signara-navy focus-visible:ring-2 focus-visible:ring-signara-navy/20"
            />
            <Textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Short description (optional)"
              rows={1}
              className="h-[2.75rem] min-h-[2.75rem] resize-none overflow-y-auto border-signara-steel/30 bg-white px-3 py-2 text-base text-signara-navy shadow-none placeholder:text-signara-steel focus-visible:border-signara-navy focus-visible:ring-2 focus-visible:ring-signara-navy/20"
            />
          </div>

          {/* Draft & orientation — two rows, same total height as name + description */}
          <div className="box-border min-w-[13rem] space-y-3 rounded-lg border border-signara-steel/25 bg-signara-background/60 px-3 py-0">
            <div className="flex h-11 items-center justify-between gap-4">
              <Label htmlFor="template-active" className="cursor-pointer text-sm font-medium text-signara-navy">
                {isActive ? 'Active' : 'Draft'}
              </Label>
              <Switch id="template-active" checked={isActive} onCheckedChange={setIsActive} />
            </div>

            <div className="flex h-[2.75rem] min-h-[2.75rem] items-center gap-2">
              <Label
                htmlFor="template-orientation"
                className="shrink-0 text-sm font-medium text-signara-navy"
              >
                Orientation
              </Label>
              <Select
                value={pageOrientation}
                onValueChange={(value) => handlePageOrientationChange(value as PageOrientation)}
              >
                <SelectTrigger
                  id="template-orientation"
                  className="h-9 min-w-0 flex-1 border-signara-steel/30 bg-white text-signara-navy"
                >
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="portrait">Portrait</SelectItem>
                  <SelectItem value="landscape">Landscape</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          {/* Primary actions — row heights match name + description */}
          <div className="flex min-w-[9.5rem] flex-col space-y-3 lg:border-l lg:border-signara-steel/20 lg:pl-4">
            <Button
              type="button"
              variant="outline"
              className="h-11 w-full gap-1.5 border-signara-navy text-signara-navy hover:bg-signara-navy hover:text-white"
              onClick={handlePreview}
            >
              <Eye className="size-4" />
              Preview PDF
            </Button>

            <Button
              onClick={handleSave}
              disabled={isPending || !hasTitle}
              className="h-[2.75rem] min-h-[2.75rem] w-full bg-signara-gold font-semibold text-signara-navy hover:bg-[#C49B2E] disabled:opacity-50"
            >
              {isPending ? (
                <>
                  <Loader2 className="mr-2 size-4 animate-spin" />
                  Saving…
                </>
              ) : (
                'Save template'
              )}
            </Button>

            {templateId && (
              <Button
                asChild
                variant="outline"
                className="h-8 w-full gap-1.5 border-signara-steel/40 text-xs text-signara-navy hover:bg-signara-navy/5"
              >
                <Link href={`/dashboard/templates/${templateId}/workflow`}>
                  Next: Build approval chain
                  <ArrowRight className="size-3.5" />
                </Link>
              </Button>
            )}
          </div>
        </div>
      </header>

      <div className="flex-1 overflow-y-auto border-t border-signara-steel/10 bg-signara-background p-6">
        <div
          className={`mx-auto ${pageOrientation === 'landscape' ? 'max-w-[1200px]' : 'max-w-[850px]'}`}
        >
          <TemplateEditor
            ref={editorRef}
            initialContent={content}
            defaultTextColor={getTemplateTextColor(content)}
            organisationBranding={organisationBranding}
            useOrganisationLogo={useOrganisationLogo}
            useOrganisationLetterhead={useOrganisationLetterhead}
            pageOrientation={pageOrientation}
            onUseOrganisationLogoChange={handleUseOrganisationLogoChange}
            onUseOrganisationLetterheadChange={handleUseOrganisationLetterheadChange}
            onChange={handleContentChange}
            onDirty={() => setIsContentDirty(true)}
          />
        </div>
      </div>

      <TemplateOrientationDialog
        open={orientationDialogOpen}
        currentOrientation={pageOrientation}
        nextOrientation={pendingOrientation}
        onConfirm={handleConfirmOrientationChange}
        onCancel={handleCancelOrientationChange}
      />

      <TemplateUnsavedDialog
        open={leaveDialogOpen}
        isSaving={isSavingDraft}
        onSaveDraft={handleSaveDraftAndLeave}
        onDiscard={handleDiscardAndLeave}
        onCancel={handleCancelLeave}
      />

      {showPdfPreview && previewContent && (
        <PdfPreviewModal
          content={previewContent}
          name={name || 'Template preview'}
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
  organisationBranding: initialBranding,
  onClose,
}: {
  content: TiptapDocument
  name: string
  organisationBranding?: OrganisationBranding | null
  onClose: () => void
}) {
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
            key={`${getTemplatePageOrientation(content)}-${initialBranding?.logoUrl ?? 'no-logo'}-${initialBranding?.letterheadUrl ?? 'no-letterhead'}-${initialBranding?.letterheadLandscapeUrl ?? 'no-landscape-letterhead'}`}
            content={content}
            name={name}
            organisationBranding={initialBranding ?? null}
          />
        </div>
      </div>
    </div>
  )
}
