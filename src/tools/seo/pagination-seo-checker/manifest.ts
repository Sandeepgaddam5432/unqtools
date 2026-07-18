import type { ToolManifest } from "../../../lib/tool";

export const manifest: ToolManifest = {
  id: "pagination-seo-checker",
  name: "Pagination SEO Checker",
  description:
    "Validate pagination SEO best practices — rel prev/next chain, canonical self-reference, status codes, sequence gaps, duplicate canonicals. Auto-detects 5 pagination URL patterns, categorizes issues by severity, generates recommendations, CSV export, history (localStorage), shareable URL. 100% client-side.",
  category: "seo",
  keywords: [
    "pagination", "rel next", "rel prev",
    "canonical", "paginated urls", "seo pagination",
    "page number", "sequence gap",
  ],
  icon: "list-ordered",
  requiresNetwork: false,
  seo: {
    title: "Pagination SEO Checker — rel prev/next + Canonical Validation | UnQTools",
    faq: [
      {
        q: "How does the pagination SEO checker work?",
        a: "Paste your paginated URLs (one per line, in order) and optionally a CSV of page metadata (url, rel_prev, rel_next, canonical, status_code). The tool auto-detects page numbers using 5 patterns, validates the rel prev/next chain, checks canonicals point to self (not page 1), validates status codes, and detects sequence gaps + duplicate canonicals.",
      },
      {
        q: "What URL patterns does the tool recognize?",
        a: "Five common pagination patterns: /page/N path segments, ?page=N query strings, ?p=N query strings, /p/N path segments, and ?pg=N query strings. Each URL is parsed to extract its page number for sequence validation.",
      },
      {
        q: "What issues does the tool flag?",
        a: "Critical: missing rel_prev/rel_next, broken chain (rel_prev points to wrong page), canonical pointing to page 1 instead of self, non-200 status. Warning: sequence gaps (1,2,4 — missing 3), duplicate canonicals (multiple URLs canonicalized to same URL). Info: missing optional metadata.",
      },
      {
        q: "What extra features does this tool have compared to others?",
        a: "(1) URL parsing with 5 auto page-number detection patterns. (2) Sequence gap detection. (3) rel prev/next chain validation. (4) Canonical validation (self vs page-1). (5) Status code validation. (6) Issue categorization (critical/warning/info). (7) Text report renderer. (8) CSV renderer (url, page_num, issues, severity). (9) Copy + Download .txt + Download CSV. (10) History (localStorage, last 20). (11) Shareable URL. (12) Filter by severity. (13) Summary stats (total URLs, total issues, by severity). (14) Recommendation generator (e.g. 'Add rel=next to page 1').",
      },
      {
        q: "Is my data sent anywhere?",
        a: "No. All URL parsing and validation runs locally in your browser. History is stored in localStorage on this device only.",
      },
    ],
  },
  status: "done",
};
