import type { ToolManifest } from "../../../lib/tool";

export const manifest: ToolManifest = {
  id: "locale-keyword-researcher",
  name: "Locale Keyword Researcher",
  description:
    "Generate locale-specific keyword variants for country/language combinations. Translate base keywords across 10 languages, apply locale spelling variants, attach localized modifiers, and produce Google search URLs per locale. 100% client-side — 17 extras including 50+ word translation table, currency detection, untranslatable word detector, history, shareable URL.",
  category: "seo",
  keywords: [
    "keyword research", "locale keywords", "international keywords",
    "multilingual seo", "keyword translation", "localized keywords",
    "language targeting", "google search url", "keyword variants",
  ],
  icon: "languages",
  requiresNetwork: false,
  seo: {
    title: "Locale Keyword Researcher — Translate + Localize Keywords per Country | UnQTools",
    faq: [
      {
        q: "How does the locale keyword researcher work?",
        a: "Enter a base keyword (e.g. 'buy shoes'), pick target locales (one per line as 'Language-Country' e.g. 'en-US', 'de-DE'), and list modifiers (e.g. 'online, near me, cheap'). The tool translates each word using a built-in table for 10 languages, applies locale-specific spelling variants (e.g. 'color' vs 'colour'), and combines base × modifier to produce localized keyword variants with Google search URLs.",
      },
      {
        q: "What languages are supported by the translation table?",
        a: "10 languages: English (en), German (de), French (fr), Spanish (es), Italian (it), Japanese (ja), Korean (ko), Chinese (zh), Portuguese (pt), and Russian (ru). The table covers 50+ common e-commerce words: buy, sell, price, cheap, best, online, near me, store, shop, delivery, free shipping, reviews, top, sale, discount, and more.",
      },
      {
        q: "What extra features does this tool have compared to others?",
        a: "(1) Locale parser (Language-Country format validator). (2) Built-in translation table (50+ words × 10 languages). (3) Base keyword translator (word-by-word). (4) Locale-specific spelling variant handler (en-US vs en-GB). (5) Locale-specific currency detection (15+ currencies). (6) Modifier translator. (7) Keyword variant combiner (base × modifier). (8) Google search URL generator per locale. (9) Text report renderer. (10) CSV export. (11) Copy + Download .txt + Download CSV. (12) History (localStorage, max 20). (13) Shareable URL. (14) Filter by locale. (15) Summary stats. (16) Locale presets (12 locales). (17) Untranslatable word detector.",
      },
      {
        q: "Is my data sent anywhere?",
        a: "No. All translation, combination, and URL generation runs locally in your browser. History is stored in localStorage on this device only.",
      },
      {
        q: "How does the untranslatable word detector work?",
        a: "When the base keyword or a modifier contains a word not in the translation table, the tool flags it. You can either add it manually via the table extension or accept the untranslated word as-is (Google still searches for it).",
      },
    ],
  },
  status: "done",
};
