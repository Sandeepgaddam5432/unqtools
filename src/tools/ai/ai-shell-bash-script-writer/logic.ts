/**
 * AI Shell & Bash Script Writer — pure logic.
 *
 * Convert plain-English task descriptions to safe, commented Bash/shell
 * scripts (template-based, 100% offline). Provides a shellcheck-style
 * linter, destructive-command detection, per-section plain-English
 * explanation, cron-ready wrapper, dry-run guard injection, and an
 * "explain existing script" mode. Optional BYO-key LLM call lives in
 * ui.tsx (touches network).
 *
 * Pure functions only — no DOM, no network.
 *
 * Honesty: the generator is rule-based and template-driven; it handles
 * common tasks (backup, find/cleanup, system info, deployment, monitoring,
 * file ops) but cannot synthesise arbitrary complex logic. On-device rules
 * are weaker than a BYO-key LLM for tricky tasks. Always read and test
 * scripts on non-critical data first — shell mistakes can delete files
 * irreversibly. Nothing is uploaded or logged by us.
 */

// ---------- Types ----------

export type ShellFlavor = "bash" | "posix";

export type ScriptCategory =
  | "file-ops"
  | "system-info"
  | "backup"
  | "deployment"
  | "monitoring"
  | "generic";

export interface LintFinding {
  /** Severity: error (likely bug), warning (style/risk), info (suggestion). */
  severity: "error" | "warning" | "info";
  /** 1-based line number. */
  line: number;
  /** Short rule id, e.g. "SC2086". */
  rule: string;
  /** Human-readable message. */
  message: string;
  /** Suggested fix (if any). */
  suggestion?: string;
}

export interface DestructiveFlag {
  line: number;
  pattern: string;
  reason: string;
}

export interface ScriptSection {
  /** 1-based start line of the section. */
  start: number;
  /** 1-based end line of the section. */
  end: number;
  /** Short label, e.g. "Shebang", "Strict mode", "Function: rotate". */
  label: string;
  /** Plain-English explanation of what this section does. */
  explanation: string;
}

export interface GenerateOptions {
  flavor: ShellFlavor;
  /** Script name (used in usage block; defaults to "script"). */
  name?: string;
  /** One-line description for the usage block. */
  description?: string;
  /** Whether to inject a `--dry-run` flag guard. */
  dryRun?: boolean;
  /** Whether to wrap the script as a cron-friendly entrypoint (lockfile + logging). */
  cron?: boolean;
  /** Positional argument names (e.g. ["SRC","DEST"]). */
  args?: string[];
}

export interface GeneratedScript {
  script: string;
  category: ScriptCategory;
  flavor: ShellFlavor;
  findings: LintFinding[];
  destructive: DestructiveFlag[];
  sections: ScriptSection[];
  note: string;
}

export interface HistoryEntry {
  ts: number;
  task: string;
  flavor: ShellFlavor;
  category: ScriptCategory;
  scriptPreview: string;
}

export interface ShareState {
  task: string;
  flavor: ShellFlavor;
  dryRun: boolean;
  cron: boolean;
}

export interface LlmEnhancement {
  script: string;
  explanation: string;
  alternatives: string[];
  warnings: string[];
}

// ---------- Constants ----------

export const HISTORY_KEY = "unqtools:ai-shell-bash-script-writer:history";
export const HISTORY_MAX = 20;
export const LLM_KEY_STORAGE = "unqtools:ai-shell-bash-script-writer:llm-key";

export const STRICT_MODE_BASH = [
  "# Fail fast: undefined variable = error, pipeline failure propagates,",
  "# and a sub-shell failure exits the script.",
  "set -euo pipefail",
].join("\n");

export const STRICT_MODE_POSIX = [
  "# Fail fast: undefined variable = error, command failure exits.",
  "set -eu",
].join("\n");

