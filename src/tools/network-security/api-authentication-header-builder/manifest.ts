/**
 * API Authentication Header Builder — Tool Manifest
 */
import type { ToolManifest } from "../../../lib/tool";

export const manifest: ToolManifest = {
  id: "api-authentication-header-builder",
  name: "API Authentication Header Builder",
  description: "Build API authentication headers: Bearer token, Basic Auth, API Key, HMAC, AWS Signature v4.",
  category: "network-security",
  keywords: ["api auth", "authentication header", "bearer token", "basic auth", "hmac"],
  icon: "KeyRound",
  requiresNetwork: false,
  seo: {
    title: "API Authentication Header Builder — 100% Private, Offline | UnQTools",
    faq: [
      { q: "What does this tool do?", a: "Build API authentication headers: Bearer token, Basic Auth, API Key, HMAC, AWS Signature v4." },
      { q: "Is my data sent to a server?", a: "No. This tool runs 100% in your browser. Nothing is uploaded, tracked, or stored remotely." },
      { q: "What extra features does this tool have?", a: "Extras: (1) (1) Bearer token header, (2) (2) Basic Auth header, (3) (3) API Key header, (4) (4) HMAC signature header, (5) (5) AWS Signature v4, (6) (6) OAuth 2.0, (7) (7) JWT header, (8) (8) Custom headers, (9) (9) curl command generator, (10) (10) Copy header, (11) (11) Export config, (12) (12) PWA offline" },
      { q: "Does this work offline?", a: "Yes — install as a PWA and use it without network." },
    ],
  },
  status: "done",
};
