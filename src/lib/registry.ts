/**
 * Central tool registry. Auto-collects every tool's manifest.ts via Vite glob.
 * Adding a new tool is as simple as dropping a folder under src/tools/<cat>/<id>/
 * with a manifest.ts — routing, search, and the homepage grid pick it up automatically.
 */
import type { ToolCategory, ToolManifest } from "./tool";

const modules = import.meta.glob<{ manifest: ToolManifest }>("/src/tools/**/manifest.ts", {
  eager: true,
});

export const TOOLS: readonly ToolManifest[] = Object.values(modules)
  .map((m) => m.manifest)
  .filter(Boolean)
  .sort((a, b) => a.name.localeCompare(b.name));

export function byCategory(c: ToolCategory): ToolManifest[] {
  return TOOLS.filter((t) => t.category === c);
}

export function byId(id: string): ToolManifest | undefined {
  return TOOLS.find((t) => t.id === id);
}

export function countByCategory(): Record<ToolCategory, number> {
  const counts = {} as Record<ToolCategory, number>;
  for (const t of TOOLS) {
    counts[t.category] = (counts[t.category] ?? 0) + 1;
  }
  return counts;
}
