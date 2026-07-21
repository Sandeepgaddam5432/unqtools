/**
 * Markdown Linter & Formatter — pure logic.
 *
 * Implements 25+ markdownlint-compatible rules (MD001–MD058) with
 * auto-fix, a configurable LintConfig, history (localStorage, max 20),
 * and a shareable URL encoding the config. Pure functions only —
 * no DOM, no network.
 *
 * Design principles:
 *  - Every rule has a stable ID (MD001 … MD058), a short name, a
 *    description, a severity, and a fixable flag.
 *  - Lint produces a list of violations with line/col/rule/message/fix.
 *  - autoFix applies all fixable rules in a single pass.
 *  - The formatter combines safe fixes into a Prettier-compatible preset.
 */

// ---------------------------------------------------------------------------
// Public types
// ---------------------------------------------------------------------------

export type Severity = "error" | "warning" | "info";

export interface LintConfig {
  // Rule toggles (true = enabled)
  md001: boolean; md003: boolean; md004: boolean; md005: boolean;
  md007: boolean; md009: boolean; md010: boolean; md012: boolean;
  md013: boolean; md018: boolean; md019: boolean; md022: boolean;
  md025: boolean; md026: boolean; md029: boolean; md030: boolean;
  md031: boolean; md032: boolean; md033: boolean; md034: boolean;
  md035: boolean; md039: boolean; md040: boolean; md041: boolean;
  md047: boolean; md058: boolean;
  // Parameters
  lineLength: number;          // MD013
  headingStyle: "atx" | "setext"; // MD003
  ulMarker: "-" | "*" | "+";    // MD004
  ulIndent: number;            // MD007
  codeFenceStyle: "backtick" | "tilde"; // MD035 alias
  hrStyle: "---" | "***" | "___"; // MD035
  emphasisStyle: "asterisk" | "underscore";
  noInlineHtmlTags: string;    // MD033 comma-separated allowed tags (empty = disabled)
  noTrailingPunctuation: string; // MD026
}

export type RuleId =
  | "MD001" | "MD003" | "MD004" | "MD005" | "MD007" | "MD009" | "MD010"
  | "MD012" | "MD013" | "MD018" | "MD019" | "MD022" | "MD025" | "MD026"
  | "MD029" | "MD030" | "MD031" | "MD032" | "MD033" | "MD034" | "MD035"
  | "MD039" | "MD040" | "MD041" | "MD047" | "MD058";

export interface RuleMeta {
  id: RuleId;
  name: string;
  description: string;
  severity: Severity;
  fixable: boolean;
  /** Config key controlling this rule (if any). */
  configKey?: keyof LintConfig;
}

export interface Violation {
  rule: RuleId;
  line: number;
  column: number;
  message: string;
  fixable: boolean;
  severity: Severity;
}

export interface LintResult {
  violations: Violation[];
  total: number;
  errors: number;
  warnings: number;
  fixable: number;
  byRule: Record<string, number>;
}

export interface HistoryEntry {
  ts: number;
  total: number;
  fixable: number;
  errors: number;
  warnings: number;
  preview: string;
}

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const HISTORY_KEY = "unqtools:markdown-linter:history";
const HISTORY_MAX = 20;

