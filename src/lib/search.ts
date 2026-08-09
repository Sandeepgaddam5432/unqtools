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
 * Intent synonyms — users describe tasks in everyday words ("make my PDF
 * smaller"), not tool names ("Compress PDF"). Expanding the query with these
 * synonyms makes intent searches find the right tool.
 */
const INTENT_SYNONYMS: Record<string, string[]> = {
  shrink: ["compress", "reduce", "smaller"],
  smaller: ["compress", "reduce", "shrink"],
  reduce: ["compress", "shrink", "minify"],
  compress: ["shrink", "reduce", "smaller"],
  make: ["create", "generate", "convert"],
  create: ["make", "generate", "builder"],
  turn: ["convert", "transform"],
  change: ["convert", "transform"],
  transform: ["convert"],
  join: ["merge", "combine"],
  combine: ["merge", "join"],
  protect: ["encrypt", "password", "secure", "lock"],
  lock: ["encrypt", "password", "protect"],
  unlock: ["decrypt", "remove password", "remove"],
  remove: ["delete", "strip", "erase"],
  delete: ["remove", "strip"],
  extract: ["pull", "get", "convert"],
  convert: ["transform", "to"],
  clean: ["format", "strip", "remove"],
  tidy: ["format", "beautify", "clean"],
  beautify: ["format", "prettify"],
  fix: ["repair", "validate", "check"],
  check: ["validate", "test", "verify"],
  verify: ["check", "validate"],
  generate: ["create", "make", "random"],
  random: ["generate"],
  split: ["divide", "separate"],
  crop: ["cut", "trim"],
  trim: ["cut", "remove"],
  edit: ["modify", "change"],
  resize: ["scale", "shrink", "enlarge"],
  scale: ["resize"],
  download: ["save", "get"],
  read: ["view", "open"],
  view: ["read", "open", "inspect"],
};

/** Stopwords that add no signal; dropped after synonym expansion. */
const STOPWORDS = new Set([
  "the", "and", "for", "with", "from", "into", "onto", "my", "your", "our",
  "its", "this", "that", "have", "has", "was", "are", "can", "could",
]);

/** Expand a query into search terms: original tokens + intent synonyms. */
export function expandQuery(query: string): string[] {
  const tokens = query.toLowerCase().split(/[^a-z0-9]+/).filter(Boolean);
  const terms = new Set<string>();
  for (const tok of tokens) {
    terms.add(tok);
    for (const syn of INTENT_SYNONYMS[tok] ?? []) {
      terms.add(syn);
    }
  }
  const out: string[] = [];
  for (const t of terms) {
    if (t.length < 3 || STOPWORDS.has(t)) continue;
    out.push(t);
  }
  return out;
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

  // Direct phrase match first; intent synonyms fill the gaps.
  const terms = expandQuery(q);

  const results: SearchResult[] = [];
  for (const tool of tools) {
    const fields = [tool.name, tool.description, tool.id, ...tool.keywords];
    let best = 0;
    for (const field of fields) {
      const s = scoreString(q, field);
      if (s > best) best = s;
    }
    // Synonym term matching (e.g. "shrink" → "compress")
    for (const field of fields) {
      for (const term of terms) {
        const s = scoreString(term, field);
        if (s > best) best = s;
      }
    }
    if (best > 0) {
      results.push({ tool, score: best });
    }
  }
  results.sort((a, b) => b.score - a.score || a.tool.name.localeCompare(b.tool.name));
  return results.slice(0, limit);
}
