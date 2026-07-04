'use client'

import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { Check, Loader2 } from 'lucide-react'
import { updateBrandTheme } from '@/app/actions/profile'
import { BRAND_THEME_IDS, BRAND_THEMES, type BrandTheme } from '@/lib/brand-themes'
import { cn } from '@/lib/utils'

interface BrandThemePickerProps {
  currentTheme: BrandTheme
}

export function BrandThemePicker({ currentTheme }: BrandThemePickerProps) {
  const router = useRouter()
  const [selected, setSelected] = useState<BrandTheme>(currentTheme)
  const [error, setError] = useState<string | null>(null)
  const [isPending, startTransition] = useTransition()

  function handleSelect(theme: BrandTheme) {
    if (theme === selected || isPending) return

    setError(null)
    setSelected(theme)

    startTransition(async () => {
      const result = await updateBrandTheme(theme)

      if (!result.success) {
        setSelected(currentTheme)
        setError(result.error)
        return
      }

      router.refresh()
    })
  }

  return (
    <div className="space-y-3">
      <div>
        <p className="text-signara-navy font-medium">Brand colour</p>
        <p className="mt-0.5 text-sm text-signara-steel">
          Choose the primary colour for your organisation&apos;s dashboard. Gold accents
          and other colours stay the same.
        </p>
      </div>

      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        {BRAND_THEME_IDS.map((themeId) => {
          const theme = BRAND_THEMES[themeId]
          const isSelected = selected === themeId

          return (
            <button
              key={themeId}
              type="button"
              disabled={isPending}
              onClick={() => handleSelect(themeId)}
              aria-pressed={isSelected}
              className={cn(
                'group relative flex flex-col overflow-hidden rounded-lg border-2 text-left transition-all',
                isSelected
                  ? 'border-signara-gold shadow-sm'
                  : 'border-signara-steel/30 hover:border-signara-navy/30'
              )}
            >
              {/* Mini preview */}
              <div className="flex h-16">
                <div
                  className="w-1/3 shrink-0"
                  style={{ backgroundColor: theme.hex }}
                  aria-hidden
                />
                <div className="flex flex-1 flex-col justify-center gap-1.5 bg-signara-background px-2.5">
                  <div
                    className="h-1.5 w-3/4 rounded-sm"
                    style={{ backgroundColor: theme.hex }}
                    aria-hidden
                  />
                  <div className="h-1 w-1/2 rounded-sm bg-signara-gold" aria-hidden />
                </div>
              </div>

              <div className="flex items-center justify-between border-t border-signara-steel/20 px-2.5 py-2">
                <span className="text-xs font-medium text-signara-navy">{theme.label}</span>
                {isSelected && (
                  <Check className="size-3.5 text-signara-gold" aria-hidden />
                )}
              </div>

              {isPending && isSelected && (
                <div className="absolute inset-0 flex items-center justify-center bg-white/60">
                  <Loader2 className="size-5 animate-spin text-signara-navy" />
                </div>
              )}
            </button>
          )
        })}
      </div>

      {error && (
        <p className="text-destructive text-sm">{error}</p>
      )}
    </div>
  )
}
