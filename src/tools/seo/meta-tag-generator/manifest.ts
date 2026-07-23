/**
 * Meta Tag Generator — Tool Manifest
 */
import type { ToolManifest } from "../../../lib/tool";

export const manifest: ToolManifest = {
  id: "meta-tag-generator",
  name: "Meta Tag Generator",
  description:
    "Generate HTML meta tags for SEO, Open Graph, Twitter Cards, and JSON-LD schema. Includes title-length checker, pixel-width estimator, and 10+ extras. 100% private.",
  category: "seo",
  keywords: ["meta tag generator", "open graph", "twitter card", "schema markup", "json-ld", "html head", "seo tags"],
  icon: "code",
  requiresNetwork: false,
  seo: {
    title: "Meta Tag Generator — SEO + Open Graph + Twitter + JSON-LD | UnQTools",
    faq: [
      { q: "What meta tags do I need?", a: "Essential: title (50-60 chars), description (150-160 chars), viewport, charset, canonical. Recommended: Open Graph (og:title, og:description, og:image, og:url), Twitter Card (twitter:card, twitter:title), and JSON-LD structured data." },
      { q: "What extras does this tool have?", a: "Extras: (1) SEO title + description with pixel-width estimator (Google SERP cutoff ~580px), (2) Open Graph + Twitter Card from one input, (3) JSON-LD schema.org Article/Product/LocalBusiness/FAQPage, (4) Robots meta (noindex/nofollow/noarchive), (5) Canonical URL, (6) Hreflang alternates, (7) Favicon + Apple touch icon tags, (8) Theme-color + manifest link, (9) Refresh-redirect tag, (10) Rating tag (adult/safe), (11) Copy individual sections, (12) Preview as Google SERP snippet, (13) Export as complete HTML head block." },
    ],
  },
  status: "done",
};
