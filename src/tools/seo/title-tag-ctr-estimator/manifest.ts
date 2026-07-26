/**
 * Title Tag Optimizer & CTR Estimator — Tool Manifest
 */
import type { ToolManifest } from "../../../lib/tool";

export const manifest: ToolManifest = {
  id: "title-tag-ctr-estimator",
  name: "Title Tag Optimizer & CTR Estimator",
  description:
    "Optimize title tags with pixel-accurate preview (desktop + mobile), keyword-position + brand-suffix + power-word checks, a title-quality score, and a position-aware CTR estimate based on published CTR curves. Includes bulk audit + A/B variants. 100% client-side.",
  category: "seo",
  keywords: ["title tag optimizer", "title tag length checker", "ctr estimator seo", "title tag tester", "title pixel width"],
  icon: "Tag",
  requiresNetwork: false,
  seo: {
    title: "Title Tag Optimizer & CTR Estimator — Pixel-Accurate + Position-Aware | UnQTools",
    faq: [
      { q: "What is the ideal title tag length?", a: "Aim for 50–60 characters / ~580px desktop / ~520px mobile. Google truncates by pixel width, not character count. This tool shows both so you can fit before truncation." },
      { q: "How is the CTR estimate calculated?", a: "We combine a title-quality score (keyword front-loading, power/emotion words, numbers, length, brand suffix) with a configurable position-CTR curve (Advanced Web Ranking-style). The output is a relative estimate — actual CTR varies by niche, intent, and SERP features." },
      { q: "What extras does this tool include?", a: "Extras: (1) Pixel-accurate desktop + mobile preview, (2) Real-time pixel-width meter, (3) Title-quality score with breakdown, (4) Position-aware CTR estimate (1–10), (5) A/B/C variant comparison, (6) Bulk audit (missing/duplicate/too-long), (7) Power-word + emotion-word library, (8) Brand-suffix builder (pipe vs em-dash), (9) Keyword-position check, (10) CSV export of audit, (11) Copy optimized title, (12) Shareable preset, (13) CTR curve slider, (14) Truncation flag." },
      { q: "Does Google always show my title?", a: "No. Google rewrites titles ~60% of the time (often using your <h1> or anchor text). This tool optimizes for the case where Google uses what you write — the quality score is still a useful signal even when rewrites happen." },
    ],
  },
  status: "done",
};
