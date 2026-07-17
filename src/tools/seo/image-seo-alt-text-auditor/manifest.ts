import type { ToolManifest } from "../../../lib/tool";

export const manifest: ToolManifest = {
  id: "image-seo-alt-text-auditor",
  name: "Image SEO & Alt Text Auditor",
  description:
    "Audit image alt text from HTML for SEO and accessibility. Extract <img> tags, flag missing/empty/too-long/too-short/non-descriptive alt, compute stats, generate CSV and Markdown reports, and list WCAG issues. 100% client-side.",
  category: "seo",
  keywords: [
    "alt text", "image seo", "accessibility", "wcag", "img audit",
    "alt attribute", "screen reader", "image optimization",
  ],
  icon: "image",
  requiresNetwork: false,
  seo: {
    title: "Image SEO & Alt Text Auditor — Accessibility Checker | UnQTools",
    faq: [
      {
        q: "What does this tool check?",
        a: "It extracts every <img> tag from your HTML and audits the alt attribute: missing alt, empty alt (decorative), too short (< 4 chars), too long (> 125 chars), and non-descriptive (only generic words like 'image' or 'photo'). It also flags images missing width/height (CLS risk).",
      },
      {
        q: "Why is alt text important for SEO?",
        a: "Alt text helps Google understand what images show, which can drive traffic from Google Images and Image Search. It's also used as a ranking signal for regular search (image context helps the page). And alt text is essential for accessibility — screen readers read it aloud to visually impaired users.",
      },
      {
        q: "What's WCAG 2.1 SC 1.1.1?",
        a: "Web Content Accessibility Guidelines (WCAG) Success Criterion 1.1.1 (Non-text Content) requires that all non-decorative images have equivalent text alternatives. Decorative images can use empty alt=\"\". Content-bearing images need descriptive alt text. This is a Level A requirement — the minimum legal accessibility standard in many jurisdictions.",
      },
      {
        q: "What makes alt text 'good'?",
        a: "Between 4 and 125 characters, descriptive of what the image actually shows (not 'image of a car' — just 'a red sports car on a highway'), and not stuffed with keywords. If the image is purely decorative (a spacer, a border), use alt=\"\" (empty alt) so screen readers skip it.",
      },
      {
        q: "What extra features does this tool have compared to others?",
        a: "(1) Image count + per-issue counts. (2) Missing alt count. (3) Empty (decorative) alt count. (4) Good alt count. (5) Alt length stats (min/avg/max). (6) SEO issue list (missing dimensions, non-descriptive, etc.). (7) WCAG 2.1 accessibility issue list. (8) Export report as CSV. (9) Copy report. (10) History (localStorage, last 20) + shareable URL.",
      },
      {
        q: "Is my data sent anywhere?",
        a: "No. All HTML parsing and analysis runs locally. History is stored in localStorage on this device only.",
      },
    ],
  },
  status: "done",
};
