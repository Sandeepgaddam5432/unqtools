/**
 * Bash Script Generator / Boilerplate — pure logic.
 *
 * Assemble a hardened, shellcheck-clean Bash script skeleton from a
 * ScriptConfig. Pure functions only — no DOM, no network. Every
 * section is optional and toggled by the config so the output stays
 * minimal.
 *
 * Sections emitted (in order):
 *   1. Header comment block
 *   2. Shebang                 (config.shebang)
 *   3. Strict mode             (config.strictMode)
 *   4. Constants               (always — SCRIPT_NAME, etc.)
 *   5. Color helpers           (config.colors && config.logging)
 *   6. Logging helpers         (config.logging)
 *   7. usage()                 (always, when flags or positionals exist)
 *   8. cleanup() + TMP_DIR     (config.traps)
 *   9. Dependency check        (config.dependencyCheck.length > 0)
 *  10. Root check              (config.rootRequired)
 *  11. OS detection            (config.osDetect)
 *  12. Default flag values     (always)
 *  13. Argument parser         (always — manual while loop)
 *  14. Required-flag check     (always)
 *  15. Positional validation   (always)
 *  16. Main body               (always)
 *  17. Exit 0                  (always)
 */

// ---------------------------------------------------------------------------
// Public types
// ---------------------------------------------------------------------------

export type Shebang = "env" | "bin";

export interface Flag {
  /** Single-character short flag (e.g. "f"). Empty string for none. */
  short: string;
  /** Long name without -- prefix (e.g. "file"). */
  long: string;
  /** Human-readable description. */
  description: string;
  /** Whether this flag takes a value. */
  takesValue: boolean;
  /** Whether this flag is required. */
  required: boolean;
  /** Default value (only meaningful when takesValue=true). */
  default?: string;
}

export interface Positional {
  /** Argument name (e.g. "input_file"). */
  name: string;
  /** Human-readable description. */
  description: string;
  /** Whether this argument is required. */
  required: boolean;
}

export interface ScriptConfig {
  /** Script name (used in usage and as default .sh filename). */
  name: string;
  /** One-line description. */
  description: string;
  /** Optional version string. */
  version: string;
  /** Shebang line. */
  shebang: Shebang;
  /** Emit `set -euo pipefail` + IFS. */
  strictMode: boolean;
  /** Emit EXIT/ERR/INT traps with mktemp -d cleanup. */
  traps: boolean;
  /** Emit info/warn/error logging helpers. */
  logging: boolean;
  /** Use ANSI colors in log output (requires logging). */
  colors: boolean;
  /** Include --verbose / --quiet flags (requires logging). */
  verboseQuiet: boolean;
  /** External commands to require via `command -v`. */
  dependencyCheck: string[];
  /** Include --dry-run flag scaffolding. */
  dryRun: boolean;
  /** Refuse to run unless EUID == 0. */
  rootRequired: boolean;
  /** Detect and export OSTYPE / OS_KERNEL. */
  osDetect: boolean;
  /** Declared flags. */
  flags: Flag[];
  /** Declared positional arguments. */
  positionals: Positional[];
}

export interface ValidationResult {
  errors: string[];
  warnings: string[];
}

export interface HistoryEntry {
  ts: number;
  name: string;
  flagCount: number;
  positionalCount: number;
  lineCount: number;
}

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

export const SHEBANGS: Record<Shebang, string> = {
  env: "#!/usr/bin/env bash",
  bin: "#!/bin/bash",
};

export const SHEBANG_LABELS: Record<Shebang, string> = {
  env: "#!/usr/bin/env bash  (portable)",
  bin: "#!/bin/bash  (explicit path)",
};

export interface Preset {
  id: string;
  label: string;
  description: string;
  config: ScriptConfig;
}

/** Default empty config — sensible starting point. */
export const DEFAULT_CONFIG: ScriptConfig = {
  name: "my-script",
  description: "A short description of what this script does.",
  version: "1.0.0",
  shebang: "env",
  strictMode: true,
  traps: true,
  logging: true,
  colors: true,
  verboseQuiet: true,
  dependencyCheck: [],
  dryRun: false,
  rootRequired: false,
  osDetect: false,
  flags: [],
  positionals: [],
};

