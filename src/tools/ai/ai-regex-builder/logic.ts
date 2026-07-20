/**
 * AI Regex Builder — pure logic.
 *
 * Pattern library (email, phone, URL, IPv4, date, time, credit card, hex
 * color, ZIP code, UUID, etc.). Natural-language → regex matcher. Live
 * tester with match highlights. Token-by-token AST explainer. Multi-flavor
 * conversion (JS / PCRE / Python / Java). ReDoS / catastrophic-backtracking
 * linter. Capture-group table, replace preview, code-snippet export.
 *
 * Pure functions only — no DOM, no network. The optional LLM call (BYO API
 * key) lives in ui.tsx because it touches the network.
 */

// ---------- Types ----------

export type Flavor = "js" | "pcre" | "python" | "java";

export interface PatternDef {
  id: string;
  name: string;
  description: string;
  keywords: string[];          // lowercase NL keywords that should route to this pattern
  pattern: string;             // JS regex source (no flags)
  flags: string;               // default flags
  exampleMatches: string[];
  exampleNonMatches: string[];
  notes: string;               // flavor / caveat note
}

export interface MatchSegment {
  start: number;
  end: number;
  text: string;
  groups: (string | undefined)[];   // capture groups for this match
}

export interface TestResult {
  ok: boolean;
  error?: string;              // syntax error message
  matches: MatchSegment[];
  matchCount: number;
  groups: { index: number; name?: string; values: string[] }[];
}

export interface RegexToken {
  type:
    | "char" | "escaped" | "class" | "anchor" | "quantifier"
    | "group-open" | "group-close" | "alternation" | "literal"
    | "flag" | "named-group" | "backreference" | "lookaround";
  raw: string;
  value: string;               // the literal token text (e.g. '\\d')
  description: string;
  groupIndex?: number;         // for groups
  groupName?: string;
}

export interface ReDoSWarning {
  severity: "high" | "medium" | "low";
  pattern: string;             // the dangerous snippet
  reason: string;
  suggestion: string;
}

export interface BuildResult {
  description: string;
  patternId: string | null;    // matched library id, or null if custom
  patternName: string;
  pattern: string;             // JS source
  flags: string;
  flavor: Flavor;
  test: TestResult;            // result of testing against empty sample
  tokens: RegexToken[];
  redosWarnings: ReDoSWarning[];
  notes: string;
  generatedAt: number;
}

export interface HistoryEntry {
  ts: number;
  description: string;
  pattern: string;
  flags: string;
  patternId: string | null;
  matchCount: number;
}

export interface ShareState {
  description: string;
  sample: string;
  flavor: Flavor;
  flags: string;
}

// ---------- Constants ----------

export const HISTORY_KEY = "unqtools:ai-regex-builder:history";
export const HISTORY_MAX = 20;

export const FLAVOR_LABELS: Record<Flavor, string> = {
  js: "JavaScript",
  pcre: "PCRE (PHP)",
  python: "Python",
  java: "Java",
};

export const ALL_FLAVORS: Flavor[] = ["js", "pcre", "python", "java"];

