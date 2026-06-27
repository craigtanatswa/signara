'use client'

import { useCallback, useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'

interface UseTemplateUnsavedGuardOptions {
  isDirty: boolean
  onSaveDraft: () => Promise<boolean>
}

export function useTemplateUnsavedGuard({
  isDirty,
  onSaveDraft,
}: UseTemplateUnsavedGuardOptions) {
  const router = useRouter()
  const [leaveDialogOpen, setLeaveDialogOpen] = useState(false)
  const [pendingHref, setPendingHref] = useState<string | null>(null)
  const [isSavingDraft, setIsSavingDraft] = useState(false)

  const navigateAway = useCallback(
    (href: string | null) => {
      if (href) {
        router.push(href)
      } else {
        router.back()
      }
    },
    [router]
  )

  useEffect(() => {
    if (!isDirty) return

    const onBeforeUnload = (event: BeforeUnloadEvent) => {
      event.preventDefault()
      event.returnValue = ''
    }

    window.addEventListener('beforeunload', onBeforeUnload)
    return () => window.removeEventListener('beforeunload', onBeforeUnload)
  }, [isDirty])

  useEffect(() => {
    if (!isDirty) return

    const onClick = (event: MouseEvent) => {
      const anchor = (event.target as HTMLElement).closest('a[href]') as HTMLAnchorElement | null
      if (!anchor) return

      const href = anchor.getAttribute('href')
      if (!href || href.startsWith('#') || href.startsWith('mailto:') || href.startsWith('tel:')) {
        return
      }

      let url: URL
      try {
        url = new URL(anchor.href, window.location.origin)
      } catch {
        return
      }

      if (url.origin !== window.location.origin) return

      const current = window.location.pathname + window.location.search
      const target = url.pathname + url.search
      if (target === current) return

      event.preventDefault()
      event.stopPropagation()
      setPendingHref(target)
      setLeaveDialogOpen(true)
    }

    document.addEventListener('click', onClick, true)
    return () => document.removeEventListener('click', onClick, true)
  }, [isDirty])

  const handleSaveDraftAndLeave = useCallback(async () => {
    setIsSavingDraft(true)
    try {
      const saved = await onSaveDraft()
      if (saved) {
        setLeaveDialogOpen(false)
        navigateAway(pendingHref)
      }
    } finally {
      setIsSavingDraft(false)
    }
  }, [navigateAway, onSaveDraft, pendingHref])

  const handleDiscardAndLeave = useCallback(() => {
    setLeaveDialogOpen(false)
    navigateAway(pendingHref)
  }, [navigateAway, pendingHref])

  const handleCancelLeave = useCallback(() => {
    setLeaveDialogOpen(false)
    setPendingHref(null)
  }, [])

  return {
    leaveDialogOpen,
    isSavingDraft,
    handleSaveDraftAndLeave,
    handleDiscardAndLeave,
    handleCancelLeave,
  }
}
