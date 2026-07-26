/**
 * HSTS Preload Checker & Header Generator — Tool Manifest
 */
import type { ToolManifest } from "../../../lib/tool";

export const manifest: ToolManifest = {
  id: "hsts-preload-checker",
  name: "HSTS Preload Checker & Header Generator",
  description: "Check HSTS preload eligibility and generate Strict-Transport-Security headers with proper directives.",
  category: "network-security",
  keywords: ["hsts", "hsts preload", "strict transport security", "hsts header"],
  icon: "Lock",
  requiresNetwork: false,
  seo: {
    title: "HSTS Preload Checker & Header Generator — 100% Private, Offline | UnQTools",
    faq: [
      { q: "What does this tool do?", a: "Check HSTS preload eligibility and generate Strict-Transport-Security headers with proper directives." },
      { q: "Is my data sent to a server?", a: "No. This tool runs 100% in your browser. Nothing is uploaded, tracked, or stored remotely." },
      { q: "What extra features does this tool have?", a: "Extras: (1) (1) HSTS header generator, (2) (2) max-age directive, (3) (3) includeSubDomains, (4) (4) preload directive, (5) (5) Preload eligibility checklist, (6) (6) HSTS preload submission URL, (7) (7) Common misconfigurations, (8) (8) Header validation, (9) (9) Copy header, (10) (10) Nginx/Apache config, (11) (11) Export config, (12) (12) PWA offline" },
      { q: "Does this work offline?", a: "Yes — install as a PWA and use it without network." },
    ],
  },
  status: "done",
};
