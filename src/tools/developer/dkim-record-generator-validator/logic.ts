/**
 * DKIM Record Generator & Validator — pure logic.
 *
 * Builds DKIM DNS TXT records (selector._domainkey.<domain>) from the
 * v / k / p / h / s / t / n tags, validates any record against RFC 6376,
 * decodes every tag with plain-English explanations, estimates the public-
 * key bit length, generates dig / nslookup / kdig (DoH) / curl DoH lookup
 * commands for the selector+domain, and generates OpenDKIM keygen + openssl
 * key-generation commands.
 *
 * Pure functions only — no DOM, no network, no external deps. Actual
 * cryptographic key generation is interactive in the browser via WebCrypto
 * (handled in the UI), and the private key NEVER touches this logic module.
 *
 * PRIVACY: The history feature stores only operation metadata
 * (action + keyType + estimatedBits + ts), NEVER the public key, selector,
 * or domain.
 */

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export type KeyType = "rsa" | "ed25519";

/** Known RSA key sizes for the bit-length estimator. */
export type RsaBitLength = 1024 | 2048 | 4096;

/** DKIM t= flags (RFC 6376 §3.6.1 + RFC 8301). */
export type DkimFlag = "y" | "s" | "i";

/** Acceptable hash algorithms for the h= tag. */
export type HashAlgorithm = "sha1" | "sha256" | "sha512";

/** Service types for the s= tag. */
export type ServiceType = "email" | "*";

/** All known DKIM record tags. */
export type DkimTagName = "v" | "k" | "p" | "h" | "s" | "t" | "n";

/** Generic tag-name → value map (output of the parser). */
export type DkimTags = Partial<Record<DkimTagName, string>>;

export interface DkimInput {
  selector: string;
  domain: string;
  keyType: KeyType;
  /** Base64 public key (the p= tag value). Empty = revoked key. */
  publicKey: string;
  /** Hash algorithms for the h= tag. Empty = omit h=. */
  hashes: HashAlgorithm[];
  /** Service type for the s= tag. Empty = omit s=. */
  service?: ServiceType;
  /** Flags for the t= tag. Empty = omit t=. */
  flags: DkimFlag[];
  /** Notes for the n= tag. Empty = omit n=. */
  notes?: string;
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
  tags: DkimTags;
  issues: ValidationIssue[];
  keyType: KeyType | null;
  estimatedBits: number | null;
  isRevoked: boolean;
  recordLength: number;
  txtSplitNeeded: boolean;
}

export interface TagExplanation {
  tag: string;
  required: boolean;
  short: string;
  long: string;
}

export interface FlagExplanation {
  flag: string;
  short: string;
  long: string;
}

export interface GeneratedCommand {
  tool: "dig" | "nslookup" | "kdig" | "host" | "curl";
  label: string;
  command: string;
  explanation: string;
}

export interface KeygenCommand {
  tool: "opendkim-genkey" | "openssl";
  label: string;
  command: string;
  explanation: string;
}

export interface HistoryEntry {
  ts: number;
  action: "generate" | "validate";
  keyType: KeyType | "unknown";
  estimatedBits: number | null;
}

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

/** Common DKIM selectors to try for auto-detection. */
export const COMMON_SELECTORS: readonly string[] = [
  "default", "google", "selector1", "selector2", "k1", "k2",
  "mandrill", "s1", "s2", "mail", "smtp", "dkim",
];

/** Valid DKIM t= flags (RFC 6376 §3.6.1, RFC 8301). */
export const VALID_FLAGS: ReadonlySet<DkimFlag> = new Set(["y", "s", "i"]);

/** Valid hash algorithms for the h= tag. */
export const VALID_HASHES: ReadonlySet<HashAlgorithm> = new Set([
  "sha1", "sha256", "sha512",
]);

/** Valid service types for the s= tag. */
export const VALID_SERVICES: ReadonlySet<ServiceType> = new Set(["email", "*"]);

/** Valid key types for the k= tag. */
export const VALID_KEY_TYPES: ReadonlySet<KeyType> = new Set(["rsa", "ed25519"]);

/** DKIM TXT records have a 255-byte per-string limit in DNS; long records
 *  must be split into multiple quoted strings (RFC 4408 §3.3). */
export const TXT_MAX_PER_STRING = 255;

// ---------------------------------------------------------------------------
// Tag & flag explanations
// ---------------------------------------------------------------------------

