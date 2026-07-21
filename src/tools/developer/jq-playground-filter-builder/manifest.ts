/**
 * jq Playground & Filter Builder — Tool Manifest.
 * Tool #324 — Category 4 (Developer & Code).
 *
 * A pure-JavaScript jq playground: paste JSON, type or build a jq
 * filter visually, see the transformed output instantly. Includes a
 * small in-browser jq interpreter (no WASM, no network) supporting
 * identity, field access, array iteration, select, map, sort, sort_by,
 * group_by, keys, values, length, to_entries, from_entries, pipe,
 * array/object constructors, arithmetic, comparisons, string
 * interpolation, recursive descent, unique, has, contains, first/last,
 * and limit. Plus a visual filter builder (select, map, sort, group),
 * per-step explanation, sample JSON, flag toggles (-c, -r, -s, -S),
 * shareable URL, and localStorage history. 100% client-side.
 */
import type { ToolManifest } from "../../../lib/tool";

export const manifest: ToolManifest = {
  id: "jq-playground-filter-builder",
  name: "jq Playground & Filter Builder",
  description:
    "A pure-JavaScript jq playground: paste JSON, type or build a jq filter visually, see the transformed output instantly. Built-in jq interpreter (no WASM, no network) supporting identity, field access, array iteration, select, map, sort, sort_by, group_by, keys, values, length, to_entries, from_entries, pipe, array/object constructors, arithmetic, comparisons, recursive descent, unique, has, contains, first/last, and limit. Visual filter builder (select fields, filter, map, sort, group), per-step plain-English explanation, sample JSON, flag toggles (-c, -r, -s, -S), shareable URL, history. 100% client-side.",
  category: "developer",
  keywords: [
    "jq playground", "jq online", "jq filter tester", "jqplay alternative",
    "jq examples", "learn jq", "jq offline", "jq filter builder",
    "jq visual", "json query", "json transformation", "json path",
  ],
  icon: "braces",
  requiresNetwork: false,
  seo: {
    title: "jq Playground & Filter Builder — Pure-JS jq, Visual Filter Builder | UnQTools",
    faq: [
      {
        q: "Is this a real jq engine?",
        a: "It's a small pure-JavaScript jq interpreter built from scratch — no WASM, no network. It supports the most common filters: identity (.), field access (.foo, .foo.bar, .[0]), array iteration (.[]), select(condition), map(expr), sort, sort_by(f), group_by(f), keys, values, length, to_entries, from_entries, pipe (|), array and object constructors, arithmetic (+ - * /), comparisons, string interpolation, recursive descent (..), unique, unique_by(f), has(key), contains, first/last, and limit(n; f). For filters outside this subset (e.g. def, @format, regex, try/catch), use the official play.jqlang.org which bundles the full jq WASM build.",
      },
      {
        q: "How does the visual filter builder work?",
        a: "Add steps in plain English: 'select field', 'filter where', 'map', 'sort by', 'group by', 'limit'. Each step has a small form (field name, condition, expression). As you add steps, the tool generates the equivalent jq filter string AND a plain-English explanation of what each step does. You can also edit the raw filter directly — the builder and the raw editor stay in sync when possible.",
      },
      {
        q: "What do the -c, -r, -s, -S flags do?",
        a: "-c (compact): produce compact output with no whitespace. -r (raw): if the result is a string, print it without quotes (useful for extracting text). -s (slurp): collect multiple JSON inputs into a single array before filtering (handy for NDJSON). -S (sort-keys): output object keys in sorted order. All flags are pure-JS, no external process.",
      },
      {
        q: "Can I test against NDJSON (one JSON object per line)?",
        a: "Yes. Toggle -s (slurp) and paste your NDJSON — each line is parsed and collected into an array. The filter then runs against that array. Invalid lines are reported with their line number.",
      },
      {
        q: "What extra features does this tool have versus jqplay?",
        a: "(1) Pure-JS jq interpreter — no WASM, instant load, works offline. (2) Visual filter builder with per-step plain-English explanation. (3) Flag toggles: -c, -r, -s, -S. (4) NDJSON slurp mode. (5) Per-step pipeline explanation. (6) Searchable recipe library (identity, .[], select, map, group_by, to_entries, del, string interpolation). (7) Sample JSON loader. (8) Distinct error surfaces for invalid JSON vs invalid filter. (9) Live debounced run. (10) Copy output. (11) localStorage history (max 20). (12) Shareable URL with embedded JSON + filter. 100% client-side — your JSON never leaves the device.",
      },
    ],
  },
  status: "done",
};