// ---------------------------------------------------------------------------
// Presets — five templates per blueprint: file-ops, system-info, backup,
// deployment, monitoring.
// ---------------------------------------------------------------------------

export const PRESETS: Preset[] = [
  {
    id: "file-ops",
    label: "File Operations",
    description: "Iterate files in a directory with optional pattern filter.",
    config: {
      ...DEFAULT_CONFIG,
      name: "file-ops",
      description: "Iterate files in a directory, optionally filtered by glob.",
      version: "1.0.0",
      flags: [
        {
          short: "d", long: "dir", description: "Directory to scan",
          takesValue: true, required: false, default: ".",
        },
        {
          short: "p", long: "pattern", description: "Glob pattern (e.g. *.log)",
          takesValue: true, required: false, default: "*",
        },
        {
          short: "v", long: "verbose", description: "Verbose output",
          takesValue: false, required: false,
        },
      ],
      positionals: [
        { name: "output_file", description: "Where to write the listing", required: false },
      ],
    },
  },
  {
    id: "system-info",
    label: "System Info",
    description: "Print system information (OS, kernel, uptime, memory, disk).",
    config: {
      ...DEFAULT_CONFIG,
      name: "system-info",
      description: "Print system information: OS, kernel, uptime, memory, disk.",
      version: "1.0.0",
      dependencyCheck: ["uname", "uptime", "free", "df"],
      flags: [
        {
          short: "j", long: "json", description: "Emit JSON instead of plain text",
          takesValue: false, required: false,
        },
        {
          short: "q", long: "quiet", description: "Only show critical fields",
          takesValue: false, required: false,
        },
      ],
      positionals: [],
    },
  },
  {
    id: "backup",
    label: "Backup",
    description: "Tar+gzip a source directory to a timestamped archive.",
    config: {
      ...DEFAULT_CONFIG,
      name: "backup",
      description: "Create a timestamped tar.gz backup of a directory.",
      version: "1.0.0",
      dependencyCheck: ["tar", "gzip", "date"],
      dryRun: true,
      flags: [
        {
          short: "s", long: "source", description: "Source directory to back up",
          takesValue: true, required: true,
        },
        {
          short: "o", long: "output", description: "Output directory for the archive",
          takesValue: true, required: false, default: "/var/backups",
        },
        {
          short: "k", long: "keep", description: "Number of old archives to keep",
          takesValue: true, required: false, default: "7",
        },
      ],
      positionals: [],
    },
  },
  {
    id: "deployment",
    label: "Deployment",
    description: "Pull latest code, run tests, build, and deploy to a target.",
    config: {
      ...DEFAULT_CONFIG,
      name: "deploy",
      description: "Pull latest code, run tests, build, and deploy to a target.",
      version: "1.0.0",
      dependencyCheck: ["git", "npm", "rsync"],
      dryRun: true,
      flags: [
        {
          short: "b", long: "branch", description: "Git branch to deploy",
          takesValue: true, required: false, default: "main",
        },
        {
          short: "t", long: "target", description: "Remote target (user@host)",
          takesValue: true, required: true,
        },
        {
          short: "p", long: "path", description: "Remote deploy path",
          takesValue: true, required: false, default: "/srv/app",
        },
        {
          short: "n", long: "no-tests", description: "Skip the test step",
          takesValue: false, required: false,
        },
      ],
      positionals: [],
    },
  },
  {
    id: "monitoring",
    label: "Monitoring",
    description: "Poll an HTTP endpoint and log status; alert on failure.",
    config: {
      ...DEFAULT_CONFIG,
      name: "monitor",
      description: "Poll an HTTP endpoint at an interval, log status, alert on failure.",
      version: "1.0.0",
      dependencyCheck: ["curl"],
      flags: [
        {
          short: "u", long: "url", description: "HTTP URL to poll",
          takesValue: true, required: true,
        },
        {
          short: "i", long: "interval", description: "Seconds between polls",
          takesValue: true, required: false, default: "30",
        },
        {
          short: "r", long: "retries", description: "Consecutive failures before alert",
          takesValue: true, required: false, default: "3",
        },
        {
          short: "w", long: "webhook", description: "Webhook URL to POST alerts to",
          takesValue: true, required: false,
        },
      ],
      positionals: [],
    },
  },
];

