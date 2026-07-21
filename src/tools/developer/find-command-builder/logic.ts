/**
 * find Command Builder — pure logic.
 *
 * Assemble correct `find` commands from a visual config — paths, name
 * glob, type, size, time, depth, permissions, owner, actions — with
 * boolean composition (AND/OR/NOT with escaped parentheses), GNU vs
 * BSD/macOS variant toggle, per-option explanation, dangerous-action
 * warnings, and recipe presets. Pure functions only — no DOM, no
 * network. Commands are GENERATED, never executed.
 */

// ---- Types ----

export type Platform = "gnu" | "bsd";

export type FileType = "f" | "d" | "l" | "b" | "c" | "p" | "s";

export type SizeUnit = "c" | "k" | "M" | "G";

export type SizeComparator = "+" | "-" | "";

export type TimeKind = "mtime" | "mmin" | "ctime" | "cmin" | "atime" | "amin";

export type ActionKind = "print" | "exec" | "execPlus" | "xargs" | "delete" | "print0" | "ls" | "printf";

export type BoolOp = "and" | "or" | "not";

export interface Predicate {
  id: string;
  kind:
    | "name"
    | "iname"
    | "path"
    | "ipath"
    | "type"
    | "size"
    | "time"
    | "newer"
    | "perm"
    | "user"
    | "group"
    | "empty"
    | "regex"
    | "depth";
  value: string;
  extra?: string;
  op: BoolOp; // how this predicate joins to the previous (first is always "and")
}

export interface BuilderConfig {
  platform: Platform;
  paths: string[];
  predicates: Predicate[];
  maxdepth: number;
  mindepth: number;
  useRegexE: boolean; // BSD -E for posix-extended
  regexType: string; // GNU -regextype
  action: ActionKind;
  execCommand: string;
  execArgs: string; // usually {} but customizable
  printfFormat: string;
  noDefaultPrint: boolean; // when action is print, omit -print (find adds implicit print)
  followSymlinks: boolean;
  mountOnly: boolean; // -mount / -xdev
}

export interface BuiltCommand {
  command: string;
  destructive: boolean;
  notes: string[];
  warnings: string[];
}

export interface OptionExplanation {
  option: string;
  explanation: string;
}

export interface Recipe {
  id: string;
  label: string;
  description: string;
  config: Partial<BuilderConfig>;
}

export interface HistoryEntry {
  ts: number;
  command: string;
  platform: Platform;
  destructive: boolean;
}

// ---- Constants ----

export const DEFAULT_CONFIG: BuilderConfig = {
  platform: "gnu",
  paths: ["."],
  predicates: [
    { id: "p1", kind: "name", value: "*.log", op: "and" },
    { id: "p2", kind: "type", value: "f", op: "and" },
  ],
  maxdepth: 0,
  mindepth: 0,
  useRegexE: false,
  regexType: "",
  action: "print",
  execCommand: "",
  execArgs: "{}",
  printfFormat: "%p\\n",
  noDefaultPrint: true,
  followSymlinks: false,
  mountOnly: false,
};

export const PLATFORM_LABELS: Record<Platform, string> = {
  gnu: "GNU findutils (Linux)",
  bsd: "BSD/macOS find",
};

export const FILE_TYPE_LABELS: Record<FileType, string> = {
  f: "f — regular file",
  d: "d — directory",
  l: "l — symbolic link",
  b: "b — block device",
  c: "c — character device",
  p: "p — named pipe (FIFO)",
  s: "s — socket",
};

export const SIZE_UNIT_LABELS: Record<SizeUnit, string> = {
  c: "c — bytes",
  k: "k — kibibytes (1024)",
  M: "M — mebibytes (1024²)",
  G: "G — gibibytes (1024³)",
};

export const TIME_KIND_LABELS: Record<TimeKind, string> = {
  mtime: "-mtime — modified (days)",
  mmin: "-mmin — modified (minutes)",
  ctime: "-ctime — status changed (days)",
  cmin: "-cmin — status changed (minutes)",
  atime: "-atime — accessed (days)",
  amin: "-amin — accessed (minutes)",
};

