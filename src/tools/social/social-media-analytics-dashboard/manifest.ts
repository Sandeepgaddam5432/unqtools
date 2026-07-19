import type { ToolManifest } from "../../../lib/tool";

export const manifest: ToolManifest = {
  id: "social-media-analytics-dashboard",
  name: "Social Media Analytics Dashboard",
  description:
    "Build analytics dashboards from social media CSV data — visualize followers, posts, engagement, impressions, reach with ASCII bar charts, line charts, KPI cards, HTML/Markdown dashboards, platform comparison, growth-trend analysis. 100% client-side. 20 extra features: CSV parser, date grouping (daily/weekly/monthly), per-platform aggregator, metric stats, ASCII bar chart, ASCII line chart, KPI cards, HTML email-friendly dashboard, Markdown dashboard, growth rate, best/worst period finder, text dashboard, CSV export, multi-format downloads, history (localStorage), shareable URL, summary stats, engagement-rate calculator, follower trend analyzer, platform comparison table.",
  category: "social",
  keywords: [
    "social media analytics", "analytics dashboard", "social metrics",
    "engagement rate", "follower growth", "impressions", "reach",
    "platform comparison", "twitter analytics", "instagram analytics",
    "facebook analytics", "linkedin analytics", "tiktok analytics",
    "youtube analytics", "ascii chart", "kpi card",
  ],
  icon: "bar-chart-3",
  requiresNetwork: false,
  seo: {
    title: "Social Media Analytics Dashboard — CSV → Charts + KPIs | UnQTools",
    faq: [
      {
        q: "How does the social media analytics dashboard work?",
        a: "Paste your social media CSV data with the columns date,platform,followers,posts,engagement,impressions,reach. Pick a metric to visualize (followers, posts, engagement, impressions, reach, or engagement-rate), a date grouping (daily/weekly/monthly), and a platform filter. The tool parses, validates, groups, aggregates, and renders an ASCII bar chart, ASCII line chart, KPI cards, and HTML/Markdown dashboards — all in your browser.",
      },
      {
        q: "What input format is expected?",
        a: "CSV with a header row and rows like: 2024-01-01,twitter,1200,5,180,5000,4200. Columns: date (YYYY-MM-DD), platform (twitter/instagram/facebook/linkedin/tiktok/youtube), followers, posts, engagement, impressions, reach. Invalid rows are reported with line numbers.",
      },
      {
        q: "What charts and reports are generated?",
        a: "ASCII bar chart (30-char width) showing the selected metric per date group, ASCII line chart (10×5 grid) showing trend over time, text KPI cards, an HTML email-friendly dashboard with inline CSS, a Markdown dashboard, a platform-comparison table, and best/worst-performing period detection.",
      },
      {
        q: "What extra features does this tool have compared to others?",
        a: "(1) CSV parser with validation. (2) Date grouper (daily/weekly/monthly). (3) Per-platform aggregator. (4) Metric calculator per group (total/avg/growth). (5) ASCII bar chart (30-char width). (6) ASCII line chart (10×5 grid). (7) KPI card renderer. (8) HTML dashboard generator (inline CSS, email-friendly). (9) Markdown dashboard generator. (10) Growth-rate calculator (period-over-period). (11) Best/worst period finder. (12) Text dashboard. (13) CSV re-export. (14) Copy + Download .txt/.html/.md/.csv. (15) History (localStorage, last 20). (16) Shareable URL. (17) Summary stats. (18) Engagement-rate calculator. (19) Follower growth trend analyzer. (20) Platform comparison table.",
      },
      {
        q: "Is my data sent anywhere?",
        a: "No. All parsing, aggregation, and rendering runs locally in your browser. History is stored in localStorage on this device only.",
      },
    ],
  },
  status: "done",
};
