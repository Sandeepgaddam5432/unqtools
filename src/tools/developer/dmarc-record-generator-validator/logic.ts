/**
 * DMARC Record Generator & Validator — pure logic.
 *
 * Builds DMARC DNS TXT records (_dmarc.<domain>) from the v / p / sp / rua /
 * ruf / fo / adkim / aspf / pct / rf / ri tags, validates any record
 * against RFC 7489, decodes every tag with plain-English explanations,
 * validates rua/ruf mailto: syntax, scores the policy strength (0–100),
 * generates an enforcement roadmap (none → quarantine → reject with pct
 * ramp), and generates dig / nslookup / kdig (DoH) / curl DoH lookup
 * commands.
 *
 * Pure functions only — no DOM, no network, no external deps.
 *
 * PRIVACY: The history feature stores only operation metadata
 * (action + policy + strength + ts), NEVER the record, domain, or report
 * URIs.
 */

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export type DmarcPolicy = "none" | "quarantine" | "reject";

export type AlignmentMode = "r" | "s";

/** Failure-reporting options for the fo= tag (RFC 7489 §6.3). */
export type FailureOption = "0" | "1" | "d" | "s";

export type ReportFormat = "afrf";

/** All known DMARC record tags. */
export type DmarcTagName =
  | "v"
  | "p"
  | "sp"
  | "rua"
  | "ruf"
  | "fo"
  | "adkim"
  | "aspf"
  | "pct"
  | "rf"
  | "ri";

export type DmarcTags = Partial<Record<DmarcTagName, string>>;

export interface DmarcInput {
  domain: string;
  policy: DmarcPolicy;
  subdomainPolicy?: DmarcPolicy | "inherit";
  rua?: string;            // comma-separated mailto: URIs
  ruf?: string;            // comma-separated mailto: URIs
  fo?: FailureOption[];    // failure-reporting options
  adkim?: AlignmentMode;   // DKIM alignment (default r)
  aspf?: AlignmentMode;    // SPF alignment (default r)
  pct?: number;            // 0-100 (default 100)
  rf?: ReportFormat;       // default afrf
  ri?: number;             // seconds (default 86400)
}

export type IssueLevel = "error" | "warning" | "info";

export interface ValidationIssue {
  level: IssueLevel;
  code: string;
  message: string;
  fix?: string;
}

export interface ValidationResult {
  valid: boolean;
  tags: DmarcTags;
  issues: ValidationIssue[];
  policy: DmarcPolicy | null;
  subdomainPolicy: DmarcPolicy | null;
  strength: number;             // 0-100
  strengthLabel: "none" | "weak" | "moderate" | "strong" | "maximum";
  recordLength: number;
  hasRua: boolean;
  hasRuf: boolean;
}

export interface TagExplanation {
  tag: string;
  required: boolean;
  short: string;
  long: string;
  default?: string;
}

export interface PolicyExplanation {
  policy: DmarcPolicy;
  short: string;
  long: string;
  strength: number;
  recommendation: string;
}

export interface AlignmentExplanation {
  mode: AlignmentMode;
  short: string;
  long: string;
}

export interface FailureOptionExplanation {
  option: FailureOption;
  short: string;
  long: string;
}

export interface GeneratedCommand {
  tool: "dig" | "nslookup" | "kdig" | "host" | "curl";
  label: string;
  command: string;
  explanation: string;
}

export interface RoadmapStep {
  level: number;
  title: string;
  description: string;
  isCurrent: boolean;
  isDone: boolean;
}

export interface HistoryEntry {
  ts: number;
  action: "generate" | "validate";
  policy: DmarcPolicy | "unknown";
  strength: number;
}

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

export const VALID_POLICIES: ReadonlySet<DmarcPolicy> = new Set([
  "none", "quarantine", "reject",
]);

export const VALID_ALIGNMENTS: ReadonlySet<AlignmentMode> = new Set(["r", "s"]);

export const VALID_FAILURE_OPTIONS: ReadonlySet<FailureOption> = new Set([
  "0", "1", "d", "s",
]);

export const VALID_REPORT_FORMATS: ReadonlySet<ReportFormat> = new Set(["afrf"]);

export const DMARC_RI_DEFAULT = 86400;  // 24 hours
export const DMARC_PCT_DEFAULT = 100;
export const DMARC_RF_DEFAULT: ReportFormat = "afrf";

/** Ordered tag list for the record generator (RFC 7489 §6.3 ordering). */
export const TAG_ORDER: readonly DmarcTagName[] = [
  "v", "p", "sp", "rua", "ruf", "fo", "adkim", "aspf", "pct", "rf", "ri",
];

// ---------------------------------------------------------------------------
// Tag / policy / alignment explanations
// ---------------------------------------------------------------------------

