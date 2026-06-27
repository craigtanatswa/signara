'use client'

import type { Editor } from '@tiptap/react'
import {
  Bold,
  Italic,
  Heading1,
  Heading2,
  List,
  ListOrdered,
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
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { Separator } from '@/components/ui/separator'
import { cn } from '@/lib/utils'
import type { FieldType } from '@/types/database'

interface TemplateToolbarProps {
  editor: Editor
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

export function TemplateToolbar({ editor }: TemplateToolbarProps) {
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

  return (
    <div className="flex flex-wrap items-center gap-0.5 rounded-t-lg border border-signara-steel/30 bg-signara-background px-2 py-1.5">
      {/* Text formatting */}
      <ToolbarButton
        onClick={() => editor.chain().focus().toggleBold().run()}
        active={editor.isActive('bold')}
        title="Bold"
      >
        <Bold className="size-3.5" />
      </ToolbarButton>
      <ToolbarButton
        onClick={() => editor.chain().focus().toggleItalic().run()}
        active={editor.isActive('italic')}
        title="Italic"
      >
        <Italic className="size-3.5" />
      </ToolbarButton>

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

      {/* Insert field dropdown */}
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button
            type="button"
            variant="ghost"
            size="sm"
            className="h-8 gap-1.5 px-2.5 text-xs font-medium text-signara-navy hover:bg-signara-navy/10"
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
  )
}