/** Common destructive-command patterns → reasons. */
export const DESTRUCTIVE_PATTERNS: { pattern: RegExp; reason: string }[] = [
  { pattern: /\brm\s+-[a-zA-Z]*r[a-zA-Z]*f/, reason: "Recursive forced delete — irreversible." },
  { pattern: /\brm\s+-[a-zA-Z]*f[a-zA-Z]*r/, reason: "Recursive forced delete — irreversible." },
  { pattern: /\bdd\s+if=.*of=\/dev\//, reason: "Raw block-device write — can wipe a disk." },
  { pattern: /\bmkfs\b/, reason: "Build a filesystem — destroys existing data on the target." },
  { pattern: /:\(\)\s*\{\s*:\s*\|\s*:\s*&\s*\}\s*;\s*:/, reason: "Fork bomb — DoS the host." },
  { pattern: /\bchmod\s+-R\s+0?777\b/, reason: "World-writable recursive chmod — security risk." },
  { pattern: /\bchown\s+-R\s+root/, reason: "Recursive chown to root — broad privilege change." },
  { pattern: /\bshutdown\b|\breboot\b|\bhalt\b|\bpoweroff\b/, reason: "System power control." },
  { pattern: /\b>\s*\/dev\/sd[a-z]/, reason: "Redirect to a block device — destroys the disk." },
  { pattern: /\biptables\s+-F\b/, reason: "Flush firewall rules — may open the host." },
];

/** shellcheck-style lint rules. Each rule scans one line at a time. */
export interface LintRuleDef {
  rule: string;
  severity: LintFinding["severity"];
  message: string;
  suggestion?: string;
  test: (line: string, _idx: number) => boolean;
}

export const LINT_RULES: LintRuleDef[] = [
  {
    rule: "SC2086",
    severity: "warning",
    message: "Unquoted variable in command — word-splits on whitespace.",
    suggestion: "Wrap the variable in double quotes: \"$VAR\".",
    test: (l) => /\$\w+\s*[^"'\s)/]/.test(l) && !/^#/.test(l) && !/\bcase\b/.test(l),
  },
  {
    rule: "SC2155",
    severity: "warning",
    message: "Declare and assign separately to avoid masking return values.",
    suggestion: "local var; var=$(cmd)  instead of  local var=$(cmd).",
    test: (l) => /\b(local|declare|readonly)\s+\w+=\$\(/.test(l),
  },
  {
    rule: "SC2181",
    severity: "info",
    message: "Check exit code directly with `if cmd; then` rather than `$?`.",
    test: (l) => /\$\?/.test(l) && !/^#/.test(l),
  },
  {
    rule: "SC2046",
    severity: "warning",
    message: "Word-splittable command substitution — quote it.",
    suggestion: "Wrap in double quotes: \"$(cmd)\".",
    test: (l) => /[^"]\$\([^)]+\)[^"]/.test(l) && !/^#/.test(l) && !/\bfor\b/.test(l),
  },
  {
    rule: "SC2230",
    severity: "info",
    message: "Prefer `command -v` over `which` to check for a command.",
    test: (l) => /\bwhich\s+/.test(l),
  },
  {
    rule: "SC2164",
    severity: "warning",
    message: "Use `cd dir || exit` so the script fails instead of running in the wrong dir.",
    suggestion: "Append  || exit 1  to the cd command.",
    test: (l) => /\bcd\s+[^|&]+\s*(;|$)/.test(l) && !/\|\|\s*(exit|return)/.test(l),
  },
  {
    rule: "SC2004",
    severity: "info",
    message: "${} is not needed for simple arithmetic; use $(( )).",
    test: (l) => /\$\{?\d+\}?\s*[-+*/]/.test(l),
  },
  {
    rule: "SC2188",
    severity: "warning",
    message: "Redirection without a command — did you mean `: > file`?",
    test: (l) => /^>\s+\S+\s*$/.test(l.trim()),
  },
  {
    rule: "SC1004",
    severity: "error",
    message: "Backslash-newline is fragile; prefer a real newline inside quotes.",
    test: (l) => /\\$/.test(l) && !/^#/.test(l),
  },
  {
    rule: "SC2236",
    severity: "info",
    message: "Use `-z`/`-n` instead of `! -z`/`! -n` for clarity.",
    test: (l) => /!\s+-z\b/.test(l) || /!\s+-n\b/.test(l),
  },
];

/** Template presets (clickable NL examples). */
export const TASK_PRESETS: string[] = [
  "back up this folder daily and rotate old backups",
  "find all .log files older than 30 days and delete them",
  "print disk usage for each subdirectory",
  "deploy the current git branch to /var/www",
  "monitor a URL and alert on HTTP 5xx",
  "rename all .JPG files in this folder to lowercase .jpg",
  "count lines of code in all .py files",
  "create a self-signed TLS certificate",
  "kill processes matching a pattern",
  "sync a folder to an S3 bucket",
];

/** Keyword groups used to detect the script category. */
export const CATEGORY_KEYWORDS: Record<ScriptCategory, string[]> = {
  "file-ops": [
    "rename", "move", "copy", "delete", "find", "files", "folder",
    "directory", "chmod", "permission", "lowercase", "uppercase",
    "extension", "convert", "lines", "word count",
  ],
  "system-info": [
    "disk", "memory", "cpu", "uptime", "system", "info", "kernel",
    "processes", "top", "users", "logged in", "network",
  ],
  "backup": [
    "backup", "back up", "archive", "tar", "rotate", "snapshot",
    "restore", "compress", "dump",
  ],
  "deployment": [
    "deploy", "git", "branch", "push", "release", "build", "ship",
    "publish", "rollback", "tag", "remote", "rsync", "s3",
  ],
  "monitoring": [
    "monitor", "alert", "watch", "url", "http", "health", "ping",
    "check", "service", "heartbeat", "uptime", "5xx", "latency",
  ],
  "generic": [],
};

export const CATEGORY_LABELS: Record<ScriptCategory, string> = {
  "file-ops": "File Operations",
  "system-info": "System Information",
  "backup": "Backup & Rotation",
  "deployment": "Deployment",
  "monitoring": "Monitoring & Alerting",
  "generic": "Generic",
};

// ---------- Helpers ----------

/** Normalize a task description: trim, collapse whitespace, lowercase. */
export function normalizeTask(s: string): string {
  return (s || "").replace(/\s+/g, " ").trim();
}

/** Detect the best-matching script category from a task description. */
export function detectCategory(task: string): ScriptCategory {
  const t = normalizeTask(task).toLowerCase();
  if (!t) return "generic";
  const scores: Record<ScriptCategory, number> = {
    "file-ops": 0,
    "system-info": 0,
    "backup": 0,
    "deployment": 0,
    "monitoring": 0,
    "generic": 0,
  };
  for (const cat of Object.keys(CATEGORY_KEYWORDS) as ScriptCategory[]) {
    for (const kw of CATEGORY_KEYWORDS[cat]) {
      if (t.includes(kw)) scores[cat] += 1;
    }
  }
  let best: ScriptCategory = "generic";
  let bestScore = 0;
  for (const cat of Object.keys(scores) as ScriptCategory[]) {
    if (scores[cat] > bestScore) {
      best = cat;
      bestScore = scores[cat];
    }
  }
  return bestScore > 0 ? best : "generic";
}

/** Build the shebang line for the chosen flavor. */
export function buildShebang(flavor: ShellFlavor): string {
  return flavor === "posix" ? "#!/bin/sh" : "#!/usr/bin/env bash";
}

/** Build the strict-mode block for the chosen flavor. */
export function buildStrictMode(flavor: ShellFlavor): string {
  return flavor === "posix" ? STRICT_MODE_POSIX : STRICT_MODE_BASH;
}

/** Build a usage/help block referencing the script name and args. */
export function buildUsageBlock(
  name: string,
  args: string[],
  description: string,
): string {
  const argList = args.length > 0 ? " " + args.map((a) => `<${a}>`).join(" ") : "";
  const lines: string[] = [];
  lines.push("# usage: " + name + argList + " [options]");
  if (description) lines.push("#   " + description);
  lines.push("# options:");
  lines.push("#   -h, --help       show this help and exit");
  lines.push("#   -n, --dry-run    print actions without executing them");
  if (args.length > 0) {
    lines.push("# arguments:");
    for (const a of args) {
      lines.push(`#   <${a}>   required`);
    }
  }
  return lines.join("\n");
}

/** Build a getopts-style argument parser for the chosen flavor. */
export function buildArgParser(flavor: ShellFlavor, args: string[]): string {
  const posix = flavor === "posix";
  const lines: string[] = [];
  lines.push("# ---- Argument parsing ----");
  if (posix) {
    lines.push("DRY_RUN=0");
    lines.push('while getopts ":hn" opt; do');
    lines.push('  case "$opt" in');
    lines.push("    h) sed -n '2,/^$/p' \"$0\" | sed 's/^# \\?//'; exit 0 ;;");
    lines.push("    n) DRY_RUN=1 ;;");
    lines.push('    \\?) echo "Unknown option: -$OPTARG" >&2; exit 2 ;;');
    lines.push("  esac");
    lines.push("done");
    lines.push("shift $((OPTIND - 1))");
  } else {
    lines.push("DRY_RUN=0");
    lines.push('while [[ $# -gt 0 ]]; do');
    lines.push('  case "$1" in');
    lines.push("    -h|--help)");
    lines.push('      sed -n "2,/^$/p" "$0" | sed "s/^# \\?//"; exit 0 ;;');
    lines.push("    -n|--dry-run) DRY_RUN=1; shift ;;");
    lines.push("    --) shift; break ;;");
    lines.push('    *) echo "Unknown argument: $1" >&2; exit 2 ;;');
    lines.push("  esac");
    lines.push("done");
  }
  if (args.length > 0) {
    lines.push(`if [[ $# -lt ${args.length} ]]; then`);
    lines.push(`  echo "Usage: ${args.length} positional argument(s) required" >&2`);
    lines.push("  exit 2");
    lines.push("fi");
    for (let i = 0; i < args.length; i++) {
      lines.push(`${args[i]}="${"$" + (i + 1)}"`);
    }
  }
  return lines.join("\n");
}

/** Inject a `--dry-run` guard: every command is wrapped with `[[ $DRY_RUN -eq 1 ]] || `. */
export function addDryRunGuard(script: string): string {
  const lines = script.split("\n");
  const out: string[] = [];
  let inHeredoc = false;
  for (const line of lines) {
    if (inHeredoc) {
      out.push(line);
      // Naive heredoc terminator detection: a line that is exactly a label.
      // We only track the common case "EOF".
      if (/^EOF\s*$/.test(line.trim())) inHeredoc = false;
      continue;
    }
    if (/<<-?EOF\b/.test(line)) inHeredoc = true;
    // Skip comments and blank lines.
    if (/^\s*#/.test(line) || /^\s*$/.test(line)) { out.push(line); continue; }
    // Skip control flow keywords.
    if (/^\s*(if|elif|else|fi|for|while|do|done|case|esac|function|return|exit|local|declare)\b/.test(line)) {
      out.push(line);
      continue;
    }
    // Wrap the line's command with a dry-run guard.
    out.push('[[ "$DRY_RUN" -eq 1 ]] && { echo "[dry-run] " ' + JSON.stringify(line.trim()) + '; } || ' + line);
  }
  return out.join("\n");
}

/** Wrap a script as a cron-friendly entrypoint with a lockfile + logging. */
export function wrapForCron(script: string, name = "script"): string {
  const lines = script.split("\n");
  const header = [
    "# ---- cron wrapper ----",
    "# Acquire a lockfile so two cron runs cannot overlap.",
    `LOCKFILE="/tmp/${name}.lock"`,
    'exec 9>"$LOCKFILE"',
    'if ! flock -n 9; then',
    '  echo "Another instance is already running." >&2',
    "  exit 0",
    "fi",
    "# Log every line with a timestamp.",
    'log() { echo "[$(date -u +%Y-%m-%dT%H:%M:%SZ)] $*"; }',
    'trap \'log "exiting (rc=$?)"\' EXIT',
    'log "starting ${0}"',
  ];
  return [...header, ...lines, 'log "done"'].join("\n");
}

// ---------- Linter (shellcheck-style heuristics) ----------

/** Strip a single line of its trailing comment. */
function stripComment(line: string): string {
  // Naive: a `#` outside quotes starts a comment.
  let inSingle = false;
  let inDouble = false;
  for (let i = 0; i < line.length; i++) {
    const c = line[i];
    if (c === "'" && !inDouble) inSingle = !inSingle;
    else if (c === '"' && !inSingle) inDouble = !inDouble;
    else if (c === "#" && !inSingle && !inDouble && (i === 0 || /\s/.test(line[i - 1]))) {
      return line.slice(0, i);
    }
  }
  return line;
}

/** Run all lint rules against a script and return findings. */
export function lintScript(script: string): LintFinding[] {
  const findings: LintFinding[] = [];
  const lines = script.split("\n");
  for (let i = 0; i < lines.length; i++) {
    const raw = lines[i];
    const code = stripComment(raw);
    for (const rule of LINT_RULES) {
      try {
        if (rule.test(code, i)) {
          findings.push({
            severity: rule.severity,
            line: i + 1,
            rule: rule.rule,
            message: rule.message,
            suggestion: rule.suggestion,
          });
        }
      } catch {
        // rule threw — skip silently.
      }
    }
  }
  return findings;
}

/** Detect destructive commands in the script. */
export function detectDestructive(script: string): DestructiveFlag[] {
  const out: DestructiveFlag[] = [];
  const lines = script.split("\n");
  for (let i = 0; i < lines.length; i++) {
    const code = stripComment(lines[i]);
    for (const p of DESTRUCTIVE_PATTERNS) {
      if (p.pattern.test(code)) {
        out.push({ line: i + 1, pattern: p.pattern.source, reason: p.reason });
      }
    }
  }
  return out;
}

/** Explain a script section-by-section in plain English. */
export function explainScript(script: string): ScriptSection[] {
  const lines = script.split("\n");
  const sections: ScriptSection[] = [];
  let i = 0;
  let current: ScriptSection | null = null;
  const flush = (endLine: number) => {
    if (current) {
      current.end = endLine;
      sections.push(current);
      current = null;
    }
  };
  while (i < lines.length) {
    const line = lines[i];
    const trimmed = line.trim();
    if (/^#!\//.test(trimmed)) {
      flush(i);
      current = {
        start: i + 1,
        end: i + 1,
        label: "Shebang",
        explanation: "Tells the kernel which interpreter to run the file with.",
      };
      flush(i + 1);
    } else if (/^set\s+-[a-zA-Z]*u/.test(trimmed) || /^set\s+-eu/.test(trimmed)) {
      flush(i);
      current = {
        start: i + 1,
        end: i + 1,
        label: "Strict mode",
        explanation: "Enables fail-fast semantics: undefined variables error, command failures exit, and (in Bash) a pipeline failure propagates.",
      };
      // advance through consecutive set/comment lines
      let j = i;
      while (j + 1 < lines.length && /^\s*(#|set\s+-)/.test(lines[j + 1])) j++;
      current.end = j + 1;
      flush(j + 1);
      i = j;
    } else if (/^\s*#\s*-{3,}/.test(line) || /^\s*#\s*={3,}/.test(line)) {
      flush(i);
      const label = trimmed.replace(/^#\s*[-=]+\s*/, "").trim() || "Section";
      current = {
        start: i + 1,
        end: i + 1,
        label: label.slice(0, 60),
        explanation: "A section header marking a logical block of the script.",
      };
      flush(i + 1);
    } else if (/^\s*(function\s+)?[a-zA-Z_][a-zA-Z0-9_]*\s*\(\)\s*\{?/.test(trimmed) && !/^#\s/.test(trimmed)) {
      flush(i);
      const m = trimmed.match(/^\s*(?:function\s+)?([a-zA-Z_][a-zA-Z0-9_]*)\s*\(\)/);
      const name = m ? m[1] : "function";
      current = {
        start: i + 1,
        end: i + 1,
        label: `Function: ${name}`,
        explanation: `Defines a reusable function named "${name}" — invoked later by name.`,
      };
      // Find closing brace at column 0.
      let j = i + 1;
      while (j < lines.length && !/^\}/.test(lines[j])) j++;
      current.end = Math.min(j + 1, lines.length);
      flush(current.end);
      i = j;
    } else if (/^\s*if\b/.test(trimmed)) {
      flush(i);
      current = {
        start: i + 1,
        end: i + 1,
        label: "Conditional (if)",
        explanation: "Branches the script flow based on a condition.",
      };
      flush(i + 1);
    } else if (/^\s*for\b/.test(trimmed)) {
      flush(i);
      current = {
        start: i + 1,
        end: i + 1,
        label: "Loop (for)",
        explanation: "Iterates over a list of items, running the body once per item.",
      };
      flush(i + 1);
    } else if (/^\s*while\b/.test(trimmed)) {
      flush(i);
      current = {
        start: i + 1,
        end: i + 1,
        label: "Loop (while)",
        explanation: "Runs the body repeatedly while a condition holds.",
      };
      flush(i + 1);
    } else if (/^\s*trap\b/.test(trimmed)) {
      flush(i);
      current = {
        start: i + 1,
        end: i + 1,
        label: "Trap handler",
        explanation: "Runs a cleanup command when the script exits or receives a signal.",
      };
      flush(i + 1);
    } else if (/^\s*case\b/.test(trimmed)) {
      flush(i);
      current = {
        start: i + 1,
        end: i + 1,
        label: "Case statement",
        explanation: "Dispatches on a value, like a switch statement.",
      };
      flush(i + 1);
    }
    i++;
  }
  flush(lines.length);
  return sections;
}

// ---------- Template bodies ----------

function templateFileOps(task: string, args: string[]): string {
  if (/older than/.test(task) && /delete|remove|clean/.test(task)) {
    const days = (task.match(/(\d+)\s*days?/) || [])[1] ?? "30";
    return [
      "# ---- Find old files and remove them ----",
      `DAYS="${days}"`,
      args.length > 0 ? 'TARGET="${1:-.}"' : 'TARGET="${1:-.}"',
      'log "Removing files older than ${DAYS} days under ${TARGET}"',
      'find "$TARGET" -type f -mtime +"$DAYS" -print',
      'if [[ "$DRY_RUN" -eq 0 ]]; then',
      '  find "$TARGET" -type f -mtime +"$DAYS" -delete',
      "fi",
    ].join("\n");
  }
  if (/rename|lowercase|uppercase|extension/.test(task)) {
    return [
      "# ---- Rename files in the current directory ----",
      "shopt -s nullglob 2>/dev/null || true",
      'for f in *; do',
      '  [ -f "$f" ] || continue',
      '  new="${f,,}"   # lowercase (Bash 4+)',
      '  if [[ "$f" != "$new" && "$DRY_RUN" -eq 0 ]]; then',
      '    mv -n -- "$f" "$new"',
      '  fi',
      "done",
    ].join("\n");
  }
  if (/count|lines|word count/.test(task)) {
    return [
      "# ---- Count lines in matching files ----",
      args.length > 0 ? 'PATTERN="${1:-*.txt}"' : 'PATTERN="${1:-*.txt}"',
      'log "Counting lines in files matching $PATTERN"',
      'find . -type f -name "$PATTERN" -print0 |',
      '  xargs -0 wc -l | sort -n',
    ].join("\n");
  }
  return [
    "# ---- File operation ----",
    'log "Performing: ' + task.replace(/"/g, "'") + '"',
    'ls -lah "${1:-.}"',
  ].join("\n");
}

function templateSystemInfo(task: string): string {
  if (/disk|usage/.test(task)) {
    return [
      "# ---- Disk usage per top-level subdirectory ----",
      'log "Disk usage for ${1:-.}"',
      'du -sh "${1:-.}"/* 2>/dev/null | sort -h',
    ].join("\n");
  }
  if (/memory|ram/.test(task)) {
    return [
      "# ---- Memory summary ----",
      'log "Memory overview"',
      "free -h 2>/dev/null || vmstat",
    ].join("\n");
  }
  if (/cpu|load/.test(task)) {
    return [
      "# ---- CPU / load average ----",
      'log "Load average and top CPU consumers"',
      "uptime",
      "ps -eo pid,pcpu,pmem,comm --sort=-pcpu | head -n 10",
    ].join("\n");
  }
  if (/network|interface/.test(task)) {
    return [
      "# ---- Network interfaces ----",
      'log "Network interfaces and addresses"',
      "ip -brief addr 2>/dev/null || ifconfig",
    ].join("\n");
  }
  return [
    "# ---- System information ----",
    'log "uname / uptime / users"',
    "uname -a",
    "uptime",
    "who",
  ].join("\n");
}

function templateBackup(task: string): string {
  if (/rotate|retention|keep/.test(task)) {
    return [
      "# ---- Backup with rotation ----",
      'SRC="${1:-.}"',
      'DEST="${2:-./backups}"',
      'KEEP="${3:-7}"   # number of old backups to keep',
      'mkdir -p "$DEST"',
      'STAMP="$(date -u +%Y%m%dT%H%M%SZ)"',
      'ARCHIVE="${DEST}/backup-${STAMP}.tar.gz"',
      'log "Creating $ARCHIVE from $SRC"',
      'tar -czf "$ARCHIVE" "$SRC"',
      'log "Rotating: keeping last $KEEP archives"',
      'ls -1t "$DEST"/backup-*.tar.gz 2>/dev/null | tail -n +"$((KEEP + 1))" |',
      '  while read -r old; do',
      '    log "pruning $old"',
      '    [[ "$DRY_RUN" -eq 0 ]] && rm -f -- "$old"',
      "  done",
    ].join("\n");
  }
  return [
    "# ---- Single-shot backup ----",
    'SRC="${1:-.}"',
    'DEST="${2:-./backups}"',
    'mkdir -p "$DEST"',
    'STAMP="$(date -u +%Y%m%dT%H%M%SZ)"',
    'ARCHIVE="${DEST}/backup-${STAMP}.tar.gz"',
    'log "Creating $ARCHIVE from $SRC"',
    'tar -czf "$ARCHIVE" "$SRC"',
    'log "Done: $ARCHIVE"',
  ].join("\n");
}

function templateDeployment(task: string): string {
  if (/s3|aws/.test(task)) {
    return [
      "# ---- Sync to S3 ----",
      'SRC="${1:-.}"',
      'BUCKET="${2:?usage: $0 <src> <bucket>}"',
      'log "Syncing $SRC -> s3://$BUCKET"',
      'aws s3 sync "$SRC" "s3://$BUCKET" --delete',
    ].join("\n");
  }
  if (/rsync/.test(task)) {
    return [
      "# ---- rsync to a remote host ----",
      'SRC="${1:-.}"',
      'REMOTE="${2:?usage: $0 <src> <user@host:/path>}"',
      'log "rsync $SRC -> $REMOTE"',
      "rsync -avz --delete --partial",
      '  -e "ssh -o StrictHostKeyChecking=accept-new"',
      '  "$SRC/" "$REMOTE/"',
    ].join("\n");
  }
  return [
    "# ---- Deploy current git branch ----",
    'BRANCH="${1:-$(git rev-parse --abbrev-ref HEAD)}"',
    'TARGET="${2:-/var/www}"',
    'log "Deploying branch $BRANCH to $TARGET"',
    "git archive \"$BRANCH\" | tar -x -C \"$TARGET\"",
    'log "Deployment complete"',
  ].join("\n");
}

function templateMonitoring(task: string): string {
  if (/url|http|5xx|health/.test(task)) {
    return [
      "# ---- HTTP health check ----",
      'URL="${1:?usage: $0 <url>}"',
      'THRESHOLD="${2:-5}"   # seconds before slow-warning',
      'log "Checking $URL"',
      'START=$(date +%s)',
      'CODE=$(curl -s -o /dev/null -w "%{http_code}" --max-time "$THRESHOLD" "$URL" || echo "000")',
      'END=$(date +%s)',
      'ELAPSED=$((END - START))',
      'if [[ "$CODE" -ge 500 || "$CODE" == "000" ]]; then',
      '  echo "ALERT: $URL returned $CODE in ${ELAPSED}s" >&2',
      "  exit 1",
      "fi",
      'log "OK: $URL ($CODE) in ${ELAPSED}s"',
    ].join("\n");
  }
  if (/ping/.test(task)) {
    return [
      "# ---- Ping check ----",
      'HOST="${1:?usage: $0 <host>}"',
      'COUNT="${2:-3}"',
      'ping -c "$COUNT" "$HOST"',
    ].join("\n");
  }
  return [
    "# ---- Generic monitoring loop ----",
    'while true; do',
    '  log "tick"',
    "  sleep 60",
    "done",
  ].join("\n");
}

function templateGeneric(task: string): string {
  return [
    "# ---- Generic task ----",
    "# TODO: implement the specific steps for:",
    "#   " + task.replace(/"/g, "'"),
    'log "starting: ' + task.replace(/"/g, "'") + '"',
    'echo "Hello from ${0}"',
    'log "done"',
  ].join("\n");
}

/** Build the body section for a given category and task. */
export function buildBody(category: ScriptCategory, task: string, args: string[]): string {
  switch (category) {
    case "file-ops": return templateFileOps(task, args);
    case "system-info": return templateSystemInfo(task);
    case "backup": return templateBackup(task);
    case "deployment": return templateDeployment(task);
    case "monitoring": return templateMonitoring(task);
    default: return templateGeneric(task);
  }
}

// ---------- Top-level generate ----------

/** Generate a complete Bash/shell script from a plain-English task. */
export function generateScript(task: string, opts: GenerateOptions): GeneratedScript {
  const flavor = opts.flavor;
  const name = (opts.name || "script").replace(/[^a-zA-Z0-9_-]/g, "-").replace(/^-+|-+$/g, "") || "script";
  const description = opts.description || normalizeTask(task);
  const args = opts.args ?? [];
  const category = detectCategory(task);
  const note = category === "generic"
    ? "Could not confidently match a template family — generic scaffold emitted. Use the BYO-key LLM polish for a tailored script."
    : `Matched template family: ${CATEGORY_LABELS[category]}. Review and adjust paths/flags before running.`;

  const parts: string[] = [];
  parts.push(buildShebang(flavor));
  parts.push("#");
  parts.push("# " + description);
  parts.push("# Generated locally by UnQTools AI Shell & Bash Script Writer.");
  parts.push("# Always review and test on non-critical data first.");
  parts.push(buildUsageBlock(name, args, description));
  parts.push(buildStrictMode(flavor));
  parts.push("");
  if (flavor === "bash") {
    parts.push('log() { echo "[$(date -u +%Y-%m-%dT%H:%M:%SZ)] $*"; }');
  } else {
    parts.push('log() { echo "[$(date -u +%Y-%m-%dT%H:%M:%SZ)] $*"; }');
  }
  parts.push(buildArgParser(flavor, args));
  parts.push("");
  parts.push(buildBody(category, task, args));
  parts.push("");
  parts.push('log "script finished"');
  let script = parts.join("\n");

  if (opts.dryRun) {
    script = addDryRunGuard(script);
  }
  if (opts.cron) {
    script = wrapForCron(script, name);
  }

  const findings = lintScript(script);
  const destructive = detectDestructive(script);
  const sections = explainScript(script);

  return { script, category, flavor, findings, destructive, sections, note };
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

export function buildShareUrl(state: ShareState): string {
  const params = new URLSearchParams();
  if (state.task) params.set("task", state.task);
  if (state.flavor) params.set("flavor", state.flavor);
  if (state.dryRun) params.set("dry", "1");
  if (state.cron) params.set("cron", "1");
  if (typeof window === "undefined") return `?${params.toString()}`;
  return `${window.location.origin}${window.location.pathname}#${params.toString()}`;
}

export function parseShareUrl(hash: string): ShareState {
  const clean = hash.startsWith("#") ? hash.slice(1) : hash;
  if (!clean) return { task: "", flavor: "bash", dryRun: false, cron: false };
  const params = new URLSearchParams(clean);
  const flavor = (params.get("flavor") as ShellFlavor) ?? "bash";
  return {
    task: params.get("task") ?? "",
    flavor: flavor === "posix" ? "posix" : "bash",
    dryRun: params.get("dry") === "1",
    cron: params.get("cron") === "1",
  };
}

// ---------- Optional BYO-key LLM prompt ----------

export function buildLlmPrompt(task: string, flavor: ShellFlavor): string {
  return [
    "You are a Bash/shell scripting expert. Convert the user's plain-English",
    `task into a ${flavor === "posix" ? "POSIX /bin/sh" : "Bash"} script with:`,
    "- proper shebang,",
    flavor === "posix" ? "- `set -eu` (POSIX has no pipefail)," : "- `set -euo pipefail`,",
    "- a getopts arg parser with -h/--help and -n/--dry-run,",
    "- per-section comments and a `log()` helper,",
    "- safe quoting everywhere.",
    "Return JSON with this exact shape:",
    "",
    "{",
    '  "script": "the full script as a single string with \\n escapes",',
    '  "explanation": "one-paragraph plain-English description",',
    '  "alternatives": ["a shorter variant", "a more robust variant"],',
    '  "warnings": ["any destructive-operation caveat"]',
    "}",
    "",
    "Do not include markdown fences. Return raw JSON only.",
    "",
    `User task: ${task}`,
  ].join("\n");
}

export function renderLlmResult(raw: string): LlmEnhancement {
  const fallback: LlmEnhancement = {
    script: "",
    explanation: "The LLM did not return parseable JSON.",
    alternatives: [],
    warnings: [],
  };
  try {
    const start = raw.indexOf("{");
    const end = raw.lastIndexOf("}");
    if (start === -1 || end === -1) return fallback;
    const obj = JSON.parse(raw.slice(start, end + 1)) as Partial<LlmEnhancement>;
    return {
      script: obj.script ?? "",
      explanation: obj.explanation ?? "",
      alternatives: Array.isArray(obj.alternatives) ? obj.alternatives : [],
      warnings: Array.isArray(obj.warnings) ? obj.warnings : [],
    };
  } catch {
    return fallback;
  }
}
