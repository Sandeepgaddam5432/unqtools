import type { ToolManifest } from "../../../lib/tool";

export const manifest: ToolManifest = {
  id: "html-to-text-ratio-checker",
  name: "HTML to Text Ratio Checker",
  description:
    "Analyze HTML-to-text ratio for SEO. Extract visible text, compute ratio, count words/tags/scripts/images, get SEO recommendations and a 0-100 score. 100% client-side.",
  category: "seo",
  keywords: [
    "html to text ratio", "code to text ratio", "seo audit",
    "html analysis", "content ratio", "page analysis", "text extraction",
  ],
  icon: "bar-chart-3",
  requiresNetwork: false,
  seo: {
    title: "HTML to Text Ratio Checker — SEO Page Analyzer | UnQTools",
    faq: [
      {
        q: "What is HTML-to-text ratio?",
        a: "It's the percentage of a page's HTML that is visible text content. Formula: (text size / total HTML size) × 100. A higher ratio means more content relative to markup. Most SEO guides recommend a ratio between 15% and 50% for content pages.",
      },
      {
        q: "What is a good HTML-to-text ratio?",
        a: "Generally 15-50% is considered healthy. Below 10% suggests thin content or excessive markup. Above 70% may indicate very plain pages that could benefit from more semantic structure (headings, lists, schema). Note: ratio alone isn't a ranking factor — content quality matters far more.",
      },
      {
        q: "Does HTML-to-text ratio affect rankings?",
        a: "Not directly — Google has stated they don't use code-to-text ratio as a ranking signal. However, very low ratios can indicate thin content (a quality issue) or excessive scripts (a performance issue), both of which can indirectly affect rankings. Treat this as a diagnostic, not a target.",
      },
      {
        q: "How does the tool handle scripts and styles?",
        a: "We strip <script> and <style> blocks before counting text — they're not visible to users. We also strip HTML comments and decode entities. The result is what users actually see, which is the meaningful SEO text content.",
      },
      {
        q: "What extra features does this tool have compared to others?",
        a: "(1) HTML-to-text ratio visualization (text vs markup bar). (2) Full tag stripping (scripts, styles, comments). (3) Word count and character count. (4) Tag count breakdown (scripts, styles, images, links, headings, paragraphs, lists). (5) SEO score 0-100 with weighted criteria. (6) Recommendation list (good/warning/bad). (7) Markdown report export. (8) Visible text preview. (9) History (localStorage, last 20). (10) Shareable URL — encode HTML in fragment.",
      },
      {
        q: "Is my data sent anywhere?",
        a: "No. All HTML parsing and analysis runs locally in your browser. History is stored in localStorage on this device only.",
      },
    ],
  },
  status: "done",
};