// ---------------------------------------------------------------------------
// Validation
// ---------------------------------------------------------------------------

const SHORT_FLAG_RE = /^[a-zA-Z]$/;
const LONG_FLAG_RE = /^[a-z][a-z0-9-]*$/;

/** Validate a ScriptConfig and return errors + warnings. */
export function validateConfig(c: ScriptConfig): ValidationResult {
  const errors: string[] = [];
  const warnings: string[] = [];

  if (!c.name) errors.push("Script name is required.");
  if (c.name && !/^[a-z][a-z0-9_-]*$/i.test(c.name)) {
    errors.push("Script name must be alphanumeric with - or _.");
  }
  if (!c.description) warnings.push("Description is empty — usage() will look bare.");

  const seenShort = new Set<string>();
  const seenLong = new Set<string>();
  for (const f of c.flags) {
    if (f.short && !SHORT_FLAG_RE.test(f.short)) {
      errors.push(`Flag --${f.long}: short flag must be a single letter (got "${f.short}").`);
    }
    if (!f.long || !LONG_FLAG_RE.test(f.long)) {
      errors.push(`Flag has invalid long name "${f.long}".`);
    }
    if (f.short && seenShort.has(f.short)) {
      errors.push(`Duplicate short flag "${f.short}".`);
    }
    if (seenLong.has(f.long)) {
      errors.push(`Duplicate long flag "${f.long}".`);
    }
    seenShort.add(f.short);
    seenLong.add(f.long);
    if (f.long === "help") warnings.push(`--help is auto-generated; flag --${f.long} may clash.`);
    if (f.long === "verbose" && c.verboseQuiet) {
      warnings.push("--verbose is auto-added when verboseQuiet is on; rename or disable.");
    }
    if (f.long === "quiet" && c.verboseQuiet) {
      warnings.push("--quiet is auto-added when verboseQuiet is on; rename or disable.");
    }
    if (f.long === "dry-run" && c.dryRun) {
      warnings.push("--dry-run is auto-added when dryRun is on; rename or disable.");
    }
    if (f.required && f.takesValue && f.default) {
      warnings.push(`Flag --${f.long}: required flag with a default — default will be ignored.`);
    }
  }

  const seenPos = new Set<string>();
  for (const p of c.positionals) {
    if (!p.name || !/^[a-z][a-z0-9_]*$/i.test(p.name)) {
      errors.push(`Positional has invalid name "${p.name}".`);
    }
    if (seenPos.has(p.name)) errors.push(`Duplicate positional "${p.name}".`);
    seenPos.add(p.name);
  }

  for (const dep of c.dependencyCheck) {
    if (!dep || !/^[a-z][a-z0-9_.+-]*$/i.test(dep)) {
      errors.push(`Dependency "${dep}" doesn't look like a command name.`);
    }
  }

  return { errors, warnings };
}

// ---------------------------------------------------------------------------
// String helpers
// ---------------------------------------------------------------------------

/** Escape a string for inclusion in single-quoted bash. */
export function escapeSingleQuote(s: string): string {
  return `'${(s || "").replace(/'/g, `'\\''`)}'`;
}

/** Escape a string for safe inclusion in a double-quoted bash context. */
export function escapeDoubleQuote(s: string): string {
  return (s || "").replace(/([\\$"`])/g, "\\$1");
}

/** Repeat a character n times. */
export function repeat(s: string, n: number): string {
  if (n <= 0) return "";
  return s.repeat(n);
}

/** Indent every line of a block by n spaces. */
export function indent(block: string, n: number): string {
  if (!block) return "";
  const pad = repeat(" ", n);
  return block.split("\n").map((l) => l.length ? pad + l : l).join("\n");
}

/** Wrap text to a width. */
export function wrapText(text: string, width: number): string[] {
  const out: string[] = [];
  for (const para of (text || "").split("\n")) {
    if (!para) { out.push(""); continue; }
    const words = para.split(/\s+/);
    let line = "";
    for (const w of words) {
      if (line && (line.length + 1 + w.length) > width) { out.push(line); line = w; }
      else line = line ? `${line} ${w}` : w;
    }
    if (line) out.push(line);
  }
  return out;
}

