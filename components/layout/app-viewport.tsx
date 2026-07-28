/**
 * Locks a route group to exactly one viewport so the app shell manages its own
 * internal scroll areas. Marketing routes deliberately opt out of this and use
 * normal document scroll.
 */
export function AppViewport({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex h-dvh min-h-0 flex-col overflow-hidden">{children}</div>
  )
}