export const ACTION_LABELS: Record<ActionKind, string> = {
  print: "print (default)",
  print0: "print0 (NUL-separated)",
  ls: "-ls (long listing)",
  printf: "-printf (GNU only)",
  exec: "-exec cmd {} \\; (per file)",
  execPlus: "-exec cmd {} + (batched)",
  xargs: "pipe to xargs (-print0 | xargs -0)",
  delete: "-delete (DESTRUCTIVE)",
};

export const PRINTF_TOKENS: { token: string; meaning: string }[] = [
  { token: "%p", meaning: "file path" },
  { token: "%f", meaning: "basename (no directories)" },
  { token: "%h", meaning: "leading directories" },
  { token: "%P", meaning: "path with starting-points removed" },
  { token: "%H", meaning: "starting-point under which file was found" },
  { token: "%s", meaning: "size in bytes" },
  { token: "%y", meaning: "type letter (f/d/l/...)" },
  { token: "%m", meaning: "permission bits (octal)" },
  { token: "%u", meaning: "owner name" },
  { token: "%g", meaning: "group name" },
  { token: "%t", meaning: "modification time (ctime format)" },
  { token: "%Tk", meaning: "modification time (k=strftime spec)" },
  { token: "%n", meaning: "number of hard links" },
  { token: "%i", meaning: "inode number" },
  { token: "%l", meaning: "symlink target (or empty)" },
  { token: "\\n", meaning: "newline" },
  { token: "\\t", meaning: "tab" },
];

export const REGEX_TYPES: string[] = [
  "", "posix-basic", "posix-extended", "posix-awk", "posix-egrep", "emacs", "grep", "sed",
];

export const COMMON_RECIPES: Recipe[] = [
  {
    id: "find-log-files",
    label: "Find all .log files",
    description: "Recursively list every .log file in the current directory.",
    config: {
      paths: ["."],
      predicates: [
        { id: "p1", kind: "name", value: "*.log", op: "and" },
        { id: "p2", kind: "type", value: "f", op: "and" },
      ],
      action: "print",
      noDefaultPrint: true,
    },
  },
  {
    id: "find-large-files",
    label: "Find files larger than 100 MB",
    description: "Search for files bigger than 100 mebibytes.",
    config: {
      paths: ["."],
      predicates: [
        { id: "p1", kind: "type", value: "f", op: "and" },
        { id: "p2", kind: "size", value: "+100M", op: "and" },
      ],
      action: "print",
      noDefaultPrint: true,
    },
  },
  {
    id: "find-modified-7d",
    label: "Modified in last 7 days",
    description: "Files modified less than 7 days ago.",
    config: {
      paths: ["."],
      predicates: [
        { id: "p1", kind: "type", value: "f", op: "and" },
        { id: "p2", kind: "time", value: "-mtime -7", extra: "mtime", op: "and" },
      ],
      action: "print",
      noDefaultPrint: true,
    },
  },
  {
    id: "find-empty-files",
    label: "Find empty files",
    description: "All zero-byte regular files.",
    config: {
      paths: ["."],
      predicates: [
        { id: "p1", kind: "type", value: "f", op: "and" },
        { id: "p2", kind: "empty", value: "", op: "and" },
      ],
      action: "print",
      noDefaultPrint: true,
    },
  },
  {
    id: "find-empty-dirs",
    label: "Find empty directories (deletable)",
    description: "Empty dirs — safe to delete with -delete.",
    config: {
      paths: ["."],
      predicates: [
        { id: "p1", kind: "type", value: "d", op: "and" },
        { id: "p2", kind: "empty", value: "", op: "and" },
      ],
      action: "delete",
    },
  },
  {
    id: "find-by-perm",
    label: "World-writable files (security)",
    description: "Find files writable by anyone — security audit.",
    config: {
      paths: ["."],
      predicates: [
        { id: "p1", kind: "type", value: "f", op: "and" },
        { id: "p2", kind: "perm", value: "-o+w", op: "and" },
      ],
      action: "print",
      noDefaultPrint: true,
    },
  },
  {
    id: "find-by-owner",
    label: "Find files owned by user",
    description: "All files owned by a specific user.",
    config: {
      paths: ["."],
      predicates: [
        { id: "p1", kind: "type", value: "f", op: "and" },
        { id: "p2", kind: "user", value: "alice", op: "and" },
      ],
      action: "print",
      noDefaultPrint: true,
    },
  },
  {
    id: "find-newer-than",
    label: "Files newer than reference",
    description: "Files modified more recently than reference.txt.",
    config: {
      paths: ["."],
      predicates: [
        { id: "p1", kind: "type", value: "f", op: "and" },
        { id: "p2", kind: "newer", value: "reference.txt", op: "and" },
      ],
      action: "print",
      noDefaultPrint: true,
    },
  },
  {
    id: "find-exec-grep",
    label: "Run grep on each file (-exec \\;)",
    description: "Search inside every .py file for a pattern.",
    config: {
      paths: ["."],
      predicates: [
        { id: "p1", kind: "name", value: "*.py", op: "and" },
        { id: "p2", kind: "type", value: "f", op: "and" },
      ],
      action: "exec",
      execCommand: "grep -nH TODO",
      execArgs: "{}",
    },
  },
  {
    id: "find-exec-plus",
    label: "Run cmd on all files at once (-exec +)",
    description: "Batch-pass all .txt files to wc -l for fast counting.",
    config: {
      paths: ["."],
      predicates: [
        { id: "p1", kind: "name", value: "*.txt", op: "and" },
        { id: "p2", kind: "type", value: "f", op: "and" },
      ],
      action: "execPlus",
      execCommand: "wc -l",
      execArgs: "{}",
    },
  },
  {
    id: "find-print0-xargs",
    label: "Safe pipeline (-print0 | xargs -0)",
    description: "NUL-separated pipeline handles filenames with spaces/newlines.",
    config: {
      paths: ["."],
      predicates: [
        { id: "p1", kind: "name", value: "*.jpg", op: "and" },
        { id: "p2", kind: "type", value: "f", op: "and" },
      ],
      action: "xargs",
      execCommand: "convert -resize 50%",
    },
  },
  {
    id: "find-printf-gnu",
    label: "GNU -printf custom format",
    description: "GNU-only: print size + path as TSV.",
    config: {
      platform: "gnu",
      paths: ["."],
      predicates: [
        { id: "p1", kind: "type", value: "f", op: "and" },
      ],
      action: "printf",
      printfFormat: "%s\\t%p\\n",
    },
  },
];

