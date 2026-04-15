import TipTapEditor from '@/components/TipTapEditor'
import { Input } from '@/components/ui/input'

export default function PostEditor({ title, setTitle, content, onContentChange }) {
  return (
    <>
      <Input
        type="text"
        placeholder="Post title (optional)"
        value={title}
        onChange={(e) => setTitle(e.target.value)}
        className="h-11 rounded-xl"
      />
      <TipTapEditor content={content} onChange={onContentChange} />
    </>
  )
}
