import { cn } from '@/lib/utils'

interface ErrorMessageProps {
  children: React.ReactNode
  className?: string
}

export function ErrorMessage({ children, className }: ErrorMessageProps) {
  return (
    <div
      role="alert"
      className={cn('rounded-md border border-red-200 bg-red-50 px-4 py-3', className)}
    >
      <p className="text-sm text-red-900">{children}</p>
    </div>
  )
}
