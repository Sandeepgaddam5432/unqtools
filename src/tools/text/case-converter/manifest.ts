import type { ToolManifest } from "../../../lib/tool";

export const manifest: ToolManifest = {
  id: "case-converter",
  name: "Text Case Converter",
  description:
    "Convert text between UPPERCASE, lowercase, Title Case, Sentence case, camelCase, PascalCase, snake_case, kebab-case, CONSTANT_CASE, and more. 100% private.",
  category: "text",
  keywords: [
    "case converter",
    "uppercase",
    "lowercase",
    "title case",
    "camelcase",
    "snake case",
    "kebab case",
    "pascalcase",
  ],
  icon: "type",
  requiresNetwork: false,
  seo: {
    title: "Text Case Converter — UPPER / lower / Title / camel / snake / kebab | UnQTools",
    faq: [
      {
        q: "What cases are supported?",
        a: "UPPERCASE, lowercase, Title Case, Sentence case, camelCase, PascalCase, snake_case, kebab-case, CONSTANT_CASE, dot.case, and alternating case — 11 in total.",
      },
      {
        q: "How does Title Case handle small words?",
        a: "Articles, conjunctions, and short prepositions (a, an, the, and, but, or, for, nor, in, on, at, to, by, of, etc.) are kept lowercase unless they're the first or last word of the string, following standard title-case rules.",
      },
    ],
  },
  status: "done",
};
