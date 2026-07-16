import type { ToolManifest } from "../../../lib/tool";

export const manifest: ToolManifest = {
  id: "meta-tag-generator",
  name: "Meta Tag Generator",
  description:
    "Generate SEO-ready HTML meta tags — title, description, keywords, robots directives, viewport, charset, canonical, Open Graph and Twitter Card basics. Includes live preview, character/pixel counters, and copy/download. 100% client-side.",
  category: "seo",
  keywords: [
    "meta tag", "seo", "html", "head", "title", "description", "keywords",
    "robots", "viewport", "charset", "canonical", "open graph", "twitter card",
  ],
  icon: "tags",
  requiresNetwork: false,
  seo: {
    title: "Meta Tag Generator — SEO HTML Head Tags | UnQTools",
    faq: [
      {
        q: "What meta tags does this generator produce?",
        a: "Title, description, keywords, author, robots (index/noindex/follow/nofollow), viewport, charset, canonical URL, theme-color, apple-mobile-web-app-capable, Open Graph basics, and Twitter Card basics. All output is plain HTML you can paste into the <head> of any page.",
      },
      {
        q: "What is the ideal length for a meta title and description?",
        a: "Google typically truncates titles around 60 characters / 600px and descriptions around 160 characters / 980px. Our tool shows live character counts and approximate pixel widths so you can stay within those limits.",
      },
      {
        q: "What is the robots meta tag for?",
        a: "The robots tag tells search engine crawlers what to do with the page: index/noindex controls inclusion in search results; follow/nofollow controls whether links on the page are crawled. Use noindex for thin/private pages; use nofollow for untrusted outbound links.",
      },
      {
        q: "What extra features does this tool have compared to others?",
        a: "(1) Live HTML preview rendered in the page. (2) Character counters for title (60) and description (160). (3) Approximate pixel-width estimator (Arial-based). (4) Open Graph basic tags (og:title/og:description/og:image/og:url). (5) Twitter Card basic tags (summary/summary_large_image). (6) Theme-color meta. (7) Apple-mobile-web-app meta. (8) History (localStorage, last 20 generations). (9) Shareable URL — encode the form in the fragment. (10) Download as standalone .html snippet.",
      },
      {
        q: "Is my data sent anywhere?",
        a: "No. Tag generation runs entirely in your browser using string templates. History is stored in localStorage on your device only.",
      },
    ],
  },
  status: "done",
};
