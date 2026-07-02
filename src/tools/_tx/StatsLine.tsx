/**
 * StatsLine — compact input/output stats row.
 * Uses existing v4.0 tokens/classes only.
 */
interface StatsLineProps {
  stats: { label: string; value: string | number }[];
}

export function StatsLine({ stats }: StatsLineProps) {
  return (
    <div class="flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-fg-subtle">
      {stats.map((s, i) => (
        <span key={i}>
          {i > 0 && <span class="mr-4 text-fg-subtle">·</span>}
          <strong class="text-fg">{s.value}</strong> {s.label}
        </span>
      ))}
    </div>
  );
}