const TAG_EXPLANATIONS: Record<DkimTagName, TagExplanation> = {
  v: {
    tag: "v",
    required: true,
    short: "Version",
    long: "DKIM version. MUST be the first tag and the value MUST be exactly `DKIM1` (case-insensitive). Identifies the TXT record as a DKIM key record (vs. other TXT records on the same name).",
  },
  k: {
    tag: "k",
    required: false,
    short: "Key type",
    long: "Public-key algorithm. Default is `rsa`. RFC 8463 adds `ed25519` (smaller keys, faster verification). Receivers must support the chosen algorithm or signatures will be ignored.",
  },
  p: {
    tag: "p",
    required: true,
    short: "Public key",
    long: "Base64-encoded public key (DER-encoded SubjectPublicKeyInfo for RSA, raw 32-byte key for Ed25519). An empty `p=` value REVOKES the key — receivers will treat any signature using this selector as a permanent failure. Generate with opendkim-genkey or openssl; the corresponding private key stays on your mail server.",
  },
  h: {
    tag: "h",
    required: false,
    short: "Acceptable hash algorithms",
    long: "Colon-separated list of hash algorithms the signer may use (`sha1:sha256` etc.). Default allows all algorithms the receiver supports. sha1 is weak — prefer sha256 or sha512. If omitted, the receiver picks.",
  },
  s: {
    tag: "s",
    required: false,
    short: "Service type",
    long: "Colon-separated list of service types this key may sign for. Default is `*` (any). `s=email` restricts to email — receivers should refuse to verify signatures for other services. Most domains set `s=email` or omit the tag.",
  },
  t: {
    tag: "t",
    required: false,
    short: "Flags",
    long: "Colon-separated flags. `y` = test mode (do not enforce failures). `s` = strict selector (signature i= must match the exact selector+domain, no subdomain matching). `i` = obsolete (RFC 8301). Remove `t=y` before going to enforcement.",
  },
  n: {
    tag: "n",
    required: false,
    short: "Notes",
    long: "Human-readable notes for the DNS admin. Not used by receivers. Avoid putting sensitive info here — DNS TXT records are public.",
  },
};

const FLAG_EXPLANATIONS: Record<DkimFlag, FlagExplanation> = {
  y: {
    flag: "y",
    short: "Test mode",
    long: "Domain is testing DKIM. Receivers should treat the signature as valid but NOT enforce failures (do not quarantine or reject). Remove before going to enforcement.",
  },
  s: {
    flag: "s",
    short: "Strict selector",
    long: "Signature i= must match the exact selector+domain. Subdomains may not use this key. Recommended for production domains.",
  },
  i: {
    flag: "i",
    short: "Obsolete (RFC 8301)",
    long: "Deprecated flag. RFC 8301 removed the `i` flag — receivers should ignore it. Remove from your record.",
  },
};

export function explainTag(tag: DkimTagName): TagExplanation {
  return TAG_EXPLANATIONS[tag];
}

export function explainAllTags(): TagExplanation[] {
  return ["v", "k", "p", "h", "s", "t", "n"].map((t) => TAG_EXPLANATIONS[t as DkimTagName]);
}

export function explainFlag(flag: DkimFlag): FlagExplanation {
  return FLAG_EXPLANATIONS[flag];
}

export function explainAllFlags(): FlagExplanation[] {
  return ["y", "s", "i"].map((f) => FLAG_EXPLANATIONS[f as DkimFlag]);
}

// ---------------------------------------------------------------------------
// Validators
// ---------------------------------------------------------------------------

