/**
 * Text Repeater — Tool Manifest
 */
import type { ToolManifest } from "../../../lib/tool";

export const manifest: ToolManifest = {
  id: "text-repeater",
  name: "Text Repeater",
  description:
    "Repeat text N times with separators, prefix/suffix, numbered sequences, and patterns. Useful for testing, padding, and dummy data. 10+ extras. 100% private.",
  category: "text",
  keywords: ["text repeater", "repeat text", "duplicate text", "text multiplier", "padding text", "dummy text"],
  icon: "copy",
  requiresNetwork: false,
  seo: {
    title: "Text Repeater — Multiply Text + Numbered Sequences | UnQTools",
    faq: [
      { q: "What can I use this for?", a: "Generate test data, fill column widths, create padding, repeat emoji, build numbered lists (1. 2. 3.), generate Lorem Ipsum-style filler, create barcode-like patterns, or stress-test text rendering with very long strings." },
      { q: "What extras does this tool have?", a: "Extras: (1) Repeat N times, (2) Custom separator, (3) Prefix + suffix, (4) Numbered sequence (1. 2. 3.), (5) Zero-padded numbers (01, 02), (6) Custom numbering start + step, (7) Letter sequence (a, b, c...), (8) Random text mode (shuffle each repeat), (9) Pattern-based repeat (e.g. {n} {text}), (10) Char-limit truncation, (11) Reverse each iteration, (12) Mirror output (abc → abc|cba), (13) Copy output, (14) Download as .txt." },
    ],
  },
  status: "done",
};
