import type { ToolManifest } from "../../../lib/tool";

export const manifest: ToolManifest = {
  id: "add-line-breaks",
  name: "Add Line Breaks",
  description:
    "Insert line breaks into text — word-wrap at a column width, split on a delimiter, or break every N characters/words. Unicode-correct, word-safe, with CJK/emoji support. 100% private.",
  category: "text",
  keywords: [
    "add line breaks",
    "word wrap",
    "insert line breaks",
    "split text into lines",
    "break text",
    "text wrapper",
  ],
  icon: "type",
  requiresNetwork: false,
  seo: {
    title: "Add Line Breaks — word wrap, split on delimiter, every N chars/words | UnQTools",
    faq: [
      {
        q: "Does the word-wrap split words?",
        a: "No. By default, word-safe wrapping never splits a word — if a word is longer than the column width, it goes on its own line. You can enable 'Hard break' to split words mid-grapheme at the width boundary.",
      },
      {
        q: "Does it handle CJK and emoji correctly?",
        a: "Yes. The tool uses Intl.Segmenter for grapheme-aware segmentation and an East-Asian-width heuristic so CJK characters (double-width) and emoji are counted correctly when wrapping by column.",
      },
      {
        q: "Can I choose between LF and CRLF output?",
        a: "Yes. Select LF (Unix/macOS) or CRLF (Windows) in the options. Existing line endings in your input are normalized to your choice.",
      },
    ],
  },
  status: "done",
};