const TAG_EXPLANATIONS: Record<DmarcTagName, TagExplanation> = {
  v: {
    tag: "v",
    required: true,
    short: "Version",
    long: "DMARC version. MUST be the first tag and the value MUST be exactly `DMARC1` (case-insensitive). Identifies the TXT record as a DMARC record.",
  },
  p: {
    tag: "p",
    required: true,
    short: "Policy",
    long: "Policy for the organizational domain. `none` = monitor only (no enforcement). `quarantine` = deliver failing mail to spam. `reject` = reject failing mail at SMTP. Always ramp pct from 10 → 100 when moving up.",
  },
  sp: {
    tag: "sp",
    required: false,
    short: "Subdomain policy",
    long: "Policy for subdomains. Defaults to the value of `p=` (inherit). Set explicitly when subdomains need a different policy (e.g. p=reject but sp=none for parked subdomains).",
    default: "inherits from p=",
  },
  rua: {
    tag: "rua",
    required: false,
    short: "Aggregate report URI",
    long: "Comma-separated list of `mailto:` URIs that receive daily aggregate (rua) reports. Aggregate reports are XML summaries of all mail claiming to be from your domain — used for monitoring. Receiver MUST be authorized via a DMARC record at the report-receiver's domain (`example.com._report._dmarc.reportreceiver.com`).",
  },
  ruf: {
    tag: "ruf",
    required: false,
    short: "Forensic report URI",
    long: "Comma-separated list of `mailto:` URIs that receive forensic (ruf) reports — copies of failing messages with headers. Controlled by the `fo=` tag. Forensic reports may leak PII and are increasingly suppressed by receivers (Gmail, Yahoo); rely on rua for monitoring.",
  },
  fo: {
    tag: "fo",
    required: false,
    short: "Failure reporting options",
    long: "Colon-separated failure-reporting options for the ruf= destinations. `0` (default) = report if both SPF and DKIM fail. `1` = report if either fails. `d` = report if DKIM failed. `s` = report if SPF failed. Ignored if ruf= is absent.",
    default: "0",
  },
  adkim: {
    tag: "adkim",
    required: false,
    short: "DKIM alignment",
    long: "DKIM identifier-alignment mode. `r` (relaxed, default) allows organizational-domain matching — `mail.example.com` aligns with `example.com`. `s` (strict) requires exact matching. Strict is safer but breaks legitimate subdomain sending.",
    default: "r",
  },
  aspf: {
    tag: "aspf",
    required: false,
    short: "SPF alignment",
    long: "SPF identifier-alignment mode. `r` (relaxed, default) allows organizational-domain matching. `s` (strict) requires exact matching. Same semantics as adkim=.",
    default: "r",
  },
  pct: {
    tag: "pct",
    required: false,
    short: "Percentage",
    long: "Percentage of mail the policy applies to (0–100). `pct=100` = full enforcement. Use lower values to ramp up safely — e.g. start at `pct=10` when moving from none → quarantine, then ramp to 100.",
    default: "100",
  },
  rf: {
    tag: "rf",
    required: false,
    short: "Report format",
    long: "Report format for rua/ruf reports. Only defined value is `afrf` (Authentication Failure Reporting Format, RFC 6591).",
    default: "afrf",
  },
  ri: {
    tag: "ri",
    required: false,
    short: "Report interval",
    long: "Requested interval between aggregate reports, in seconds. Default is 86400 (24 hours). Receivers may use a longer interval at their discretion.",
    default: "86400",
  },
};

const POLICY_EXPLANATIONS: Record<DmarcPolicy, PolicyExplanation> = {
  none: {
    policy: "none",
    short: "Monitor only",
    long: "Receivers send aggregate (rua) and forensic (ruf) reports but take NO enforcement action on failing mail. Use this to collect data for 1–2 weeks before enforcing.",
    strength: 0,
    recommendation: "Move to p=quarantine with pct=10 once you've reviewed 2 weeks of rua reports and identified all legitimate senders.",
  },
  quarantine: {
    policy: "quarantine",
    short: "Spam folder",
    long: "Receivers deliver failing mail to the spam/junk folder. Recommended intermediate step before full reject.",
    strength: 50,
    recommendation: "Ramp pct from 10 → 25 → 50 → 100 while monitoring rua reports for false positives. Then move to p=reject pct=10.",
  },
  reject: {
    policy: "reject",
    short: "Reject at SMTP",
    long: "Receivers reject failing mail at the SMTP layer (mail never reaches the inbox). Recommended end-state for domains with verified legitimate senders.",
    strength: 100,
    recommendation: "Maximum enforcement achieved. Continue monitoring rua reports and rotate DKIM keys annually.",
  },
};

