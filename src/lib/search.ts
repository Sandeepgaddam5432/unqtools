/**
 * Client-side fuzzy search over the tool registry.
 * Pure functions; safe to unit-test and to run in a worker.
 *
 * Strategy: subsequence match with scoring (consecutive matches score higher,
 * earlier matches score higher). Tiny (no deps) — stays well under budget.
 */
import type { CatalogItem } from "./catalog";

export interface SearchResult {
  tool: CatalogItem;
  score: number;
}

/**
 * Score a single string against a query using subsequence matching.
 * Returns 0 if the query is not a subsequence of the candidate.
 */
export function scoreString(query: string, candidate: string): number {
  if (!query) return 1;
  const q = query.toLowerCase();
  const c = candidate.toLowerCase();

  // Exact / prefix / word-boundary boosts
  if (c === q) return 1000;
  if (c.startsWith(q)) return 500;
  if (c.includes(q)) return 250;

  // Subsequence match with consecutive-match bonus
  let qi = 0;
  let score = 0;
  let lastMatchIdx = -2;
  for (let ci = 0; ci < c.length && qi < q.length; ci++) {
    if (c[ci] === q[qi]) {
      score += 10;
      if (ci === lastMatchIdx + 1) score += 15; // consecutive bonus
      lastMatchIdx = ci;
      qi++;
    }
  }
  return qi === q.length ? score + (100 - c.length) : 0;
}

/**
 * Search the registry. Returns tools ranked by score, descending.
 * Empty query returns all tools (in registry order).
 */
export function searchTools(
  query: string,
  tools: readonly CatalogItem[],
  limit = 50,
): SearchResult[] {
  const q = query.trim();
  if (!q) return tools.map((tool) => ({ tool, score: 1 })).slice(0, limit);

  const results: SearchResult[] = [];
  for (const tool of tools) {
    const fields = [tool.name, tool.description, tool.id, ...tool.keywords];
    let best = 0;
    for (const field of fields) {
      const s = scoreString(q, field);
      if (s > best) best = s;
    }
    if (best > 0) {
      results.push({ tool, score: best });
    }
  }
  results.sort((a, b) => b.score - a.score || a.tool.name.localeCompare(b.tool.name));
  return results.slice(0, limit);
}
