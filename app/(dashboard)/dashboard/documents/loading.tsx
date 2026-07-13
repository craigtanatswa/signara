import { Skeleton } from '@/components/ui/skeleton'

export default function DocumentsLoading() {
  return (
    <div className="space-y-6 p-6">
      <div className="flex items-center justify-between gap-4">
        <div className="space-y-2">
          <Skeleton className="h-7 w-40 bg-signara-steel/20" />
          <Skeleton className="h-4 w-64 bg-signara-steel/15" />
        </div>
        <Skeleton className="h-10 w-36 bg-signara-steel/20" />
      </div>

      <div className="space-y-3 rounded-lg border border-signara-steel/30 bg-white p-4 shadow-sm">
        <div className="flex flex-wrap gap-3">
          <Skeleton className="h-10 w-64 bg-signara-steel/15" />
          <Skeleton className="h-10 w-36 bg-signara-steel/15" />
          <Skeleton className="h-10 w-32 bg-signara-steel/15" />
          <Skeleton className="h-10 w-40 bg-signara-steel/15" />
        </div>
        <Skeleton className="h-5 w-48 bg-signara-steel/10" />
      </div>

      <div className="overflow-hidden rounded-lg border border-signara-steel/30 bg-white shadow-sm">
        <div className="border-b border-signara-steel/20 px-6 py-3">
          <Skeleton className="h-4 w-full max-w-md bg-signara-steel/15" />
        </div>
        {Array.from({ length: 6 }).map((_, i) => (
          <div
            key={i}
            className="flex items-center gap-4 border-b border-signara-steel/10 px-6 py-4 last:border-0"
          >
            <Skeleton className="h-4 w-48 bg-signara-steel/15" />
            <Skeleton className="h-4 w-32 bg-signara-steel/10" />
            <Skeleton className="h-5 w-24 bg-signara-steel/10" />
            <Skeleton className="h-4 w-28 bg-signara-steel/10" />
            <Skeleton className="ml-auto h-4 w-20 bg-signara-steel/10" />
          </div>
        ))}
      </div>
    </div>
  )
}