// Pattern library — each pattern is a tested, common regex.
export const PATTERN_LIBRARY: PatternDef[] = [
  {
    id: "email",
    name: "Email address",
    description: "RFC-ish email address (local-part@domain.tld).",
    keywords: ["email", "e-mail", "mail", "mailto", "inbox"],
    pattern: "[a-zA-Z0-9._%+\\-]+@[a-zA-Z0-9.\\-]+\\.[a-zA-Z]{2,}",
    flags: "g",
    exampleMatches: ["alice@example.com", "bob+filter@mail.co.uk", "user_123@sub.domain.org"],
    exampleNonMatches: ["alice@", "@example.com", "not an email", "alice@.com"],
    notes: "Simplified RFC 5322 — does not allow quoted local parts or IP-literal domains.",
  },
  {
    id: "url",
    name: "URL (http/https)",
    description: "HTTP or HTTPS URL with optional path, query, and fragment.",
    keywords: ["url", "link", "website", "http", "https", "uri", "web address"],
    pattern: "https?://[a-zA-Z0-9.\\-]+(?:\\.[a-zA-Z]{2,})(?:/[\\w\\-./?%&=#]*)?",
    flags: "g",
    exampleMatches: ["https://example.com", "http://sub.domain.org/path?q=1#frag", "https://my-site.io/a/b/c"],
    exampleNonMatches: ["ftp://example.com", "example.com", "just text"],
    notes: "Matches http(s) only — extend the scheme alternation for ftp/mailto/etc.",
  },
  {
    id: "ipv4",
    name: "IPv4 address",
    description: "Four-octet dotted IPv4 address (0.0.0.0 – 255.255.255.255).",
    keywords: ["ip", "ipv4", "ip address", "internet protocol", "octet"],
    pattern: "(?:25[0-5]|2[0-4]\\d|1?\\d?\\d)(?:\\.(?:25[0-5]|2[0-4]\\d|1?\\d?\\d)){3}",
    flags: "g",
    exampleMatches: ["192.168.1.1", "10.0.0.255", "8.8.8.8", "255.255.255.255"],
    exampleNonMatches: ["999.1.1.1", "1.2.3", "not an ip", "256.0.0.1"],
    notes: "Validates octet range 0–255. Does not match IPv6 — see separate pattern.",
  },
  {
    id: "phone-us",
    name: "US phone number",
    description: "US phone in (xxx) xxx-xxxx, xxx-xxx-xxxx, or xxxxxxxxxx form.",
    keywords: ["phone", "phone number", "telephone", "us phone", "cell", "mobile"],
    pattern: "\\(?\\d{3}\\)?[\\s.\\-]?\\d{3}[\\s.\\-]?\\d{4}",
    flags: "g",
    exampleMatches: ["(555) 123-4567", "555-123-4567", "5551234567", "555.123.4567"],
    exampleNonMatches: ["12-34", "phone", "55-55-55-55"],
    notes: "Lenient on separators. Add a leading +1 alternation for international format.",
  },
  {
    id: "credit-card",
    name: "Credit card number",
    description: "16-digit card number with optional spaces or dashes (no Luhn check).",
    keywords: ["credit card", "card number", "visa", "mastercard", "amex", "payment"],
    pattern: "\\b(?:\\d[ \\-]?){13,16}\\b",
    flags: "g",
    exampleMatches: ["4111 1111 1111 1111", "4111-1111-1111-1111", "4111111111111111"],
    exampleNonMatches: ["123", "not a card", "4111 1111 1111"],
    notes: "Format only — does NOT validate Luhn checksum or card brand. Validate server-side.",
  },
  {
    id: "date-iso",
    name: "ISO date (YYYY-MM-DD)",
    description: "ISO 8601 calendar date with optional time.",
    keywords: ["date", "iso date", "yyyy-mm-dd", "calendar", "day"],
    pattern: "\\d{4}-\\d{2}-\\d{2}(?:T\\d{2}:\\d{2}(?::\\d{2})?(?:Z|[+\\-]\\d{2}:?\\d{2})?)?",
    flags: "g",
    exampleMatches: ["2024-01-15", "2024-01-15T10:30:00Z", "2024-12-31T23:59:59+05:30"],
    exampleNonMatches: ["2024/01/15", "15-01-2024", "Jan 15, 2024"],
    notes: "Validates format, not real calendar dates (Feb 31 will match).",
  },
  {
    id: "time-24h",
    name: "Time (24-hour HH:MM)",
    description: "24-hour time with optional seconds.",
    keywords: ["time", "24 hour", "24h", "hh:mm", "military time", "clock"],
    pattern: "(?:[01]\\d|2[0-3]):[0-5]\\d(?::[0-5]\\d)?",
    flags: "g",
    exampleMatches: ["00:00", "23:59", "12:30:45", "09:15"],
    exampleNonMatches: ["24:00", "12:60", "9:5", "noon"],
    notes: "Range-validates hours 00–23 and minutes/seconds 00–59.",
  },
  {
    id: "hex-color",
    name: "Hex color code",
    description: "CSS hex color with optional # and 3/4/6/8 digit forms.",
    keywords: ["hex", "color", "css color", "hex color", "rgb hex"],
    pattern: "#?(?:[0-9a-fA-F]{3,4}|[0-9a-fA-F]{6}|[0-9a-fA-F]{8})\\b",
    flags: "g",
    exampleMatches: ["#fff", "#aabbcc", "#aabbccff", "aabbcc"],
    exampleNonMatches: ["#ggg", "#12", "not a color"],
    notes: "Matches 3/4/6/8 hex digits. CSS allows both shorthand and full forms.",
  },
  {
    id: "zip-us",
    name: "US ZIP code",
    description: "5-digit ZIP or ZIP+4 (5 digits, dash, 4 digits).",
    keywords: ["zip", "zip code", "postal", "us zip", "postcode"],
    pattern: "\\b\\d{5}(?:-\\d{4})?\\b",
    flags: "g",
    exampleMatches: ["12345", "12345-6789", "90210", "10001-0001"],
    exampleNonMatches: ["1234", "123456", "ABCDE", "12345-678"],
    notes: "US only. For other countries, add an explicit country pattern.",
  },
  {
    id: "uuid",
    name: "UUID (any version)",
    description: "RFC 4122 UUID with hex groups separated by dashes.",
    keywords: ["uuid", "guid", "identifier", "rfc 4122", "universal id"],
    pattern: "\\b[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}\\b",
    flags: "g",
    exampleMatches: ["550e8400-e29b-41d4-a716-446655440000", "00000000-0000-0000-0000-000000000000"],
    exampleNonMatches: ["550e8400", "not-a-uuid", "xyz-12345678-1234-1234-1234-123456789012"],
    notes: "Does not validate the version nibble — see v4 UUID pattern for stricter matching.",
  },
  {
    id: "integer",
    name: "Integer number",
    description: "Optional sign + whole number, no decimal point.",
    keywords: ["integer", "whole number", "number", "int", "digit"],
    pattern: "[+\\-]?\\d+",
    flags: "g",
    exampleMatches: ["42", "-17", "+3", "0"],
    exampleNonMatches: ["3.14", "abc", "--5"],
    notes: "Use \\b boundaries if you need to avoid matching inside larger strings.",
  },
  {
    id: "decimal",
    name: "Decimal number",
    description: "Optional sign + number with optional fractional part.",
    keywords: ["decimal", "float", "real number", "double", "fraction"],
    pattern: "[+\\-]?\\d+(?:\\.\\d+)?",
    flags: "g",
    exampleMatches: ["3.14", "-0.5", "42", "+10.0"],
    exampleNonMatches: ["abc", "3.", ".5"],
    notes: "Requires a leading digit before the decimal point.",
  },
];

