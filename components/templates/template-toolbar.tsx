'use client'

import { useEditorState, type Editor } from '@tiptap/react'
import { useRef } from 'react'
import {
  Bold,
  Italic,
  Underline,
  Strikethrough,
  Heading1,
  Heading2,
  List,
  ListOrdered,
  AlignLeft,
  AlignCenter,
  AlignRight,
  AlignJustify,
  IndentDecrease,
  IndentIncrease,
  Highlighter,
  Minus,
  Plus,
  Table,
  Type,
  Hash,
  CalendarDays,
  ChevronDown,
  ToggleLeft,
  Paperclip,
  PenLine,
  Maximize2,
  Minimize2,
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Label } from '@/components/ui/label'
import { Switch } from '@/components/ui/switch'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { Separator } from '@/components/ui/separator'
import { cn } from '@/lib/utils'
import { DEFAULT_TEMPLATE_TEXT_COLOR } from '@/lib/tiptap/field-utils'
import { formatFontSizeLabel, TEMPLATE_FONT_SIZES_PT } from '@/lib/tiptap/font-size'
import type { FieldType, PageOrientation } from '@/types/database'

interface TemplateToolbarProps {
  editor: Editor
  defaultTextColor?: string
  useOrganisationLogo?: boolean
  useOrganisationLetterhead?: boolean
  logoAvailable?: boolean
  letterheadAvailable?: boolean
  pageOrientation?: PageOrientation
  onUseOrganisationLogoChange?: (checked: boolean) => void
  onUseOrganisationLetterheadChange?: (checked: boolean) => void
  isMaximized?: boolean
  onToggleMaximize?: () => void
}

interface ToolbarButtonProps {
  onClick: () => void
  active?: boolean
  disabled?: boolean
  title: string
  children: React.ReactNode
}

function ToolbarButton({ onClick, active, disabled, title, children }: ToolbarButtonProps) {
  return (
    <Button
      type="button"
      variant="ghost"
      size="sm"
      onMouseDown={(event) => event.preventDefault()}
      onClick={onClick}
      disabled={disabled}
      title={title}
      className={cn(
        'h-8 w-8 p-0 text-black hover:bg-signara-navy/10 hover:text-black',
        active && 'bg-signara-navy/10 text-black'
      )}
    >
      {children}
    </Button>
  )
}

const FIELD_TYPES: { type: FieldType; label: string; icon: React.ComponentType<{ className?: string }> }[] = [
  { type: 'text', label: 'Text', icon: Type },
  { type: 'number', label: 'Number', icon: Hash },
  { type: 'date', label: 'Date', icon: CalendarDays },
  { type: 'dropdown', label: 'Dropdown', icon: ChevronDown },
  { type: 'checkbox', label: 'Checkbox', icon: ToggleLeft },
  { type: 'file', label: 'File attachment', icon: Paperclip },
  { type: 'signature', label: 'Signature', icon: PenLine },
]

const FONT_FAMILIES = [
  { label: 'Default Font', value: '' },
  { label: 'Arial', value: 'Arial, sans-serif' },
  { label: 'Calibri', value: 'Calibri, Arial, sans-serif' },
  { label: 'Times New Roman', value: '"Times New Roman", serif' },
  { label: 'Georgia', value: 'Georgia, serif' },
  { label: 'Courier New', value: '"Courier New", monospace' },
]

const FONT_SIZES = TEMPLATE_FONT_SIZES_PT