// ---- Shell quoting ----

/** Shell-quote a string for safe inclusion in a command. Single-quoted. */
export function shellQuote(s: string): string {
  if (s === "") return "''";
  if (/^[A-Za-z0-9_@%+=:,./-]+$/.test(s)) return s;
  return `'${s.replace(/'/g, "'\\''")}'`;
}

// ---- Predicate rendering ----

/** Render a single predicate to its find syntax. */
export function renderPredicate(p: Predicate, platform: Platform): string {
  switch (p.kind) {
    case "name": return `-name ${shellQuote(p.value)}`;
    case "iname": return `-iname ${shellQuote(p.value)}`;
    case "path": return `-path ${shellQuote(p.value)}`;
    case "ipath": return `-ipath ${shellQuote(p.value)}`;
    case "type": return `-type ${p.value}`;
    case "size": return `-size ${shellQuote(p.value)}`;
    case "time": {
      // value like "-mtime -7" — value already contains the comparator
      const kind = (p.extra || "mtime") as TimeKind;
      const trimmed = p.value.replace(/^-?(mtime|mmin|ctime|cmin|atime|amin)\s*/, "");
      return `-${kind} ${shellQuote(trimmed)}`;
    }
    case "newer": return `-newer ${shellQuote(p.value)}`;
    case "perm": return `-perm ${shellQuote(p.value)}`;
    case "user": return `-user ${shellQuote(p.value)}`;
    case "group": return `-group ${shellQuote(p.value)}`;
    case "empty": return `-empty`;
    case "regex": {
      if (platform === "bsd") return `-regex ${shellQuote(p.value)}`;
      return `-regex ${shellQuote(p.value)}`;
    }
    case "depth": return ""; // handled separately via maxdepth/mindepth
    default: return "";
  }
}

