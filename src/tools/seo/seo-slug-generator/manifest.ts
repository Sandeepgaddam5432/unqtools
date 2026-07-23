/**
 * SEO Slug Generator — Tool Manifest
 */
import type { ToolManifest } from "../../../lib/tool";

export const manifest: ToolManifest = {
  id: "seo-slug-generator",
  name: "SEO Slug Generator",
  description:
    "Generate SEO-friendly URL slugs from any title. Customizable separator, case, max length, stop-word removal, transliteration, and 10+ extras. 100% private.",
  category: "seo",
  keywords: ["slug generator", "url slug", "seo slug", "permalink", "urlify", "slugify"],
  icon: "link",
  requiresNetwork: false,
  seo: {
    title: "SEO Slug Generator — URL Slugify + Stop Words + Transliteration | UnQTools",
    faq: [
      { q: "What makes a good URL slug?", a: "Short (3-5 words), lowercase, hyphen-separated, no stop words (a/an/the), no special chars, no dates, keyword-rich. Good: 'best-coffee-grinders-2024'. Bad: 'The-Best-Coffee-Grinders-For-Your-Home!!!'." },
      { q: "What extras does this tool have?", a: "Extras: (1) 5 separator options (- _ . ~ +), (2) Case toggle (lower/upper/preserve), (3) Stop-word removal (English + 8 other languages), (4) Unicode transliteration (é→e, ñ→n, 等), (5) CJK → pinyin/romaji approximation, (6) Max-length truncation on word boundary, (7) Preserve numbers toggle, (8) Emoji + symbol stripping, (9) Custom replacement map, (10) Batch mode (one slug per line), (11) Slug collision suffix counter, (12) Copy individual or all results, (13) Reverse: slug → title case." },
    ],
  },
  status: "done",
};
