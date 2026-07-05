/**
 * ToolSkeleton — dimension-reserved placeholder for lazy-loaded tool UIs.
 * Prevents CLS when the Suspense fallback (empty) is replaced by the real tool UI.
 */
export function ToolSkeleton() {
  return (
    <div className="space-y-4" aria-busy="true" aria-label="Loading tool">
      {/* Options bar placeholder */}
      <div className="min-h-[80px] rounded-xl border bg-card animate-pulse" />
      {/* Input/output area placeholder */}
      <div className="min-h-[320px] rounded-xl border bg-card animate-pulse" />
      {/* Privacy note placeholder */}
      <div className="min-h-[40px] rounded-xl border bg-card animate-pulse" />
    </div>
  );
}
