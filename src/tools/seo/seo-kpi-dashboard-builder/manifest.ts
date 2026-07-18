import type { ToolManifest } from "../../../lib/tool";

export const manifest: ToolManifest = {
  id: "seo-kpi-dashboard-builder",
  name: "SEO KPI Dashboard Builder",
  description:
    "Build KPI dashboards from raw SEO data. Paste CSV (kpi,value,target,date) and visualize metrics with ASCII bar charts, ASCII line charts, status classification (on-track/behind/critical), HTML dashboard with inline CSS, markdown dashboard, CSV export, history, shareable URL, KPI templates. 100% client-side.",
  category: "seo",
  keywords: [
    "kpi", "dashboard", "seo kpi",
    "metrics", "kpi dashboard", "ascii chart",
    "kpi report", "seo metrics",
  ],
  icon: "bar-chart-3",
  requiresNetwork: false,
  seo: {
    title: "SEO KPI Dashboard Builder — ASCII Charts + HTML/Markdown Export | UnQTools",
    faq: [
      {
        q: "How does the SEO KPI dashboard builder work?",
        a: "Paste KPI data as CSV (columns: kpi,value,target,date). The tool parses each row, groups by KPI name, computes the latest value, target progress %, trend (vs previous date), and status (on-track, behind, critical). It then renders dashboards as text, HTML, markdown, or CSV.",
      },
      {
        q: "What chart types are supported?",
        a: "ASCII bar charts (30-character width using █ block characters) for progress, ASCII line charts (10x5 grid using ● and │ characters) for time series, KPI cards (text-based with value/target/progress/trend/status), and inline-SVG bars/sparklines in the HTML dashboard for email-friendly rendering.",
      },
      {
        q: "How is KPI status classified?",
        a: "Status is based on the latest value vs target ratio: on-track when value >= target, behind when 50% <= value < target, critical when value < 50% of target, and no-target when target is 0 or missing. The HTML dashboard color-codes these (green/amber/red).",
      },
      {
        q: "What extra features does this tool have compared to others?",
        a: "(1) CSV parser with field validation. (2) KPI grouping by name. (3) Latest value calculator. (4) Target progress % calculator. (5) Trend analyzer (up/down/flat, % change). (6) Status classifier. (7) ASCII bar chart generator. (8) ASCII line chart generator. (9) KPI card renderer. (10) HTML dashboard with inline CSS (email-friendly). (11) Markdown dashboard. (12) Text dashboard. (13) CSV export. (14) Copy + download .txt/.html/.md. (15) History (localStorage, last 20). (16) Shareable URL. (17) Filter by KPI name. (18) Summary stats. (19) 6 KPI templates.",
      },
      {
        q: "Is my data sent anywhere?",
        a: "No. All parsing, calculation, and rendering runs locally in your browser. History is stored in localStorage on this device only. No KPI data ever leaves your browser.",
      },
    ],
  },
  status: "done",
};