/** Compose all predicates with proper boolean operators + escaped parens. */
export function composePredicates(predicates: Predicate[], platform: Platform): { expr: string; notes: string[] } {
  if (predicates.length === 0) return { expr: "", notes: [] };
  const parts: string[] = [];
  const notes: string[] = [];
  let pushed = 0;
  for (let i = 0; i < predicates.length; i++) {
    const p = predicates[i];
    if (p.kind === "depth") continue;
    const rendered = renderPredicate(p, platform);
    if (!rendered) continue;
    if (pushed === 0) {
      parts.push(rendered);
    } else if (p.op === "not") {
      parts.push(`-not ${rendered}`);
    } else if (p.op === "or") {
      parts.push(`-o ${rendered}`);
    } else {
      // AND is implicit in find; emit no operator
      parts.push(`-a ${rendered}`);
      notes.push("find's -a (AND) is the default and can be omitted; we keep it for clarity.");
    }
    pushed++;
  }
  if (parts.length === 0) return { expr: "", notes };
  if (parts.length === 1) return { expr: parts[0], notes };
  // When OR is involved, wrap in parens to disambiguate precedence.
  const hasOr = predicates.some((p) => p.op === "or");
  const hasNot = predicates.some((p, i) => i > 0 && p.op === "not");
  if (hasOr || hasNot) {
    notes.push("Parentheses \\( \\) are escaped because ( and ) are shell metacharacters.");
    return { expr: `\\( ${parts.join(" ")} \\)`, notes };
  }
  return { expr: parts.join(" "), notes };
}

// ---- Action rendering ----

/** Render the action portion of the find command. */
export function renderAction(config: BuilderConfig): { expr: string; notes: string[]; destructive: boolean } {
  const notes: string[] = [];
  let destructive = false;
  switch (config.action) {
    case "print":
      if (config.noDefaultPrint) return { expr: "", notes, destructive };
      return { expr: "-print", notes, destructive };
    case "print0":
      return { expr: "-print0", notes: ["-print0 separates paths with NUL bytes — safe for filenames with spaces/newlines."], destructive };
    case "ls":
      return { expr: "-ls", notes: ["-ls prints a long listing similar to ls -dils."], destructive };
    case "printf":
      if (config.platform === "bsd") {
        notes.push("-printf is GNU-only. BSD/macOS: pipe to `xargs -0 stat -f '%N'` or use ls -la.");
        return { expr: `-printf ${shellQuote(config.printfFormat)}`, notes, destructive };
      }
      return { expr: `-printf ${shellQuote(config.printfFormat)}`, notes, destructive };
    case "exec": {
      const cmd = config.execCommand || "echo";
      const args = config.execArgs || "{}";
      return {
        expr: `-exec ${cmd} ${args} \\;`,
        notes: [
          "\\; runs the command once PER matching file. Use + to batch (faster).",
          `${args} is replaced with the current file path.`,
        ],
        destructive: /\brm\b/.test(cmd),
      };
    }
    case "execPlus": {
      const cmd = config.execCommand || "echo";
      const args = config.execArgs || "{}";
      notes.push("+ batches matching files into as few invocations as possible — much faster than \\;.");
      notes.push("{} MUST be the last argument before + with -exec ... {} +.");
      return { expr: `-exec ${cmd} ${args} +`, notes, destructive: /\brm\b/.test(cmd) };
    }
    case "xargs": {
      const cmd = config.execCommand || "echo";
      return {
        expr: `-print0 | xargs -0 ${cmd}`,
        notes: [
          "-print0 | xargs -0 is the safe pattern for filenames with spaces or newlines.",
          "Without -0 / -print0, xargs splits on whitespace — risky.",
        ],
        destructive: /\brm\b/.test(cmd),
      };
    }
    case "delete": {
      destructive = true;
      notes.push("DESTRUCTIVE: -delete silently removes matches. Always preview with -print first.");
      if (config.platform === "bsd") {
        notes.push("BSD/macOS: -delete implies -depth (processes directory contents before the directory itself).");
      } else {
        notes.push("GNU: -delete also implies -depth. Cannot delete '/' — find refuses.");
      }
      return { expr: "-delete", notes, destructive };
    }
    default:
      return { expr: "", notes, destructive };
  }
}

// ---- Top-level command builder ----

