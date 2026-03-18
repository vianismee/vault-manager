import { Skeleton } from "@/components/ui/skeleton";

export function VaultListSkeleton() {
  return (
    <div className="divide-y divide-border/30">
      {Array.from({ length: 5 }).map((_, i) => (
        <VaultItemSkeleton key={i} />
      ))}
    </div>
  );
}

export function VaultItemSkeleton() {
  return (
    <div className="flex items-center gap-4 py-3.5 px-2">
      <Skeleton className="h-11 w-11 rounded-xl" />
      <div className="flex-1 space-y-2">
        <Skeleton className="h-5 w-32 rounded" />
        <Skeleton className="h-4 w-48 rounded" />
      </div>
    </div>
  );
}

export function VaultStatsSkeleton() {
  return (
    <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
      {Array.from({ length: 4 }).map((_, i) => (
        <div key={i} className="card-flat p-4 space-y-2">
          <Skeleton className="h-7 w-12 rounded" />
          <Skeleton className="h-4 w-20 rounded" />
        </div>
      ))}
    </div>
  );
}

export function VaultDetailSkeleton() {
  return (
    <div className="space-y-6 px-6 py-5">
      {/* Header */}
      <div className="flex items-center gap-4">
        <Skeleton className="h-14 w-14 rounded-2xl" />
        <div className="flex-1 space-y-2">
          <Skeleton className="h-6 w-48 rounded" />
          <Skeleton className="h-4 w-32 rounded" />
        </div>
      </div>

      {/* Credentials */}
      <div className="space-y-4">
        <div className="space-y-2">
          <Skeleton className="h-4 w-20 rounded" />
          <Skeleton className="h-11 w-full rounded-lg" />
        </div>
        <div className="space-y-2">
          <Skeleton className="h-4 w-20 rounded" />
          <Skeleton className="h-11 w-full rounded-lg" />
        </div>
      </div>
    </div>
  );
}

export function PasswordFormSkeleton() {
  return (
    <div className="space-y-5">
      {Array.from({ length: 6 }).map((_, i) => (
        <div key={i} className="space-y-2">
          <Skeleton className="h-5 w-24 rounded" />
          <Skeleton className="h-11 w-full rounded-lg" />
        </div>
      ))}
    </div>
  );
}