// ---------------------------------------------------------------------------
// Variable-name helpers
// ---------------------------------------------------------------------------

/** Convert a long flag name to an UPPER_SNAKE_CASE bash var name. */
export function flagVarName(long: string): string {
  return long.toUpperCase().replace(/-/g, "_");
}

/** Convert a positional name to UPPER_SNAKE_CASE. */
export function posVarName(name: string): string {
  return name.toUpperCase().replace(/-/g, "_");
}

// ---------------------------------------------------------------------------
// Section generators
// ---------------------------------------------------------------------------

/** Build the header comment block. */
export function generateHeader(c: ScriptConfig): string {
  const lines: string[] = ["#"];
  lines.push(`# ${c.name} — ${c.description}`);
  if (c.version) lines.push(`# Version: ${c.version}`);
  lines.push("#");
  lines.push("# Usage:");
  lines.push("#   See --help.");
  lines.push("#");
  lines.push("# Generated by UnQTools Bash Script Generator. 100% client-side.");
  return lines.join("\n");
}

/** Build the shebang line. */
export function generateShebang(c: ScriptConfig): string {
  return SHEBANGS[c.shebang] || SHEBANGS.env;
}

/** Build the strict-mode block. */
export function generateStrictMode(_c: ScriptConfig): string {
  return [
    "# ---------------------------------------------------------------------------",
    "# Strict mode: fail on error, undefined var, pipe failure. Safe IFS.",
    "# ---------------------------------------------------------------------------",
    "set -euo pipefail",
    "IFS=$'\\n\\t'",
  ].join("\n");
}

/** Build script-level constants. */
export function generateConstants(c: ScriptConfig): string {
  const lines: string[] = [
    "# ---------------------------------------------------------------------------",
    "# Constants",
    "# ---------------------------------------------------------------------------",
    `readonly SCRIPT_NAME="${escapeDoubleQuote(c.name)}"`,
  ];
  if (c.version) lines.push(`readonly SCRIPT_VERSION="${escapeDoubleQuote(c.version)}"`);
  lines.push(`readonly SCRIPT_DESC="${escapeDoubleQuote(c.description)}"`);
  return lines.join("\n");
}

/** Build ANSI color helpers. */
export function generateColorHelpers(_c: ScriptConfig): string {
  return [
    "# ---------------------------------------------------------------------------",
    "# ANSI colors (only when stderr is a TTY).",
    "# ---------------------------------------------------------------------------",
    "if [[ -t 2 ]]; then",
    "  readonly CLR_RED=$'\\e[31m'",
    "  readonly CLR_YEL=$'\\e[33m'",
    "  readonly CLR_GRN=$'\\e[32m'",
    "  readonly CLR_BLU=$'\\e[34m'",
    "  readonly CLR_RST=$'\\e[0m'",
    "else",
    "  readonly CLR_RED=''",
    "  readonly CLR_YEL=''",
    "  readonly CLR_GRN=''",
    "  readonly CLR_BLU=''",
    "  readonly CLR_RST=''",
    "fi",
  ].join("\n");
}

/** Build logging helpers (info/warn/error to stderr). */
export function generateLoggingHelpers(c: ScriptConfig): string {
  const infoTag = c.colors ? '"${CLR_BLU}[INFO]${CLR_RST}"' : '"[INFO]"';
  const warnTag = c.colors ? '"${CLR_YEL}[WARN]${CLR_RST}"' : '"[WARN]"';
  const errTag = c.colors ? '"${CLR_RED}[ERROR]${CLR_RST}"' : '"[ERROR]"';
  const okTag = c.colors ? '"${CLR_GRN}[OK]${CLR_RST}"' : '"[OK]"';

  return [
    "# ---------------------------------------------------------------------------",
    "# Logging helpers. All output goes to stderr so stdout stays clean.",
    "# Honors --quiet (suppress INFO) and --verbose (show DEBUG).",
    "# ---------------------------------------------------------------------------",
    "log_info() {",
    "  if [[ \"${QUIET:-0}\" != \"1\" ]]; then",
    `    printf '%s %s\\n' ${infoTag} \"$*\" >&2`,
    "  fi",
    "}",
    "log_warn() {",
    `  printf '%s %s\\n' ${warnTag} \"$*\" >&2`,
    "}",
    "log_error() {",
    `  printf '%s %s\\n' ${errTag} \"$*\" >&2`,
    "}",
    "log_ok() {",
    "  if [[ \"${QUIET:-0}\" != \"1\" ]]; then",
    `    printf '%s %s\\n' ${okTag} \"$*\" >&2`,
    "  fi",
    "}",
    "log_debug() {",
    "  if [[ \"${VERBOSE:-0}\" == \"1\" ]]; then",
    "    printf '[DEBUG] %s\\n' \"$*\" >&2",
    "  fi",
    "}",
    "die() {",
    "  log_error \"$*\"",
    "  exit 1",
    "}",
  ].join("\n");
}

