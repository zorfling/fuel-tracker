'use client';

export function FuelCardSkeleton() {
  return (
    <div className="flex items-center gap-3 rounded-2xl border bg-white p-4 dark:bg-slate-900 animate-pulse">
      {/* Brand logo placeholder */}
      <div className="h-10 w-10 rounded-full bg-slate-200 dark:bg-slate-700 flex-shrink-0" />
      <div className="flex-1 min-w-0">
        {/* Station name */}
        <div className="h-4 w-3/4 rounded bg-slate-200 dark:bg-slate-700 mb-2" />
        {/* Address */}
        <div className="h-3 w-1/2 rounded bg-slate-200 dark:bg-slate-700" />
      </div>
      <div className="text-right flex-shrink-0">
        {/* Price */}
        <div className="h-6 w-16 rounded bg-slate-200 dark:bg-slate-700 mb-1" />
        {/* Distance */}
        <div className="h-3 w-12 rounded bg-slate-200 dark:bg-slate-700" />
      </div>
    </div>
  );
}

export function FuelListSkeleton({ count = 8 }: { count?: number }) {
  return (
    <div className="flex flex-col gap-2">
      {/* Trend bar skeleton */}
      <div className="flex items-center gap-4 rounded-2xl border bg-white/80 px-4 py-3 dark:bg-slate-900/80 animate-pulse">
        <div className="h-4 w-20 rounded bg-slate-200 dark:bg-slate-700" />
        <div className="h-4 w-16 rounded bg-slate-200 dark:bg-slate-700" />
        <div className="h-4 w-16 rounded bg-slate-200 dark:bg-slate-700" />
      </div>
      {/* Card skeletons */}
      {Array.from({ length: count }).map((_, i) => (
        <FuelCardSkeleton key={i} />
      ))}
    </div>
  );
}