/** Build the full find command from the config. */
export function buildFindCommand(config: BuilderConfig): BuiltCommand {
  const parts: string[] = ["find"];
  const notes: string[] = [];
  const warnings: string[] = [];
  let destructive = false;
  // Paths.
  if (config.paths.length === 0) {
    warnings.push("No paths specified — find will print a usage error. Add at least one path (often '.').");
    parts.push(".");
  } else {
    for (const p of config.paths) parts.push(shellQuote(p));
  }
  // Global options (must come before predicates in find).
  if (config.maxdepth > 0) parts.push(`-maxdepth ${config.maxdepth}`);
  if (config.mindepth > 0) parts.push(`-mindepth ${config.mindepth}`);
  if (config.followSymlinks) {
    parts.push("-L");
    notes.push("-L follows symlinks. Beware of symlink loops — find detects and warns but continues.");
  }
  if (config.mountOnly) {
    parts.push(config.platform === "bsd" ? "-xdev" : "-mount");
    notes.push(config.platform === "bsd" ? "-xdev prevents descending into other filesystems." : "-mount prevents descending into other filesystems (GNU alias of -xdev).");
  }
  if (config.useRegexE && config.platform === "bsd") {
    parts.push("-E");
    notes.push("BSD -E enables posix-extended regex syntax for -regex.");
  }
  if (config.regexType && config.platform === "gnu") {
    parts.push(`-regextype ${config.regexType}`);
    notes.push(`GNU -regextype '${config.regexType}' selects the regex engine for -regex/-iregex.`);
  }
  // Predicates.
  const composed = composePredicates(config.predicates, config.platform);
  if (composed.expr) parts.push(composed.expr);
  for (const n of composed.notes) notes.push(n);
  // Action.
  const action = renderAction(config);
  if (action.expr) parts.push(action.expr);
  for (const n of action.notes) notes.push(n);
  if (action.destructive) {
    destructive = true;
    warnings.push("Destructive action selected — verify the command with -print before running for real.");
  }
  // Sanity: predicate before action.
  if (action.expr && config.predicates.length === 0) {
    warnings.push("No predicates set — the action will apply to EVERY file under the path.");
  }
  // Platform feature checks.
  if (config.action === "printf" && config.platform === "bsd") {
    warnings.push("-printf is GNU-only and will fail on BSD/macOS. Toggle the platform or use ls -la.");
  }
  if (config.regexType && config.platform === "bsd") {
    warnings.push("-regextype is GNU-only. BSD uses -E for posix-extended.");
  }
  if (config.useRegexE && config.platform === "gnu") {
    warnings.push("-E (posix-extended) is BSD syntax. GNU find uses -regextype posix-extended.");
  }
  return { command: parts.join(" "), destructive, notes, warnings };
}

// ---- Explanation ----

/** Plain-English summary of the command's intent. */
export function explainIntent(config: BuilderConfig): string {
  const head = `Search ${config.paths.length === 0 ? "the current directory" : config.paths.join(", ")} recursively`;
  const bits: string[] = [];
  for (const p of config.predicates) {
    if (p.kind === "depth") continue;
    bits.push(describePredicate(p));
  }
  const tail = bits.length > 0 ? ` for files matching: ${bits.join("; AND ")}.` : ".";
  let action = "";
  switch (config.action) {
    case "print": action = " Print matching paths (one per line)."; break;
    case "print0": action = " Print paths NUL-separated (safe for piped commands)."; break;
    case "ls": action = " Print a long listing (-ls)."; break;
    case "printf": action = ` Print using format '${config.printfFormat}'.`; break;
    case "exec": action = ` Run '${config.execCommand || "echo"}' on each match (one invocation per file).`; break;
    case "execPlus": action = ` Run '${config.execCommand || "echo"}' on all matches in batches (faster).`; break;
    case "xargs": action = ` Pipe NUL-separated paths to 'xargs -0 ${config.execCommand || "echo"}'.`; break;
    case "delete": action = " DELETE matching files/dirs (destructive)."; break;
  }
  let depth = "";
  if (config.maxdepth > 0) depth += ` Limit to ${config.maxdepth} levels deep.`;
  if (config.mindepth > 0) depth += ` Skip first ${config.mindepth} levels.`;
  return `${head}${tail}${action}${depth}`;
}

