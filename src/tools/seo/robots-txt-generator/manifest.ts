import type { ToolManifest } from "../../../lib/tool";

export const manifest: ToolManifest = {
  id: "robots-txt-generator",
  name: "Robots.txt Generator",
  description:
    "Generate robots.txt files for crawler control. User-agent presets (Googlebot, Bingbot, etc.), allow/disallow rules, wildcard patterns, crawl-delay, sitemap directive, comments, and validation warnings. 100% client-side.",
  category: "seo",
  keywords: [
    "robots.txt", "robots", "crawler", "spider", "user-agent", "googlebot", "bingbot",
    "disallow", "allow", "crawl-delay", "wildcard",
  ],
  icon: "bot",
  requiresNetwork: false,
  seo: {
    title: "Robots.txt Generator — Crawler Control | UnQTools",
    faq: [
      {
        q: "What is robots.txt?",
        a: "robots.txt is a text file at the root of your site (e.g. example.com/robots.txt) that tells search engine crawlers which parts of your site they may or may not crawl. It uses the Robots Exclusion Protocol.",
      },
      {
        q: "What's the difference between Disallow and noindex?",
        a: "Disallow tells crawlers not to crawl a URL — but if a URL is linked from elsewhere, it may still appear in search results without a description. To prevent indexing entirely, use the robots meta tag with noindex instead.",
      },
      {
        q: "What are wildcard patterns?",
        a: "The * wildcard matches any sequence of characters and $ marks the end of a URL. For example, Disallow: /*? blocks all URLs with a query string, and Disallow: /*.pdf$ blocks all PDF files.",
      },
      {
        q: "What extra features does this tool have compared to others?",
        a: "(1) User-agent presets — Googlebot, Bingbot, Slurp, DuckDuckBot, Baiduspider, YandexBot, facebookexternalhit, AhrefsBot, SemrushBot, GPTBot. (2) Allow/disallow toggle per rule. (3) Path pattern builder with wildcard support. (4) Sitemap auto-include. (5) Crawl-delay directive. (6) Comments. (7) Live preview. (8) Validation warnings (e.g., path without leading slash). (9) Stats — rule count per user-agent. (10) History (localStorage, last 20).",
      },
      {
        q: "Is my data sent anywhere?",
        a: "No. robots.txt generation is pure string templating in your browser. History is stored in localStorage on this device only.",
      },
    ],
  },
  status: "done",
};
