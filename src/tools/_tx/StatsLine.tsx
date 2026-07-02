/**
 * StatsLine — compact input/output stats row.
 * Uses existing v4.0 tokens/classes only.
 */
interface StatsLineProps {
  stats: { label: string; value: string | number }[];
}

export function StatsLine({ stats }: StatsLineProps) {
  return (
    <div class="text-unq-text-3 flex flex-wrap items-center gap-x-4 gap-y-1 text-xs">
      {stats.map((s, i) => (
        <span key={i}>
          {i > 0 && <span class="text-unq-text-3 mr-4">·</span>}
          <strong class="text-unq-text">{s.value}</strong> {s.label}
        </span>
      ))}
    </div>
  );
}
