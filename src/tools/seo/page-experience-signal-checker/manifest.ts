import type { ToolManifest } from "../../../lib/tool";

export const manifest: ToolManifest = {
  id: "page-experience-signal-checker",
  name: "Page Experience Signal Checker",
  description:
    "Check page experience signals — Core Web Vitals (LCP, FID, CLS, INP), HTTPS, mobile-friendliness, intrusive interstitials, and safe browsing. Per-signal scoring, color-coded status, weighted page-experience score, recommendation generator, comparison mode, CSV export, history, shareable URL. 100% client-side — paste measurements, get instant scores.",
  category: "seo",
  keywords: [
    "page experience", "core web vitals", "cwv", "lcp",
    "fid", "cls", "inp", "https", "mobile friendly",
    "interstitial", "safe browsing", "page signals",
    "google page experience",
  ],
  icon: "gauge-circle",
  requiresNetwork: false,
  seo: {
    title: "Page Experience Signal Checker — CWV + HTTPS + Mobile | UnQTools",
    faq: [
      {
        q: "What signals does the page experience checker evaluate?",
        a: "Eight signals in total: four Core Web Vitals (LCP — Largest Contentful Paint, FID — First Input Delay, CLS — Cumulative Layout Shift, INP — Interaction to Next Paint) plus four binary signals (HTTPS enabled, mobile-friendly, no intrusive interstitials, safe browsing status). Each is scored independently and rolled up into an overall page experience score.",
      },
      {
        q: "How is the page experience score calculated?",
        a: "Each Core Web Vital is scored 0-100 using Google's thresholds (good/needs improvement/poor → 100/50/0). The four CWV scores are averaged into a CWV score. The final page experience score weights: CWV 40%, HTTPS 15%, mobile-friendly 20%, no interstitials 15%, safe browsing 10%. Every input field is editable so you can see how fixing each signal moves the overall score.",
      },
      {
        q: "What thresholds are used for each Core Web Vital?",
        a: "LCP: ≤2500ms good, 2500-4000 needs improvement, >4000 poor. FID: ≤100ms good, 100-300 needs improvement, >300 poor. CLS: ≤0.1 good, 0.1-0.25 needs improvement, >0.25 poor. INP: ≤200ms good, 200-500 needs improvement, >500 poor. These match Google's published Core Web Vitals thresholds.",
      },
      {
        q: "What extra features does this tool have compared to others?",
        a: "(1) Input validation. (2) Per-signal scoring (4 CWV + 4 binary). (3) Color-coded status (good/needs improvement/poor). (4) Overall CWV score (0-100). (5) Weighted page-experience score. (6) Recommendation generator (8+ rules). (7) Signal status table. (8) Render as text report. (9) Render as CSV. (10) Copy + Download .txt + Download CSV. (11) History (localStorage, last 20). (12) Shareable URL (encodes inputs in hash). (13) Comparison mode (current vs target). (14) Summary stats. (15) Score visualization (progress bar).",
      },
      {
        q: "Is my data sent anywhere?",
        a: "No. All scoring runs locally in your browser. History is stored in localStorage on this device only. No URL or measurements ever leave the page.",
      },
    ],
  },
  status: "done",
};
