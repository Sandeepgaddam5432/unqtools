/**
 * Subdomain Finder (Reference) — Tool Manifest
 */
import type { ToolManifest } from "../../../lib/tool";

export const manifest: ToolManifest = {
  id: "subdomain-finder",
  name: "Subdomain Finder (Reference)",
  description: "Reference tool for subdomain enumeration methods. Generate DNS queries and certificate transparency searches.",
  category: "network-security",
  keywords: ["subdomain finder", "subdomain enumeration", "subdomain search", "ct logs"],
  icon: "GitFork",
  requiresNetwork: false,
  seo: {
    title: "Subdomain Finder (Reference) — 100% Private, Offline | UnQTools",
    faq: [
      { q: "What does this tool do?", a: "Reference tool for subdomain enumeration methods. Generate DNS queries and certificate transparency searches." },
      { q: "Is my data sent to a server?", a: "No. This tool runs 100% in your browser. Nothing is uploaded, tracked, or stored remotely." },
      { q: "What extra features does this tool have?", a: "Extras: (1) (1) Common subdomain list (top 1000), (2) (2) DNS query generator, (3) (3) Certificate Transparency search URL, (4) (4) Subdomain bruteforce wordlist, (5) (5) Subdomain takeover checklist, (6) (6) Wildcard DNS detection, (7) (7) Bulk DNS query generator, (8) (8) Search engine dork generator, (9) (9) Copy queries, (10) (10) Export wordlist, (11) (11) PWA offline, (12) (12) Educational resources" },
      { q: "Does this work offline?", a: "Yes — install as a PWA and use it without network." },
    ],
  },
  status: "done",
};