/** Describe a single predicate in plain English. */
export function describePredicate(p: Predicate): string {
  switch (p.kind) {
    case "name": return `name matches glob '${p.value}'`;
    case "iname": return `name matches glob '${p.value}' (case-insensitive)`;
    case "path": return `full path matches glob '${p.value}'`;
    case "ipath": return `full path matches glob '${p.value}' (case-insensitive)`;
    case "type": return `type is '${p.value}' (${typeDescription(p.value)})`;
    case "size": return `size is '${p.value}' (comparator+unit)`;
    case "time": {
      const kind = (p.extra || "mtime") as TimeKind;
      return `${kind.replace("-", "")} '${p.value}'`;
    }
    case "newer": return `modified more recently than '${p.value}'`;
    case "perm": return `permissions match '${p.value}'`;
    case "user": return `owned by user '${p.value}'`;
    case "group": return `owned by group '${p.value}'`;
    case "empty": return `is empty`;
    case "regex": return `path matches regex '${p.value}'`;
    case "depth": return `depth filter`;
    default: return "(unknown)";
  }
}

function typeDescription(t: string): string {
  switch (t) {
    case "f": return "regular file";
    case "d": return "directory";
    case "l": return "symlink";
    case "b": return "block device";
    case "c": return "character device";
    case "p": return "named pipe";
    case "s": return "socket";
    default: return t;
  }
}

/** Per-option explanations for the active config. */
export function explainOptions(config: BuilderConfig): OptionExplanation[] {
  const out: OptionExplanation[] = [];
  if (config.maxdepth > 0) {
    out.push({ option: `-maxdepth ${config.maxdepth}`, explanation: `Descend at most ${config.maxdepth} level(s) below the starting points. -maxdepth 0 means only the starting points themselves.` });
  }
  if (config.mindepth > 0) {
    out.push({ option: `-mindepth ${config.mindepth}`, explanation: `Do not apply tests at depth less than ${config.mindepth}.` });
  }
  if (config.followSymlinks) {
    out.push({ option: "-L", explanation: "Follow symbolic links. Beware of loops — find detects and warns but keeps going." });
  }
  if (config.mountOnly) {
    out.push({ option: config.platform === "bsd" ? "-xdev" : "-mount", explanation: "Don't descend into directories on other filesystems (e.g. /proc, /sys, network mounts)." });
  }
  if (config.useRegexE && config.platform === "bsd") {
    out.push({ option: "-E", explanation: "BSD: use posix-extended regex for -regex/-iregex." });
  }
  if (config.regexType && config.platform === "gnu") {
    out.push({ option: `-regextype ${config.regexType}`, explanation: `GNU: use the '${config.regexType}' regex engine for -regex/-iregex.` });
  }
  for (const p of config.predicates) {
    if (p.kind === "depth") continue;
    const rendered = renderPredicate(p, config.platform);
    out.push({ option: rendered, explanation: explainPredicateSingle(p) });
  }
  switch (config.action) {
    case "print":
      if (!config.noDefaultPrint) out.push({ option: "-print", explanation: "Print each matching path (one per line). Implicit if no other action is given." });
      else out.push({ option: "(implicit -print)", explanation: "find adds -print implicitly when no other action is specified." });
      break;
    case "print0":
      out.push({ option: "-print0", explanation: "Print each path followed by a NUL byte instead of a newline. Combine with xargs -0 for safe handling of paths containing spaces or newlines." });
      break;
    case "ls":
      out.push({ option: "-ls", explanation: "List each match like 'ls -dils'." });
      break;
    case "printf":
      out.push({ option: `-printf ${config.printfFormat}`, explanation: `GNU-only: print using the format string '${config.printfFormat}'. %p = path, %s = size, %y = type letter, %m = perms octal, %t = mtime. Not available on BSD/macOS.` });
      break;
    case "exec":
      out.push({ option: `-exec ${config.execCommand} ${config.execArgs} \\;`, explanation: `Run '${config.execCommand}' once per matching file. \\; marks the end of the command. ${config.execArgs} is replaced with the file path.` });
      break;
    case "execPlus":
      out.push({ option: `-exec ${config.execCommand} ${config.execArgs} +`, explanation: `Run '${config.execCommand}' with as many matching files as possible per invocation. ${config.execArgs} MUST be the last argument before +. Faster than \\; for large sets.` });
      break;
    case "xargs":
      out.push({ option: `-print0 | xargs -0 ${config.execCommand}`, explanation: `Pipe NUL-separated paths to xargs, which runs '${config.execCommand}' on them in batches. Safe for paths with spaces/newlines. Use -P N for parallel.` });
      break;
    case "delete":
      out.push({ option: "-delete", explanation: "DESTRUCTIVE: delete matching files/directories. Implies -depth (contents before container). Find refuses to delete '/'. ALWAYS preview with -print first." });
      break;
  }
  return out;
}