/** Build the usage() function from declared flags and positionals. */
export function generateUsage(c: ScriptConfig): string {
  const hasFlags = c.flags.length > 0 || c.verboseQuiet || c.dryRun;
  const lines: string[] = [
    "# ---------------------------------------------------------------------------",
    "# usage() — print help. Auto-generated from declared flags.",
    "# ---------------------------------------------------------------------------",
    "usage() {",
    `  printf 'Usage: %s [OPTIONS]' "\${SCRIPT_NAME}"`,
  ];
  for (const p of c.positionals) {
    if (p.required) lines.push(`  printf ' <%s>' "\${${p.name}}"`);
    else lines.push(`  printf ' [<%s>]' "\${${p.name}}"`);
  }
  lines.push("  printf '\\n'");
  if (c.description) {
    lines.push(`  printf '\\n%s\\n' "\${SCRIPT_DESC}"`);
  }
  if (hasFlags) {
    lines.push("  printf '\\nOptions:\\n'");
    lines.push("  printf '  -h, --help              Show this help and exit\\n'");
    if (c.verboseQuiet) {
      lines.push("  printf '  -v, --verbose           Verbose output (DEBUG logs)\\n'");
      lines.push("  printf '  -q, --quiet             Suppress INFO logs\\n'");
    }
    if (c.dryRun) {
      lines.push("  printf '      --dry-run           Print actions without executing\\n'");
    }
    for (const f of c.flags) {
      const shortPart = f.short ? `-${f.short}, ` : "    ";
      const valuePart = f.takesValue ? "=<value>" : "";
      const label = `  ${shortPart}--${f.long}${valuePart}`;
      const pad = Math.max(2, 24 - label.length);
      const desc = f.description + (f.required ? " (required)" : "");
      const def = f.takesValue && f.default && !f.required ? ` [default: ${f.default}]` : "";
      lines.push(`  printf '%s%s%s\\n' '${label}${repeat(" ", pad)}' '${escapeSingleQuote(desc + def)}'`);
    }
  }
  if (c.positionals.length > 0) {
    lines.push("  printf '\\nArguments:\\n'");
    for (const p of c.positionals) {
      const label = `  ${p.name}`;
      const pad = Math.max(2, 24 - label.length);
      const desc = p.description + (p.required ? " (required)" : " (optional)");
      lines.push(`  printf '%s%s%s\\n' '${label}${repeat(" ", pad)}' '${escapeSingleQuote(desc)}'`);
    }
  }
  if (c.version) {
    lines.push(`  printf '\\nVersion: %s\\n' "\${SCRIPT_VERSION}"`);
  }
  lines.push("}");
  return lines.join("\n");
}

/** Build the cleanup function + temp dir setup. */
export function generateTraps(c: ScriptConfig): string {
  if (!c.traps) return "";
  return [
    "# ---------------------------------------------------------------------------",
    "# Temp dir + cleanup. Traps ensure TMP_DIR is removed on EXIT/INT/ERR.",
    "# ---------------------------------------------------------------------------",
    "TMP_DIR=\"\"",
    "cleanup() {",
    "  local code=$?",
    "  if [[ -n \"$TMP_DIR\" && -d \"$TMP_DIR\" ]]; then",
    "    rm -rf \"$TMP_DIR\"",
    "  fi",
    "  exit \"$code\"",
    "}",
    "on_err() {",
    "  local code=$?",
    "  local line=${1:-}",
    "  log_error \"Failure on line ${line} (exit ${code})\"",
    "  cleanup \"$code\"",
    "}",
    "TMP_DIR=\"$(mktemp -d 2>/dev/null || mktemp -d -t tmp)\"",
    "trap 'cleanup' EXIT",
    "trap 'cleanup' INT",
    "trap 'on_err ${LINENO}' ERR",
  ].join("\n");
}

