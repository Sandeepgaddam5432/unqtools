import type { ToolManifest } from "../../../lib/tool";

export const manifest: ToolManifest = {
  id: "serp-snippet-preview",
  name: "SERP Snippet Preview",
  description:
    "Preview how your page will appear in Google search results. Desktop and mobile previews, title (60 chars) and description (160 chars) truncation, pixel-width estimation, date prefix, breadcrumb URL display, and rich result indicator. 100% client-side.",
  category: "seo",
  keywords: [
    "serp", "snippet", "preview", "google", "search results", "title",
    "description", "meta description", "pixel width", "truncation",
  ],
  icon: "eye",
  requiresNetwork: false,
  seo: {
    title: "SERP Snippet Preview — Google Search Preview | UnQTools",
    faq: [
      {
        q: "What is a SERP snippet?",
        a: "The SERP (Search Engine Results Page) snippet is the title, URL, and description that Google shows for your page in search results. It's the first thing searchers see — getting it right dramatically impacts click-through rate.",
      },
      {
        q: "How long can the title and description be?",
        a: "Google truncates titles around 50-60 characters / 600px (desktop) and descriptions around 150-160 characters / 980px. Pixel width matters more than character count because Google uses proportional fonts.",
      },
      {
        q: "Does Google always use my meta description?",
        a: "No. Google may rewrite or replace your meta description with text from the page if it thinks that's more relevant to the query. The SERP preview shows what your snippet could look like — not what it will look like for every query.",
      },
      {
        q: "What extra features does this tool have compared to others?",
        a: "(1) Desktop vs mobile preview. (2) Title truncation at ~60 chars. (3) Description truncation at ~160 chars. (4) Pixel width estimation (600px desktop, 980px mobile is wrong — Google uses 600px desktop / 1200px mobile actually — we use the more conservative 600/980). (5) Date prefix option (e.g. 'Jan 1, 2026 —'). (6) Rich result indicator. (7) Favicon preview. (8) Breadcrumb URL display. (9) History (localStorage, last 20). (10) Shareable URL — encode the form in the fragment.",
      },
      {
        q: "Is my data sent anywhere?",
        a: "No. SERP preview rendering is pure string manipulation in your browser. History is stored in localStorage on this device only.",
      },
    ],
  },
  status: "done",
};