function explainPredicateSingle(p: Predicate): string {
  switch (p.kind) {
    case "name": return `Match files whose basename matches the glob '${p.value}'. * = any chars, ? = one char, [abc] = char class. Use -iname for case-insensitive.`;
    case "iname": return `Match basename against '${p.value}' ignoring case.`;
    case "path": return `Match the FULL path against the glob '${p.value}'. Use * to match across slashes on GNU (-wholename pattern).`;
    case "ipath": return `Match full path against '${p.value}' ignoring case.`;
    case "type": return `Match files of type '${p.value}' (${typeDescription(p.value)}).`;
    case "size": return `Match files with size '${p.value}'. +N = greater than, -N = less than, N = exactly. Units: c (bytes), k (1024), M (1024²), G (1024³).`;
    case "time": {
      const kind = (p.extra || "mtime") as TimeKind;
      const kindWord = kind.startsWith("m") ? "modified" : kind.startsWith("c") ? "status-changed" : "accessed";
      const unit = kind.endsWith("min") ? "minutes" : "days (24h)";
      const v = p.value.replace(/^-?(mtime|mmin|ctime|cmin|atime|amin)\s*/, "");
      return `Match files ${kindWord} '${v}' ${unit} ago. +N = more than N*unit ago, -N = less than N*unit ago, N = exactly N*unit ago (rounds down).`;
    }
    case "newer": return `Match files modified more recently than '${p.value}'. Use -newermt '2024-01-01' for an absolute date (GNU only).`;
    case "perm": return `Match files with permissions '${p.value}'. -mode = ALL bits set, /mode = ANY bit set, mode = EXACT. Symbolic: -o+w, -u-s, etc.`;
    case "user": return `Match files owned by user '${p.value}'.`;
    case "group": return `Match files owned by group '${p.value}'.`;
    case "empty": return `Match empty regular files OR empty directories.`;
    case "regex": return `Match the full path against the regex '${p.value}'. Match is on the WHOLE path, not a substring — anchor with .* if needed.`;
    case "depth": return `Depth filter (handled by -maxdepth/-mindepth).`;
    default: return "";
  }
}

// ---- Validation ----

export function validateConfig(config: BuilderConfig): { errors: string[]; warnings: string[] } {
  const errors: string[] = [];
  const warnings: string[] = [];
  if (config.paths.length === 0) errors.push("At least one starting path is required.");
  if (config.action === "exec" || config.action === "execPlus") {
    if (!config.execCommand.trim()) errors.push("Action is -exec but no command was specified.");
    if (config.action === "execPlus" && !/\{\}/.test(config.execArgs)) {
      warnings.push("-exec ... + requires {} in the args. Adding it automatically.");
    }
  }
  if (config.action === "xargs" && !config.execCommand.trim()) {
    errors.push("xargs action requires a command to pipe to.");
  }
  if (config.action === "printf" && config.platform === "bsd") {
    warnings.push("-printf is GNU-only and will fail on BSD/macOS.");
  }
  if (config.action === "printf" && !config.printfFormat.trim()) {
    errors.push("printf action requires a format string.");
  }
  if (config.action === "delete" && config.predicates.length === 0) {
    warnings.push("-delete with no predicates will attempt to delete EVERYTHING under the path. Add at least -name or -type.");
  }
  if (config.action === "delete" && !config.predicates.some((p) => p.kind === "name" || p.kind === "iname" || p.kind === "type")) {
    warnings.push("-delete without a -name or -type filter is dangerous — preview with -print first.");
  }
  if (config.regexType && config.platform === "bsd") {
    warnings.push("-regextype is GNU-only. On BSD, use -E for posix-extended.");
  }
  if (config.useRegexE && config.platform === "gnu") {
    warnings.push("-E is BSD syntax for posix-extended. On GNU, use -regextype posix-extended.");
  }
  for (const p of config.predicates) {
    if ((p.kind === "name" || p.kind === "iname" || p.kind === "path") && !p.value) {
      errors.push(`${p.kind} predicate has an empty pattern.`);
    }
  }
  return { errors, warnings };
}

