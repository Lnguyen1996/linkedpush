import { useEditor, EditorContent } from '@tiptap/react'
import StarterKit from '@tiptap/starter-kit'
import Link from '@tiptap/extension-link'
import Placeholder from '@tiptap/extension-placeholder'
import CharacterCount from '@tiptap/extension-character-count'
import { Bold, Italic, List, ListOrdered, Link as LinkIcon, Undo, Redo } from 'lucide-react'
import { useState, useEffect } from 'react'

import { cn } from '@/lib/utils'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Separator } from '@/components/ui/separator'
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover'
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip'

const CHAR_LIMIT = 3000

function ToolbarButton({ onClick, active, children, tooltip }) {
  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <Button
          type="button"
          variant="ghost"
          size="sm"
          onClick={onClick}
          className={cn(
            'h-8 w-8 p-0',
            active && 'bg-primary/10 text-primary shadow-sm'
          )}
        >
          {children}
        </Button>
      </TooltipTrigger>
      <TooltipContent side="bottom" className="text-xs">
        {tooltip}
      </TooltipContent>
    </Tooltip>
  )
}

export default function TipTapEditor({ content, onChange, placeholder = 'Write your post...' }) {
  const [linkOpen, setLinkOpen] = useState(false)
  const [linkUrl, setLinkUrl] = useState('')

  const editor = useEditor({
    extensions: [
      StarterKit.configure({ link: false }),
      Link.configure({ openOnClick: false }),
      Placeholder.configure({ placeholder }),
      CharacterCount.configure({ limit: CHAR_LIMIT }),
    ],
    content: content || '',
    onUpdate: ({ editor }) => {
      onChange(editor.getHTML(), editor.getText({ blockSeparator: '\n\n' }))
    },
  })

  useEffect(() => {
    if (editor && content !== undefined && editor.getHTML() !== content) {
      editor.commands.setContent(content || '')
      // Defer onChange so editor processes setContent first
      requestAnimationFrame(() => {
        onChange(editor.getHTML(), editor.getText({ blockSeparator: '\n\n' }))
      })
    }
  }, [content])

  if (!editor) return null

  const charCount = editor.storage.characterCount.characters()
  const isNearLimit = charCount > CHAR_LIMIT * 0.9
  const isOverLimit = charCount >= CHAR_LIMIT
  const progress = Math.min((charCount / CHAR_LIMIT) * 100, 100)

  function toggleLink() {
    if (editor.isActive('link')) {
      editor.chain().focus().unsetLink().run()
      return
    }
    setLinkOpen((v) => !v)
    setLinkUrl('')
  }

  function applyLink() {
    if (linkUrl) {
      editor.chain().focus().extendMarkRange('link').setLink({ href: linkUrl }).run()
    }
    setLinkOpen(false)
    setLinkUrl('')
  }

  return (
    <TooltipProvider delayDuration={300}>
      <div className="border border-input rounded-xl overflow-hidden bg-card shadow-sm focus-within:ring-[3px] focus-within:ring-ring/20 focus-within:border-ring transition-all">
        {/* Toolbar */}
        <div className="flex items-center gap-0.5 px-2 py-1.5 border-b border-border">
          <ToolbarButton
            onClick={() => editor.chain().focus().toggleBold().run()}
            active={editor.isActive('bold')}
            tooltip="Bold (Cmd+B)"
          >
            <Bold size={15} />
          </ToolbarButton>
          <ToolbarButton
            onClick={() => editor.chain().focus().toggleItalic().run()}
            active={editor.isActive('italic')}
            tooltip="Italic (Cmd+I)"
          >
            <Italic size={15} />
          </ToolbarButton>

          <Separator orientation="vertical" className="mx-1 h-5" />

          <ToolbarButton
            onClick={() => editor.chain().focus().toggleBulletList().run()}
            active={editor.isActive('bulletList')}
            tooltip="Bullet List"
          >
            <List size={15} />
          </ToolbarButton>
          <ToolbarButton
            onClick={() => editor.chain().focus().toggleOrderedList().run()}
            active={editor.isActive('orderedList')}
            tooltip="Ordered List"
          >
            <ListOrdered size={15} />
          </ToolbarButton>

          <Separator orientation="vertical" className="mx-1 h-5" />

          {/* Link button with Popover */}
          <Popover open={linkOpen} onOpenChange={setLinkOpen}>
            <Tooltip>
              <TooltipTrigger asChild>
                <PopoverTrigger asChild>
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    onClick={toggleLink}
                    className={cn(
                      'h-8 w-8 p-0',
                      editor.isActive('link') && 'bg-primary/10 text-primary shadow-sm'
                    )}
                  >
                    <LinkIcon size={15} />
                  </Button>
                </PopoverTrigger>
              </TooltipTrigger>
              <TooltipContent side="bottom" className="text-xs">
                Link
              </TooltipContent>
            </Tooltip>
            <PopoverContent side="bottom" align="start" className="w-80 p-3">
              <div className="flex gap-2">
                <Input
                  type="url"
                  value={linkUrl}
                  onChange={(e) => setLinkUrl(e.target.value)}
                  placeholder="https://example.com"
                  className="flex-1 h-8 text-sm"
                  autoFocus
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') {
                      e.preventDefault()
                      applyLink()
                    }
                    if (e.key === 'Escape') {
                      setLinkOpen(false)
                      setLinkUrl('')
                    }
                  }}
                />
                <Button size="sm" onClick={applyLink}>
                  Add
                </Button>
              </div>
            </PopoverContent>
          </Popover>

          <div className="ml-auto flex items-center gap-0.5">
            <ToolbarButton
              onClick={() => editor.chain().focus().undo().run()}
              tooltip="Undo (Cmd+Z)"
            >
              <Undo size={15} />
            </ToolbarButton>
            <ToolbarButton
              onClick={() => editor.chain().focus().redo().run()}
              tooltip="Redo (Cmd+Shift+Z)"
            >
              <Redo size={15} />
            </ToolbarButton>
          </div>
        </div>

        {/* Editor */}
        <EditorContent
          editor={editor}
          className="prose prose-sm dark:prose-invert max-w-none px-4 py-3 min-h-[220px] focus-within:outline-none [&_.tiptap]:outline-none [&_.tiptap]:min-h-[200px] [&_.is-editor-empty:first-child::before]:text-muted-foreground/50 [&_.is-editor-empty:first-child::before]:content-[attr(data-placeholder)] [&_.is-editor-empty:first-child::before]:float-left [&_.is-editor-empty:first-child::before]:h-0 [&_.is-editor-empty:first-child::before]:pointer-events-none"
        />

        {/* Character count with progress bar */}
        <div className="border-t border-border">
          <div className="h-0.5 bg-muted">
            <div
              className={cn(
                'h-full transition-all duration-300',
                isOverLimit ? 'bg-destructive' : isNearLimit ? 'bg-amber-400 dark:bg-amber-500' : 'bg-primary/30'
              )}
              style={{ width: `${progress}%` }}
            />
          </div>
          <div className={cn(
            'px-4 py-2 text-xs text-right',
            isOverLimit ? 'text-destructive font-semibold' : isNearLimit ? 'text-amber-600 dark:text-amber-400 font-medium' : 'text-muted-foreground'
          )}>
            {charCount.toLocaleString()} / {CHAR_LIMIT.toLocaleString()}
          </div>
        </div>
      </div>
    </TooltipProvider>
  )
}
