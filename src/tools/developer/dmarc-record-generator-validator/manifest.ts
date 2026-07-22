/**
 * DMARC Record Generator & Validator — Tool Manifest.
 * Tool #393 — Category 4 (Developer & Code).
 *
 * Per blueprint: DMARC record generator & validator. Pure-JS builds DMARC
 * DNS TXT records (_dmarc.<domain>) from the v / p / sp / rua / ruf / fo /
 * adkim / aspf / pct / rf / ri tags, validates DMARC syntax against
 * RFC 7489, generates dig / nslookup / kdig (DoH) lookup commands,
 * explains each policy (none / quarantine / reject) with a strength meter,
 * validates rua / ruf mailto: URIs, and produces an enforcement roadmap
 * (none → quarantine → reject). 100% client-side generation and validation;
 * live lookup requires the network via the generated dig commands.
 */
import type { ToolManifest } from "../../../lib/tool";

export const manifest: ToolManifest = {
  id: "dmarc-record-generator-validator",
  name: "DMARC Record Generator & Validator",
  description:
    "Build a valid DMARC DNS TXT record (_dmarc.<domain>) from the v / p / sp / rua / ruf / fo / adkim / aspf / pct / rf / ri tags (policy none / quarantine / reject, subdomain policy, aggregate & forensic report URIs, failure-reporting options, DKIM & SPF alignment modes, percentage, report format & interval), validate any existing record against RFC 7489, decode every tag with plain-English explanations, validate rua/ruf mailto: syntax, score the policy strength (0–100), generate an enforcement roadmap (none → quarantine → reject), and generate dig / nslookup / kdig (DoH) lookup commands. 100% client-side generation and validation; live lookup requires the network via the generated dig commands.",
  category: "developer",
  keywords: [
    "dmarc record", "dmarc generator", "dmarc validator", "dmarc checker",
    "dmarc policy", "rfc 7489", "_dmarc", "dmarc1", "email authentication",
    "p=none", "p=quarantine", "p=reject", "rua", "ruf",
    "adkim", "aspf", "dmarc alignment", "dmarc enforcement",
  ],
  icon: "mail-check",
  requiresNetwork: false,
  seo: {
    title: "DMARC Record Generator & Validator — RFC 7489 + Enforcement Roadmap | UnQTools",
    faq: [
      {
        q: "How does the DMARC generator work?",
        a: "Pick your domain policy (p=none / quarantine / reject), the subdomain policy (sp=), enter aggregate and forensic report mailto: URIs (rua= / ruf=), choose failure-reporting options (fo=0/1/d/s), DKIM and SPF alignment modes (adkim=r/s, aspf=r/s), the percentage of mail the policy applies to (pct=0–100), and the report format / interval (rf=afrf, ri=seconds). The generator assembles a valid `v=DMARC1; p=...; ...` TXT record for the `_dmarc.<domain>` DNS name with tags in the recommended order, and shows a live preview with a policy-strength meter you can copy. Validation against RFC 7489 runs as you type.",
      },
      {
        q: "What do p=none / p=quarantine / p=reject mean?",
        a: "`p=none` is monitoring mode — receivers send aggregate (rua) and forensic (ruf) reports but take NO enforcement action on failing mail. Use this to collect data for 1–2 weeks before enforcing. `p=quarantine` tells receivers to deliver failing mail to the spam/junk folder (recommended intermediate step). `p=reject` tells receivers to REJECT failing mail at the SMTP layer (recommended end-state). Always ramp pct from 10 → 25 → 50 → 100 when moving up a level so you can detect false positives. The tool's enforcement roadmap tells you the exact next step.",
      },
      {
        q: "What does the validator check?",
        a: "(1) Valid `v=DMARC1` version tag (must be first). (2) Required `p=` policy tag present and one of none/quarantine/reject. (3) `sp=` subdomain policy is valid. (4) `rua=` / `ruf=` use valid `mailto:` syntax with a valid email address. (5) `fo=` is from {0, 1, d, s}. (6) `adkim=` / `aspf=` are r (relaxed) or s (strict). (7) `pct=` is 0–100. (8) `rf=` is `afrf`. (9) `ri=` is a positive integer (seconds). (10) Tag-order check (v= must be first). (11) Weak-policy warning for `p=none` (monitoring only). (12) Multiple DMARC records flagged (invalid — RFC 7489 §6.1). (13) External-destination verification note for rua/ruf pointing to another domain. (14) Policy-strength score (0–100). Every issue comes with a plain-English explanation and a suggested fix.",
      },
      {
        q: "What is DKIM / SPF alignment (adkim / aspf)?",
        a: "DMARC alignment checks that the domain in the DKIM signature (d=) or the SPF return-path matches the domain in the From: header. `adkim=r` (relaxed, default) allows organizational-domain matching — `mail.example.com` aligns with `example.com`. `adkim=s` (strict) requires exact matching — `mail.example.com` does NOT align with `example.com`. `aspf=r` / `aspf=s` work the same for SPF. Strict alignment is safer but breaks legitimate subdomain sending; most domains use relaxed alignment. The tool explains both modes and warns if your alignment is inconsistent with your sending architecture.",
      },
      {
        q: "What extra features does this tool have compared to other DMARC tools?",
        a: "(1) Visual generator for v / p / sp / rua / ruf / fo / adkim / aspf / pct / rf / ri tags. (2) RFC 7489 syntax validator with 14+ checks. (3) Per-tag plain-English explanations (`explainTag`). (4) Policy-strength meter (0–100, color-coded). (5) Enforcement roadmap (none → quarantine → reject with pct ramp). (6) rua / ruf mailto: URI validator with external-destination note. (7) DKIM / SPF alignment explainer (r vs s). (8) Failure-reporting options (fo) explainer (0/1/d/s). (9) dig / nslookup / kdig (DoH) / curl DoH lookup commands. (10) Multiple-DMARC-record detector. (11) Policy reference table. (12) Subdomain-policy warning when sp is weaker than p. (13) Copy/download record. (14) localStorage history (max 20, stores only metadata). (15) Shareable URL. 100% client-side.",
      },
    ],
  },
  status: "done",
};
