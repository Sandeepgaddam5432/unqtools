/**
 * User Agent Parser — Tool Manifest
 */
import type { ToolManifest } from "../../../lib/tool";

export const manifest: ToolManifest = {
  id: "user-agent-parser",
  name: "User Agent Parser",
  description: "Parse any User-Agent string into browser, engine, OS, CPU, device, and bot/AI-crawler classification. Uses Client Hints when available. 100% client-side.",
  category: "network-security",
  keywords: ["user agent parser", "ua parser", "browser detection", "os detection", "device detection", "client hints"],
  icon: "Globe",
  requiresNetwork: false,
  seo: {
    title: "User Agent Parser — 100% Private, Offline | UnQTools",
    faq: [
      { q: "What does this tool do?", a: "Parse any User-Agent string into browser, engine, OS, CPU, device, and bot/AI-crawler classification. Uses Client Hints when available. 100% client-side." },
      { q: "Is my data sent to a server?", a: "No. This tool runs 100% in your browser. Nothing is uploaded, tracked, or stored remotely. It works offline as a PWA." },
      { q: "What extra features does this tool have?", a: "Extras: (1) UAParser.js-grade regex parsing (browser, engine, OS, CPU, device), (2) Client Hints integration via navigator.userAgentData, (3) Bot/AI-crawler detection (Googlebot, GPTBot, ClaudeBot, Bingbot), (4) Live 'Your UA' auto-detection on page load, (5) Bulk paste mode (one UA per line) with JSON output, (6) UA builder reverse mode — compose a UA from parts, (7) Confidence scoring (flags frozen/spoofed UA strings), (8) Export parsed results as JSON or CSV, (9) Copy individual fields with one click, (10) Honesty banner: UA strings are spoofable, Client Hints preferred, (11) PWA offline — works without network, (12) History of last 10 parsed UAs (localStorage)" },
      { q: "Does this work offline?", a: "Yes — install as a PWA and use it without network. All processing happens client-side." },
    ],
  },
  status: "done",
};
