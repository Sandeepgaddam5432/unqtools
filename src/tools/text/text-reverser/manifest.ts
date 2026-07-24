/**
 * Text Reverser — Tool Manifest
 */
import type { ToolManifest } from "../../../lib/tool";

export const manifest: ToolManifest = {
  id: "text-reverser",
  name: "Text Reverser",
  description:
    "Reverse text by characters, words, lines, or sentences. Multiple modes, preserve case, mirror text, and 10+ extras. 100% private.",
  category: "text",
  keywords: ["text reverser", "reverse text", "backwards text", "mirror text", "reverse words", "reverse lines"],
  icon: "flip-horizontal",
  requiresNetwork: false,
  seo: {
    title: "Text Reverser — Reverse Chars/Words/Lines + Mirror | UnQTools",
    faq: [
      { q: "What's the difference between reversing by character vs word?", a: "Character reversal: 'Hello World' → 'dlroW olleH'. Word reversal: 'Hello World' → 'World Hello'. Line reversal: 'line1\\nline2' → 'line2\\nline1'. Sentence reversal: 'A. B. C.' → 'C. B. A.'" },
      { q: "What extras does this tool have?", a: "Extras: (1) Reverse by char/word/line/sentence, (2) Preserve case position, (3) Mirror text (Unicode mirroring), (4) Reverse only digits, (5) Reverse only letters, (6) Skip punctuation, (7) Multi-mode (chain reversals), (8) Batch mode (one input per line), (9) Live preview as you type, (10) Copy individual results, (11) CSV export of batch, (12) Preserve Unicode combining marks, (13) RTL/LTR toggle for display, (14) Reverse-preserving-punctuation (e.g. 'Hello, World!' → 'olleH, dlroW!')." },
    ],
  },
  status: "done",
};