const DOMAIN_RE = /^(?=.{1,253}$)([a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?\.)+[a-zA-Z]{2,}$/;
const SELECTOR_RE = /^[A-Za-z0-9](?:[A-Za-z0-9_-]{0,61}[A-Za-z0-9])?$/;
const BASE64_RE = /^[A-Za-z0-9+/]+={0,2}$/;
const BASE64_NOPAD_RE = /^[A-Za-z0-9+/_-]+$/;

export function isValidDomain(v: string): boolean {
  const s = v.trim().toLowerCase();
  if (!s) return false;
  return DOMAIN_RE.test(s);
}

export function isValidSelector(v: string): boolean {
  const s = v.trim().toLowerCase();
  if (!s) return false;
  return SELECTOR_RE.test(s);
}

export function isValidBase64(v: string): boolean {
  const s = v.replace(/\s+/g, "");
  if (!s) return false;
  return BASE64_RE.test(s) || BASE64_NOPAD_RE.test(s);
}

export function isValidHash(h: string): h is HashAlgorithm {
  return VALID_HASHES.has(h as HashAlgorithm);
}

export function isValidFlag(f: string): f is DkimFlag {
  return VALID_FLAGS.has(f as DkimFlag);
}

export function isValidService(s: string): s is ServiceType {
  return VALID_SERVICES.has(s as ServiceType);
}

export function isValidKeyType(k: string): k is KeyType {
  return VALID_KEY_TYPES.has(k as KeyType);
}

// ---------------------------------------------------------------------------
// Public-key bit-length estimator
// ---------------------------------------------------------------------------

/**
 * Estimate the RSA/Ed25519 key bit length from the base64 public key.
 *
 * Heuristic based on base64 char length (the p= tag is the DER-encoded
 * SubjectPublicKeyInfo for RSA, or the raw 32-byte key for Ed25519):
 *   - 1024-bit RSA SPKI → ~216 chars
 *   - 2048-bit RSA SPKI → ~392 chars
 *   - 4096-bit RSA SPKI → ~744 chars
 *   - Ed25519 raw key    → ~44 chars (32 bytes)
 *
 * Returns `null` for unparseable input, or for keys that don't match any
 * known size.
 */
export function estimateKeyBits(
  base64Key: string,
  keyType: KeyType,
): number | null {
  const s = (base64Key || "").replace(/\s+/g, "");
  if (!s) return null;

  if (keyType === "ed25519") {
    // Ed25519 public key = 32 raw bytes → 44 base64 chars (with padding) or
    // 43 chars (without padding). Treat anything in this range as 256-bit.
    const decodedLen = Math.floor((s.length * 3) / 4);
    if (decodedLen === 32 || s.length === 43 || s.length === 44) return 256;
    return null;
  }

  // RSA: use base64 char-length buckets.
  if (s.length < 180) return null; // too short
  if (s.length < 280) return 1024;
  if (s.length < 600) return 2048;
  return 4096;
}

// ---------------------------------------------------------------------------
// Record generator
// ---------------------------------------------------------------------------

/**
 * Build a DKIM TXT record from structured input. Tags are emitted in the
 * recommended order: v, k, p, h, s, t, n. Tags with empty values are
 * omitted (except `p=` which is preserved when explicitly revoked).
 *
 * Tags are separated by `; ` and have a single space after each `;`.
 */
export function buildRecord(input: DkimInput): string {
  const parts: string[] = ["v=DKIM1"];
  parts.push(`k=${input.keyType}`);

  // p= is required. Empty value = revoked.
  const pub = (input.publicKey || "").replace(/\s+/g, "");
  parts.push(`p=${pub}`);

  if (input.hashes && input.hashes.length > 0) {
    // Dedupe + preserve order.
    const seen = new Set<HashAlgorithm>();
    const list: HashAlgorithm[] = [];
    for (const h of input.hashes) {
      if (!seen.has(h)) { seen.add(h); list.push(h); }
    }
    parts.push(`h=${list.join(":")}`);
  }
  if (input.service) {
    parts.push(`s=${input.service}`);
  }
  if (input.flags && input.flags.length > 0) {
    const seen = new Set<DkimFlag>();
    const list: DkimFlag[] = [];
    for (const f of input.flags) {
      if (!seen.has(f)) { seen.add(f); list.push(f); }
    }
    parts.push(`t=${list.join(":")}`);
  }
  if (input.notes && input.notes.trim()) {
    parts.push(`n=${input.notes.trim()}`);
  }

  return parts.join("; ");
}

/**
 * Build the DNS name for a DKIM selector: `<selector>._domainkey.<domain>`.
 */
export function buildSelectorName(selector: string, domain: string): string {
  const s = selector.trim().toLowerCase();
  const d = domain.trim().toLowerCase();
  if (!s || !d) return "";
  return `${s}._domainkey.${d}`;
}

// ---------------------------------------------------------------------------
// Record parser
// ---------------------------------------------------------------------------

/**
 * Parse a DKIM TXT record string into a tag map. Supports both semicolon-
 * separated (`v=DKIM1; k=rsa; p=...`) and whitespace-separated forms.
 * Strips surrounding double quotes (dig +short wraps TXT values in quotes).
 */
export function parseRecord(record: string): {
  tags: DkimTags;
  issues: ValidationIssue[];
} {
  const issues: ValidationIssue[] = [];
  const tags: DkimTags = {};

  const s = (record || "").trim();
  if (!s) {
    issues.push({ level: "error", code: "empty", message: "Empty input." });
    return { tags, issues };
  }
  // Strip surrounding quotes (dig +short TXT wraps values in `"..."`).
  const cleaned = s.replace(/^"+|"+$/g, "").trim();
  if (!cleaned) {
    issues.push({ level: "error", code: "empty", message: "Empty input." });
    return { tags, issues };
  }

  // Split on `;` or whitespace, but tolerate `; ` and `;` separators.
  const tokens = cleaned.split(/[;\s]+/).filter(Boolean);

  for (let i = 0; i < tokens.length; i++) {
    const tok = tokens[i];
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
    if (tags[name as DkimTagName] !== undefined) {
      issues.push({
        level: "warning",
        code: "duplicate-tag",
        message: `Tag "${name}" appears more than once — only the last value is kept.`,
      });
    }
    tags[name as DkimTagName] = value;
  }

  return { tags, issues };
}

// ---------------------------------------------------------------------------
// Validator
// ---------------------------------------------------------------------------

/**
 * Validate a DKIM record against RFC 6376. Returns the parsed tags, a list
 * of issues (each with a code, level, message, and suggested fix), the
 * detected key type, the estimated bit length, and whether the key is
 * revoked (empty p=).
 */
export function validateRecord(record: string): ValidationResult {
  const issues: ValidationIssue[] = [];
  const parsed = parseRecord(record);
  issues.push(...parsed.issues);
  const tags = parsed.tags;

  // v= must be present and equal DKIM1 (case-insensitive).
  const v = tags.v;
  if (v === undefined) {
    issues.push({
      level: "error",
      code: "no-version",
      message: 'Missing required v= tag. The record must start with "v=DKIM1".',
      fix: 'Prefix the record with "v=DKIM1; ".',
    });
  } else if (v.toLowerCase() !== "dkim1") {
    issues.push({
      level: "error",
      code: "bad-version",
      message: `v= tag has value "${v}" — must be exactly "DKIM1" (case-insensitive).`,
      fix: 'Set v=DKIM1.',
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
      fix: 'Move "v=DKIM1" to the beginning of the record.',
    });
  }

  // k= must be rsa or ed25519 (default rsa).
  const kRaw = tags.k;
  let keyType: KeyType | null = null;
  if (kRaw === undefined) {
    keyType = "rsa"; // default
    issues.push({
      level: "info",
      code: "no-key-type",
      message: "No k= tag — defaulting to rsa (RFC 6376 §3.6.1).",
    });
  } else if (!isValidKeyType(kRaw)) {
    issues.push({
      level: "error",
      code: "bad-key-type",
      message: `k= tag has value "${kRaw}" — must be "rsa" or "ed25519".`,
      fix: 'Set k=rsa (default) or k=ed25519.',
    });
  } else {
    keyType = kRaw;
  }

  // p= is required.
  const p = tags.p;
  const isRevoked = p !== undefined && p === "";
  if (p === undefined) {
    issues.push({
      level: "error",
      code: "no-public-key",
      message: "Missing required p= tag. The public key is mandatory.",
      fix: "Add p=<base64 public key> or p= (empty) to revoke.",
    });
  } else if (isRevoked) {
    issues.push({
      level: "info",
      code: "revoked-key",
      message: "p= is empty — this selector is REVOKED. Receivers will treat any signature using this key as a permanent failure. Use this to retire a compromised key without removing the DNS record.",
    });
  } else if (!isValidBase64(p)) {
    issues.push({
      level: "error",
      code: "bad-base64",
      message: "p= value is not valid base64.",
      fix: "Encode the public key as base64 (DER SubjectPublicKeyInfo for RSA, raw 32 bytes for Ed25519). Use `openssl base64 -A` to produce a single-line base64 string.",
    });
  }

  // h= must be a colon-separated list from {sha1, sha256, sha512}.
  const h = tags.h;
  if (h !== undefined && h !== "") {
    const hashes = h.split(":").filter(Boolean);
    for (const ha of hashes) {
      if (!isValidHash(ha)) {
        issues.push({
          level: "error",
          code: "bad-hash",
          message: `h= contains unknown hash algorithm "${ha}".`,
          fix: "Use only sha1, sha256, or sha512 (colon-separated).",
        });
      }
    }
    if (hashes.includes("sha1")) {
      issues.push({
        level: "warning",
        code: "weak-hash",
        message: "h= includes sha1, which is cryptographically weak.",
        fix: "Prefer sha256 or sha512.",
      });
    }
  }

  // s= must be email or *.
  const sv = tags.s;
  if (sv !== undefined && sv !== "") {
    const services = sv.split(":").filter(Boolean);
    for (const st of services) {
      if (!isValidService(st)) {
        issues.push({
          level: "error",
          code: "bad-service",
          message: `s= contains unknown service type "${st}".`,
          fix: 'Use "email" or "*".',
        });
      }
    }
  }

  // t= must be a colon-separated list from {y, s, i}.
  const t = tags.t;
  if (t !== undefined && t !== "") {
    const flags = t.split(":").filter(Boolean);
    for (const fl of flags) {
      if (!isValidFlag(fl)) {
        issues.push({
          level: "error",
          code: "bad-flag",
          message: `t= contains unknown flag "${fl}".`,
          fix: 'Use only y, s (or i, deprecated).',
        });
      }
    }
    if (flags.includes("y")) {
      issues.push({
        level: "warning",
        code: "test-mode",
        message: "t=y means test mode — receivers will NOT enforce DKIM failures. Remove before going to enforcement.",
        fix: 'Remove "y" from the t= tag when you are ready to enforce.',
      });
    }
    if (flags.includes("i")) {
      issues.push({
        level: "warning",
        code: "obsolete-flag",
        message: "t=i is obsolete (RFC 8301). Receivers should ignore it.",
        fix: 'Remove "i" from the t= tag.',
      });
    }
  }

  // Bit-length estimator + weak-key warning.
  let estimatedBits: number | null = null;
  if (keyType && p && !isRevoked) {
    estimatedBits = estimateKeyBits(p, keyType);
    if (keyType === "rsa" && estimatedBits === 1024) {
      issues.push({
        level: "warning",
        code: "weak-key-size",
        message: "RSA key appears to be 1024-bit — below the 2048-bit minimum recommended by RFC 8301.",
        fix: "Rotate to a 2048-bit or 4096-bit RSA key (or use Ed25519).",
      });
    } else if (keyType === "rsa" && estimatedBits === null) {
      issues.push({
        level: "info",
        code: "unknown-key-size",
        message: "Could not estimate RSA key size from the p= value. The key may be malformed or use an unsupported format.",
      });
    }
  }

  // TXT length / split detection.
  const recordLength = record.length;
  const txtSplitNeeded = recordLength > TXT_MAX_PER_STRING;

  const valid = !issues.some((i) => i.level === "error");
  return {
    valid,
    tags,
    issues,
    keyType,
    estimatedBits,
    isRevoked,
    recordLength,
    txtSplitNeeded,
  };
}

/**
 * Detect multiple DKIM records on the same selector name. Pass the array of
 * TXT records returned by `dig +short TXT <selector>._domainkey.<domain>`.
 * RFC 6376 §3.6.1 says a selector name MUST have exactly one DKIM key
 * record (multiple `v=DKIM1` records is invalid).
 */
export function detectMultipleDkimRecords(txtRecords: string[]): ValidationIssue | null {
  const dkim = txtRecords.filter((r) => {
    const s = r.trim().replace(/^"+|"+$/g, "").trim().toLowerCase();
    return s.startsWith("v=dkim1");
  });
  if (dkim.length > 1) {
    return {
      level: "error",
      code: "multiple-dkim",
      message: `Found ${dkim.length} DKIM records on the same selector name. RFC 6376 §3.6.1 says a selector MUST have exactly one DKIM key record — receivers may return PermError or use an arbitrary one.`,
      fix: "Delete all but one DKIM record on this selector name.",
    };
  }
  return null;
}

// ---------------------------------------------------------------------------
// TXT splitter (for long 2048/4096-bit keys)
// ---------------------------------------------------------------------------

/**
 * Split a long TXT record into chunks of at most `maxLen` characters, quoted
 * and concatenated as Bind-format `"chunk1" "chunk2" ...`. Useful for 2048
 * and 4096-bit RSA keys whose base64 representation exceeds the 255-byte
 * per-string DNS limit. The split happens at any character boundary — DKIM
 * parsers concatenate the strings before base64-decoding.
 */
export function splitTxtForBind(record: string, maxLen: number = TXT_MAX_PER_STRING): string {
  const s = record || "";
  if (s.length <= maxLen) return `"${s}"`;
  const chunks: string[] = [];
  for (let i = 0; i < s.length; i += maxLen) {
    chunks.push(s.slice(i, i + maxLen));
  }
  return chunks.map((c) => `"${c}"`).join(" ");
}

// ---------------------------------------------------------------------------
// dig command generator
// ---------------------------------------------------------------------------

/** Generate dig / nslookup / kdig / curl commands to look up a DKIM record. */
export function generateDigCommands(selector: string, domain: string): GeneratedCommand[] {
  const sel = selector.trim().toLowerCase();
  const dom = domain.trim().toLowerCase();
  if (!sel || !dom) return [];
  const name = `${sel}._domainkey.${dom}`;
  return [
    {
      tool: "dig",
      label: "dig TXT +short",
      command: `dig +short TXT ${name}`,
      explanation: `List the TXT record(s) on ${name}. Look for the one starting with "v=DKIM1".`,
    },
    {
      tool: "dig",
      label: "dig TXT (filtered for DKIM)",
      command: `dig +short TXT ${name} | grep '^"v=DKIM1'`,
      explanation: "Filter dig output to show only DKIM records. Multiple lines = multiple DKIM records (invalid).",
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
// OpenDKIM / openssl keygen command generator
// ---------------------------------------------------------------------------

/** Generate OpenDKIM + openssl key-pair generation commands. */
export function generateKeygenCommands(
  selector: string,
  domain: string,
  keyType: KeyType,
  bits: RsaBitLength = 2048,
): KeygenCommand[] {
  const sel = selector.trim().toLowerCase();
  const dom = domain.trim().toLowerCase();
  if (!sel || !dom) return [];

  const out: KeygenCommand[] = [];

  if (keyType === "rsa") {
    out.push({
      tool: "opendkim-genkey",
      label: "OpenDKIM — generate RSA key pair",
      command: `opendkim-genkey -s ${sel} -d ${dom} -b ${bits} -r`,
      explanation: `Generates ${sel}.private (private key — keep on your mail server, NEVER publish) and ${sel}.txt (the ready-to-publish DNS TXT record). -r restricts the key to email use. -b ${bits} sets the RSA modulus size.`,
    });
    out.push({
      tool: "openssl",
      label: "openssl — RSA private key",
      command: `openssl genrsa -out ${sel}.private ${bits}`,
      explanation: `Generate a ${bits}-bit RSA private key. Keep this on your mail server; never publish it.`,
    });
    out.push({
      tool: "openssl",
      label: "openssl — RSA public key (DER + base64)",
      command: `openssl rsa -in ${sel}.private -pubout -outform der 2>/dev/null | openssl base64 -A`,
      explanation: "Derive the base64-encoded SubjectPublicKeyInfo (the p= tag value) from the private key. Paste the output into the p= field above.",
    });
  } else {
    // Ed25519
    out.push({
      tool: "openssl",
      label: "openssl — Ed25519 private key",
      command: `openssl genpkey -algorithm Ed25519 -out ${sel}.private`,
      explanation: "Generate an Ed25519 private key (32 bytes). Keep this on your mail server; never publish it.",
    });
    out.push({
      tool: "openssl",
      label: "openssl — Ed25519 public key (raw + base64)",
      command: `openssl pkey -in ${sel}.private -pubout -outform der 2>/dev/null | tail -c 32 | openssl base64 -A`,
      explanation: "Derive the 32-byte raw Ed25519 public key as base64 (the p= tag value per RFC 8463). The `tail -c 32` strips the 12-byte DER SubjectPublicKeyInfo prefix. Paste the output into the p= field above.",
    });
  }

  return out;
}

// ---------------------------------------------------------------------------
// Common-selector auto-detection
// ---------------------------------------------------------------------------

/**
 * Build dig commands for each common selector against a domain — useful for
 * auto-detecting which selector a third-party sender (Google, Mailchimp,
 * SendGrid, …) is using. Returns one dig command per common selector.
 */
export function generateCommonSelectorCommands(domain: string): GeneratedCommand[] {
  const dom = domain.trim().toLowerCase();
  if (!dom) return [];
  return COMMON_SELECTORS.map((sel) => {
    const name = `${sel}._domainkey.${dom}`;
    return {
      tool: "dig" as const,
      label: `Check selector "${sel}"`,
      command: `dig +short TXT ${name}`,
      explanation: `Look up the ${name} TXT record. If non-empty, ${sel} is a DKIM selector used by ${dom}.`,
    };
  });
}

// ---------------------------------------------------------------------------
// History (localStorage)
// ---------------------------------------------------------------------------

const HISTORY_KEY = "unqtools:dkim-record-generator-validator:history";
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
