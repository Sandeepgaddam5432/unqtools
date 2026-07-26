/**
 * Keyword Density Analyzer — Tool Manifest
 */
import type { ToolManifest } from "../../../lib/tool";

export const manifest: ToolManifest = {
  id: "keyword-density-analyzer",
  name: "Keyword Density Analyzer",
  description:
    "Analyze pasted text or HTML for word and n-gram (1/2/3-word) frequency and density, with configurable stop-word lists, stemming, position weighting (title/H1/H2/body/anchor), and over-optimization flags — not magic % targets. 100% client-side.",
  category: "seo",
  keywords: ["keyword density checker", "keyword density analyzer", "word frequency counter", "n-gram analyzer", "keyword stuffing"],
  icon: "Type",
  requiresNetwork: false,
  seo: {
    title: "Keyword Density Analyzer — N-gram, Stemming, No Stuffing Myths | UnQTools",
    faq: [
      { q: "What is the ideal keyword density?", a: "There is no ideal percentage. Google rewards relevance, not ratios. This tool flags potential stuffing (e.g., density above ~3–4% on a single term) but never prescribes a magic number. Aim for natural usage with related terms and synonyms." },
      { q: "How is density calculated?", a: "Density = (term count / total non-stop-word tokens) × 100. For n-grams, the denominator is total n-gram slots. We use Intl.Segmenter where available (CJK-friendly) and fall back to whitespace tokenization." },
      { q: "What extras does this tool include?", a: "Extras: (1) 1/2/3-gram frequency tables with count + density %, (2) Stop-word toggle + language presets (en/es/fr/de/it), (3) Porter stemmer toggle for grouping inflections, (4) Position weighting (title/H1/H2/body/anchor), (5) HTML element breakdown, (6) Over-optimization flags, (7) Reading-level (Flesch) + word/char count, (8) Highlight occurrences in source text, (9) CSV export, (10) CJK/Thai support via Intl.Segmenter, (11) HTML entity decoding, (12) Stop-word editor, (13) Sortable tables, (14) Sample comparison." },
      { q: "Does the tool fetch URLs?", a: "No. Paste text or HTML only — no network. We strip HTML server-side-free using DOMParser-free regex; everything runs locally." },
    ],
  },
  status: "done",
};
