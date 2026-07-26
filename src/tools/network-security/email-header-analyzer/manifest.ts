/**
 * Email Header Analyzer — Tool Manifest
 */
import type { ToolManifest } from "../../../lib/tool";

export const manifest: ToolManifest = {
  id: "email-header-analyzer",
  name: "Email Header Analyzer",
  description: "Parse RFC 5322 email headers — Received chain, SPF, DKIM, DMARC, Message-ID, hops, delays. 100% client-side.",
  category: "network-security",
  keywords: ["email header analyzer", "rfc 5322", "spf", "dkim", "dmarc", "received chain"],
  icon: "Mail",
  requiresNetwork: false,
  seo: {
    title: "Email Header Analyzer — 100% Private, Offline | UnQTools",
    faq: [
      { q: "What does this tool do?", a: "Parse RFC 5322 email headers — Received chain, SPF, DKIM, DMARC, Message-ID, hops, delays. 100% client-side." },
      { q: "Is my data sent to a server?", a: "No. This tool runs 100% in your browser. Nothing is uploaded, tracked, or stored remotely. It works offline as a PWA." },
      { q: "What extra features does this tool have?", a: "Extras: (1) Parse full RFC 5322 headers (folded lines, comments), (2) Received chain visualization with hop-by-hop delays, (3) SPF, DKIM, DMARC authentication results extraction, (4) Message-ID, In-Reply-To, References threading, (5) From/To/Cc/Bcc/Reply-To parsing with display names, (6) Date parsing with timezone conversion, (7) Total transmission time calculation, (8) Geolocation hint from Received IPs (offline DB), (9) Header folding/decoding (RFC 2047 encoded-words), (10) Suspicious header detection (mismatched From/Return-Path), (11) Export as JSON, copy individual headers, (12) PWA offline — paste headers anywhere" },
      { q: "Does this work offline?", a: "Yes — install as a PWA and use it without network. All processing happens client-side." },
    ],
  },
  status: "done",
};