// ---- Recipe helpers ----

/** Render recipes as plain text for download. */
export function renderRecipesText(): string {
  return COMMON_RECIPES.map((r) => {
    const cmd = buildFindCommand({ ...DEFAULT_CONFIG, ...r.config });
    return `${r.label}\n  ${r.description}\n  command: ${cmd.command}`;
  }).join("\n\n");
}

// ---- History (localStorage) ----

const HISTORY_KEY = "unqtools:find-command-builder:history";
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

// ---- Shareable URL ----

export function buildShareUrl(config: BuilderConfig): string {
  const params = new URLSearchParams();
  params.set("plat", config.platform);
  if (config.paths.length > 0) params.set("paths", config.paths.join(","));
  if (config.maxdepth > 0) params.set("maxd", String(config.maxdepth));
  if (config.mindepth > 0) params.set("mind", String(config.mindepth));
  if (config.useRegexE) params.set("re", "1");
  if (config.regexType) params.set("rt", config.regexType);
  params.set("act", config.action);
  if (config.execCommand) params.set("cmd", config.execCommand);
  if (config.execArgs && config.execArgs !== "{}") params.set("args", config.execArgs);
  if (config.printfFormat && config.printfFormat !== "%p\\n") params.set("pf", config.printfFormat);
  if (config.noDefaultPrint) params.set("nop", "1");
  if (config.followSymlinks) params.set("L", "1");
  if (config.mountOnly) params.set("mnt", "1");
  if (config.predicates.length > 0) {
    params.set("preds", JSON.stringify(config.predicates));
  }
  if (typeof window === "undefined") return `?${params.toString()}`;
  return `${window.location.origin}${window.location.pathname}#${params.toString()}`;
}

export function parseShareUrl(hash: string): { config: Partial<BuilderConfig> } {
  const clean = hash.startsWith("#") ? hash.slice(1) : hash;
  if (!clean) return { config: {} };
  const params = new URLSearchParams(clean);
  const config: Partial<BuilderConfig> = {};
  if (params.has("plat")) {
    const p = params.get("plat") as Platform | null;
    if (p && ["gnu", "bsd"].includes(p)) config.platform = p;
  }
  if (params.has("paths")) config.paths = params.get("paths")!.split(",").filter(Boolean);
  if (params.has("maxd")) config.maxdepth = Math.max(0, parseInt(params.get("maxd")!, 10) || 0);
  if (params.has("mind")) config.mindepth = Math.max(0, parseInt(params.get("mind")!, 10) || 0);
  if (params.has("re")) config.useRegexE = params.get("re") === "1";
  if (params.has("rt")) config.regexType = params.get("rt")!;
  if (params.has("act")) {
    const a = params.get("act") as ActionKind | null;
    if (a && ["print", "print0", "ls", "printf", "exec", "execPlus", "xargs", "delete"].includes(a)) config.action = a;
  }
  if (params.has("cmd")) config.execCommand = params.get("cmd")!;
  if (params.has("args")) config.execArgs = params.get("args")!;
  if (params.has("pf")) config.printfFormat = params.get("pf")!;
  if (params.has("nop")) config.noDefaultPrint = params.get("nop") === "1";
  if (params.has("L")) config.followSymlinks = params.get("L") === "1";
  if (params.has("mnt")) config.mountOnly = params.get("mnt") === "1";
  if (params.has("preds")) {
    try {
      const preds = JSON.parse(params.get("preds")!);
      if (Array.isArray(preds)) config.predicates = preds;
    } catch {
      // ignore
    }
  }
  return { config };
}
