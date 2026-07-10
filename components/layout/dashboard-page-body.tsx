import { cn } from '@/lib/utils'

export function DashboardPageBody({
  children,
  className,
}: {
  children: React.ReactNode
  className?: string
}) {
  return (
    <div className={cn('min-h-0 flex-1 overflow-y-auto p-6', className)}>{children}</div>
  )
}
