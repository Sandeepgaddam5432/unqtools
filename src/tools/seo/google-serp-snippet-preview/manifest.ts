/**
 * Google SERP Snippet Preview — Tool Manifest
 */
import type { ToolManifest } from "../../../lib/tool";

export const manifest: ToolManifest = {
  id: "google-serp-snippet-preview",
  name: "Google SERP Snippet Preview",
  description:
    "Pixel-accurate preview of how your title, URL, and meta description will appear in Google search — desktop + mobile, with truncation warnings, rich elements (favicon, breadcrumb, date, rating, sitelinks, FAQ), and query keyword bolding. 100% client-side.",
  category: "seo",
  keywords: ["serp preview", "google serp simulator", "snippet preview tool", "title meta preview", "serp snippet"],
  icon: "Search",
  requiresNetwork: false,
  seo: {
    title: "Google SERP Snippet Preview — Pixel-Accurate Title & Meta Tester | UnQTools",
    faq: [
      { q: "How is this SERP preview pixel-accurate?", a: "We approximate Google's Arial/Roboto font metrics using a weighted per-character width model and apply Google's current truncation thresholds: title ~580px desktop / ~520px mobile, description ~990px mobile / ~920px desktop. The tool flags truncation before it happens so you can rewrite." },
      { q: "What extras does this tool include?", a: "Extras: (1) Desktop + mobile side-by-side, (2) Real-time pixel-width meter for title and description, (3) Query keyword bolding simulation, (4) Favicon + breadcrumb path, (5) Article date prefix, (6) Star-rating rich result, (7) Sitelinks block, (8) FAQ rich result, (9) Dark-mode SERP, (10) Multiple stacked results, (11) Import existing title/meta tags from pasted HTML, (12) Copy optimized title/description, (13) Shareable preset, (14) Truncation version dated." },
      { q: "Does Google always show what I write?", a: "No. Google frequently rewrites titles (often using your h1 or anchor text) and may generate descriptions from page content. This tool is a best-effort preview of what *should* appear, not a guarantee. Truncation thresholds also shift over time — we version them." },
    ],
  },
  status: "done",
};
