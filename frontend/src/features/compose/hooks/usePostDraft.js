import { useState } from 'react'

function htmlToPlain(raw) {
  if (!raw) return ''
  if (raw.includes('<p>') || raw.includes('<br')) {
    return raw
      .replace(/<br\s*\/?>/gi, '\n')
      .replace(/<\/p>\s*<p>/gi, '\n\n')
      .replace(/<[^>]+>/g, '')
      .trim()
  }
  return raw
}

export default function usePostDraft() {
  const [title, setTitle] = useState('')
  const [content, setContent] = useState('')
  const [plainText, setPlainText] = useState('')
  const [firstComment, setFirstComment] = useState('')
  const [showFirstComment, setShowFirstComment] = useState(false)
  const [postStatus, setPostStatus] = useState('draft')

  function onContentChange(html, text) {
    setContent(html)
    setPlainText(text)
  }

  function hydrateFromPost(post) {
    setTitle(post.title || '')
    setContent(post.content || '')
    setPlainText(htmlToPlain(post.content || ''))
    setPostStatus(post.status || 'draft')
    if (post.first_comment) {
      setFirstComment(post.first_comment)
      setShowFirstComment(true)
    }
  }

  return {
    title,
    setTitle,
    content,
    setContent,
    plainText,
    setPlainText,
    firstComment,
    setFirstComment,
    showFirstComment,
    setShowFirstComment,
    postStatus,
    setPostStatus,
    onContentChange,
    hydrateFromPost,
  }
}
