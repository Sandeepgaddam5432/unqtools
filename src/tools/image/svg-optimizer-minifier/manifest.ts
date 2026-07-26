/**
 * SVG Optimizer & Minifier — Tool Manifest
 */
import type { ToolManifest } from "../../../lib/tool";

export const manifest: ToolManifest = {
  id: "svg-optimizer-minifier",
  name: "SVG Optimizer & Minifier",
  description: "Optimize and minify SVG files. Remove metadata, simplify paths, strip comments, dedupe.",
  category: "image",
  keywords: ["svg optimizer", "svg minifier", "svg compress", "optimize svg"],
  icon: "Minimize2",
  requiresNetwork: false,
  seo: {
    title: "SVG Optimizer & Minifier — 100% Private, Offline | UnQTools",
    faq: [
      { q: "What does this tool do?", a: "Optimize and minify SVG files. Remove metadata, simplify paths, strip comments, dedupe." },
      { q: "Is my data sent to a server?", a: "No. This tool runs 100% in your browser. Nothing is uploaded, tracked, or stored remotely." },
      { q: "What extra features does this tool have?", a: "Extras: (1) (1) Remove metadata, (2) (2) Simplify paths, (3) (3) Strip comments, (4) (4) Dedupe definitions, (5) (5) Inline styles, (6) (6) Round numbers, (7) (7) Remove unused IDs, (8) (8) Before/after size, (9) (9) Download optimized, (10) (10) Copy SVG, (11) (11) Bulk optimize, (12) (12) PWA offline" },
      { q: "Does this work offline?", a: "Yes — install as a PWA and use it without network." },
    ],
  },
  status: "done",
};
