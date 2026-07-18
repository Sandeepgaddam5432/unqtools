import type { ToolManifest } from "../../../lib/tool";

export const manifest: ToolManifest = {
  id: "competitor-website-analyzer",
  name: "Competitor Website Analyzer",
  description:
    "Compare your site against competitors across 10 SEO dimensions. Paste CSV (domain,metric,value) from Ahrefs/Semrush/Moz, get a comparison matrix, leader per metric, your rank, gap analysis, quick wins (gap < 20%), critical gaps (gap > 50%), strengths/weaknesses, text/CSV reports. 100% client-side.",
  category: "seo",
  keywords: [
    "competitor analysis", "seo competitor",
    "competitor research", "website comparison",
    "ahrefs", "semrush", "moz",
    "gap analysis", "competitor",
  ],
  icon: "swords",
  requiresNetwork: false,
  seo: {
    title: "Competitor Website Analyzer — Compare SEO Metrics, Find Gaps | UnQTools",
    faq: [
      {
        q: "How does the competitor analyzer work?",
        a: "Paste CSV in the format domain,metric,value (one row per metric per domain). Supported metrics: organic_traffic, organic_keywords, backlinks, referring_domains, domain_authority, page_authority, avg_position, pages_indexed, load_time_ms, mobile_score. The tool pivots the data into a comparison matrix, identifies the leader per metric, ranks your domain, and computes the gap (absolute + percentage).",
      },
      {
        q: "How does the tool know which direction is better?",
        a: "Each metric has a built-in direction. Higher-is-better metrics include organic_traffic, organic_keywords, backlinks, referring_domains, domain_authority, page_authority, pages_indexed, and mobile_score. Lower-is-better metrics include avg_position and load_time_ms. The leader finder and rank calculator use this direction automatically.",
      },
      {
        q: "What are quick wins and critical gaps?",
        a: "Quick wins are metrics where your gap to the leader is less than 20% — small improvements could close the gap. Critical gaps are metrics where your gap exceeds 50% — significant work needed. Strengths are metrics where you're the leader (rank #1).",
      },
      {
        q: "What extra features does this tool have compared to others?",
        a: "(1) CSV parser with field validation. (2) Comparison matrix builder (domains × metrics). (3) Min/max/avg calculator per metric. (4) Leader finder with metric-direction awareness. (5) Your rank calculator (1st, 2nd, 3rd per metric). (6) Gap-to-leader calculator (absolute + %). (7) Strengths/weaknesses analyzer. (8) Quick wins identifier (gap < 20%). (9) Critical gaps identifier (gap > 50%). (10) Metric direction lookup for 10 metrics. (11) Text report renderer. (12) CSV export. (13) Copy + download .txt/.csv. (14) History (localStorage, last 20). (15) Shareable URL. (16) Filter by metric. (17) Summary stats. (18) Color-coded comparison table in UI.",
      },
      {
        q: "Is my data sent anywhere?",
        a: "No. All parsing, pivoting, ranking, and gap analysis runs locally in your browser. History is stored in localStorage on this device only. The tool never makes network requests.",
      },
    ],
  },
  status: "done",
};