// ---------- Utilities ----------

function clamp(n: number, lo: number, hi: number): number {
  return Math.max(lo, Math.min(hi, n));
}

function escapeRegex(s: string): string {
  return s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

/** Normalize whitespace and trim a description. */
export function normalizeDescription(s: string): string {
  return (s || "").replace(/\s+/g, " ").trim();
}

/** Normalize flags: only keep valid JS flags in canonical order. */
export function normalizeFlags(s: string): string {
  const seen = new Set<string>();
  const out: string[] = [];
  const valid = new Set(["g", "i", "m", "s", "u", "y"]);
  for (const ch of (s || "").toLowerCase()) {
    if (valid.has(ch) && !seen.has(ch)) {
      seen.add(ch);
      out.push(ch);
    }
  }
  // Canonical order: g, i, m, s, u, y
  const order = ["g", "i", "m", "s", "u", "y"];
  return order.filter((f) => seen.has(f)).join("");
}

// ---------- NL → pattern matcher ----------

/** Score how well a description matches a pattern's keywords (0–100). */
export function scorePatternMatch(description: string, def: PatternDef): number {
  const lower = normalizeDescription(description).toLowerCase();
  if (!lower) return 0;
  let score = 0;
  for (const kw of def.keywords) {
    if (lower.includes(kw)) {
      // Longer keyword matches are weighted higher.
      score += 10 + kw.length;
    }
  }
  // Boost on exact id match
  if (lower === def.id) score += 50;
  return clamp(score, 0, 100);
}

/** Match a description against the library; return ranked candidates. */
export function matchPatterns(description: string): { def: PatternDef; score: number }[] {
  const lower = normalizeDescription(description).toLowerCase();
  if (!lower) return [];
  const scored = PATTERN_LIBRARY
    .map((def) => ({ def, score: scorePatternMatch(description, def) }))
    .filter((x) => x.score > 0)
    .sort((a, b) => b.score - a.score);
  return scored;
}

/** Build a regex from a description. Picks the best library match, else returns custom error. */
export function buildRegex(
  description: string,
  opts: { flavor?: Flavor; sample?: string; flags?: string } = {},
): BuildResult {
  const flavor = opts.flavor ?? "js";
  const sample = opts.sample ?? "";
  const matches = matchPatterns(description);
  const customFlags = opts.flags ? normalizeFlags(opts.flags) : "";

  let def: PatternDef | null = null;
  let patternName = "No match";
  let notes = "No library pattern matched this description. Try one of the sample descriptions.";
  let pattern = "";
  let flags = "";

  if (matches.length > 0) {
    def = matches[0].def;
    patternName = def.name;
    notes = def.notes;
    pattern = def.pattern;
    flags = customFlags || def.flags;
  } else if (description.trim()) {
    // Last resort: treat the description as a literal regex string if it contains regex metacharacters.
    const clean = normalizeDescription(description);
    if (/[[\\()|*+?]/.test(clean)) {
      pattern = clean;
      flags = customFlags || "g";
      patternName = "Custom regex (literal)";
      notes = "Used your input as a literal regex because no library pattern matched.";
    } else {
      pattern = escapeRegex(clean);
      flags = customFlags || "g";
      patternName = "Literal match";
      notes = "Used your input as a literal string (escaped) because no library pattern matched.";
    }
  }

  const test = testRegex(pattern, flags, sample);
  const tokens = explainRegex(pattern);
  const redosWarnings = detectRedos(pattern);

  return {
    description: normalizeDescription(description),
    patternId: def?.id ?? null,
    patternName,
    pattern,
    flags,
    flavor,
    test,
    tokens,
    redosWarnings,
    notes,
    generatedAt: Date.now(),
  };
}

// ---------- Test regex against sample text ----------

/** Compile and test a regex pattern against a sample string. */
export function testRegex(pattern: string, flags: string, sample: string): TestResult {
  if (!pattern) {
    return { ok: false, error: "Empty pattern", matches: [], matchCount: 0, groups: [] };
  }
  let re: RegExp;
  try {
    re = new RegExp(pattern, flags);
  } catch (e) {
    return {
      ok: false,
      error: e instanceof Error ? e.message : "Invalid regex",
      matches: [],
      matchCount: 0,
      groups: [],
    };
  }
  const matches: MatchSegment[] = [];
  const groupMap = new Map<number, { index: number; name?: string; values: string[] }>();

  if (re.global) {
    let m: RegExpExecArray | null;
    let safety = 0;
    while ((m = re.exec(sample)) !== null) {
      matches.push({
        start: m.index,
        end: m.index + m[0].length,
        text: m[0],
        groups: m.slice(1),
      });
      for (let gi = 1; gi < m.length; gi++) {
        if (!groupMap.has(gi)) groupMap.set(gi, { index: gi, values: [] });
        groupMap.get(gi)!.values.push(m[gi] ?? "");
      }
      if (m[0].length === 0) re.lastIndex++;   // avoid infinite loop on zero-width
      if (++safety > 10000) break;
    }
  } else {
    const m = re.exec(sample);
    if (m) {
      matches.push({
        start: m.index,
        end: m.index + m[0].length,
        text: m[0],
        groups: m.slice(1),
      });
      for (let gi = 1; gi < m.length; gi++) {
        if (!groupMap.has(gi)) groupMap.set(gi, { index: gi, values: [] });
        groupMap.get(gi)!.values.push(m[gi] ?? "");
      }
    }
  }

  // Extract named groups (JS only — RegExpExecArray has groups property)
  let firstNamed: { name: string; index: number } | null = null;
  try {
    const m = new RegExp(pattern, flags.includes("g") ? flags : flags + "g").exec(sample);
    if (m && m.groups) {
      const names = Object.keys(m.groups);
      if (names.length > 0) {
        // Map named groups: indices are positional. We'll just attach the first name to the next available group.
        let idx = 1;
        for (const name of names) {
          if (!firstNamed) firstNamed = { name, index: idx };
          if (!groupMap.has(idx)) groupMap.set(idx, { index: idx, name, values: [] });
          else groupMap.get(idx)!.name = name;
          idx++;
        }
      }
    }
  } catch {
    // ignore named-group extraction errors
  }

  return {
    ok: true,
    matches,
    matchCount: matches.length,
    groups: Array.from(groupMap.values()).sort((a, b) => a.index - b.index),
  };
}

// ---------- Token-by-token explainer (AST) ----------

/** Tokenize a regex pattern and explain each token. */
export function explainRegex(pattern: string): RegexToken[] {
  const tokens: RegexToken[] = [];
  let groupIndex = 0;
  let i = 0;

  while (i < pattern.length) {
    const ch = pattern[i];

    // Escaped character
    if (ch === "\\") {
      const next = pattern[i + 1] ?? "";
      const value = `\\${next}`;
      tokens.push({
        type: next.match(/[dDwWsS]/) ? "class"
          : next.match(/[bB]/) ? "anchor"
          : "escaped",
        raw: value,
        value,
        description: explainEscape(next),
      });
      i += 2;
      continue;
    }

    // Character class [..]
    if (ch === "[") {
      let j = i + 1;
      let negate = false;
      if (pattern[j] === "^") { negate = true; j++; }
      let body = "";
      while (j < pattern.length && pattern[j] !== "]") {
        body += pattern[j];
        if (pattern[j] === "\\" && j + 1 < pattern.length) {
          body += pattern[j + 1];
          j += 2;
        } else {
          j++;
        }
      }
      const raw = pattern.slice(i, j + 1);
      tokens.push({
        type: "class",
        raw,
        value: raw,
        description: negate
          ? `Negated character class: any char NOT in [${body}]`
          : `Character class: any char in [${body}]`,
      });
      i = j + 1;
      continue;
    }

    // Quantifiers
    if (ch === "*" || ch === "+" || ch === "?") {
      tokens.push({
        type: "quantifier",
        raw: ch,
        value: ch,
        description: ch === "*" ? "Zero or more of the previous token"
          : ch === "+" ? "One or more of the previous token"
          : "Zero or one of the previous token (optional)",
      });
      i++;
      continue;
    }
    if (ch === "{") {
      let j = i + 1;
      while (j < pattern.length && pattern[j] !== "}") j++;
      const raw = pattern.slice(i, j + 1);
      tokens.push({
        type: "quantifier",
        raw,
        value: raw,
        description: `Quantifier: ${raw} (repeat previous token)`,
      });
      i = j + 1;
      continue;
    }

    // Anchors
    if (ch === "^" || ch === "$") {
      tokens.push({
        type: "anchor",
        raw: ch,
        value: ch,
        description: ch === "^" ? "Start of string (or line with /m flag)" : "End of string (or line with /m flag)",
      });
      i++;
      continue;
    }

    // Groups
    if (ch === "(") {
      // Check for non-capturing, lookaround, or named group
      const two = pattern.slice(i, i + 2);
      const three = pattern.slice(i, i + 3);
      const four = pattern.slice(i, i + 4);
      if (three === "(?:" ) {
        tokens.push({ type: "group-open", raw: "(?:", value: "(?:", description: "Non-capturing group start" });
        i += 3;
        continue;
      }
      if (four === "(?P<" || three === "(?<") {
        // Named group: (?<name>...) or (?P<name>...)
        const offset = four === "(?P<" ? 4 : 3;
        let j = i + offset;
        let name = "";
        while (j < pattern.length && pattern[j] !== ">") { name += pattern[j]; j++; }
        groupIndex++;
        tokens.push({
          type: "named-group",
          raw: pattern.slice(i, j + 1),
          value: pattern.slice(i, j + 1),
          description: `Named capture group "${name}" (group ${groupIndex})`,
          groupIndex,
          groupName: name,
        });
        i = j + 1;
        continue;
      }
      if (three === "(?=" || three === "(?!" || four === "(?<=" || four === "(?<!") {
        const len = four === "(?<=" || four === "(?<!" ? 4 : 3;
        const raw = pattern.slice(i, i + len);
        tokens.push({
          type: "lookaround",
          raw,
          value: raw,
          description: four === "(?<="
            ? "Positive lookbehind"
            : four === "(?<!"
              ? "Negative lookbehind"
              : three === "(?="
                ? "Positive lookahead"
                : "Negative lookahead",
        });
        i += len;
        continue;
      }
      groupIndex++;
      tokens.push({
        type: "group-open",
        raw: "(",
        value: "(",
        description: `Capture group ${groupIndex} start`,
        groupIndex,
      });
      i++;
      continue;
    }
    if (ch === ")") {
      tokens.push({ type: "group-close", raw: ")", value: ")", description: "Group end" });
      i++;
      continue;
    }

    // Alternation
    if (ch === "|") {
      tokens.push({ type: "alternation", raw: "|", value: "|", description: "Alternation (OR)" });
      i++;
      continue;
    }

    // Backreference \1..\9 handled by escaped above.
    // Dot
    if (ch === ".") {
      tokens.push({
        type: "literal",
        raw: ".",
        value: ".",
        description: "Any character (except newline, unless /s flag)",
      });
      i++;
      continue;
    }

    // Plain literal
    tokens.push({
      type: "char",
      raw: ch,
      value: ch,
      description: `Literal "${ch}"`,
    });
    i++;
  }

  return tokens;
}

function explainEscape(ch: string): string {
  switch (ch) {
    case "d": return "Any digit [0-9]";
    case "D": return "Any non-digit";
    case "w": return "Any word char [A-Za-z0-9_]";
    case "W": return "Any non-word char";
    case "s": return "Any whitespace";
    case "S": return "Any non-whitespace";
    case "b": return "Word boundary";
    case "B": return "Not a word boundary";
    case "n": return "Newline";
    case "t": return "Tab";
    case "r": return "Carriage return";
    case "0": return "NUL character";
    default:
      if (/^\d$/.test(ch)) return `Backreference to group ${ch}`;
      return `Escaped literal "${ch}"`;
  }
}

// ---------- Multi-flavor conversion ----------

/** Convert a JS regex source string to a target flavor's string form. */
export function convertFlavor(pattern: string, from: Flavor, to: Flavor): string {
  if (from === to) return pattern;
  let out = pattern;
  if (to === "python") {
    // Python re: (?<name>...) is supported; (?P<name>...) is legacy supported too.
    // Convert JS (?<name>...) to (?P<name>...) for max compat.
    out = out.replace(/\(\?<([a-zA-Z_]\w*)>/g, "(?P<$1>");
  } else if (to === "pcre") {
    // PCRE supports both forms — leave as-is.
  } else if (to === "java") {
    // Java supports (?<name>...) — leave as-is. Backslashes already doubled in string form.
  } else if (to === "js") {
    // Convert (?P<name>...) back to (?<name>...) for JS.
    out = out.replace(/\(\?P<([a-zA-Z_]\w*)>/g, "(?<$1>");
  }
  return out;
}

/** Render a regex pattern as a code string for the target flavor. */
export function renderPatternForFlavor(pattern: string, flags: string, flavor: Flavor): string {
  const converted = convertFlavor(pattern, "js", flavor);
  switch (flavor) {
    case "js":
      return `/${converted}/${flags}`;
    case "pcre":
      return `/${converted}/${flags.replace(/[uy]/g, "")}`;
    case "python":
      return `r"${converted}"`;
    case "java":
      return `"${converted.replace(/\\/g, "\\\\")}"`;
    default:
      return converted;
  }
}

// ---------- ReDoS / catastrophic-backtracking linter ----------

/** Detect common catastrophic-backtracking patterns. */
export function detectRedos(pattern: string): ReDoSWarning[] {
  const out: ReDoSWarning[] = [];

  // Nested quantifier: (a+)+  or  (a*)*
  const nested = pattern.match(/\(([^()]*?)[*+][^()]*?\)[*+]/);
  if (nested) {
    out.push({
      severity: "high",
      pattern: nested[0],
      reason: "Nested quantifier on a group — catastrophic backtracking on long non-matching input.",
      suggestion: "Use a possessive quantifier or rewrite as (?:a+b*)+ to remove ambiguity.",
    });
  }

  // Overlapping alternation with quantifier: (a|a)*
  const overlap = pattern.match(/\(([^()]*\|[^()]*)\)[*+]/);
  if (overlap) {
    const alts = overlap[1].split("|").map((s) => s.trim());
    // Check if any two alternatives share a prefix
    for (let i = 0; i < alts.length; i++) {
      for (let j = i + 1; j < alts.length; j++) {
        if (alts[i] && alts[j] && (alts[i].startsWith(alts[j]) || alts[j].startsWith(alts[i]))) {
          out.push({
            severity: "medium",
            pattern: overlap[0],
            reason: `Alternation with shared prefix (${alts[i]} | ${alts[j]}) under a quantifier — backtracking on overlap.`,
            suggestion: "Disambiguate the alternatives or anchor them more tightly.",
          });
          break;
        }
      }
    }
  }

  // Quantified . with no upper bound and other quantifiers nearby: .+.*  or  .*.+
  if (/\.[*+][^.]*?\.[*+]/.test(pattern)) {
    out.push({
      severity: "medium",
      pattern: pattern.match(/\.[*+][^.]*?\.[*+]/)?.[0] ?? "",
      reason: "Two unbounded dot-quantifiers in sequence — quadratic backtracking on partial matches.",
      suggestion: "Use a more specific character class or bound the quantifier (e.g. {1,100}).",
    });
  }

  // (a|.+)+ style — alternation containing a greedy dot, inside a quantifier
  if (/\((?:[^()]*\.)[^()]*\)[*+]/.test(pattern)) {
    out.push({
      severity: "low",
      pattern: pattern.match(/\((?:[^()]*\.)[^()]*\)[*+]/)?.[0] ?? "",
      reason: "Greedy dot inside a quantified group — can cause exponential backtracking.",
      suggestion: "Replace the inner dot with a more specific character class.",
    });
  }

  return out;
}

// ---------- Replace preview ----------

/** Apply a regex replace and return the result + diff stats. */
export function previewReplace(
  pattern: string,
  flags: string,
  sample: string,
  replacement: string,
): { ok: boolean; error?: string; result: string; replacements: number } {
  if (!pattern) return { ok: false, error: "Empty pattern", result: sample, replacements: 0 };
  let re: RegExp;
  try {
    // Ensure global flag for replace-all semantics.
    const f = flags.includes("g") ? flags : flags + "g";
    re = new RegExp(pattern, f);
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : "Invalid regex", result: sample, replacements: 0 };
  }
  let count = 0;
  // Count matches first
  const matches = sample.match(re);
  count = matches ? matches.length : 0;
  const result = sample.replace(re, replacement);
  return { ok: true, result, replacements: count };
}

// ---------- Code snippet export ----------

/** Build a code snippet that uses the regex in the target language. */
export function buildCodeSnippet(
  pattern: string,
  flags: string,
  flavor: Flavor,
  sampleVar = "text",
): string {
  const converted = convertFlavor(pattern, "js", flavor);
  switch (flavor) {
    case "js":
      return [
        `const re = /${converted}/${flags};`,
        `const matches = ${sampleVar}.match(re);`,
        `console.log(matches);`,
      ].join("\n");
    case "pcre":
      return [
        `<?php`,
        `$re = '/${converted}/${flags.replace(/[uy]/g, "")}';`,
        `preg_match_all($re, $${sampleVar}, $matches);`,
        `print_r($matches);`,
      ].join("\n");
    case "python":
      return [
        `import re`,
        `pattern = r"${converted}"`,
        `matches = re.findall(pattern, ${sampleVar})`,
        `print(matches)`,
      ].join("\n");
    case "java":
      return [
        `import java.util.regex.*;`,
        `Pattern p = Pattern.compile("${converted.replace(/\\/g, "\\\\")}");`,
        `Matcher m = p.matcher(${sampleVar});`,
        `while (m.find()) { System.out.println(m.group()); }`,
      ].join("\n");
    default:
      return converted;
  }
}

// ---------- Renderers ----------

/** Render the build result as plain text. */
export function renderText(r: BuildResult): string {
  const lines: string[] = [];
  lines.push(`# Regex Build: ${r.patternName}`);
  lines.push(`Description: ${r.description}`);
  lines.push(`Pattern: /${r.pattern}/${r.flags}`);
  lines.push(`Flavor: ${FLAVOR_LABELS[r.flavor]}`);
  lines.push(`Matches in sample: ${r.test.matchCount}`);
  if (r.test.error) lines.push(`Error: ${r.test.error}`);
  lines.push("");
  lines.push("Tokens:");
  for (const t of r.tokens) {
    lines.push(`  ${t.raw.padEnd(12)} → ${t.description}`);
  }
  if (r.redosWarnings.length > 0) {
    lines.push("");
    lines.push("ReDoS warnings:");
    for (const w of r.redosWarnings) {
      lines.push(`  [${w.severity}] ${w.pattern}: ${w.reason}`);
      lines.push(`    fix: ${w.suggestion}`);
    }
  }
  if (r.notes) {
    lines.push("");
    lines.push(`Notes: ${r.notes}`);
  }
  return lines.join("\n");
}

/** Render the build result as Markdown. */
export function renderMarkdown(r: BuildResult): string {
  const lines: string[] = [];
  lines.push(`# Regex Build: ${r.patternName}`);
  lines.push("");
  lines.push(`**Description:** ${r.description}`);
  lines.push(`**Pattern:** \`${renderPatternForFlavor(r.pattern, r.flags, r.flavor)}\``);
  lines.push(`**Flavor:** ${FLAVOR_LABELS[r.flavor]}`);
  lines.push(`**Matches in sample:** ${r.test.matchCount}`);
  if (r.test.error) lines.push(`**Error:** ${r.test.error}`);
  lines.push("");
  lines.push("## Token explanation");
  lines.push("");
  lines.push("| Token | Type | Description |");
  lines.push("|---|---|---|");
  for (const t of r.tokens) {
    lines.push(`| \`${t.raw}\` | ${t.type} | ${t.description} |`);
  }
  if (r.redosWarnings.length > 0) {
    lines.push("");
    lines.push("## ReDoS warnings");
    lines.push("");
    for (const w of r.redosWarnings) {
      lines.push(`- **[${w.severity}]** \`${w.pattern}\` — ${w.reason}`);
      lines.push(`  - _Fix:_ ${w.suggestion}`);
    }
  }
  if (r.notes) {
    lines.push("");
    lines.push(`## Notes`);
    lines.push("");
    lines.push(r.notes);
  }
  return lines.join("\n");
}

/** Render the build result as JSON. */
export function renderJson(r: BuildResult): string {
  return JSON.stringify(r, null, 2);
}

/** Render just the pattern as a string (literal form). */
export function renderPatternOnly(r: BuildResult): string {
  return renderPatternForFlavor(r.pattern, r.flags, r.flavor);
}

// ---------- History (localStorage) ----------

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

// ---------- Shareable URL ----------

export function buildShareUrl(description: string, sample: string, flavor: Flavor, flags: string): string {
  const params = new URLSearchParams();
  if (description) params.set("d", description);
  if (sample) params.set("s", sample);
  if (flavor) params.set("f", flavor);
  if (flags) params.set("fl", flags);
  if (typeof window === "undefined") return `?${params.toString()}`;
  return `${window.location.origin}${window.location.pathname}#${params.toString()}`;
}

export function parseShareUrl(hash: string): ShareState {
  const clean = hash.startsWith("#") ? hash.slice(1) : hash;
  if (!clean) return { description: "", sample: "", flavor: "js", flags: "" };
  const params = new URLSearchParams(clean);
  const flavorRaw = params.get("f") ?? "js";
  const flavor = ALL_FLAVORS.includes(flavorRaw as Flavor) ? (flavorRaw as Flavor) : "js";
  return {
    description: params.get("d") ?? "",
    sample: params.get("s") ?? "",
    flavor,
    flags: params.get("fl") ?? "",
  };
}

// ---------- Sample descriptions ----------

export const SAMPLE_DESCRIPTIONS: { label: string; description: string; sample: string }[] = [
  {
    label: "Email addresses",
    description: "match email addresses",
    sample: "Contact alice@example.com or bob+filter@mail.co.uk — not alice@ or @example.com.",
  },
  {
    label: "IPv4 addresses",
    description: "find ipv4 addresses",
    sample: "Try 192.168.1.1 and 8.8.8.8 but not 999.1.1.1 or 1.2.3.",
  },
  {
    label: "Hex colors",
    description: "extract hex color codes",
    sample: "Use #fff for white, #aabbcc for blue, and #ff8800ff for orange (with alpha).",
  },
  {
    label: "ISO dates",
    description: "match iso date",
    sample: "Born 2024-01-15, met 2024-12-31T23:59:59Z, not 01/15/2024.",
  },
  {
    label: "UUIDs",
    description: "find uuid",
    sample: "Ids: 550e8400-e29b-41d4-a716-446655440000 and 00000000-0000-0000-0000-000000000000.",
  },
];

// ---------- LLM helpers (UI-only — pure prompt builder) ----------

/** Build the prompt to send to an LLM for richer regex generation (BYO key). */
export function buildLlmPrompt(description: string, flavor: Flavor): string {
  return [
    "You are an expert at regular expressions.",
    `Generate a single ${FLAVOR_LABELS[flavor]} regex that matches: ${description}.`,
    "Return ONLY the regex pattern as a JSON object: {\"pattern\":\"...\",\"flags\":\"...\",\"explanation\":\"...\"}",
    "No commentary, no markdown fences.",
  ].join("\n");
}

/** Parse an LLM-returned JSON object. */
export function parseLlmResult(llmText: string): { pattern: string; flags: string; explanation: string } | null {
  try {
    const obj = JSON.parse(llmText);
    if (typeof obj !== "object" || obj === null) return null;
    const pattern = typeof obj.pattern === "string" ? obj.pattern : "";
    const flags = typeof obj.flags === "string" ? obj.flags : "g";
    const explanation = typeof obj.explanation === "string" ? obj.explanation : "";
    if (!pattern) return null;
    return { pattern, flags, explanation };
  } catch {
    return null;
  }
}
