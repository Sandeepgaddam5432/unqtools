/**
 * SPF Record Generator & Validator — Tool Manifest.
 * Tool #391 — Category 4 (Developer & Code).
 *
 * Per blueprint: SPF record generator & validator. Pure-JS builds SPF
 * TXT records from a guided form (include, a, mx, ip4, ip6, ~all, -all),
 * validates SPF syntax against RFC 7208, generates dig commands, checks
 * the 10 DNS-lookup limit, and explains each mechanism in plain English.
 * 100% client-side — recursive DNS resolution requires the network, so
 * the lookup-limit checker uses an optional per-mechanism depth input
 * the user provides (or a live DoH mode clearly marked as network).
 */
import type { ToolManifest } from "../../../lib/tool";

export const manifest: ToolManifest = {
  id: "spf-record-generator-validator",
  name: "SPF Record Generator & Validator",
  description:
    "Build a valid SPF TXT record from a guided form (ip4, ip6, a, mx, include, redirect, all qualifier — -all / ~all / ?all / +all) and validate any existing record against RFC 7208. Live lookup-count meter tracks the 10 DNS-lookup limit, mechanism-order checker, deprecated ptr warnings, multiple-SPF-record detection, macro warnings, and a dig command generator. Plain-English mechanism explanations and suggested fixes for every validation issue. 100% client-side generation; recursive lookup counting uses an optional include-depth map or a clearly-labeled live-DNS mode.",
  category: "developer",
  keywords: [
    "spf record", "spf generator", "spf validator", "spf checker",
    "spf 10 lookup limit", "rfc 7208", "txt record", "email authentication",
    "include mechanism", "ip4 mechanism", "ip6 mechanism", "mx mechanism",
    "all mechanism", "~all", "-all", "dmarc",
  ],
  icon: "mail-check",
  requiresNetwork: false,
  seo: {
    title: "SPF Record Generator & Validator — RFC 7208 + 10-Lookup Limit | UnQTools",
    faq: [
      {
        q: "How does the SPF generator work?",
        a: "Pick your mechanisms from the visual form — ip4 / ip6 / a / mx / include / redirect — and the all-qualifier (-all = fail, ~all = softfail, ?all = neutral, +all = pass). The generator assembles a valid `v=spf1 ... <qualifier>all` record with mechanisms in the correct order, deduplicates identical entries, and shows a live preview you can copy. Validation against RFC 7208 runs as you type.",
      },
      {
        q: "What is the 10 DNS-lookup limit and how do you count it?",
        a: "RFC 7208 §4.6.4 says an SPF evaluation MUST NOT trigger more than 10 DNS-lookup-type mechanisms (include, a, mx, redirect, ptr, exists). Exceeding this silently returns PermError and breaks deliverability. We count each include / a / mx / redirect / exists / ptr as 1 lookup. For recursive include resolution (include:spf.example.com → its own includes), you can either enter the depth map manually per include, or run the clearly-labeled live-DNS mode (uses DNS-over-HTTPS) to resolve nested includes recursively and count the real total.",
      },
      {
        q: "What does the validator check?",
        a: "(1) Valid `v=spf1` prefix. (2) Each mechanism has a known name and qualifier (+/-/~/?). (3) ip4 / ip6 use valid CIDR syntax. (4) a / mx / include / redirect point to a syntactically-valid domain. (5) all is last. (6) redirect is last and not combined with all. (7) ptr is flagged as deprecated (RFC 7208 §5.5). (8) Multiple SPF records for one domain are flagged (invalid — RFC 7208 §3.2). (9) SPF macros (%{…}) are flagged as not statically evaluable. (10) Mechanism count and the 10-lookup limit. Every issue comes with a plain-English explanation and a suggested fix.",
      },
      {
        q: "What does '~all' vs '-all' vs '?all' vs '+all' mean?",
        a: "The qualifier on the `all` mechanism sets the default verdict for senders not matching any earlier mechanism. `-all` = Fail (reject — recommended for locked-down domains). `~all` = SoftFail (mark as spam but accept — recommended during rollout). `?all` = Neutral (no policy, accept — same as no SPF). `+all` = Pass (allow everyone — NEVER use this, it's worse than no SPF). The same four qualifiers prefix any mechanism, e.g. `+ip4:1.2.3.4` (explicit pass) or `~mx` (softfail if MX matches).",
      },
      {
        q: "What extra features does this tool have compared to other SPF tools?",
        a: "(1) Visual generator with ip4 / ip6 / a / mx / include / redirect / all-qualifier form. (2) RFC 7208 syntax validator with 10+ checks. (3) Live 10-DNS-lookup counter with color-coded meter. (4) Mechanism-order checker (all must be last; redirect must be last; no mechanism after all). (5) Deprecated ptr-mechanism warning. (6) Multiple-SPF-record detector (flags 2+ records). (7) SPF macro (%{…}) warning. (8) Plain-English mechanism explanations and per-issue suggested fixes. (9) dig command generator for SPF lookup (TXT _dmarc, +short, +multi). (10) Redirect vs include explainer. (11) Qualifier reference table. (12) Per-include recursive-depth input for lookup counting. (13) SPF flattening suggestion when lookup count exceeds 10. (14) Copy/download record. (15) localStorage history (max 20). (16) Shareable URL. 100% client-side.",
      },
    ],
  },
  status: "done",
};
