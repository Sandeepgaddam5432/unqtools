import type { ToolManifest } from "../../../lib/tool";

export const manifest: ToolManifest = {
  id: "topic-cluster-builder",
  name: "Topic Cluster Builder",
  description:
    "Build topic cluster maps with pillar page, supporting cluster content, subtopics, and internal link recommendations. Audience-aware subtopic generation (beginner/intermediate/advanced), cluster page title suggestions, content briefs with word count estimates, internal link matrix, JSON cluster map export, CSV export, history (localStorage), shareable URL. 100% client-side.",
  category: "seo",
  keywords: [
    "topic cluster", "pillar page", "cluster content",
    "content cluster", "internal linking", "content strategy",
    "hub and spoke", "content silo",
  ],
  icon: "network",
  requiresNetwork: false,
  seo: {
    title: "Topic Cluster Builder — Pillar Pages + Internal Link Map | UnQTools",
    faq: [
      {
        q: "How does the topic cluster builder work?",
        a: "Enter your pillar topic (e.g. 'SEO') and a list of supporting cluster topics (one per line). The tool generates a cluster page title suggestion per cluster (e.g. 'SEO: Keyword Research Guide'), 4 audience-aware subtopics per cluster, internal link recommendations (pillar ↔ cluster and cluster ↔ adjacent cluster), a content brief outline (title, target keyword, suggested word count, headers), and a downloadable JSON cluster map.",
      },
      {
        q: "What are subtopic templates?",
        a: "Six deterministic templates: 'What is <cluster>', 'How to do <cluster>', '<cluster> best practices', '<cluster> tools', '<cluster> examples', and 'Common <cluster> mistakes'. Based on your audience level, the tool picks 4 of these: beginner gets What is / How to / Examples / Mistakes; intermediate gets How to / Best practices / Tools / Mistakes; advanced gets Best practices / Tools / Examples / Mistakes. No AI — fully deterministic.",
      },
      {
        q: "How are internal links recommended?",
        a: "Two types: (1) Pillar ↔ cluster (every cluster links to the pillar and vice versa) and (2) cluster ↔ cluster (each cluster links to its adjacent neighbors, so cluster[i] ↔ cluster[i+1]). The internal link matrix visualizes which clusters should cross-link. All recommendations are derived from your input list — no external data.",
      },
      {
        q: "What extra features does this tool have compared to others?",
        a: "(1) Pillar + cluster parser. (2) Cluster page title generator. (3) Subtopic generator with 6 templates, audience-aware selection. (4) Internal link recommendations (pillar ↔ cluster, cluster ↔ cluster). (5) Cluster map builder (JSON structure). (6) Internal link matrix. (7) Content brief outline per cluster (title, keyword, word count, headers). (8) Audience level presets (beginner/intermediate/advanced). (9) Text report renderer. (10) CSV exporter (cluster, subtopic, title, keyword, word count). (11) Copy + Download .txt + Download CSV + Download JSON. (12) History (localStorage, last 20). (13) Shareable URL. (14) Filter by cluster. (15) Summary stats (total clusters, subtopics, internal links, total word count). (16) Word count estimator (beginner 800, intermediate 1500, advanced 2500).",
      },
      {
        q: "Is my data sent anywhere?",
        a: "No. All cluster generation, subtopic templating, and link recommendations run locally in your browser. History is stored in localStorage on this device only.",
      },
    ],
  },
  status: "done",
};
