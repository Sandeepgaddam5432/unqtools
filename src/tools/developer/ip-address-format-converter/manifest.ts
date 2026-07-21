/**
 * IP Address Format Converter — Tool Manifest.
 * Tool #384 — Category 4 (Developer & Code).
 *
 * Convert an IPv4 address between every representation — dotted-decimal,
 * 32-bit integer, hexadecimal (0xC0A80001), octal, dotted-binary, dotted-hex
 * and dotted-octal — with a per-octet breakdown. Also convert IPv6 between
 * its 128-bit integer, hex and expanded/compressed forms. Auto-detect the
 * input format and batch-convert lists. 100% client-side, BigInt math, no
 * network.
 */
import type { ToolManifest } from "../../../lib/tool";

export const manifest: ToolManifest = {
  id: "ip-address-format-converter",
  name: "IP Address Format Converter",
  description:
    "Convert an IPv4 address between dotted-decimal, 32-bit integer, hexadecimal (0xC0A80001), octal, dotted-binary, dotted-hex and dotted-octal with a per-octet breakdown. Convert IPv6 between its 128-bit integer, hex, expanded and RFC 5952 compressed forms. Auto-detect the input format (0x/0b/0 prefixes, mixed dotted-hex like 0xC0.0xA8.0.1) and batch-convert lists. 100% client-side with BigInt 128-bit math.",
  category: "developer",
  keywords: [
    "ip to decimal", "ip to hex", "ip to binary", "ip address converter",
    "integer to ip", "dotted decimal to integer", "ip to octal",
    "dotted hex ip", "dotted binary ip", "ipv4 to integer",
    "ipv6 to integer", "ipv6 to hex", "ip format converter",
    "0x ip address", "ip octal",
  ],
  icon: "binary",
  requiresNetwork: false,
  seo: {
    title: "IP Address Format Converter — Decimal, Hex, Binary, Octal | UnQTools",
    faq: [
      {
        q: "Which IPv4 formats does the converter support?",
        a: "Seven formats, all interoperable: dotted-decimal (192.168.0.1), 32-bit decimal integer (3232235521), hexadecimal with optional 0x prefix (0xC0A80001 or C0A80001), octal with leading 0 (030052000001), binary with optional 0b prefix (11000000101010000000000000000001), dotted-hex where each octet may carry its own 0x (0xC0.0xA8.0x00.0x01 or C0.A8.0.1) and dotted-binary (11000000.10101000.00000000.00000001). You can paste any of these and the tool auto-detects the source format and shows every other representation alongside a per-octet breakdown.",
      },
      {
        q: "How does auto-detection handle the leading-zero octal ambiguity?",
        a: "For a single integer, '0x' → hex, '0b' → binary, a leading '0' on a multi-digit value → octal, otherwise decimal. For dotted form, each octet is inspected: '0x' → dotted-hex, '0b' → dotted-binary, a leading '0' (multi-digit, octal digits only) → dotted-octal, otherwise dotted-decimal. Mixed dotted-hex (some octets with 0x, some without) is accepted — every octet is parsed as hex when any 0x prefix appears. Out-of-range octets (>255) and integers larger than 2^32−1 are flagged with a precise error message.",
      },
      {
        q: "Does it convert IPv6 addresses too?",
        a: "Yes. Paste any IPv6 address (full, compressed with '::', or embedded-IPv4 like ::ffff:192.0.2.1) and the tool returns its 128-bit decimal integer (BigInt-exact), full 128-bit hex (no separators), expanded form (8 hextets, 4 digits each) and RFC 5952 canonical compressed form. The 128-bit math uses BigInt because JavaScript Number only safely holds 53-bit integers — even ::ffff:ffff:ffff:ffff:ffff:ffff:ffff:ffff is exact.",
      },
      {
        q: "Can I batch-convert a list of addresses?",
        a: "Yes. Paste one address per line (or comma-separated) and the tool converts each entry, listing the source format and all target representations. Invalid entries are flagged inline with the error so you can copy the good rows. Download the result as CSV or JSON for downstream use.",
      },
      {
        q: "What extra features does this tool have versus other IP converters?",
        a: "(1) Seven IPv4 formats in one tool (most competitors do one or two). (2) Auto-detect input format with 0x/0b/0 prefix rules. (3) Per-octet breakdown table (decimal, hex, binary, octal) so the conversion is transparent. (4) IPv6 ↔ 128-bit integer, hex, expanded, compressed. (5) Batch list conversion. (6) Validation with clear error messages for out-of-range octets and integers. (7) Copy each representation to clipboard. (8) Download CSV and JSON. (9) History (localStorage, last 20). (10) Shareable URL with the input encoded. (11) Mixed dotted-hex support (0xC0.0xA8.0.1). (12) RFC 5952 canonical compression for IPv6. 100% client-side, BigInt-exact, no ads, no uploads.",
      },
    ],
  },
  status: "done",
};
