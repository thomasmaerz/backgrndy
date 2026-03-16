export default function Loading() {
  return (
    <div className="flex h-full p-8 gap-8">
      {/* Sidebar skeleton */}
      <div className="w-80 bg-bg-surface border-r border-bg-border rounded-xl p-4 space-y-4">
        <div className="h-6 w-32 bg-bg-border rounded animate-pulse" />
        <div className="space-y-2">
          {[1, 2, 3].map((i) => (
            <div key={i} className="h-20 bg-bg-border rounded-lg animate-pulse" />
          ))}
        </div>
      </div>

      {/* Main content skeleton */}
      <div className="flex-1 space-y-4">
        <div className="h-32 bg-bg-surface border border-bg-border rounded-xl animate-pulse" />
        <div className="h-64 bg-bg-surface border border-bg-border rounded-xl animate-pulse" />
        <div className="h-16 bg-bg-surface border border-bg-border rounded-xl animate-pulse" />
      </div>
    </div>
  )
}
