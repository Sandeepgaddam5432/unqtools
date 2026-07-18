import type { ToolManifest } from "../../../lib/tool";

export const manifest: ToolManifest = {
  id: "javascript-seo-render-tester",
  name: "JavaScript SEO Render Tester",
  description:
    "Test JavaScript SEO rendering by analyzing HTML snippets and JS file lists. Detects render-blocking scripts (head scripts without async/defer), counts external vs inline scripts, simulates DOM mutation to find missing <title>/<meta description>/<h1>, and generates a 0-100 render score with 6+ recommendation rules. 100% client-side, 15 extra features.",
  category: "seo",
  keywords: [
    "javascript seo", "js rendering", "render-blocking",
    "client-side rendering", "csr seo", "dom mutation",
    "script async defer", "googlebot", "render score",
  ],
  icon: "code-xml",
  requiresNetwork: false,
  seo: {
    title: "JavaScript SEO Render Tester — Render-Blocking + Score | UnQTools",
    faq: [
      {
        q: "How does the JavaScript SEO render tester work?",
        a: "Paste your HTML snippet (head + initial body) and a list of JS files (one per line, can include attributes like defer/async). The tool extracts <script> tags with their attributes, detects render-blocking scripts (head scripts without async/defer), simulates what the DOM looks like after JS execution by extracting <title>, <meta name='description'>, <h1>, and <a href>, then generates SEO recommendations and a 0-100 render score.",
      },
      {
        q: "What is a render-blocking script?",
        a: "A <script> tag placed in the document <head> without the 'async' or 'defer' attribute. Browsers must download and execute these scripts before rendering the page, which delays first paint. For SEO, this means Googlebot sees an empty page for longer. The fix is to add defer (or async for independent scripts) or move the script to the end of <body>.",
      },
      {
        q: "How is the render score computed?",
        a: "The render score starts at 100 and is reduced by: -15 per render-blocking head script (max -45), -15 if no <title> would be present after render, -15 if no meta description, -10 if no <h1>, -5 if more than 5 external scripts (HTTP request bloat), and -5 if external scripts lack async/defer. The final score is clamped to 0-100. Higher is better for SEO.",
      },
      {
        q: "What extra features does this tool have compared to others?",
        a: "(1) HTML parsing (script tag extraction with attributes). (2) Render-blocking script detection (head scripts without async/defer). (3) JS file list parser. (4) DOM mutation simulator (extract title/meta/h1/links from HTML). (5) Missing critical tag detection. (6) External vs inline script counter. (7) Recommendation generator (6+ rules). (8) Render score (0-100). (9) Text report rendering. (10) CSV export (script URL, type, blocking, recommendation). (11) Copy + Download .txt + Download CSV. (12) History (localStorage, max 20). (13) Shareable URL (encode HTML + JS list in hash). (14) Filter (blocking only / all). (15) Summary stats (total scripts, blocking, render score).",
      },
      {
        q: "Is my data sent anywhere?",
        a: "No. All HTML parsing, script extraction, and scoring runs locally in your browser. History is stored in localStorage on this device only. No network calls.",
      },
    ],
  },
  status: "done",
};
