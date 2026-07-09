'use client'

import { useEffect, useState } from 'react'
import type { DepartmentOption } from '@/types/org-structure'

export function useDepartments() {
  const [departments, setDepartments] = useState<DepartmentOption[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    let cancelled = false

    fetch('/api/departments/list')
      .then((res) => res.json())
      .then((data) => {
        if (cancelled) return
        if (data.error) {
          setError(data.error)
          return
        }
        setDepartments(data.departments ?? [])
      })
      .catch(() => {
        if (!cancelled) setError('Could not load departments')
      })
      .finally(() => {
        if (!cancelled) setLoading(false)
      })

    return () => {
      cancelled = true
    }
  }, [])

  return { departments, loading, error }
}