export function TemplateToolbar({
  editor,
  defaultTextColor = DEFAULT_TEMPLATE_TEXT_COLOR,
  useOrganisationLogo = false,
  useOrganisationLetterhead = false,
  logoAvailable = false,
  letterheadAvailable = false,
  pageOrientation = 'portrait',
  onUseOrganisationLogoChange,
  onUseOrganisationLetterheadChange,
  isMaximized = false,
  onToggleMaximize,
}: TemplateToolbarProps) {
  const savedSelectionRef = useRef<{ from: number; to: number } | null>(null)
  const {
    selectionColor,
    highlightColor,
    fontFamily,
    fontSize,
    textAlign,
  } = useEditorState({
    editor,
    selector: ({ editor: ed }) => {
      const textStyleAttrs = ed.getAttributes('textStyle')
      const paragraphAttrs = ed.getAttributes('paragraph')
      const headingAttrs = ed.getAttributes('heading')
      const blockAttrs = Object.keys(paragraphAttrs).length ? paragraphAttrs : headingAttrs
      const inlineColor = textStyleAttrs.color as string | undefined
      const inlineHighlight = ed.getAttributes('highlight').color as string | undefined
      return {
        selectionColor: inlineColor ?? defaultTextColor,
        highlightColor: inlineHighlight ?? '#fff59d',
        fontFamily: (textStyleAttrs.fontFamily as string | undefined) ?? '',
        fontSize: (textStyleAttrs.fontSize as string | undefined) ?? '',
        textAlign: (blockAttrs.textAlign as string | undefined) ?? 'left',
      }
    },
  })

  function rememberSelection() {
    const { from, to } = editor.state.selection
    savedSelectionRef.current = { from, to }
  }

  function formattingChain() {
    const chain = editor.chain().focus()
    const savedSelection = savedSelectionRef.current

    if (savedSelection) {
      const maxPosition = editor.state.doc.content.size
      chain.setTextSelection({
        from: Math.min(savedSelection.from, maxPosition),
        to: Math.min(savedSelection.to, maxPosition),
      })
    }

    return chain
  }

  function insertTable() {
    editor
      .chain()
      .focus()
      .insertTable({ rows: 3, cols: 3, withHeaderRow: true })
      .run()
  }

  function insertField(fieldType: FieldType) {
    window.dispatchEvent(new CustomEvent('tiptap:close-field-popovers'))
    editor.chain().focus().insertFormField({ fieldType }).run()
  }

  function handleTextColorChange(color: string) {
    formattingChain().setColor(color).run()
  }

  function handleHighlightChange(color: string) {
    formattingChain().setHighlight({ color }).run()
  }

  function handleFontFamilyChange(value: string) {
    const chain = formattingChain()
    if (value) chain.setFontFamily(value).run()
    else chain.unsetFontFamily().run()
  }

  function handleFontSizeChange(value: string) {
    const chain = formattingChain()
    if (value) chain.setFontSize(value).run()
    else chain.unsetFontSize().run()
  }

  return (
    <div
      className={cn(
        'border border-signara-steel/30 bg-signara-background',
        isMaximized
          ? 'sticky top-0 z-10 shrink-0 rounded-none border-x-0 border-t-0 shadow-sm'
          : 'rounded-t-lg'
      )}
    >
      <div className="flex flex-wrap items-center gap-0.5 px-2 py-1.5">
      {/* Text formatting */}
      <ToolbarButton
        onClick={() => editor.chain().focus().toggleBold().run()}
        active={editor.isActive('bold')}
        title="Bold (Ctrl+B)"
      >
        <Bold className="size-3.5" />
      </ToolbarButton>
      <ToolbarButton
        onClick={() => editor.chain().focus().toggleItalic().run()}
        active={editor.isActive('italic')}
        title="Italic (Ctrl+I)"
      >
        <Italic className="size-3.5" />
      </ToolbarButton>
      <ToolbarButton
        onClick={() => editor.chain().focus().toggleUnderline().run()}
        active={editor.isActive('underline')}
        title="Underline (Ctrl+U)"
      >
        <Underline className="size-3.5" />
      </ToolbarButton>
      <ToolbarButton
        onClick={() => editor.chain().focus().toggleStrike().run()}
        active={editor.isActive('strike')}
        title="Strike-through"
      >
        <Strikethrough className="size-3.5" />
      </ToolbarButton>

      <Separator orientation="vertical" className="mx-1 h-5" />

      <label htmlFor="template-font-family" className="sr-only">
        Font family
      </label>
      <select
        id="template-font-family"
        value={fontFamily}
        onMouseDown={rememberSelection}
        onFocus={rememberSelection}
        onChange={(e) => handleFontFamilyChange(e.target.value)}
        className="h-8 rounded border border-signara-steel/40 bg-white px-2 text-xs text-signara-navy"
        title="Font family"
      >
        {FONT_FAMILIES.map((font) => (
          <option key={font.label} value={font.value}>
            {font.label}
          </option>
        ))}
      </select>

      <label htmlFor="template-font-size" className="sr-only">
        Font size
      </label>
      <select
        id="template-font-size"
        value={fontSize}
        onMouseDown={rememberSelection}
        onFocus={rememberSelection}
        onChange={(e) => handleFontSizeChange(e.target.value)}
        className="h-8 rounded border border-signara-steel/40 bg-white px-2 text-xs text-signara-navy"
        title="Font size"
      >
        <option value="" disabled hidden>
          Size
        </option>
        {FONT_SIZES.map((size) => (
          <option key={size} value={size}>
            {formatFontSizeLabel(size)}
          </option>
        ))}
      </select>

      <Separator orientation="vertical" className="mx-1 h-5" />

      <div
        className="flex items-center gap-1.5 px-1"
        title="Text colour"
      >
        <label htmlFor="template-text-color" className="sr-only">
          Text colour
        </label>
        <input
          id="template-text-color"
          type="color"
          value={selectionColor}
          onMouseDown={rememberSelection}
          onFocus={rememberSelection}
          onChange={(e) => handleTextColorChange(e.target.value)}
          className="size-7 cursor-pointer rounded border border-signara-steel/40 bg-white p-0.5"
        />
      </div>
      <div className="flex items-center gap-1.5 px-1" title="Highlight">
        <Highlighter className="size-3.5 text-signara-steel" />
        <label htmlFor="template-highlight-color" className="sr-only">
          Highlight colour
        </label>
        <input
          id="template-highlight-color"
          type="color"
          value={highlightColor}
          onMouseDown={rememberSelection}
          onFocus={rememberSelection}
          onChange={(e) => handleHighlightChange(e.target.value)}
          className="size-7 cursor-pointer rounded border border-signara-steel/40 bg-white p-0.5"
        />
      </div>

      <Separator orientation="vertical" className="mx-1 h-5" />

      {/* Headings */}
      <ToolbarButton
        onClick={() => editor.chain().focus().toggleHeading({ level: 1 }).run()}
        active={editor.isActive('heading', { level: 1 })}
        title="Heading 1"
      >
        <Heading1 className="size-3.5" />
      </ToolbarButton>
      <ToolbarButton
        onClick={() => editor.chain().focus().toggleHeading({ level: 2 }).run()}
        active={editor.isActive('heading', { level: 2 })}
        title="Heading 2"
      >
        <Heading2 className="size-3.5" />
      </ToolbarButton>

      <Separator orientation="vertical" className="mx-1 h-5" />

      {/* Alignment */}
      <ToolbarButton
        onClick={() => editor.chain().focus().setTextAlign('left').run()}
        active={textAlign === 'left'}
        title="Align left"
      >
        <AlignLeft className="size-3.5" />
      </ToolbarButton>
      <ToolbarButton
        onClick={() => editor.chain().focus().setTextAlign('center').run()}
        active={textAlign === 'center'}
        title="Align center"
      >
        <AlignCenter className="size-3.5" />
      </ToolbarButton>
      <ToolbarButton
        onClick={() => editor.chain().focus().setTextAlign('right').run()}
        active={textAlign === 'right'}
        title="Align right"
      >
        <AlignRight className="size-3.5" />
      </ToolbarButton>
      <ToolbarButton
        onClick={() => editor.chain().focus().setTextAlign('justify').run()}
        active={textAlign === 'justify'}
        title="Justify"
      >
        <AlignJustify className="size-3.5" />
      </ToolbarButton>

      <Separator orientation="vertical" className="mx-1 h-5" />

      {/* Lists */}
      <ToolbarButton
        onClick={() => editor.chain().focus().toggleBulletList().run()}
        active={editor.isActive('bulletList')}
        title="Bullet list"
      >
        <List className="size-3.5" />
      </ToolbarButton>
      <ToolbarButton
        onClick={() => editor.chain().focus().toggleOrderedList().run()}
        active={editor.isActive('orderedList')}
        title="Numbered list"
      >
        <ListOrdered className="size-3.5" />
      </ToolbarButton>
      <ToolbarButton
        onClick={() => editor.chain().focus().decreaseIndent().run()}
        title="Decrease indent (Shift+Tab)"
      >
        <IndentDecrease className="size-3.5" />
      </ToolbarButton>
      <ToolbarButton
        onClick={() => editor.chain().focus().increaseIndent().run()}
        title="Increase indent (Tab)"
      >
        <IndentIncrease className="size-3.5" />
      </ToolbarButton>

      <Separator orientation="vertical" className="mx-1 h-5" />

      {/* Table */}
      <ToolbarButton onClick={insertTable} title="Insert table">
        <Table className="size-3.5" />
      </ToolbarButton>

      {/* Divider */}
      <ToolbarButton
        onClick={() => editor.chain().focus().setHorizontalRule().run()}
        title="Horizontal divider"
      >
        <Minus className="size-3.5" />
      </ToolbarButton>

      <Separator orientation="vertical" className="mx-1 h-5" />

      {/* Branding */}
      <div
        className="flex items-center gap-3"
        onMouseDown={(event) => event.preventDefault()}
      >
        <div className="flex items-center gap-1.5">
          <Switch
            id="toolbar-use-logo"
            checked={useOrganisationLogo && logoAvailable}
            disabled={!logoAvailable || !onUseOrganisationLogoChange}
            onCheckedChange={onUseOrganisationLogoChange}
            className="scale-90"
            aria-label="Include organisation logo"
          />
          <Label
            htmlFor="toolbar-use-logo"
            className="cursor-pointer text-xs font-medium text-signara-navy"
            title={logoAvailable ? 'Include organisation logo' : 'Upload an organisation logo first'}
          >
            Logo
          </Label>
        </div>

        <div className="flex items-center gap-1.5">
          <Switch
            id="toolbar-use-letterhead"
            checked={useOrganisationLetterhead && letterheadAvailable}
            disabled={!letterheadAvailable || !onUseOrganisationLetterheadChange}
            onCheckedChange={onUseOrganisationLetterheadChange}
            className="scale-90"
            aria-label="Include organisation letterhead"
          />
          <Label
            htmlFor="toolbar-use-letterhead"
            className="cursor-pointer text-xs font-medium text-signara-navy"
            title={
              letterheadAvailable
                ? 'Include organisation letterhead'
                : pageOrientation === 'landscape'
                  ? 'Upload a landscape letterhead in Organisation settings first'
                  : 'Upload an organisation letterhead first'
            }
          >
            Letterhead
          </Label>
        </div>
      </div>

      <Separator orientation="vertical" className="mx-1 h-5" />

      {/* Insert field dropdown */}
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button
            type="button"
            variant="ghost"
            size="sm"
            className="h-8 gap-1.5 rounded-md border border-signara-navy px-2.5 text-xs font-medium text-signara-navy hover:bg-signara-navy/10"
          >
            <Plus className="size-3.5" />
            Insert field
            <ChevronDown className="size-3" />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="start" className="w-48">
          <div className="px-2 py-1.5">
            <p className="text-xs font-semibold text-signara-steel">Field type</p>
          </div>
          <DropdownMenuSeparator />
          {FIELD_TYPES.map(({ type, label, icon: Icon }) => (
            <DropdownMenuItem
              key={type}
              onSelect={() => insertField(type)}
              className="gap-2.5 text-sm"
            >
              <Icon className="size-3.5 text-signara-steel" />
              {label}
            </DropdownMenuItem>
          ))}
        </DropdownMenuContent>
      </DropdownMenu>
      </div>

      {onToggleMaximize && (
        <div className="flex items-center justify-end border-t border-signara-steel/20 px-2 py-1.5">
          <Button
            type="button"
            variant="ghost"
            size="sm"
            onClick={onToggleMaximize}
            className="h-8 gap-1.5 rounded-md border border-signara-steel/40 px-2.5 text-xs font-medium text-signara-navy hover:bg-signara-navy/10"
            title={isMaximized ? 'Exit full screen (Esc)' : 'Maximise editor'}
          >
            {isMaximized ? (
              <>
                <Minimize2 className="size-3.5" />
                Exit full screen
              </>
            ) : (
              <>
                <Maximize2 className="size-3.5" />
                Maximise
              </>
            )}
          </Button>
        </div>
      )}
    </div>
  )
}
