interface SkeletonProps {
  className?: string;
}

export function Skeleton({ className = '' }: SkeletonProps) {
  return <span aria-hidden="true" className={`skeleton block overflow-hidden rounded-xl bg-slate-100 ${className}`} />;
}

export function PanelSkeleton({ rows = 3 }: { rows?: number }) {
  return (
    <div className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm sm:p-7" aria-hidden="true">
      <div className="flex items-center gap-3">
        <Skeleton className="h-11 w-11 shrink-0 rounded-2xl" />
        <div className="flex-1 space-y-2"><Skeleton className="h-4 w-2/5" /><Skeleton className="h-3 w-3/5" /></div>
      </div>
      <div className="mt-6 space-y-3">{Array.from({ length: rows }, (_, index) => <Skeleton key={index} className={`h-12 ${index === rows - 1 ? 'w-4/5' : 'w-full'}`} />)}</div>
    </div>
  );
}