const ALIGNMENT_EXPLANATIONS: Record<AlignmentMode, AlignmentExplanation> = {
  r: {
    mode: "r",
    short: "Relaxed (default)",
    long: "Organizational-domain matching — `mail.example.com` aligns with `example.com`. Recommended for most domains.",
  },
  s: {
    mode: "s",
    short: "Strict",
    long: "Exact-domain matching — `mail.example.com` does NOT align with `example.com`. Safer against subdomain spoofing but breaks legitimate subdomain sending.",
  },
};

const FAILURE_OPTION_EXPLANATIONS: Record<FailureOption, FailureOptionExplanation> = {
  "0": {
    option: "0",
    short: "Both fail (default)",
    long: "Generate a forensic (ruf) report only if BOTH SPF and DKIM fail to align. Default behavior.",
  },
  "1": {
    option: "1",
    short: "Either fails",
    long: "Generate a forensic report if EITHER SPF OR DKIM fails to align. More reports, more noise.",
  },
  d: {
    option: "d",
    short: "DKIM failed",
    long: "Generate a forensic report if DKIM failed to verify (regardless of SPF).",
  },
  s: {
    option: "s",
    short: "SPF failed",
    long: "Generate a forensic report if SPF failed (regardless of DKIM).",
  },
};

export function explainTag(tag: DmarcTagName): TagExplanation {
  return TAG_EXPLANATIONS[tag];
}

export function explainAllTags(): TagExplanation[] {
  return TAG_ORDER.map((t) => TAG_EXPLANATIONS[t]);
}

export function explainPolicy(p: DmarcPolicy): PolicyExplanation {
  return POLICY_EXPLANATIONS[p];
}

export function explainAllPolicies(): PolicyExplanation[] {
  return ["none", "quarantine", "reject"].map(
    (p) => POLICY_EXPLANATIONS[p as DmarcPolicy],
  );
}

export function explainAlignment(a: AlignmentMode): AlignmentExplanation {
  return ALIGNMENT_EXPLANATIONS[a];
}

export function explainFailureOption(fo: FailureOption): FailureOptionExplanation {
  return FAILURE_OPTION_EXPLANATIONS[fo];
}

export function explainAllFailureOptions(): FailureOptionExplanation[] {
  return ["0", "1", "d", "s"].map(
    (f) => FAILURE_OPTION_EXPLANATIONS[f as FailureOption],
  );
}

// ---------------------------------------------------------------------------
// Validators
// ---------------------------------------------------------------------------

