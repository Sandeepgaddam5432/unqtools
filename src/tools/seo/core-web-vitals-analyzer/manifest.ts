import type { ToolManifest } from "../../../lib/tool";

export const manifest: ToolManifest = {
  id: "core-web-vitals-analyzer",
  name: "Core Web Vitals Analyzer",
  description:
    "Analyze Core Web Vitals from imported PageSpeed Insights JSON. Extract LCP/INP/CLS/FCP/TTFB/TBT/SI metrics, score against Google thresholds, show pass/warn/fail per metric, overall 0-100 score, prioritized recommendations. CSV export, history (localStorage), shareable URL. 100% client-side.",
  category: "seo",
  keywords: [
    "core web vitals", "lcp", "inp", "cls", "fid",
    "pagespeed insights", "page speed", "performance",
  ],
  icon: "gauge",
  requiresNetwork: false,
  seo: {
    title: "Core Web Vitals Analyzer — LCP/INP/CLS Scoring | UnQTools",
    faq: [
      {
        q: "What are Core Web Vitals?",
        a: "Google's official page-experience metrics: LCP (Largest Contentful Paint, ≤2.5s good), INP (Interaction to Next Paint, ≤200ms good, replaces FID in March 2024), CLS (Cumulative Layout Shift, ≤0.1 good). They directly affect search rankings.",
      },
      {
        q: "How does the analyzer work?",
        a: "Paste a PageSpeed Insights JSON response (from the PSI API or web UI). The tool extracts LCP, INP, FID, CLS, FCP, TTFB, TBT, and Speed Index metrics, scores each against Google's thresholds, computes an overall 0-100 score, and generates prioritized recommendations.",
      },
      {
        q: "What are the thresholds?",
        a: "LCP: ≤2500ms good, >4000ms poor. INP: ≤200ms good, >500ms poor. CLS: ≤0.1 good, >0.25 poor. FCP: ≤1800ms good. TTFB: ≤800ms good. TBT: ≤200ms good. SI: ≤3400ms good. The full threshold table is included in the tool UI.",
      },
      {
        q: "How do I get the PageSpeed JSON?",
        a: "Visit pagespeed.web.dev, enter your URL, click Analyze, then open DevTools → Network → look for the API call to www.googleapis.com/pagespeedonline/v5/runPagespeed — copy the JSON response. Or call the PSI API directly with your API key.",
      },
      {
        q: "What extra features does this tool have compared to others?",
        a: "(1) LCP analysis. (2) INP analysis (the new metric that replaced FID). (3) CLS analysis. (4) Overall 0-100 score. (5) Pass/warn/fail per metric. (6) Prioritized recommendations (core vitals first). (7) URL field extraction. (8) CSV export. (9) History (localStorage, last 20). (10) Shareable URL. (11) Full threshold reference table.",
      },
      {
        q: "Is my data sent anywhere?",
        a: "No. The tool doesn't call the PageSpeed API — you paste the JSON yourself. All parsing runs locally. History is stored in localStorage on this device only.",
      },
    ],
  },
  status: "done",
};
