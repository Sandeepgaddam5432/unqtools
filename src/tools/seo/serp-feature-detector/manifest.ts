/**
 * SERP Feature Detector — Tool Manifest
 */
import type { ToolManifest } from "../../../lib/tool";

export const manifest: ToolManifest = {
  id: "serp-feature-detector",
  name: "SERP Feature Detector",
  description: "Detect and track SERP features (featured snippets, PAA, local pack, image pack, video carousel).",
  category: "seo",
  keywords: ["serp feature", "serp tracker", "featured snippet", "serp detector"],
  icon: "Eye",
  requiresNetwork: false,
  seo: {
    title: "SERP Feature Detector — 100% Private, Offline | UnQTools",
    faq: [
      { q: "What does this tool do?", a: "Detect and track SERP features (featured snippets, PAA, local pack, image pack, video carousel)." },
      { q: "Is my data sent to a server?", a: "No. This tool runs 100% in your browser. Nothing is uploaded, tracked, or stored remotely." },
      { q: "What extra features does this tool have?", a: "Extras: (1) (1) Featured snippet detection, (2) (2) PAA box tracking, (3) (3) Local pack detection, (4) (4) Image pack, (5) (5) Video carousel, (6) (6) Shopping results, (7) (7) News box, (8) (8) Knowledge panel, (9) (9) Site links, (10) (10) SERP feature score, (11) (11) Export tracking sheet, (12) (12) PWA offline" },
      { q: "Does this work offline?", a: "Yes — install as a PWA and use it without network." },
    ],
  },
  status: "done",
};
