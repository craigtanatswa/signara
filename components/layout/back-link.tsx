import Link from 'next/link'
import { ChevronLeft } from 'lucide-react'
import { cn } from '@/lib/utils'

interface BackLinkProps {
  href: string
  label: string
  className?: string
}

/** Use on nested dashboard pages to return to the parent section (e.g. edit → list). */
export function BackLink({ href, label, className }: BackLinkProps) {
  return (
    <Link
      href={href}
      className={cn(
        'inline-flex items-center gap-1.5 text-sm text-signara-steel transition-colors hover:text-signara-navy',
        className
      )}
    >
      <ChevronLeft className="size-4 shrink-0" />
      {label}
    </Link>
  )
}
