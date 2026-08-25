/**
 * Ping Online (HTTP-based) — Tool Manifest
 */
import type { ToolManifest } from "../../../lib/tool";

export const manifest: ToolManifest = {
  id: "ping-online",
  name: "Ping Online (HTTP-based)",
  description: "HTTP-based ping tool to check if a URL is reachable. Measures response time and status codes.",
  category: "network-security",
  keywords: ["ping online", "url ping", "website ping", "http ping"],
  icon: "Activity",
  requiresNetwork: false,
  seo: {
    title: "Ping Online (HTTP-based) — 100% Private, Offline | UnQTools",
    faq: [
      { q: "What does this tool do?", a: "HTTP-based ping tool to check if a URL is reachable. Measures response time and status codes." },
      { q: "Is my data sent to a server?", a: "No. This tool runs 100% in your browser. Nothing is uploaded, tracked, or stored remotely." },
      { q: "What extra features does this tool have?", a: "Extras: (1) (1) HTTP reachability check, (2) (2) Response time measurement, (3) (3) Status code display, (4) (4) Headers inspection, (5) (5) Multiple URL batch check, (6) (6) Interval ping, (7) (7) Response size, (8) (8) SSL info, (9) (9) Copy results, (10) (10) Export CSV, (11) (11) PWA offline, (12) (12) Privacy note" },
      { q: "Does this work offline?", a: "Yes — install as a PWA and use it without network." },
    ],
  },
  status: "planned",
};
