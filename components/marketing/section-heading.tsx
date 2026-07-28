import { cn } from '@/lib/utils'
import { Reveal } from './reveal'

interface SectionHeadingProps {
  eyebrow: string
  title: React.ReactNode
  description?: string
  tone?: 'light' | 'dark'
  align?: 'left' | 'center'
}

export function SectionHeading({
  eyebrow,
  title,
  description,
  tone = 'light',
  align = 'left',
}: SectionHeadingProps) {
  const dark = tone === 'dark'

  return (
    <Reveal
      className={cn(
        'max-w-2xl',
        align === 'center' && 'mx-auto text-center'
      )}
    >
      <div
        className={cn(
          'flex items-center gap-3',
          align === 'center' && 'justify-center'
        )}
      >
        <span aria-hidden className="h-px w-8 bg-signara-gold" />
        <span
          className={cn(
            'text-xs font-semibold uppercase tracking-[0.28em]',
            dark ? 'text-signara-gold' : 'text-signara-navy/60'
          )}
        >
          {eyebrow}
        </span>
      </div>

      <h2
        className={cn(
          'mt-5 font-display text-3xl font-semibold leading-tight tracking-tight sm:text-4xl',
          dark ? 'text-white' : 'text-signara-navy'
        )}
      >
        {title}
      </h2>

      {description ? (
        <p
          className={cn(
            'mt-5 text-base leading-relaxed',
            dark ? 'text-white/70' : 'text-signara-navy/70'
          )}
        >
          {description}
        </p>
      ) : null}
    </Reveal>
  )
}
