import type { ToolManifest } from "../../../lib/tool";

export const manifest: ToolManifest = {
  id: "pdf-compare",
  name: "PDF Compare",
  description:
    "Compare two PDFs side-by-side — page count, per-page text diffs (Levenshtein similarity), metadata differences, structure (page sizes & fonts), image counts. 18+ extra features: 4 comparison modes, unified-diff / HTML / CSV / JSON renderers, significant-change finder, history & shareable URL. 100% client-side — no uploads.",
  category: "pdf",
  keywords: [
    "compare pdf",
    "pdf diff",
    "pdf comparison",
    "compare documents",
    "pdf changes",
    "pdf checker",
    "diff pdf",
    "pdf similarity",
    "document diff",
    "pdf analyzer",
  ],
  icon: "git-compare",
  requiresNetwork: false,
  seo: {
    title: "PDF Compare — Diff Two PDFs Online Free | UnQTools",
    faq: [
      {
        q: "Is my data sent anywhere?",
        a: "No. PDF comparison runs 100% in your browser using JavaScript and pdf-lib. Your files never leave your device, and the tool works offline once the page is loaded.",
      },
      {
        q: "What does PDF Compare detect?",
        a: "It compares page counts, per-page text content (line-by-line diff with a Levenshtein similarity score), metadata fields (title, author, subject, keywords, creator, producer, dates), structure (page sizes, embedded font names), and per-page image counts. Choose from 4 comparison modes: text-only, metadata-only, full, or structure.",
      },
      {
        q: "What extra features?",
        a: "18 extras: page-range parser; text comparator (line-by-line diff); whitespace + case normalizers; metadata comparator; structure comparator (page count, sizes, fonts); unified-diff formatter; Levenshtein similarity score; page-by-page diff generator; diff statistics (added / removed / modified / unchanged lines); 4 multi-format renderers (text, HTML, CSV, JSON); copy + download; localStorage history (max 20); shareable URL; summary stats; page-count diff; metadata diff; font-usage diff; image-count diff; and a significant-changes finder that surfaces the pages with the most differences.",
      },
      {
        q: "How is the similarity percentage calculated?",
        a: "Per page, the tool computes a Levenshtein edit distance between the two text layers (after optional whitespace / case normalization), then converts it to a 0–100% similarity score: 100 means identical, 0 means completely different. The overall document similarity is the average of all compared pages.",
      },
      {
        q: "Can I compare scanned PDFs?",
        a: "Text comparison works on PDFs that contain an embedded text layer. Scanned PDFs without a text layer will report empty text on each page — structure and metadata comparisons still work. For true text comparison of scans, run an OCR pass first (see our PDF OCR Text Extractor) and then compare the OCR'd text.",
      },
    ],
  },
  status: "done",
};
