/**
 * Meta Description A/B Tester — Tool Manifest
 */
import type { ToolManifest } from "../../../lib/tool";

export const manifest: ToolManifest = {
  id: "meta-description-ab-tester",
  name: "Meta Description A/B Tester",
  description:
    "Generate, score, and A/B/C compare meta descriptions side-by-side with pixel-accurate SERP preview, CTR-heuristic scoring, keyword bolding, and a bulk audit mode that flags missing / duplicate / over-length descriptions. 100% client-side.",
  category: "seo",
  keywords: ["meta description generator", "meta description length checker", "meta description tester", "ab test meta description", "ctr score"],
  icon: "FileText",
  requiresNetwork: false,
  seo: {
    title: "Meta Description Generator & A/B Tester — Pixel-Accurate + CTR Score | UnQTools",
    faq: [
      { q: "What is a good meta description length?", a: "Aim for 150–160 characters / ~920px desktop / ~990px mobile. Google truncates by pixel width, not character count — this tool shows both. Longer descriptions are not penalized but get cut." },
      { q: "How is the CTR score calculated?", a: "Our heuristic scores: keyword at front (+25), power words (+15), emotion words (+10), numbers/dates (+15), call-to-action (+15), length within ideal range (+10), uniqueness (+10). Max 100. This is a guidance score, not a click guarantee — Google often rewrites descriptions." },
      { q: "What extras does this tool include?", a: "Extras: (1) Pixel-accurate desktop + mobile preview, (2) A/B/C variant side-by-side, (3) CTR-heuristic scoring with breakdown, (4) Keyword bolding in preview, (5) Bulk audit mode flagging missing/duplicate/over-length, (6) Duplicate detection across variants, (7) On-device draft generator from pasted page content, (8) Power-word + emotion-word library, (9) CSV export of audit, (10) Copy optimized description, (11) Shareable preset, (12) Power-word highlights, (13) Length status badge (good/warn/bad)." },
      { q: "Does this fetch URLs?", a: "No. Bulk mode parses pasted text or HTML only — no network. You paste page URLs + descriptions and the tool audits them locally." },
    ],
  },
  status: "done",
};