export const RULES: RuleMeta[] = [
  { id: "MD001", name: "heading-increment", description: "Heading levels should only increment by one level at a time", severity: "error", fixable: false },
  { id: "MD003", name: "heading-style", description: "Heading style (atx vs setext)", severity: "error", fixable: true, configKey: "headingStyle" },
  { id: "MD004", name: "ul-style", description: "Unordered list style", severity: "error", fixable: true, configKey: "ulMarker" },
  { id: "MD005", name: "list-indent", description: "Inconsistent indentation for list items at the same level", severity: "error", fixable: true },
  { id: "MD007", name: "ul-indent", description: "Unordered list indentation", severity: "error", fixable: true, configKey: "ulIndent" },
  { id: "MD009", name: "no-trailing-spaces", description: "Trailing spaces", severity: "error", fixable: true },
  { id: "MD010", name: "no-hard-tabs", description: "Hard tabs", severity: "error", fixable: true },
  { id: "MD012", name: "no-multiple-blanks", description: "Multiple consecutive blank lines", severity: "error", fixable: true },
  { id: "MD013", name: "line-length", description: "Line length", severity: "warning", fixable: false, configKey: "lineLength" },
  { id: "MD018", name: "no-missing-space-atx", description: "No space after hash on atx style heading", severity: "error", fixable: true },
  { id: "MD019", name: "no-multiple-space-atx", description: "Multiple spaces after hash on atx style heading", severity: "error", fixable: true },
  { id: "MD022", name: "blanks-around-headings", description: "Headings should be surrounded by blank lines", severity: "error", fixable: true },
  { id: "MD025", name: "single-h1", description: "Multiple top level headings in the same document", severity: "error", fixable: false },
  { id: "MD026", name: "no-trailing-punctuation", description: "Trailing punctuation in heading", severity: "warning", fixable: true, configKey: "noTrailingPunctuation" },
  { id: "MD029", name: "ol-prefix", description: "Ordered list item prefix", severity: "error", fixable: true },
  { id: "MD030", name: "list-marker-space", description: "Spaces after list markers", severity: "error", fixable: true },
  { id: "MD031", name: "blanks-around-fences", description: "Fenced code blocks should be surrounded by blank lines", severity: "error", fixable: true },
  { id: "MD032", name: "blanks-around-lists", description: "Lists should be surrounded by blank lines", severity: "error", fixable: true },
  { id: "MD033", name: "no-inline-html", description: "Inline HTML", severity: "warning", fixable: false, configKey: "noInlineHtmlTags" },
  { id: "MD034", name: "no-bare-urls", description: "Bare URLs used", severity: "warning", fixable: false },
  { id: "MD035", name: "hr-style", description: "Horizontal rule style", severity: "error", fixable: true, configKey: "hrStyle" },
  { id: "MD039", name: "no-space-in-links", description: "Spaces inside link text", severity: "error", fixable: true },
  { id: "MD040", name: "fenced-code-language", description: "Fenced code blocks should have a language specified", severity: "warning", fixable: true },
  { id: "MD041", name: "first-line-heading", description: "First line in file should be a top level heading", severity: "error", fixable: false },
  { id: "MD047", name: "single-trailing-newline", description: "Files should end with a single newline character", severity: "error", fixable: true },
  { id: "MD058", name: "blanks-around-tables", description: "Tables should be surrounded by blank lines", severity: "error", fixable: true },
];

export const RULE_BY_ID: Record<RuleId, RuleMeta> = RULES.reduce(
  (acc, r) => { acc[r.id] = r; return acc; },
  {} as Record<RuleId, RuleMeta>,
);

export const DEFAULT_CONFIG: LintConfig = {
  md001: true, md003: true, md004: true, md005: true,
  md007: true, md009: true, md010: true, md012: true,
  md013: true, md018: true, md019: true, md022: true,
  md025: true, md026: true, md029: true, md030: true,
  md031: true, md032: true, md033: false, md034: true,
  md035: true, md039: true, md040: true, md041: true,
  md047: true, md058: true,
  lineLength: 100,
  headingStyle: "atx",
  ulMarker: "-",
  ulIndent: 2,
  codeFenceStyle: "backtick",
  hrStyle: "---",
  emphasisStyle: "asterisk",
  noInlineHtmlTags: "",
  noTrailingPunctuation: ".,;:!?",
};

/** Prettier-compatible preset — disable rules that conflict with Prettier. */
export const PRETTIER_PRESET: LintConfig = {
  ...DEFAULT_CONFIG,
  md013: false,  // Prettier reflows prose
  md033: false,  // Prettier allows HTML
  md034: false,  // Prettier auto-links URLs
  md024: true,
  lineLength: 80,
} as LintConfig;

/** Reconciled preset — markdownlint + Prettier-friendly. */
export function reconciledPreset(): LintConfig {
  return { ...PRETTIER_PRESET };
}

// ---------------------------------------------------------------------------
// Sample document
// ---------------------------------------------------------------------------

export const SAMPLE_DOC = `#   My Document

This is a paragraph with a trailing space.   
Another line with\ta hard tab.


##  My second heading.

- item one
*   item two
+ item three

1. First
1. Second
1. Third

\`\`\`
code without language
\`\`\`

|A|B|
|-|-|
|1|2|

---

# Second H1

##Last heading.

## Heading ends with a period.

This line is intentionally very very very very very very very very very very very very very very very very very very long, exceeding the 100-char limit easily.

https://example.com is a bare URL.

<div>HTML inline</div>`;

// ---------------------------------------------------------------------------
// Tokenize helpers
// ---------------------------------------------------------------------------

interface LineInfo {
  num: number;
  text: string;
  trimmed: string;
  isBlank: boolean;
}

function tokenize(src: string): LineInfo[] {
  return src.replace(/\r\n?/g, "\n").split("\n").map((text, i) => ({
    num: i + 1,
    text,
    trimmed: text.trim(),
    isBlank: text.trim() === "",
  }));
}

