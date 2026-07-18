import type { ToolManifest } from "../../../lib/tool";

export const manifest: ToolManifest = {
  id: "index-coverage-reporter",
  name: "Index Coverage Reporter",
  description:
    "Audit URL indexability: classify each URL as indexable / canonicalized / noindex / robots_blocked / error_status / duplicate_canonical. Detect canonical chains, missing canonicals, duplicate canonical targets. Generate recommendations. CSV import/export, history, shareable URL. 100% client-side — paste CSV of URL metadata and get an instant coverage report.",
  category: "seo",
  keywords: [
    "index coverage", "indexability", "canonical",
    "noindex", "robots blocked", "duplicate canonical",
    "canonical chain", "index status", "seo audit",
  ],
  icon: "shield-check",
  requiresNetwork: false,
  seo: {
    title: "Index Coverage Reporter — Indexability, Canonical & Blocked URL Audit | UnQTools",
    faq: [
      {
        q: "What URL metadata does this tool need?",
        a: "A CSV with columns: url, canonical, noindex (yes/no), robots_blocked (yes/no), status_code. The canonical column can be empty (counts as missing canonical). Header row is optional and auto-detected. Each row is parsed and validated independently — malformed rows are reported as errors.",
      },
      {
        q: "How are URLs classified?",
        a: "Six outcomes: (1) indexable — no noindex, not robots-blocked, status 200, self-canonical. (2) canonicalized — canonical points to a different URL (still indexed, but signals consolidate). (3) noindex — has noindex directive. (4) robots_blocked — blocked by robots.txt. (5) error_status — status code not 2xx. (6) duplicate_canonical — multiple URLs canonicalized to the same target.",
      },
      {
        q: "Does this detect canonical chains and duplicates?",
        a: "Yes. Canonical chains (A→B, B→C) are detected by walking canonical pointers. Duplicate canonicals surface when two or more URLs canonicalize to the same target — these can waste crawl budget and should be reviewed. Missing canonicals (empty canonical field) are also flagged.",
      },
      {
        q: "What extra features does this tool have compared to others?",
        a: "(1) CSV parser with header auto-detection and field validation. (2) Six-way URL classification. (3) Canonical chain detection (A→B→C). (4) Duplicate canonical finder (multiple URLs → same target). (5) Missing canonical detector. (6) Self-canonical vs non-self-canonical counter. (7) Indexable URL list. (8) Blocked URL list (noindex + robots). (9) Text report rendering. (10) CSV export (url, classification, canonical_target). (11) Copy + Download .txt + Download CSV. (12) History (localStorage, last 20). (13) Shareable URL (encodes records in hash). (14) Filter by classification. (15) Summary stats (% indexable, % blocked). (16) Recommendation generator (e.g. 'Add canonical to URL X').",
      },
      {
        q: "Is my data sent anywhere?",
        a: "No. CSV parsing and classification happen entirely in your browser. History is stored in localStorage on this device only. URL metadata never leaves the page.",
      },
    ],
  },
  status: "done",
};
