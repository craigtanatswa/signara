export function DashboardPageBody({
  children,
}: {
  children: React.ReactNode
}) {
  return <div className="min-h-0 flex-1 overflow-y-auto p-6">{children}</div>
}
