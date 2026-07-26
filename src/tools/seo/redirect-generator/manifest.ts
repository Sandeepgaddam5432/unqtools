/**
 * Redirect (301/302) Generator — Tool Manifest
 */
import type { ToolManifest } from "../../../lib/tool";

export const manifest: ToolManifest = {
  id: "redirect-generator",
  name: "Redirect (301/302) Generator",
  description: "Generate 301/302 redirect rules for .htaccess, Nginx, and Express. Bulk URL mapping with regex support.",
  category: "seo",
  keywords: ["redirect generator", "301 redirect", "302 redirect", "htaccess redirect"],
  icon: "Redirect",
  requiresNetwork: false,
  seo: {
    title: "Redirect (301/302) Generator — 100% Private, Offline | UnQTools",
    faq: [
      { q: "What does this tool do?", a: "Generate 301/302 redirect rules for .htaccess, Nginx, and Express. Bulk URL mapping with regex support." },
      { q: "Is my data sent to a server?", a: "No. This tool runs 100% in your browser. Nothing is uploaded, tracked, or stored remotely." },
      { q: "What extra features does this tool have?", a: "Extras: (1) (1) 301/302/307/308 redirect types, (2) (2) .htaccess rules, (3) (3) Nginx config, (4) (4) Express.js middleware, (5) (5) Cloudflare Workers, (6) (6) Bulk URL mapping (CSV), (7) (7) Regex redirect patterns, (8) (8) Wildcard redirects, (9) (9) Redirect chain detection, (10) (10) Copy config, (11) (11) Export rules file, (12) (12) PWA offline" },
      { q: "Does this work offline?", a: "Yes — install as a PWA and use it without network." },
    ],
  },
  status: "done",
};
