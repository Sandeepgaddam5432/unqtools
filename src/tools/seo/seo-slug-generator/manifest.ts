import type { ToolManifest } from "../../../lib/tool";

export const manifest: ToolManifest = {
  id: "seo-slug-generator",
  name: "SEO Slug Generator",
  description:
    "Generate SEO-friendly URL slugs from titles. Lowercase, hyphens, special-char stripping, stop-word removal, length caps, bulk mode, separators, and live URL preview. 100% client-side.",
  category: "seo",
  keywords: [
    "slug", "url slug", "permalink", "seo url", "url friendly",
    "kebab case", "stop words", "bulk slug", "pretty url", "slugify",
  ],
  icon: "link",
  requiresNetwork: false,
  seo: {
    title: "SEO Slug Generator — URL-Friendly Permalinks | UnQTools",
    faq: [
      {
        q: "What is a URL slug?",
        a: "A URL slug is the human-readable, hyphen-separated last part of a URL (e.g. /blog/how-to-bake-bread). Good slugs are lowercase, contain only a-z 0-9 and hyphens, omit stop words, and stay under ~60 characters for readability and SEO.",
      },
      {
        q: "Which rules does this tool apply?",
        a: "Lowercase, strip accents/diacritics, remove special characters, collapse whitespace into the chosen separator (hyphen or underscore), optionally remove English stop words, trim to a max length without cutting words mid-way, and trim trailing separators.",
      },
      {
        q: "What extra features does this tool have compared to others?",
        a: "(1) Stop-word removal toggle. (2) Max-length slider with word-boundary trimming. (3) Word separator (- or _). (4) Trailing-slash toggle for preview. (5) Bulk mode (one slug per line). (6) Slug stats (length + word count + character classes). (7) Live URL preview with custom domain. (8) Copy. (9) History (localStorage, last 20). (10) Shareable URL — encode the form in the fragment.",
      },
      {
        q: "Is my data sent anywhere?",
        a: "No. Slug generation is pure string manipulation in your browser. History is stored in localStorage on this device only.",
      },
    ],
  },
  status: "done",
};
