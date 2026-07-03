/**
 * Word & Character Counter — Tool Manifest
 * Reference: unqtools-docs / "Word & Character Counter — live, Unicode-correct".
 */
import type { ToolManifest } from "../../../lib/tool";

export const manifest: ToolManifest = {
  id: "word-character-counter",
  name: "Word & Character Counter",
  description:
    "Live, Unicode-correct word, character, sentence, paragraph, and line counts with reading time, SMS segments, and platform-limit meters. 100% private.",
  category: "text",
  keywords: [
    "word counter",
    "character counter",
    "letter counter",
    "sentence counter",
    "paragraph counter",
    "reading time",
    "sms segments",
    "tweet counter",
    "unicode",
    "grapheme",
  ],
  icon: "type",
  requiresNetwork: false,
  seo: {
    title: "Word & Character Counter — Live, Unicode-Correct & Private | UnQTools",
    faq: [
      {
        q: "How does this counter handle emoji and CJK characters?",
        a: "It uses the browser's Intl.Segmenter API to count true graphemes — so 👨‍👩‍👧‍👦 counts as 1 character, not 11. CJK text without spaces is segmented using language-aware word boundaries.",
      },
      {
        q: "Are SMS segments calculated correctly?",
        a: "Yes. The tool detects whether your text fits the GSM-7 charset (70 chars per segment) or requires UCS-2 (70 chars first segment, 67 chars subsequent). Multi-segment encoding rules are followed exactly.",
      },
      {
        q: "Is my text uploaded anywhere?",
        a: "No. All counting happens locally in your browser. For very large texts (>100KB), processing moves to a Web Worker to keep the UI responsive.",
      },
    ],
  },
  status: "done",
};
