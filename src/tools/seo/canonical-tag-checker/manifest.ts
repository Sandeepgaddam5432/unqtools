/**
 * Canonical Tag Checker — Tool Manifest
 */
import type { ToolManifest } from "../../../lib/tool";

export const manifest: ToolManifest = {
  id: "canonical-tag-checker",
  name: "Canonical Tag Checker",
  description: "Check canonical tags for proper implementation. Detect canonical chains, conflicts, and self-referencing issues.",
  category: "seo",
  keywords: ["canonical tag", "canonical checker", "rel canonical", "seo canonical"],
  icon: "CheckCircle",
  requiresNetwork: false,
  seo: {
    title: "Canonical Tag Checker — 100% Private, Offline | UnQTools",
    faq: [
      { q: "What does this tool do?", a: "Check canonical tags for proper implementation. Detect canonical chains, conflicts, and self-referencing issues." },
      { q: "Is my data sent to a server?", a: "No. This tool runs 100% in your browser. Nothing is uploaded, tracked, or stored remotely." },
      { q: "What extra features does this tool have?", a: "Extras: (1) (1) Canonical URL extraction, (2) (2) Self-referencing canonical detection, (3) (3) Canonical chain detection, (4) (4) Cross-domain canonical flag, (5) (5) HTTP vs HTTPS conflict, (6) (6) Multiple canonical tags flag, (7) (7) Bulk URL checking, (8) (8) robots.txt + canonical interaction, (9) (9) Copy canonical tag HTML, (10) (10) Generate correct canonical tag, (11) (11) Export report, (12) (12) PWA offline" },
      { q: "Does this work offline?", a: "Yes — install as a PWA and use it without network." },
    ],
  },
  status: "done",
};