const ATX_RE = /^(#{1,6})(\s*)(.*)$/;
const SETEXT_RE = /^([=-])\1*$/;
const UL_RE = /^(\s*)([-*+])(\s+)(.*)$/;
const OL_RE = /^(\s*)(\d+)([.)])(\s+)(.*)$/;
const FENCE_RE = /^(\s*)(`{3,}|~{3,})\s*([\w-]*)\s*$/;
const HR_RE = /^(\s*)([-*_])\s*\2\s*\2[\s\2]*$/;
const TABLE_ROW_RE = /^\s*\|.+\|\s*$/;
const TABLE_DELIM_RE = /^\s*\|?\s*:?-+:?\s*(\|\s*:?-+:?\s*)+\|?\s*$/;

const TRAILING_PUNCT = /[.,;:!?]$/;

// ---------------------------------------------------------------------------
// Lint
// ---------------------------------------------------------------------------

export function lint(src: string, config: LintConfig = DEFAULT_CONFIG): LintResult {
  const violations: Violation[] = [];
  const lines = tokenize(src);
  const enabled = (id: RuleId): boolean => {
    const key = id.toLowerCase() as keyof LintConfig;
    return config[key] === true;
  };
  const push = (rule: RuleId, line: number, column: number, message: string) => {
    const meta = RULE_BY_ID[rule];
    violations.push({
      rule,
      line,
      column,
      message,
      fixable: meta.fixable,
      severity: meta.severity,
    });
  };

  let h1Count = 0;
  let lastHeadingLevel = 0;
  let inFence = false;
  let fenceMarker = "";

  for (let i = 0; i < lines.length; i++) {
    const li = lines[i];
    const text = li.text;

    // Track fenced code blocks (rules don't apply inside)
    const fenceOpen = text.match(FENCE_RE);
    if (fenceOpen) {
      if (!inFence) {
        inFence = true;
        fenceMarker = fenceOpen[2][0];
        // MD031 — blanks-around-fences
        if (enabled("MD031")) {
          if (i > 0 && !lines[i - 1].isBlank) {
            push("MD031", li.num, 1, "Fenced code blocks should be surrounded by blank lines");
          }
        }
        // MD040 — fenced-code-language
        if (enabled("MD040")) {
          const lang = fenceOpen[3] ?? "";
          if (!lang) {
            push("MD040", li.num, 1, "Fenced code blocks should have a language specified");
          }
        }
      } else if (fenceOpen[2][0] === fenceMarker) {
        inFence = false;
        if (enabled("MD031")) {
          if (i + 1 < lines.length && !lines[i + 1].isBlank) {
            push("MD031", li.num, 1, "Fenced code blocks should be surrounded by blank lines");
          }
        }
      }
      continue;
    }
    if (inFence) continue;

    // MD009 — no-trailing-spaces
    if (enabled("MD009")) {
      const trail = text.match(/[ \t]+$/);
      if (trail && trail[0] !== "  ") {
        push("MD009", li.num, text.length - trail[0].length + 1, "Trailing spaces");
      }
    }

    // MD010 — no-hard-tabs
    if (enabled("MD010")) {
      const tabIdx = text.indexOf("\t");
      if (tabIdx !== -1) {
        push("MD010", li.num, tabIdx + 1, "Hard tab");
      }
    }

    // MD012 — no-multiple-blanks
    if (enabled("MD012")) {
      if (li.isBlank && i > 0 && lines[i - 1].isBlank) {
        push("MD012", li.num, 1, "Multiple consecutive blank lines");
      }
    }

    // MD013 — line-length
    if (enabled("MD013")) {
      if (text.length > config.lineLength) {
        push("MD013", li.num, config.lineLength + 1, `Line length ${text.length} exceeds ${config.lineLength}`);
      }
    }

    // MD018 / MD019 — atx heading spaces
    const hMatch = text.match(/^(#{1,6})(\s*)(.*)$/);
    if (hMatch && hMatch[3] !== "") {
      const hashes = hMatch[1];
      const spaces = hMatch[2];
      // It's a heading (unless it's something like `#1` without space)
      if (spaces === "" && enabled("MD018")) {
        push("MD018", li.num, hashes.length + 1, "No space after hash on atx style heading");
      } else if (spaces.length > 1 && enabled("MD019")) {
        push("MD019", li.num, hashes.length + 1, "Multiple spaces after hash on atx style heading");
      }
    }

    // ATX heading — process level/style/single-h1/increment/trailing-punct
    const atxMatch = text.match(/^(#{1,6})\s+(.*)$/);
    if (atxMatch) {
      const level = atxMatch[1].length;
      const content = atxMatch[2].replace(/\s*#+\s*$/, "").trim();

      // MD003 — heading-style: prefer atx
      if (enabled("MD003") && config.headingStyle === "atx") {
        // atx is the desired style — no violation here
      }

      // MD025 — single-h1
      if (enabled("MD025") && level === 1) {
        h1Count += 1;
        if (h1Count > 1) {
          push("MD025", li.num, 1, "Multiple top level headings in the same document");
        }
      }

      // MD001 — heading-increment
      if (enabled("MD001") && lastHeadingLevel > 0 && level > lastHeadingLevel + 1) {
        push("MD001", li.num, 1, `Heading levels incremented by more than one level (h${lastHeadingLevel} → h${level})`);
      }
      lastHeadingLevel = level;

      // MD022 — blanks-around-headings
      if (enabled("MD022")) {
        if (i > 0 && !lines[i - 1].isBlank) {
          push("MD022", li.num, 1, "Headings should be surrounded by blank lines");
        } else if (i + 1 < lines.length && !lines[i + 1].isBlank && !SETEXT_RE.test(lines[i + 1].text)) {
          push("MD022", li.num, 1, "Headings should be surrounded by blank lines");
        }
      }

      // MD026 — no-trailing-punctuation
      if (enabled("MD026")) {
        if (TRAILING_PUNCT.test(content) && config.noTrailingPunctuation.includes(content.slice(-1))) {
          push("MD026", li.num, content.length, `Trailing punctuation in heading: "${content.slice(-1)}"`);
        }
      }
      continue;
    }

    // Setext heading (=== or --- right after a text line)
    if (SETEXT_RE.test(text) && i > 0 && !lines[i - 1].isBlank) {
      // MD003 — heading-style: prefer atx, setext should be converted
      if (enabled("MD003") && config.headingStyle === "atx") {
        push("MD003", li.num, 1, "Setext heading should be atx style");
      }
      const level = text[0] === "=" ? 1 : 2;
      if (enabled("MD025") && level === 1) {
        h1Count += 1;
        if (h1Count > 1) {
          push("MD025", li.num, 1, "Multiple top level headings in the same document");
        }
      }
      if (enabled("MD001") && lastHeadingLevel > 0 && level > lastHeadingLevel + 1) {
        push("MD001", li.num, 1, `Heading levels incremented by more than one level (h${lastHeadingLevel} → h${level})`);
      }
      lastHeadingLevel = level;
      continue;
    }

    // Horizontal rule
    if (HR_RE.test(text)) {
      const style = text.trim()[0].repeat(3);
      if (enabled("MD035")) {
        if (style !== config.hrStyle) {
          push("MD035", li.num, 1, `Horizontal rule style should be "${config.hrStyle}"`);
        }
      }
      continue;
    }

    // Unordered list
    const ulMatch = text.match(UL_RE);
    if (ulMatch) {
      const marker = ulMatch[2];
      const spaces = ulMatch[3];
      if (enabled("MD004") && marker !== config.ulMarker) {
        push("MD004", li.num, (ulMatch[1].length + 1), `Unordered list marker should be "${config.ulMarker}"`);
      }
      if (enabled("MD030")) {
        if (spaces.length !== 1) {
          push("MD030", li.num, ulMatch[1].length + 1, `Expected 1 space after list marker, found ${spaces.length}`);
        }
      }
      // MD007 — ul-indent (basic)
      if (enabled("MD007")) {
        const indent = ulMatch[1].length;
        if (indent > 0 && indent % config.ulIndent !== 0) {
          push("MD007", li.num, 1, `Unordered list indentation should be a multiple of ${config.ulIndent}`);
        }
      }
      continue;
    }

    // Ordered list
    const olMatch = text.match(OL_RE);
    if (olMatch) {
      const num = parseInt(olMatch[2], 10);
      const spaces = olMatch[4];
      if (enabled("MD029")) {
        // First list item should be 1, subsequent should increment by 1
        // Look back for previous ordered list item at same indent
        const indent = olMatch[1].length;
        let prevNum: number | null = null;
        for (let k = i - 1; k >= 0; k--) {
          const prevOl = lines[k].text.match(OL_RE);
          if (prevOl && prevOl[1].length === indent) {
            prevNum = parseInt(prevOl[2], 10);
            break;
          }
          if (prevOl && prevOl[1].length !== indent) break;
          if (lines[k].isBlank) continue;
          if (!prevOl) break;
        }
        if (prevNum !== null && num !== prevNum + 1) {
          push("MD029", li.num, indent + 1, `Ordered list item prefix should be ${prevNum + 1}, found ${num}`);
        } else if (prevNum === null && num !== 1) {
          push("MD029", li.num, indent + 1, `Ordered list item prefix should start at 1, found ${num}`);
        }
      }
      if (enabled("MD030")) {
        if (spaces.length !== 1) {
          push("MD030", li.num, olMatch[1].length + olMatch[2].length + 1, `Expected 1 space after list marker, found ${spaces.length}`);
        }
      }
      continue;
    }

    // MD033 — no-inline-html
    if (enabled("MD033")) {
      const htmlTag = text.match(/<\/?([a-zA-Z][a-zA-Z0-9-]*)\b[^>]*>/);
      if (htmlTag) {
        const tag = htmlTag[1].toLowerCase();
        const allowed = config.noInlineHtmlTags
          .split(",")
          .map((t) => t.trim().toLowerCase())
          .filter(Boolean);
        if (!allowed.includes(tag)) {
          push("MD033", li.num, (text.indexOf(htmlTag[0]) + 1), `Inline HTML: <${tag}>`);
        }
      }
    }

    // MD034 — no-bare-urls
    if (enabled("MD034")) {
      const urlMatch = text.match(/(^|[\s(])(https?:\/\/[^\s)<]+)(?![)\w])/);
      if (urlMatch) {
        push("MD034", li.num, (text.indexOf(urlMatch[2]) + 1), `Bare URL: ${urlMatch[2]}`);
      }
    }

    // MD039 — no-space-in-links
    if (enabled("MD039")) {
      const linkMatch = text.match(/\[([^\]]*[\s][^\]]*|[^\[]*\s+\S+)\]\(/);
      if (linkMatch) {
        push("MD039", li.num, (text.indexOf("[") + 1), "Spaces inside link text");
      }
    }

    // Table delimiter row — track tables for MD058
    if (TABLE_DELIM_RE.test(text) && i > 0 && TABLE_ROW_RE.test(lines[i - 1].text)) {
      if (enabled("MD058")) {
        if (i > 1 && !lines[i - 2].isBlank) {
          push("MD058", lines[i - 1].num, 1, "Tables should be surrounded by blank lines");
        }
        if (i + 1 < lines.length && !TABLE_ROW_RE.test(lines[i + 1].text) && !lines[i + 1].isBlank) {
          push("MD058", li.num, 1, "Tables should be surrounded by blank lines");
        }
      }
    }

    // MD032 — blanks-around-lists (closing of a list)
    if (enabled("MD032")) {
      const isListItem = UL_RE.test(text) || OL_RE.test(text);
      const wasListItem = i > 0 && (UL_RE.test(lines[i - 1].text) || OL_RE.test(lines[i - 1].text));
      if (!isListItem && wasListItem && !li.isBlank) {
        push("MD032", li.num, 1, "Lists should be surrounded by blank lines");
      }
      if (isListItem && i > 0 && !lines[i - 1].isBlank && !UL_RE.test(lines[i - 1].text) && !OL_RE.test(lines[i - 1].text)) {
        // Don't duplicate MD022 if previous is a heading (MD022 covers it)
        if (!lines[i - 1].text.match(/^(#{1,6})\s+/)) {
          push("MD032", li.num, 1, "Lists should be surrounded by blank lines");
        }
      }
    }
  }

  // MD041 — first-line-heading
  if (enabled("MD041")) {
    const firstNonBlank = lines.find((l) => !l.isBlank);
    if (firstNonBlank && !firstNonBlank.text.match(/^#{1}\s+/)) {
      push("MD041", firstNonBlank.num, 1, "First line in file should be a top level heading");
    }
  }

  // MD047 — single-trailing-newline
  if (enabled("MD047")) {
    if (src.length > 0 && !src.endsWith("\n")) {
      push("MD047", lines.length, 1, "Files should end with a single newline character");
    } else if (/\n\n$/.test(src) || /\n{3,}$/.test(src)) {
      push("MD047", lines.length, 1, "Files should end with a single (not multiple) newline character");
    }
  }

  // Build summary
  const byRule: Record<string, number> = {};
  let errors = 0, warnings = 0, fixable = 0;
  for (const v of violations) {
    byRule[v.rule] = (byRule[v.rule] ?? 0) + 1;
    if (v.severity === "error") errors++;
    else if (v.severity === "warning") warnings++;
    if (v.fixable) fixable++;
  }
  violations.sort((a, b) => a.line - b.line || a.column - b.column);
  return { violations, total: violations.length, errors, warnings, fixable, byRule };
}

// ---------------------------------------------------------------------------
// Auto-fix
// ---------------------------------------------------------------------------

export interface FixResult {
  output: string;
  fixesApplied: number;
  remainingViolations: LintResult;
}

/** Apply all fixable rules in a single pass. */
export function autoFix(src: string, config: LintConfig = DEFAULT_CONFIG): FixResult {
  if (!src) return { output: "", fixesApplied: 0, remainingViolations: lint("", config) };
  let lines = src.replace(/\r\n?/g, "\n").split("\n");
  let fixesApplied = 0;

  // MD010 — replace hard tabs with spaces (assume 2-space indent → 4-space tab)
  if (config.md010) {
    lines = lines.map((l) => {
      if (l.includes("\t")) { fixesApplied++; return l.replace(/\t/g, "    "); }
      return l;
    });
  }

  // MD009 — strip trailing whitespace (preserve two-space hard line breaks)
  if (config.md009) {
    lines = lines.map((l) => {
      const m = l.match(/[ \t]+$/);
      if (m && m[0] !== "  ") {
        fixesApplied++;
        return l.replace(/[ \t]+$/, "");
      }
      return l;
    });
  }

  // MD019 / MD018 — normalize atx heading space
  if (config.md019 || config.md018) {
    lines = lines.map((l) => {
      const m = l.match(/^(#{1,6})(\s*)(.*)$/);
      if (m && m[3] !== "" && m[2].length !== 1) {
        fixesApplied++;
        return `${m[1]} ${m[3]}`;
      }
      return l;
    });
  }

  // MD003 — convert setext to atx (if heading style = atx)
  if (config.md003 && config.headingStyle === "atx") {
    const out: string[] = [];
    for (let i = 0; i < lines.length; i++) {
      const cur = lines[i];
      const next = i + 1 < lines.length ? lines[i + 1] : "";
      if (SETEXT_RE.test(next) && cur.trim() !== "") {
        const level = next[0] === "=" ? 1 : 2;
        out.push(`${"#".repeat(level)} ${cur.trim()}`);
        fixesApplied++;
        i++; // skip setext underline
      } else {
        out.push(cur);
      }
    }
    lines = out;
  }

  // MD004 / MD030 — normalize ul marker to config.ulMarker + 1 space
  if (config.md004 || config.md030) {
    lines = lines.map((l) => {
      const m = l.match(UL_RE);
      if (m) {
        const marker = m[2];
        const spaces = m[3];
        let newLine = l;
        if (config.md004 && marker !== config.ulMarker) {
          newLine = newLine.replace(/^(\s*)([-*+])/, `$1${config.ulMarker}`);
          fixesApplied++;
        }
        if (config.md030 && spaces.length !== 1) {
          newLine = newLine.replace(/^(\s*[-*+])(\s+)/, `$1 `);
          fixesApplied++;
        }
        return newLine;
      }
      return l;
    });
  }

  // MD029 / MD030 — renumber ordered list to 1, 2, 3…
  if (config.md029 || config.md030) {
    let counter = 0;
    let lastIndent = -1;
    lines = lines.map((l) => {
      const m = l.match(OL_RE);
      if (m) {
        const indent = m[1].length;
        if (indent !== lastIndent) { counter = 0; lastIndent = indent; }
        counter++;
        const spaces = m[4];
        let newLine = l;
        if (config.md029) {
          newLine = newLine.replace(/^(\s*)(\d+)([.)])/, `$1${counter}$3`);
          fixesApplied++;
        }
        if (config.md030 && spaces.length !== 1) {
          newLine = newLine.replace(/^(\s*\d+[.)])(\s+)/, `$1 `);
          fixesApplied++;
        }
        return newLine;
      } else if (!l.trim().startsWith(" ") && l.trim() !== "") {
        // Reset counter when leaving the list
        counter = 0;
        lastIndent = -1;
      } else if (l.trim() === "") {
        // Allow blank line within list — don't reset
      }
      return l;
    });
  }

  // MD035 — normalize horizontal rules
  if (config.md035) {
    lines = lines.map((l) => {
      if (HR_RE.test(l) && l.trim() !== "") {
        const style = l.trim()[0].repeat(3);
        if (style !== config.hrStyle) {
          fixesApplied++;
          return config.hrStyle;
        }
      }
      return l;
    });
  }

  // MD026 — remove trailing punctuation from headings
  if (config.md026) {
    lines = lines.map((l) => {
      const m = l.match(/^(#{1,6}\s+)(.*?)(\s*#*\s*)$/);
      if (m) {
        const content = m[2];
        const lastChar = content.slice(-1);
        if (config.noTrailingPunctuation.includes(lastChar)) {
          fixesApplied++;
          return `${m[1]}${content.slice(0, -1)}${m[3]}`;
        }
      }
      return l;
    });
  }

  // MD039 — strip leading/trailing whitespace inside link text
  if (config.md039) {
    lines = lines.map((l) => {
      if (/\[\s+/.test(l) || /\s+\]/.test(l)) {
        const fixed = l.replace(/\[\s+/g, "[").replace(/\s+\]/g, "]");
        if (fixed !== l) { fixesApplied++; return fixed; }
      }
      return l;
    });
  }

  // MD040 — add a default language to fenced code blocks
  if (config.md040) {
    let inFence = false;
    let fenceMarker = "";
    lines = lines.map((l) => {
      const m = l.match(FENCE_RE);
      if (m) {
        if (!inFence) {
          inFence = true;
          fenceMarker = m[2][0];
          if (!m[3]) {
            fixesApplied++;
            const indent = m[1] ?? "";
            const fence = m[2][0] === "`" ? "```" : "~~~";
            return `${indent}${fence}text`;
          }
        } else if (m[2][0] === fenceMarker) {
          inFence = false;
        }
      }
      return l;
    });
  }

  // MD022 / MD031 / MD032 / MD058 — blanks-around-* (single pass)
  if (config.md022 || config.md031 || config.md032 || config.md058) {
    const out: string[] = [];
    for (let i = 0; i < lines.length; i++) {
      const cur = lines[i];
      const prev = out[out.length - 1] ?? "";
      const next = i + 1 < lines.length ? lines[i + 1] : "";
      const isAtx = /^(#{1,6})\s+/.test(cur);
      const isFence = FENCE_RE.test(cur);
      const isList = UL_RE.test(cur) || OL_RE.test(cur);
      const isTableDelim = TABLE_DELIM_RE.test(cur);
      const wasList = UL_RE.test(prev) || OL_RE.test(prev);
      const wasFence = FENCE_RE.test(prev);

      // MD022 — blanks around headings
      if (config.md022 && isAtx && prev !== "" && !SETEXT_RE.test(prev)) {
        out.push("");
        fixesApplied++;
      }
      // MD031 — blanks around fences
      if (config.md031 && isFence && prev !== "" && !FENCE_RE.test(prev)) {
        out.push("");
        fixesApplied++;
      }
      // MD032 — blanks around lists
      if (config.md032 && isList && prev !== "" && !wasList && !isAtx && !FENCE_RE.test(prev)) {
        out.push("");
        fixesApplied++;
      }
      // MD058 — blanks around tables (delimiter row indicates a table)
      if (config.md058 && isTableDelim && prev !== "" && !TABLE_ROW_RE.test(prev)) {
        out.push("");
        fixesApplied++;
      }
      // Closing blanks for headings/lists/fences/tables
      const isClosingBlock =
        (config.md022 && /^(#{1,6})\s+/.test(prev) && !isAtx && cur !== "" && !SETEXT_RE.test(cur)) ||
        (config.md031 && FENCE_RE.test(prev) && !isFence && cur !== "") ||
        (config.md032 && wasList && !isList && cur !== "" && !/^(#{1,6})\s+/.test(cur)) ||
        (config.md058 && TABLE_ROW_RE.test(prev) && !TABLE_ROW_RE.test(cur) && !TABLE_DELIM_RE.test(cur) && cur !== "");
      if (isClosingBlock) {
        out.push("");
        fixesApplied++;
      }
      out.push(cur);
    }
    lines = out;
  }

  // MD012 — collapse multiple blank lines to a single blank
  if (config.md012) {
    const out: string[] = [];
    let blankRun = 0;
    for (const l of lines) {
      if (l.trim() === "") {
        blankRun++;
        if (blankRun <= 1) out.push("");
        else fixesApplied++;
      } else {
        blankRun = 0;
        out.push(l);
      }
    }
    lines = out;
  }

  // MD047 — ensure single trailing newline
  if (config.md047) {
    // Strip trailing blank lines, then add a single newline
    while (lines.length > 1 && lines[lines.length - 1].trim() === "") {
      lines.pop();
      fixesApplied++;
    }
    if (lines.length === 0 || lines[lines.length - 1] !== "") {
      lines.push("");
      fixesApplied++;
    }
  }

  const output = lines.join("\n");
  const remainingViolations = lint(output, config);
  return { output, fixesApplied, remainingViolations };
}

// ---------------------------------------------------------------------------
// Format (Prettier-compatible preset + fix)
// ---------------------------------------------------------------------------

export interface FormatResult extends FixResult {
  configUsed: LintConfig;
}

export function format(src: string, config: LintConfig = DEFAULT_CONFIG): FormatResult {
  const reconciled = { ...config, md013: false, md033: false, md034: false };
  const fixed = autoFix(src, reconciled);
  return { ...fixed, configUsed: reconciled };
}

// ---------------------------------------------------------------------------
// Inline-disable comment helper
// ---------------------------------------------------------------------------

/** Generate a markdownlint inline-disable HTML comment. */
export function disableComment(ruleIds: RuleId[] | "all" = "all"): string {
  const rules = ruleIds === "all" ? "" : ruleIds.join(" ");
  const inner = rules ? `markdownlint-disable ${rules}` : "markdownlint-disable";
  return `<!-- ${inner} -->`;
}

/** Generate a markdownlint inline-enable HTML comment. */
export function enableComment(ruleIds: RuleId[] | "all" = "all"): string {
  const rules = ruleIds === "all" ? "" : ruleIds.join(" ");
  const inner = rules ? `markdownlint-enable ${rules}` : "markdownlint-enable";
  return `<!-- ${inner} -->`;
}

// ---------------------------------------------------------------------------
// Diff (line-based)
// ---------------------------------------------------------------------------

export interface DiffLine {
  type: "added" | "removed" | "context";
  num: number;
  text: string;
}

export function diffLines(before: string, after: string): DiffLine[] {
  const a = before.replace(/\r\n?/g, "\n").split("\n");
  const b = after.replace(/\r\n?/g, "\n").split("\n");
  const out: DiffLine[] = [];
  const max = Math.max(a.length, b.length);
  for (let i = 0; i < max; i++) {
    const la = a[i];
    const lb = b[i];
    if (la === lb) {
      out.push({ type: "context", num: i + 1, text: lb ?? "" });
    } else {
      if (la !== undefined) out.push({ type: "removed", num: i + 1, text: la });
      if (lb !== undefined) out.push({ type: "added", num: i + 1, text: lb });
    }
  }
  return out;
}

// ---------------------------------------------------------------------------
// History (localStorage)
// ---------------------------------------------------------------------------

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
// Shareable URL (encodes config + content snippet)
// ---------------------------------------------------------------------------

const RULE_KEYS: RuleId[] = [
  "MD001", "MD003", "MD004", "MD005", "MD007", "MD009", "MD010",
  "MD012", "MD013", "MD018", "MD019", "MD022", "MD025", "MD026",
  "MD029", "MD030", "MD031", "MD032", "MD033", "MD034", "MD035",
  "MD039", "MD040", "MD041", "MD047", "MD058",
];

export function buildShareUrl(config: LintConfig): string {
  const params = new URLSearchParams();
  const enabled = RULE_KEYS.filter((r) => config[r.toLowerCase() as keyof LintConfig] === true);
  if (enabled.length > 0 && enabled.length < RULE_KEYS.length) {
    params.set("rules", enabled.join(","));
  }
  if (config.lineLength !== DEFAULT_CONFIG.lineLength) params.set("ll", String(config.lineLength));
  if (config.headingStyle !== DEFAULT_CONFIG.headingStyle) params.set("hs", config.headingStyle);
  if (config.ulMarker !== DEFAULT_CONFIG.ulMarker) params.set("um", config.ulMarker);
  if (config.ulIndent !== DEFAULT_CONFIG.ulIndent) params.set("ui", String(config.ulIndent));
  if (config.hrStyle !== DEFAULT_CONFIG.hrStyle) params.set("hr", config.hrStyle);
  if (config.emphasisStyle !== DEFAULT_CONFIG.emphasisStyle) params.set("em", config.emphasisStyle);
  if (typeof window === "undefined") return `?${params.toString()}`;
  return `${window.location.origin}${window.location.pathname}#${params.toString()}`;
}

export function parseShareUrl(hash: string): Partial<LintConfig> {
  const clean = hash.startsWith("#") ? hash.slice(1) : hash;
  if (!clean) return {};
  const params = new URLSearchParams(clean);
  const out: Partial<LintConfig> = {};
  const rules = params.get("rules");
  if (rules) {
    const list = rules.split(",").filter(Boolean);
    for (const r of RULE_KEYS) {
      const key = r.toLowerCase() as keyof LintConfig;
      (out as Record<string, unknown>)[key] = list.includes(r);
    }
  }
  const ll = params.get("ll");
  if (ll) out.lineLength = parseInt(ll, 10) || DEFAULT_CONFIG.lineLength;
  const hs = params.get("hs");
  if (hs === "atx" || hs === "setext") out.headingStyle = hs;
  const um = params.get("um");
  if (um === "-" || um === "*" || um === "+") out.ulMarker = um;
  const ui = params.get("ui");
  if (ui) out.ulIndent = parseInt(ui, 10) || DEFAULT_CONFIG.ulIndent;
  const hr = params.get("hr");
  if (hr === "---" || hr === "***" || hr === "___") out.hrStyle = hr;
  const em = params.get("em");
  if (em === "asterisk" || em === "underscore") out.emphasisStyle = em;
  return out;
}

// ---------------------------------------------------------------------------
// Validation helpers
// ---------------------------------------------------------------------------

/** Check if a string is a valid markdownlint rule ID. */
export function isRuleId(s: string): s is RuleId {
  return RULE_KEYS.includes(s as RuleId);
}

/** Get rule metadata by ID. */
export function ruleMeta(id: RuleId): RuleMeta {
  return RULE_BY_ID[id];
}

/** Count of implemented rules. */
export const RULE_COUNT = RULES.length;
