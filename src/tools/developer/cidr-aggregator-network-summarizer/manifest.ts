/**
 * CIDR Aggregator / Network Summarizer — Tool Manifest.
 * Tool #400 — Category 4 (Developer & Code).
 *
 * Paste any mix of IPs, dashed ranges, and CIDRs (IPv4 or IPv6) and the
 * tool aggregates them into the smallest possible set of CIDR prefixes —
 * merging adjacent/overlapping blocks, deduping, and optionally subtracting
 * exclusions — with before/after prefix & address counts and export in
 * CIDR / range / Cisco ACL / pfSense alias / nginx allow formats. 100%
 * client-side.
 */
import type { ToolManifest } from "../../../lib/tool";

export const manifest: ToolManifest = {
  id: "cidr-aggregator-network-summarizer",
  name: "CIDR Aggregator & Network Summarizer",
  description:
    "Aggregate messy lists of IPs, dashed ranges, and CIDR blocks (IPv4 and IPv6) into the smallest possible set of CIDR prefixes. Merges overlapping and adjacent blocks, dedupes, optionally subtracts exclusions, shows before/after prefix and address counts (BigInt), and exports as CIDR list, IP ranges, Cisco ACL, pfSense alias, or nginx allow. 100% client-side.",
  category: "developer",
  keywords: [
    "cidr aggregator", "summarize cidr", "supernet calculator",
    "merge ip ranges", "ip range to cidr", "cidr merge",
    "firewall alias aggregator", "ipv4 cidr summarizer", "ipv6 cidr aggregator",
    "network summarization", "ip block merge",
  ],
  icon: "network",
  requiresNetwork: false,
  seo: {
    title: "CIDR Aggregator & Network Summarizer — Merge IPs / Ranges / CIDRs | UnQTools",
    faq: [
      {
        q: "How does the CIDR aggregator work?",
        a: "Each input line (single IP, dashed range a.b.c.d-e.f.g.h, or CIDR block) is converted into a [start, end] numeric interval — IPv4 as a 32-bit BigInt and IPv6 as a 128-bit BigInt. The intervals are sorted, overlapping and adjacent intervals are merged into the smallest covering set, and each merged interval is greedily decomposed back into the minimal set of aligned CIDR prefixes (the same algorithm used by iprange-to-cidr / Python netaddr).",
      },
      {
        q: "Does it support both IPv4 and IPv6?",
        a: "Yes. The tool detects the family of each line automatically (':' → IPv6, otherwise IPv4), parses with full IPv6 '::' compression and embedded-IPv4 support, and aggregates IPv4 and IPv6 separately — you'll get two output sections (or only one if all inputs are the same family). BigInt is used throughout so huge ranges like 0.0.0.0/0 or ::/0 are counted mathematically without enumerating every address.",
      },
      {
        q: "How do exclusions (subtractions) work?",
        a: "Enter exclusion blocks on a separate line or in the exclusion box. The tool subtracts their intervals from the aggregated set — a single large block may be split into several smaller CIDRs around the excluded hole, exactly like a firewall rule that says 'allow this big network except this small slice'. The before/after counts reflect the post-exclusion totals.",
      },
      {
        q: "What export formats are supported?",
        a: "Five formats: CIDR list (one prefix per line), IP ranges (start-end per line), Cisco ACL (`access-list ... permit ip <net> <wildcard> any`), pfSense alias (a `network` alias body, one CIDR per line), and nginx (`allow <cidr>;` directives). All formats handle IPv4 and IPv6 and are copy/download ready.",
      },
      {
        q: "What extra features does this tool have versus other CIDR aggregators?",
        a: "(1) Mixed input — IPs, dashed ranges, and CIDRs in one paste. (2) Full IPv6 support with BigInt math. (3) Optional exclusion/subtraction that splits blocks correctly. (4) Before/after prefix and address counts with addresses-saved badge. (5) Five export formats (CIDR, ranges, Cisco ACL, pfSense alias, nginx allow). (6) Per-line parse errors collected and shown with line numbers. (7) CIDR ↔ range expansion both ways. (8) History (localStorage, last 20). (9) Shareable URL encoding input + exclusions. (10) Sort/normalize mode. (11) Address count via BigInt (handles /0 and ::/0 without overflow). (12) 100% client-side — your IP lists never leave the browser.",
      },
    ],
  },
  status: "done",
};