/** Build the dependency-check block. */
export function generateDependencyCheck(c: ScriptConfig): string {
  if (!c.dependencyCheck || c.dependencyCheck.length === 0) return "";
  const lines: string[] = [
    "# ---------------------------------------------------------------------------",
    "# Verify required external commands are available.",
    "# ---------------------------------------------------------------------------",
  ];
  for (const dep of c.dependencyCheck) {
    lines.push(`if ! command -v "${dep}" >/dev/null 2>&1; then`);
    lines.push(`  die "Missing required command: ${dep}"`);
    lines.push("fi");
  }
  return lines.join("\n");
}

/** Build the root-required check. */
export function generateRootCheck(_c: ScriptConfig): string {
  return [
    "# ---------------------------------------------------------------------------",
    "# Require root.",
    "# ---------------------------------------------------------------------------",
    "if [[ ${EUID} -ne 0 ]]; then",
    "  die \"This script must be run as root (try sudo).\"",
    "fi",
  ].join("\n");
}

/** Build the OS-detection block. */
export function generateOsDetect(_c: ScriptConfig): string {
  return [
    "# ---------------------------------------------------------------------------",
    "# OS detection. Exports OS_KERNEL and OS_FAMILY.",
    "# ---------------------------------------------------------------------------",
    "OS_KERNEL=\"$(uname -s 2>/dev/null || echo unknown)\"",
    "case \"$OS_KERNEL\" in",
    "  Linux*)  OS_FAMILY=\"linux\" ;;",
    "  Darwin*) OS_FAMILY=\"macos\" ;;",
    "  FreeBSD|OpenBSD|NetBSD) OS_FAMILY=\"bsd\" ;;",
    "  CYGWIN*|MINGW*|MSYS*) OS_FAMILY=\"windows\" ;;",
    "  *) OS_FAMILY=\"unknown\" ;;",
    "esac",
    "export OS_KERNEL OS_FAMILY",
  ].join("\n");
}

/** Build the default flag-value block. */
export function generateDefaultValues(c: ScriptConfig): string {
  const lines: string[] = [
    "# ---------------------------------------------------------------------------",
    "# Default flag values.",
    "# ---------------------------------------------------------------------------",
  ];
  if (c.verboseQuiet) {
    lines.push("VERBOSE=0");
    lines.push("QUIET=0");
  }
  if (c.dryRun) {
    lines.push("DRY_RUN=0");
  }
  for (const f of c.flags) {
    const varName = flagVarName(f.long);
    if (f.takesValue) {
      const def = f.default ?? "";
      lines.push(`${varName}="${escapeDoubleQuote(def)}"`);
    } else {
      lines.push(`${varName}=0`);
    }
  }
  return lines.join("\n");
}

/** Build the argument parser (manual while loop supporting -s, --long,
 *  --long=value, and -sVALUE forms). */
