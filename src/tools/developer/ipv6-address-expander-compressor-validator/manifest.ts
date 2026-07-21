/**
 * IPv6 Address Expander / Compressor & Validator — Tool Manifest.
 * Tool #385 — Category 4 (Developer & Code).
 *
 * Expand a compressed IPv6 address to its full 128-bit form, compress a full
 * address to its RFC 5952 canonical short form, validate the address, show
 * which rules were applied (leading-zero removal, '::' run selection), list
 * every valid representation, classify the address type (loopback, link-local,
 * ULA, multicast, global, IPv4-mapped), and batch-process lists. Embedded
 * IPv4 (::ffff:192.0.2.1) and zone IDs (%eth0) handled. 100% client-side,
 * BigInt math, no network.
 */
import type { ToolManifest } from "../../../lib/tool";

export const manifest: ToolManifest = {
  id: "ipv6-address-expander-compressor-validator",
  name: "IPv6 Expander, Compressor & Validator",
  description:
    "Expand a compressed IPv6 address to its full 128-bit form, compress a full address to its RFC 5952 canonical short form, validate it, and see exactly which rules were applied (leading-zero removal, '::' run selection). Get every valid representation, classify the address type (loopback, link-local, ULA, multicast, global, IPv4-mapped, unspecified), and batch-process lists. Handles embedded IPv4 (::ffff:192.0.2.1) and zone IDs (%eth0). 100% client-side with BigInt 128-bit math.",
  category: "developer",
  keywords: [
    "ipv6 expander", "ipv6 compress", "expand ipv6 address", "ipv6 validator",
    "ipv6 canonical form", "rfc 5952", "ipv6 compress rules",
    "ipv6 to full form", "ipv6 shorten", "ipv6 address type",
    "ipv6 loopback", "ipv6 link-local", "ipv6 ula", "ipv6 multicast",
    "ipv4 mapped ipv6", "ipv6 zone id",
  ],
  icon: "network",
  requiresNetwork: false,
  seo: {
    title: "IPv6 Expander, Compressor & Validator — RFC 5952 Canonical | UnQTools",
    faq: [
      {
        q: "How does the compressor produce RFC 5952 canonical form?",
        a: "RFC 5952 mandates four rules: (1) all hex digits lowercase, (2) leading zeros in each hextet removed ('0db8' → 'db8'), (3) the longest run of consecutive zero hextets replaced with '::' — but only when the run is at least 2 hextets long, and (4) on ties the leftmost run wins. A single zero hextet is never compressed with '::'. The tool implements all four rules and shows which one changed each part of the address, so the transformation is transparent. The compressed form round-trips back to the exact same 128-bit value.",
      },
      {
        q: "What does the validator check?",
        a: "The validator parses the address and reports a precise error for each failure: more than one '::' sequence, empty hextets, hextets longer than 4 hex digits, hextet values out of range, wrong hextet count (fewer than 8 without '::' or more than 8), invalid embedded IPv4 octets, invalid characters, and an over-length zone ID. Valid addresses get a list of every acceptable representation (compressed, expanded, with embedded IPv4 if applicable, with leading zeros, uppercase hex) so you can compare them side by side.",
      },
      {
        q: "How does it handle embedded IPv4 and zone IDs?",
        a: "Embedded IPv4 in the last 32 bits (::ffff:192.0.2.1, ::192.0.2.1) is parsed into two trailing hextets so the rest of the tool sees a uniform 8-hextet address. The expanded and compressed forms are computed from those hextets, and a separate 'with embedded IPv4' representation is offered when applicable. Zone IDs (fe80::1%eth0) are stripped before parsing, preserved on the input display, and called out in the rule-explanation panel — they are not part of the 128-bit address.",
      },
      {
        q: "Can I batch-process a list of addresses?",
        a: "Yes. Paste one IPv6 address per line (or comma-separated) and the tool expands, compresses, and validates each entry. Invalid rows are flagged inline with the exact error. Download the result as CSV (input, expanded, compressed, type, valid, error) or JSON for downstream processing — every row's 128-bit value is BigInt-exact.",
      },
      {
        q: "What extra features does this tool have versus other IPv6 expanders?",
        a: "(1) RFC 5952 canonical compression with correct '::' placement rules (longest run, leftmost on tie, no single-zero compression). (2) Expansion reproduces the exact 128 bits. (3) Rule-by-rule explanation panel — leading-zero removal, '::' run selection, embedded IPv4 handling, zone ID strip. (4) Validator with precise error messages. (5) Every valid representation listed (compressed, expanded, uppercase, leading-zero, embedded-IPv4). (6) Address-type classification: unspecified, loopback, IPv4-mapped, IPv4-compatible, link-local, unique-local (ULA), multicast, global. (7) Embedded IPv4 and zone ID support. (8) Batch list processing. (9) Copy each form. (10) Download CSV and JSON. (11) History (localStorage, last 20). (12) Shareable URL with the input encoded. 100% client-side, BigInt-exact, no ads, no uploads.",
      },
    ],
  },
  status: "done",
};