const DOMAIN_RE = /^(?=.{1,253}$)([a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?\.)+[a-zA-Z]{2,}$/;
const EMAIL_RE = /^[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}$/;

export function isValidDomain(v: string): boolean {
  const s = v.trim().toLowerCase();
  if (!s) return false;
  return DOMAIN_RE.test(s);
}

export function isValidPolicy(p: string): p is DmarcPolicy {
  return VALID_POLICIES.has(p as DmarcPolicy);
}

export function isValidAlignment(a: string): a is AlignmentMode {
  return VALID_ALIGNMENTS.has(a as AlignmentMode);
}

export function isValidFailureOption(fo: string): fo is FailureOption {
  return VALID_FAILURE_OPTIONS.has(fo as FailureOption);
}

export function isValidReportFormat(rf: string): rf is ReportFormat {
  return VALID_REPORT_FORMATS.has(rf as ReportFormat);
}

/**
 * Validate a single mailto: URI per the DMARC ru=/ruf= syntax
 * (RFC 7489 §6.3 + RFC 6068). Accepts:
 *   - mailto:user@example.com
 *   - mailto:user@example.com!10m  (DMARC size-suffix, optional)
 * Returns the parsed email and optional size suffix.
 */
export function validateMailtoUri(uri: string): {
  ok: boolean;
  email?: string;
  size?: string;
  reason?: string;
} {
  const s = (uri || "").trim();
  if (!s) return { ok: false, reason: "Empty URI" };
  if (!s.toLowerCase().startsWith("mailto:")) {
    return { ok: false, reason: 'Must start with "mailto:"' };
  }
  // Strip the mailto: prefix.
  let rest = s.slice("mailto:".length);
  // Optional DMARC size suffix: "!10m" or "!1k" etc.
  let size: string | undefined;
  const bang = rest.indexOf("!");
  if (bang >= 0) {
    size = rest.slice(bang + 1);
    rest = rest.slice(0, bang);
    if (!/^[0-9]+[kmg]?$/i.test(size)) {
      return { ok: false, reason: `Invalid size suffix "${size}" — use e.g. 10m, 1g, 500k` };
    }
  }
  const email = rest.trim();
  if (!email) return { ok: false, reason: "Empty email after mailto:" };
  if (!EMAIL_RE.test(email)) {
    return { ok: false, reason: `"${email}" is not a valid email address` };
  }
  return { ok: true, email, size };
}

/** Validate a comma-separated list of mailto: URIs. */
export function validateMailtoList(list: string): {
  ok: boolean;
  results: ReturnType<typeof validateMailtoUri>[];
} {
  const items = (list || "").split(",").map((s) => s.trim()).filter(Boolean);
  if (items.length === 0) return { ok: true, results: [] };
  const results = items.map(validateMailtoUri);
  return { ok: results.every((r) => r.ok), results };
}

// ---------------------------------------------------------------------------
// Policy strength
// ---------------------------------------------------------------------------

/**
 * Compute a 0–100 policy-strength score for a DMARC record.
 *
 *   - p=none       → base 0
 *   - p=quarantine → base 50
 *   - p=reject     → base 100
 *
 * The base is scaled by pct/100. If sp= is weaker than p=, we deduct 5
 * (subdomain enforcement is weaker than organizational-domain enforcement).
 * The result is clamped to 0–100.
 */
export function computePolicyStrength(
  policy: DmarcPolicy,
  subdomainPolicy: DmarcPolicy | null,
  pct: number,
): { strength: number; label: ValidationResult["strengthLabel"] } {
  const base = POLICY_EXPLANATIONS[policy].strength;
  const effectivePct = typeof pct === "number" && pct >= 0 && pct <= 100
    ? pct
    : DMARC_PCT_DEFAULT;
  let strength = Math.round((base * effectivePct) / 100);

  // Deduct if subdomain policy is weaker than the org-domain policy.
  if (subdomainPolicy && policyRank(subdomainPolicy) < policyRank(policy)) {
    strength = Math.max(0, strength - 5);
  }

  const label: ValidationResult["strengthLabel"] =
    strength === 0 ? "none"
    : strength <= 25 ? "weak"
    : strength < 75 ? "moderate"
    : strength < 100 ? "strong"
    : "maximum";

  return { strength, label };
}

function policyRank(p: DmarcPolicy): number {
  return p === "none" ? 0 : p === "quarantine" ? 1 : 2;
}

// ---------------------------------------------------------------------------
// Record generator
// ---------------------------------------------------------------------------

/** Build a DMARC TXT record from structured input. Tags are emitted in the
 *  RFC 7489 §6.3 recommended order. */
export function buildRecord(input: DmarcInput): string {
  const parts: string[] = ["v=DMARC1", `p=${input.policy}`];

  if (input.subdomainPolicy && input.subdomainPolicy !== "inherit") {
    parts.push(`sp=${input.subdomainPolicy}`);
  }
  const rua = (input.rua || "").trim();
  if (rua) parts.push(`rua=${rua}`);
  const ruf = (input.ruf || "").trim();
  if (ruf) parts.push(`ruf=${ruf}`);

  if (input.fo && input.fo.length > 0) {
    // Dedupe + preserve order.
    const seen = new Set<FailureOption>();
    const list: FailureOption[] = [];
    for (const f of input.fo) {
      if (!seen.has(f)) { seen.add(f); list.push(f); }
    }
    // Don't emit the default "0" alone.
    if (!(list.length === 1 && list[0] === "0")) {
      parts.push(`fo=${list.join(":")}`);
    }
  }

  if (input.adkim && input.adkim !== "r") parts.push(`adkim=${input.adkim}`);
  if (input.aspf && input.aspf !== "r") parts.push(`aspf=${input.aspf}`);
  if (typeof input.pct === "number" && input.pct !== DMARC_PCT_DEFAULT) {
    parts.push(`pct=${input.pct}`);
  }
  if (input.rf && input.rf !== DMARC_RF_DEFAULT) parts.push(`rf=${input.rf}`);
  if (typeof input.ri === "number" && input.ri !== DMARC_RI_DEFAULT) {
    parts.push(`ri=${input.ri}`);
  }

  return parts.join("; ");
}

/** Build the DNS name for a DMARC record: `_dmarc.<domain>`. */
export function buildDmarcName(domain: string): string {
  const d = domain.trim().toLowerCase();
  if (!d) return "";
  return `_dmarc.${d}`;
}

// ---------------------------------------------------------------------------
// Record parser
// ---------------------------------------------------------------------------

/**
 * Parse a DMARC TXT record string into a tag map. Supports both
 * semicolon-separated (`v=DMARC1; p=reject; ...`) and whitespace-separated
 * forms. Strips surrounding double quotes (dig +short wraps TXT values).
 */
export function parseRecord(record: string): {
  tags: DmarcTags;
  issues: ValidationIssue[];
} {
  const issues: ValidationIssue[] = [];
  const tags: DmarcTags = {};

  const s = (record || "").trim();
  if (!s) {
    issues.push({ level: "error", code: "empty", message: "Empty input." });
    return { tags, issues };
  }
  const cleaned = s.replace(/^"+|"+$/g, "").trim();
  if (!cleaned) {
    issues.push({ level: "error", code: "empty", message: "Empty input." });
    return { tags, issues };
  }

  const tokens = cleaned.split(/[;\s]+/).filter(Boolean);
  for (const tok of tokens) {
    const eq = tok.indexOf("=");
    if (eq < 0) {
      issues.push({
        level: "warning",
        code: "not-a-tag",
        message: `Token "${tok}" is not a tag=value pair — ignored.`,
      });
      continue;
    }
    const name = tok.slice(0, eq).toLowerCase();
    const value = tok.slice(eq + 1);
    if (!name) {
      issues.push({
        level: "warning",
        code: "empty-tag-name",
        message: `Token "${tok}" has an empty tag name — ignored.`,
      });
      continue;
    }
    if (tags[name as DmarcTagName] !== undefined) {
      issues.push({
        level: "warning",
        code: "duplicate-tag",
        message: `Tag "${name}" appears more than once — only the last value is kept.`,
      });
    }
    tags[name as DmarcTagName] = value;
  }

  return { tags, issues };
}

// ---------------------------------------------------------------------------
// Validator
// ---------------------------------------------------------------------------

/**
 * Validate a DMARC record against RFC 7489. Returns the parsed tags, a list
 * of issues (each with a code, level, message, and suggested fix), the
 * detected policy + subdomain policy, the policy-strength score, and
 * whether rua/ruf are present.
 */
export function validateRecord(record: string): ValidationResult {
  const issues: ValidationIssue[] = [];
  const parsed = parseRecord(record);
  issues.push(...parsed.issues);
  const tags = parsed.tags;

  // v= must be present and equal DMARC1 (case-insensitive).
  const v = tags.v;
  if (v === undefined) {
    issues.push({
      level: "error",
      code: "no-version",
      message: 'Missing required v= tag. The record must start with "v=DMARC1".',
      fix: 'Prefix the record with "v=DMARC1; ".',
    });
  } else if (v.toLowerCase() !== "dmarc1") {
    issues.push({
      level: "error",
      code: "bad-version",
      message: `v= tag has value "${v}" — must be exactly "DMARC1" (case-insensitive).`,
      fix: 'Set v=DMARC1.',
    });
  }

  // v= must be the FIRST tag.
  const s = (record || "").trim().replace(/^"+|"+$/g, "").trim();
  const firstToken = s.split(/[;\s]+/)[0] || "";
  if (firstToken && !firstToken.toLowerCase().startsWith("v=")) {
    issues.push({
      level: "error",
      code: "v-not-first",
      message: "v= must be the first tag in the record.",
      fix: 'Move "v=DMARC1" to the beginning of the record.',
    });
  }

  // p= is required and must be none/quarantine/reject.
  const pRaw = tags.p;
  let policy: DmarcPolicy | null = null;
  if (pRaw === undefined) {
    issues.push({
      level: "error",
      code: "no-policy",
      message: "Missing required p= tag. The policy is mandatory.",
      fix: 'Add p=none, p=quarantine, or p=reject.',
    });
  } else if (!isValidPolicy(pRaw)) {
    issues.push({
      level: "error",
      code: "bad-policy",
      message: `p= tag has value "${pRaw}" — must be one of none, quarantine, reject.`,
      fix: 'Set p=none (monitor), p=quarantine (spam folder), or p=reject (SMTP reject).',
    });
  } else {
    policy = pRaw;
    if (policy === "none") {
      issues.push({
        level: "warning",
        code: "weak-policy",
        message: "p=none is monitoring only — receivers take NO enforcement action. Move to p=quarantine or p=reject after reviewing 2 weeks of rua reports.",
        fix: "Ramp to p=quarantine pct=10 → 100, then p=reject pct=10 → 100.",
      });
    }
  }

  // sp= optional — must be a valid policy.
  const spRaw = tags.sp;
  let subdomainPolicy: DmarcPolicy | null = null;
  if (spRaw !== undefined) {
    if (!isValidPolicy(spRaw)) {
      issues.push({
        level: "error",
        code: "bad-sp",
        message: `sp= tag has value "${spRaw}" — must be one of none, quarantine, reject.`,
        fix: 'Set sp=none, sp=quarantine, or sp=reject.',
      });
    } else {
      subdomainPolicy = spRaw;
      // Warn if sp is weaker than p (subdomain enforcement gap).
      if (policy && policyRank(subdomainPolicy) < policyRank(policy)) {
        issues.push({
          level: "info",
          code: "sp-weaker-than-p",
          message: `sp=${subdomainPolicy} is weaker than p=${policy} — subdomains can still be spoofed even though the org domain is enforced. Intentional for parked subdomains; risky for active subdomain sending.`,
        });
      }
    }
  }

  // rua= / ruf= mailto: validation.
  const rua = tags.rua;
  const hasRua = rua !== undefined && rua !== "";
  if (hasRua) {
    const r = validateMailtoList(rua);
    if (!r.ok) {
      for (const res of r.results) {
        if (!res.ok) {
          issues.push({
            level: "error",
            code: "bad-rua",
            message: `Invalid rua= URI: ${res.reason}`,
            fix: 'Use mailto:user@example.com (comma-separated for multiple).',
          });
        }
      }
    } else {
      // External-destination verification note.
      for (const res of r.results) {
        if (res.email) {
          const at = res.email.indexOf("@");
          if (at >= 0) {
            const ruaDomain = res.email.slice(at + 1).toLowerCase();
            // We don't know the domain the record is published on, so we
            // just emit an info note about the verification requirement
            // if ruaDomain != <record domain>. Since we can't know the
            // record domain from the record alone, we always emit a hint
            // pointing the user at the verification requirement.
            issues.push({
              level: "info",
              code: "rua-external-destination",
              message: `rua= points to ${res.email}. If this is a different organizational domain than the record's domain, you MUST publish a DMARC verification record at "${ruaDomain}._report._dmarc.<your-domain>" authorizing the report receiver (RFC 7489 §7.1).`,
            });
            break; // one note per record
          }
        }
      }
    }
  }

  const ruf = tags.ruf;
  const hasRuf = ruf !== undefined && ruf !== "";
  if (hasRuf) {
    const r = validateMailtoList(ruf);
    if (!r.ok) {
      for (const res of r.results) {
        if (!res.ok) {
          issues.push({
            level: "error",
            code: "bad-ruf",
            message: `Invalid ruf= URI: ${res.reason}`,
            fix: 'Use mailto:user@example.com (comma-separated for multiple).',
          });
        }
      }
    } else {
      issues.push({
        level: "info",
        code: "ruf-pii",
        message: "ruf= forensic reports include message headers and may leak PII. Gmail, Yahoo, and others suppress ruf= entirely — rely on rua= for monitoring.",
      });
    }
  }

  // fo= optional — must be a colon-separated list from {0, 1, d, s}.
  const foRaw = tags.fo;
  if (foRaw !== undefined && foRaw !== "") {
    const fos = foRaw.split(":").filter(Boolean);
    for (const f of fos) {
      if (!isValidFailureOption(f)) {
        issues.push({
          level: "error",
          code: "bad-fo",
          message: `fo= contains unknown option "${f}".`,
          fix: 'Use only 0, 1, d, s (colon-separated).',
        });
      }
    }
    if (!hasRuf) {
      issues.push({
        level: "info",
        code: "fo-without-ruf",
        message: "fo= is set but ruf= is absent — fo= has no effect without ruf= destinations.",
        fix: "Add ruf= or remove fo=.",
      });
    }
  }

  // adkim= / aspf= optional — must be r or s.
  const adkim = tags.adkim;
  if (adkim !== undefined && adkim !== "" && !isValidAlignment(adkim)) {
    issues.push({
      level: "error",
      code: "bad-adkim",
      message: `adkim= has value "${adkim}" — must be "r" (relaxed) or "s" (strict).`,
      fix: 'Set adkim=r (default) or adkim=s.',
    });
  }
  const aspf = tags.aspf;
  if (aspf !== undefined && aspf !== "" && !isValidAlignment(aspf)) {
    issues.push({
      level: "error",
      code: "bad-aspf",
      message: `aspf= has value "${aspf}" — must be "r" (relaxed) or "s" (strict).`,
      fix: 'Set aspf=r (default) or aspf=s.',
    });
  }

  // pct= optional — must be 0–100.
  const pctRaw = tags.pct;
  let pct: number = DMARC_PCT_DEFAULT;
  if (pctRaw !== undefined && pctRaw !== "") {
    const n = Number(pctRaw);
    if (!/^\d+$/.test(pctRaw) || n < 0 || n > 100) {
      issues.push({
        level: "error",
        code: "bad-pct",
        message: `pct= has value "${pctRaw}" — must be an integer 0–100.`,
        fix: 'Use pct=10, pct=25, pct=50, pct=100, etc.',
      });
    } else {
      pct = n;
      if (policy && policy !== "none" && n < 100) {
        issues.push({
          level: "info",
          code: "partial-enforcement",
          message: `pct=${n} means only ${n}% of failing mail gets the policy applied. Ramp to pct=100 for full enforcement.`,
        });
      }
    }
  }

  // rf= optional — must be afrf.
  const rfRaw = tags.rf;
  if (rfRaw !== undefined && rfRaw !== "" && !isValidReportFormat(rfRaw)) {
    issues.push({
      level: "error",
      code: "bad-rf",
      message: `rf= has value "${rfRaw}" — only "afrf" is defined (RFC 6591).`,
      fix: 'Set rf=afrf or omit the tag.',
    });
  }

  // ri= optional — must be a positive integer.
  const riRaw = tags.ri;
  if (riRaw !== undefined && riRaw !== "") {
    const n = Number(riRaw);
    if (!/^\d+$/.test(riRaw) || n <= 0) {
      issues.push({
        level: "error",
        code: "bad-ri",
        message: `ri= has value "${riRaw}" — must be a positive integer (seconds).`,
        fix: 'Use ri=86400 (24h, default) or another positive integer.',
      });
    } else if (n < 3600) {
      issues.push({
        level: "warning",
        code: "ri-too-small",
        message: `ri=${n} is less than 1 hour — receivers may ignore this and use their default (86400s).`,
        fix: 'Use ri=86400 (24h) or larger.',
      });
    }
  }

  // Compute strength.
  const strengthResult = policy
    ? computePolicyStrength(policy, subdomainPolicy, pct)
    : { strength: 0, label: "none" as const };

  const valid = !issues.some((i) => i.level === "error");
  return {
    valid,
    tags,
    issues,
    policy,
    subdomainPolicy,
    strength: strengthResult.strength,
    strengthLabel: strengthResult.label,
    recordLength: record.length,
    hasRua,
    hasRuf,
  };
}

/**
 * Detect multiple DMARC records on the same domain. Pass the array of TXT
 * records returned by `dig +short TXT _dmarc.<domain>`. RFC 7489 §6.1 says
 * a domain MUST have at most one DMARC record — multiple `v=DMARC1`
 * records is invalid.
 */
export function detectMultipleDmarcRecords(txtRecords: string[]): ValidationIssue | null {
  const dmarc = txtRecords.filter((r) => {
    const s = r.trim().replace(/^"+|"+$/g, "").trim().toLowerCase();
    return s.startsWith("v=dmarc1");
  });
  if (dmarc.length > 1) {
    return {
      level: "error",
      code: "multiple-dmarc",
      message: `Found ${dmarc.length} DMARC records. RFC 7489 §6.1 says a domain MUST have at most one DMARC record — receivers will return PermError.`,
      fix: "Delete all but one DMARC record.",
    };
  }
  return null;
}

// ---------------------------------------------------------------------------
// Enforcement roadmap
// ---------------------------------------------------------------------------

/**
 * Generate the DMARC enforcement roadmap (5 levels: none → quarantine pct
 * ramp → reject pct ramp → reject pct=100). The current level is marked
 * based on the input policy + pct.
 */
export function generateEnforcementRoadmap(
  policy: DmarcPolicy,
  pct: number,
): RoadmapStep[] {
  const currentRank = policyRank(policy);
  const currentPct = typeof pct === "number" && pct >= 0 && pct <= 100 ? pct : 100;

  const steps: RoadmapStep[] = [
    {
      level: 0,
      title: "Monitor (p=none)",
      description: "Collect 1–2 weeks of rua reports. Identify all legitimate senders (Mailchimp, Google, your own MTAs, etc.).",
      isCurrent: policy === "none",
      isDone: currentRank > 0,
    },
    {
      level: 1,
      title: "Quarantine ramp (p=quarantine, pct=10 → 100)",
      description: "Start at pct=10. Review rua reports for false positives. Ramp pct to 25 → 50 → 100 over 1–2 weeks.",
      isCurrent: policy === "quarantine" && currentPct < 100,
      isDone: (policy === "quarantine" && currentPct >= 100) || currentRank > 1,
    },
    {
      level: 2,
      title: "Quarantine full (p=quarantine, pct=100)",
      description: "All failing mail is delivered to spam. Monitor for 1 week before moving to reject.",
      isCurrent: policy === "quarantine" && currentPct >= 100,
      isDone: currentRank > 1,
    },
    {
      level: 3,
      title: "Reject ramp (p=reject, pct=10 → 100)",
      description: "Start at pct=10. Receivers now reject failing mail at SMTP. Ramp pct to 25 → 50 → 100 over 1–2 weeks.",
      isCurrent: policy === "reject" && currentPct < 100,
      isDone: policy === "reject" && currentPct >= 100,
    },
    {
      level: 4,
      title: "Maximum enforcement (p=reject, pct=100)",
      description: "Full enforcement. Continue monitoring rua reports; rotate DKIM keys annually; review senders quarterly.",
      isCurrent: policy === "reject" && currentPct >= 100,
      isDone: false,
    },
  ];

  return steps;
}

// ---------------------------------------------------------------------------
// dig command generator
// ---------------------------------------------------------------------------

/** Generate dig / nslookup / kdig / curl commands to look up a DMARC record. */
export function generateDigCommands(domain: string): GeneratedCommand[] {
  const dom = domain.trim().toLowerCase();
  if (!dom) return [];
  const name = `_dmarc.${dom}`;
  return [
    {
      tool: "dig",
      label: "dig TXT +short",
      command: `dig +short TXT ${name}`,
      explanation: `List the TXT record(s) on ${name}. Look for the one starting with "v=DMARC1".`,
    },
    {
      tool: "dig",
      label: "dig TXT (filtered for DMARC)",
      command: `dig +short TXT ${name} | grep '^"v=DMARC1'`,
      explanation: "Filter dig output to show only DMARC records. Multiple lines = multiple DMARC records (invalid).",
    },
    {
      tool: "dig",
      label: "dig TXT (full)",
      command: `dig +noall +answer TXT ${name}`,
      explanation: "Show the full TXT answer section with TTL.",
    },
    {
      tool: "dig",
      label: "dig @resolver TXT",
      command: `dig +short TXT ${name} @1.1.1.1`,
      explanation: "Query Cloudflare DNS (1.1.1.1) directly — useful for cached-vs-authoritative comparison.",
    },
    {
      tool: "kdig",
      label: "kdig (DNS-over-HTTPS)",
      command: `kdig +https @1.1.1.1 TXT ${name}`,
      explanation: "DNS-over-HTTPS lookup via Cloudflare. Bypasses local DNS / firewall inspection.",
    },
    {
      tool: "nslookup",
      label: "nslookup TXT",
      command: `nslookup -type=TXT ${name}`,
      explanation: "Cross-platform TXT lookup (Windows-friendly).",
    },
    {
      tool: "curl",
      label: "DoH via curl (Cloudflare)",
      command: `curl -s 'https://cloudflare-dns.com/dns-query?name=${name}&type=TXT' -H 'accept: application/dns-json' | jq '.Answer'`,
      explanation: "Fetch the TXT records as JSON via DNS-over-HTTPS. Pipe through jq for pretty output.",
    },
    {
      tool: "host",
      label: "host TXT",
      command: `host -t TXT ${name}`,
      explanation: "Quick TXT lookup via the `host` utility (BIND).",
    },
  ];
}

// ---------------------------------------------------------------------------
// History (localStorage)
// ---------------------------------------------------------------------------

const HISTORY_KEY = "unqtools:dmarc-record-generator-validator:history";
const HISTORY_MAX = 20;

export function loadHistory(): HistoryEntry[] {
  if (typeof localStorage === "undefined") return [];
  try {
    const raw = localStorage.getItem(HISTORY_KEY);
    if (!raw) return [];
    const arr = JSON.parse(raw) as HistoryEntry[];
    return Array.isArray(arr) ? arr.slice(0, HISTORY_MAX) : [];
  } catch {
    return [];
  }
}

export function saveHistory(entry: HistoryEntry): HistoryEntry[] {
  const next = [entry, ...loadHistory()].slice(0, HISTORY_MAX);
  if (typeof localStorage !== "undefined") {
    try {
      localStorage.setItem(HISTORY_KEY, JSON.stringify(next));
    } catch {
      // ignore
    }
  }
  return next;
}

export function clearHistory(): void {
  if (typeof localStorage === "undefined") return;
  try {
    localStorage.removeItem(HISTORY_KEY);
  } catch {
    // ignore
  }
}

// ---------------------------------------------------------------------------
// Shareable URL
// ---------------------------------------------------------------------------

export interface ShareState {
  tab?: "generate" | "validate";
  record?: string;
}

export function buildShareUrl(state: ShareState): string {
  const params = new URLSearchParams();
  if (state.tab) params.set("tab", state.tab);
  if (state.record) params.set("r", state.record);
  if (typeof window === "undefined") return `?${params.toString()}`;
  return `${window.location.origin}${window.location.pathname}#${params.toString()}`;
}

export function parseShareUrl(hash: string): ShareState {
  const clean = hash.startsWith("#") ? hash.slice(1) : hash;
  if (!clean) return {};
  const params = new URLSearchParams(clean);
  const tabRaw = params.get("tab") ?? "";
  const tab = tabRaw === "generate" || tabRaw === "validate" ? tabRaw : undefined;
  const record = params.get("r") ?? undefined;
  return { tab, record };
}