export function generateArgParser(c: ScriptConfig): string {
  const lines: string[] = [
    "# ---------------------------------------------------------------------------",
    "# Argument parser. Manual while/case loop supports -s, --long, --long=value,",
    "# and -sVALUE forms. Remaining args are positionals.",
    "# ---------------------------------------------------------------------------",
    "POSITIONAL=()",
    "while [[ $# -gt 0 ]]; do",
    "  case \"$1\" in",
    "    -h|--help)",
    "      usage; exit 0 ;;",
  ];
  if (c.verboseQuiet) {
    lines.push("    -v|--verbose)");
    lines.push("      VERBOSE=1; shift ;;");
    lines.push("    -q|--quiet)");
    lines.push("      QUIET=1; shift ;;");
  }
  if (c.dryRun) {
    lines.push("    --dry-run)");
    lines.push("      DRY_RUN=1; shift ;;");
  }
  for (const f of c.flags) {
    const varName = flagVarName(f.long);
    if (f.takesValue) {
      if (f.short) {
        lines.push(`    -${f.short}|--${f.long})`);
        lines.push(`      ${varName}="$2"; shift 2 ;;`);
        lines.push(`    -${f.short}=*|--${f.long}=*)`);
        lines.push(`      ${varName}="\${1#*=}"; shift ;;`);
        lines.push(`    -${f.short}*)`);
        lines.push(`      ${varName}="\${1#-${f.short}}"; shift ;;`);
      } else {
        lines.push(`    --${f.long})`);
        lines.push(`      ${varName}="$2"; shift 2 ;;`);
        lines.push(`    --${f.long}=*)`);
        lines.push(`      ${varName}="\${1#*=}"; shift ;;`);
      }
    } else {
      const shortCases: string[] = [];
      if (f.short) shortCases.push(`-${f.short}`);
      shortCases.push(`--${f.long}`);
      lines.push(`    ${shortCases.join("|")})`);
      lines.push(`      ${varName}=1; shift ;;`);
    }
  }
  lines.push("    --)");
  lines.push("      shift; break ;;");
  lines.push("    -*)");
  lines.push("      die \"Unknown option: $1\" ;;");
  lines.push("    *)");
  lines.push("      POSITIONAL+=(\"$1\"); shift ;;");
  lines.push("  esac");
  lines.push("done");
  return lines.join("\n");
}

/** Build the required-flag validation block. */
export function generateRequiredCheck(c: ScriptConfig): string {
  const required = c.flags.filter((f) => f.required);
  if (required.length === 0) {
    return "# No required flags to validate.";
  }
  const lines: string[] = [
    "# ---------------------------------------------------------------------------",
    "# Required-flag validation.",
    "# ---------------------------------------------------------------------------",
  ];
  for (const f of required) {
    const varName = flagVarName(f.long);
    lines.push(`if [[ -z "\${${varName}:-}" ]]; then`);
    lines.push(`  log_error "Missing required flag: --${f.long}"`);
    lines.push("  usage >&2");
    lines.push("  exit 2");
    lines.push("fi");
  }
  return lines.join("\n");
}

/** Build the positional validation block. */
export function generatePositionalCheck(c: ScriptConfig): string {
  if (c.positionals.length === 0) {
    return [
      "# No declared positional arguments.",
      "set -- \"${POSITIONAL[@]}\"",
    ].join("\n");
  }
  const lines: string[] = [
    "# ---------------------------------------------------------------------------",
    "# Positional argument validation.",
    "# ---------------------------------------------------------------------------",
  ];
  let idx = 0;
  for (const p of c.positionals) {
    const varName = posVarName(p.name);
    lines.push(`${varName}="\${POSITIONAL[${idx}]:-}"`);
    if (p.required) {
      lines.push(`if [[ -z "\${${varName}:-}" ]]; then`);
      lines.push(`  die "Missing required argument: ${p.name}"`);
      lines.push("fi");
    }
    idx += 1;
  }
  lines.push(`if [[ \${#POSITIONAL[@]} -gt ${c.positionals.length} ]]; then`);
  lines.push("  log_warn \"Extra positional arguments ignored.\"");
  lines.push("fi");
  return lines.join("\n");
}

/** Build the main body — the user's TODO section. */
export function generateMainBody(c: ScriptConfig): string {
  const lines: string[] = [
    "# ---------------------------------------------------------------------------",
    "# Main",
    "# ---------------------------------------------------------------------------",
    "main() {",
  ];
  if (c.dryRun) {
    lines.push("  if [[ \"$DRY_RUN\" == \"1\" ]]; then");
    lines.push("    log_info \"Dry-run mode: no changes will be made.\"");
    lines.push("  fi");
  }
  if (c.logging) {
    lines.push("  log_info \"Starting ${SCRIPT_NAME}\"");
  }
  lines.push("  # TODO: implement the script logic here.");
  if (c.positionals.length > 0) {
    const names = c.positionals.map((p) => posVarName(p.name)).join(" ");
    lines.push(`  # Positionals available: ${names}`);
  }
  if (c.flags.length > 0) {
    const names = c.flags.map((f) => flagVarName(f.long)).join(" ");
    lines.push(`  # Flag values available: ${names}`);
  }
  if (c.traps) {
    lines.push("  # Use \"$TMP_DIR\" for scratch files (auto-cleaned on exit).");
  }
  if (c.logging) {
    lines.push("  log_ok \"Done.\"");
  }
  lines.push("}");
  lines.push("");
  lines.push('main "$@"');
  return lines.join("\n");
}

