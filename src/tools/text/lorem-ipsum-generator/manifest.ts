/**
 * Lorem Ipsum Generator — Tool Manifest
 */
import type { ToolManifest } from "../../../lib/tool";

export const manifest: ToolManifest = {
  id: "lorem-ipsum-generator",
  name: "Lorem Ipsum Generator",
  description:
    "Generate Lorem Ipsum placeholder text by paragraphs, sentences, words, or characters. Multiple variants, custom word lists, and 10+ extras. 100% private.",
  category: "text",
  keywords: ["lorem ipsum", "placeholder text", "dummy text", "filler text", "lipsum", "lorem generator"],
  icon: "align-left",
  requiresNetwork: false,
  seo: {
    title: "Lorem Ipsum Generator — Paragraphs/Sentences/Words/Chars | UnQTools",
    faq: [
      { q: "What is Lorem Ipsum?", a: "Lorem Ipsum is dummy text used in printing and typesetting since the 1500s. It's derived from Cicero's 'De finibus bonorum et malorum' (45 BC). Standard filler text starts with 'Lorem ipsum dolor sit amet, consectetur adipiscing elit...'." },
      { q: "What extras does this tool have?", a: "Extras: (1) Generate by paragraphs/sentences/words/characters, (2) Custom count, (3) Start with 'Lorem ipsum...' (canonical), (4) Plain Lorem Ipsum (Cicero's source), (5) Hipster Ipsum variant, (6) Bacon Ipsum variant, (7) Custom word list, (8) HTML output (with <p> tags), (9) Markdown output, (10) Plain text output, (11) Min/max words per sentence, (12) Min/max sentences per paragraph, (13) Show word count, (14) Copy + download." },
    ],
  },
  status: "done",
};
