import type { ToolManifest } from "../../../lib/tool";

export const manifest: ToolManifest = {
  id: "hreflang-tag-generator",
  name: "Hreflang Tag Generator",
  description:
    "Generate hreflang link tags for international SEO. Add language/region pairs (en-US, en-GB, fr-FR), x-default tag, ISO 639-1 language picker, ISO 3166-1 region picker, duplicate detection, and batch input. 100% client-side.",
  category: "seo",
  keywords: [
    "hreflang", "international seo", "language", "region", "iso 639-1",
    "iso 3166-1", "x-default", "alternate", "multilingual",
  ],
  icon: "languages",
  requiresNetwork: false,
  seo: {
    title: "Hreflang Tag Generator — International SEO | UnQTools",
    faq: [
      {
        q: "What is hreflang?",
        a: "hreflang is an HTML attribute on <link rel=\"alternate\"> tags that tells search engines which language and region a page targets. Example: hreflang=\"en-US\" targets English speakers in the USA. It's how Google knows to show the right localized version in search results.",
      },
      {
        q: "What is x-default?",
        a: "x-default is a special hreflang value that tells Google which page to show when no other language/region matches the user. It's typically the English or default-language version of the page.",
      },
      {
        q: "What's the correct hreflang value format?",
        a: "Either language only (en, fr, de) or language-region (en-US, en-GB, fr-CA, pt-BR). Language codes are ISO 639-1 (2 letters); region codes are ISO 3166-1 alpha-2 (2 letters). They're separated by a hyphen.",
      },
      {
        q: "What extra features does this tool have compared to others?",
        a: "(1) Language code picker (ISO 639-1). (2) Region code picker (ISO 3166-1 alpha-2). (3) URL input per language pair. (4) x-default toggle. (5) Batch input — paste a list. (6) Validation (unknown language/region codes). (7) Live preview. (8) Duplicate detection. (9) History (localStorage, last 20). (10) Shareable URL — encode the form in the fragment.",
      },
      {
        q: "Is my data sent anywhere?",
        a: "No. Hreflang tag generation is pure string templating in your browser. History is stored in localStorage on this device only.",
      },
    ],
  },
  status: "done",
};