// ---------------------------------------------------------------------------
// Top-level generator
// ---------------------------------------------------------------------------

/** Assemble the full script from a ScriptConfig. */
export function generateScript(c: ScriptConfig): string {
  const cfg: ScriptConfig = { ...DEFAULT_CONFIG, ...c };
  const parts: string[] = [];
  parts.push(generateHeader(cfg));
  parts.push("");
  parts.push(generateShebang(cfg));
  parts.push("");
  if (cfg.strictMode) {
    parts.push(generateStrictMode(cfg));
    parts.push("");
  }
  parts.push(generateConstants(cfg));
  parts.push("");
  if (cfg.colors && cfg.logging) {
    parts.push(generateColorHelpers(cfg));
    parts.push("");
  }
  if (cfg.logging) {
    parts.push(generateLoggingHelpers(cfg));
    parts.push("");
  }
  parts.push(generateUsage(cfg));
  parts.push("");
  if (cfg.traps) {
    parts.push(generateTraps(cfg));
    parts.push("");
  }
  if (cfg.dependencyCheck.length > 0) {
    parts.push(generateDependencyCheck(cfg));
    parts.push("");
  }
  if (cfg.rootRequired) {
    parts.push(generateRootCheck(cfg));
    parts.push("");
  }
  if (cfg.osDetect) {
    parts.push(generateOsDetect(cfg));
    parts.push("");
  }
  parts.push(generateDefaultValues(cfg));
  parts.push("");
  parts.push(generateArgParser(cfg));
  parts.push("");
  parts.push(generateRequiredCheck(cfg));
  parts.push("");
  parts.push(generatePositionalCheck(cfg));
  parts.push("");
  parts.push(generateMainBody(cfg));
  parts.push("");
  parts.push("exit 0");
  return parts.join("\n");
}

/** Count lines in a script. */
export function countLines(script: string): number {
  if (!script) return 0;
  return script.split("\n").length;
}

/** Compute a flat summary of a config (for stats display). */
export function computeStats(c: ScriptConfig): {
  flagCount: number;
  positionalCount: number;
  dependencyCount: number;
  togglesOn: number;
} {
  let toggles = 0;
  if (c.strictMode) toggles += 1;
  if (c.traps) toggles += 1;
  if (c.logging) toggles += 1;
  if (c.colors) toggles += 1;
  if (c.verboseQuiet) toggles += 1;
  if (c.dryRun) toggles += 1;
  if (c.rootRequired) toggles += 1;
  if (c.osDetect) toggles += 1;
  return {
    flagCount: c.flags.length,
    positionalCount: c.positionals.length,
    dependencyCount: c.dependencyCheck.length,
    togglesOn: toggles,
  };
}

/** Lookup a preset by id. Returns undefined if not found. */
export function getPreset(id: string): Preset | undefined {
  return PRESETS.find((p) => p.id === id);
}

// ---------------------------------------------------------------------------
// History (localStorage) — max 20 entries
// ---------------------------------------------------------------------------

const HISTORY_KEY = "unqtools:bash-script-generator-boilerplate:history";
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
// Shareable URL — encode config in URL hash as compact JSON
// ---------------------------------------------------------------------------

export function buildShareUrl(c: ScriptConfig): string {
  const params = new URLSearchParams();
  params.set("c", JSON.stringify(c));
  if (typeof window === "undefined") return `?${params.toString()}`;
  return `${window.location.origin}${window.location.pathname}#${params.toString()}`;
}

export function parseShareUrl(hash: string): ScriptConfig | null {
  const clean = hash.startsWith("#") ? hash.slice(1) : hash;
  if (!clean) return null;
  const params = new URLSearchParams(clean);
  const json = params.get("c");
  if (!json) return null;
  try {
    const parsed = JSON.parse(json) as Partial<ScriptConfig>;
    return { ...DEFAULT_CONFIG, ...parsed };
  } catch {
    return null;
  }
}
