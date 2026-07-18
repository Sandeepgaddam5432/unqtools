import type { ToolManifest } from "../../../lib/tool";

export const manifest: ToolManifest = {
  id: "seo-report-generator",
  name: "SEO Report Generator",
  description:
    "Generate white-label SEO audit reports in markdown, HTML, or text. Eight section templates (executive summary, technical SEO, on-page, content, backlinks, keyword rankings, competitors, recommendations), weighted overall score, cover page, table of contents, history (localStorage), shareable URL. 100% client-side.",
  category: "seo",
  keywords: [
    "seo report", "audit report", "white-label seo",
    "seo audit", "client report", "markdown report",
    "html report", "seo score", "seo template",
    "seo recommendations",
  ],
  icon: "file-text",
  requiresNetwork: false,
  seo: {
    title: "SEO Report Generator — Markdown / HTML / Text Audit Reports | UnQTools",
    faq: [
      {
        q: "How does the SEO Report Generator work?",
        a: "Enter client info, audit scores (technical, on-page, content, backlinks), keyword rankings CSV, top recommendations, and competitor URLs. Pick from 8 sections to include, choose a format (markdown, HTML, or text), and the tool generates a complete white-label audit report with cover page, table of contents, and weighted overall score.",
      },
      {
        q: "How is the overall SEO score calculated?",
        a: "The overall score is a weighted average: technical SEO (25%), on-page SEO (25%), content (20%), backlinks (30%). Only provided scores contribute to the average. Score labels: 90+ Excellent, 75-89 Good, 60-74 Needs Improvement, <60 Poor.",
      },
      {
        q: "Which sections can I include?",
        a: "Eight sections: (1) Executive summary, (2) Technical SEO, (3) On-page SEO, (4) Content analysis, (5) Backlink profile, (6) Keyword rankings, (7) Competitor analysis, (8) Recommendations. Toggle each section on/off via checkboxes.",
      },
      {
        q: "What extra features does this tool have compared to others?",
        a: "(1) Three report formats (markdown, HTML, text). (2) Eight section templates with placeholder substitution. (3) Overall score calculator (weighted 25/25/20/30). (4) Score color/label (Excellent/Good/Needs Improvement/Poor). (5) HTML report with inline CSS (email-friendly). (6) Markdown report with TOC. (7) Text report with ASCII dividers. (8) Cover page generator. (9) Table of contents generator. (10) Keyword rankings table renderer. (11) Recommendations priority list renderer. (12) Competitor URLs list renderer. (13) Copy + Download .md + Download .html + Download .txt. (14) History (last 20). (15) Shareable URL. (16) Section selector (8 checkboxes). (17) Summary stats.",
      },
      {
        q: "Is my data sent anywhere?",
        a: "No. All report generation runs locally in your browser. History is stored in localStorage on this device only.",
      },
    ],
  },
  status: "done",
};
