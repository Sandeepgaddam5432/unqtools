/**
 * Color Contrast Checker (WCAG) — Tool Manifest
 */
import type { ToolManifest } from "../../../lib/tool";

export const manifest: ToolManifest = {
  id: "color-contrast-checker",
  name: "Color Contrast Checker (WCAG)",
  description: "Check color contrast ratios for WCAG 2.1 AA/AAA compliance. Foreground/background picker.",
  category: "image",
  keywords: ["color contrast", "wcag", "accessibility", "contrast ratio"],
  icon: "Contrast",
  requiresNetwork: false,
  seo: {
    title: "Color Contrast Checker (WCAG) — 100% Private, Offline | UnQTools",
    faq: [
      { q: "What does this tool do?", a: "Check color contrast ratios for WCAG 2.1 AA/AAA compliance. Foreground/background picker." },
      { q: "Is my data sent to a server?", a: "No. This tool runs 100% in your browser. Nothing is uploaded, tracked, or stored remotely." },
      { q: "What extra features does this tool have?", a: "Extras: (1) (1) WCAG 2.1 contrast ratio, (2) (2) AA compliance (4.5:1), (3) (3) AAA compliance (7:1), (4) (4) Large text check, (5) (5) Foreground/background picker, (6) (6) Live preview, (7) (7) Hex/RGB/HSL input, (8) (8) Suggested fixes, (9) (9) Bulk pair check, (10) (10) Copy colors, (11) (11) Export report, (12) (12) PWA offline" },
      { q: "Does this work offline?", a: "Yes — install as a PWA and use it without network." },
    ],
  },
  status: "done",
};
