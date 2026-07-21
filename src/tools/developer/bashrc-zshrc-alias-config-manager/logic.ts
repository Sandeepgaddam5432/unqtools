/**
 * .bashrc / .zshrc Alias & Config Manager — pure logic.
 *
 * Build and organize shell aliases, functions, exports, and PATH edits, then
 * emit a clean, commented `.aliases` file (sourced from both .bashrc and
 * .zshrc) — with conflict detection against builtins and common tools.
 *
 * Pure functions only — no DOM, no network.
 */

// ---------------------------------------------------------------------------
// Public types
// ---------------------------------------------------------------------------

export type Shell = "bash" | "zsh";

export type AliasCategory =
  | "git"
  | "docker"
  | "kubectl"
  | "navigation"
  | "safety"
  | "ls"
  | "dev"
  | "devops"
  | "data-science"
  | "misc";

export interface AliasEntry {
  id: string;
  name: string;
  command: string;
  description?: string;
  category: AliasCategory;
  /** Which shells this alias is valid for. Empty = both. */
  shells: Shell[];
  enabled: boolean;
}

export interface FunctionEntry {
  id: string;
  name: string;
  body: string;
  description?: string;
  enabled: boolean;
}

export interface ExportEntry {
  id: string;
  key: string;
  value: string;
  description?: string;
  enabled: boolean;
}

export interface PathEntry {
  id: string;
  path: string;
  description?: string;
  /** Prepend (default) or append to PATH. */
  mode: "prepend" | "append";
  enabled: boolean;
}

export interface AliasConfig {
  aliases: AliasEntry[];
  functions: FunctionEntry[];
  exports: ExportEntry[];
  paths: PathEntry[];
}

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

export const CATEGORY_LABELS: Record<AliasCategory, string> = {
  "git": "Git",
  "docker": "Docker",
  "kubectl": "Kubernetes",
  "navigation": "Navigation",
  "safety": "Safety",
  "ls": "ls / Listing",
  "dev": "Dev",
  "devops": "DevOps",
  "data-science": "Data Science",
  "misc": "Misc",
};

/**
 * Bash/Zsh builtin commands — aliasing these may shadow expected behavior.
 * Sourced from `man bash` / `man zshbuiltins`.
 */
export const BUILTIN_COMMANDS: ReadonlySet<string> = new Set([
  "cd", "echo", "exec", "exit", "export", "kill", "pwd", "read", "set",
  "source", "type", "umask", "unset", "wait", "alias", "unalias", "bg",
  "fg", "jobs", "history", "pushd", "popd", "dirs", "trap", "return",
  "shift", "test", "times", "true", "false", "hash", "help", "let",
  "local", "logout", "printf", "command", "builtin", "declare", "eval",
  "getopts", "mapfile", "readarray", "caller", "complete", "compgen",
  "fc", "getopts", "hash", "suspend", "select",
]);

/**
 * Common CLI tools — shadowing these can break muscle memory.
 */
export const COMMON_COMMANDS: ReadonlySet<string> = new Set([
  "ls", "cp", "mv", "rm", "mkdir", "rmdir", "cat", "less", "more",
  "head", "tail", "grep", "find", "awk", "sed", "sort", "uniq", "wc",
  "diff", "tar", "gzip", "gunzip", "chmod", "chown", "df", "du", "free",
  "top", "ps", "kill", "killall", "ssh", "scp", "rsync", "curl", "wget",
  "git", "vim", "nano", "emacs", "python", "python3", "pip", "pip3",
  "node", "npm", "yarn", "pnpm", "bun", "go", "rustc", "cargo", "java",
  "javac", "mvn", "gradle", "make", "cmake", "docker", "kubectl", "helm",
  "terraform", "ansible", "aws", "gcloud", "az", "rg", "fd", "jq", "yq",
  "tmux", "screen", "fzf", "bat", "exa", "eza", "delta", "lazygit",
]);

export interface Preset {
  id: AliasCategory;
  label: string;
  description: string;
  aliases: Omit<AliasEntry, "id" | "enabled">[];
  functions: Omit<FunctionEntry, "id" | "enabled">[];
}

/**
 * Starter packs by use case (dev, devops, data science, git, docker, etc.).
 * Curated from popular dotfiles repos (mathiasbynens, ohmyzsh, ohmybash).
 */
export const ALIAS_PRESETS: Preset[] = [
  {
    id: "git",
    label: "Git",
    description: "Common git shortcuts",
    aliases: [
      { name: "gs", command: "git status", description: "git status", category: "git", shells: [] },
      { name: "ga", command: "git add", description: "git add", category: "git", shells: [] },
      { name: "gaa", command: "git add --all", description: "git add all", category: "git", shells: [] },
      { name: "gc", command: "git commit", description: "git commit", category: "git", shells: [] },
      { name: "gca", command: "git commit --amend --no-edit", description: "amend commit", category: "git", shells: [] },
      { name: "gp", command: "git push", description: "git push", category: "git", shells: [] },
      { name: "gpl", command: "git pull --rebase", description: "git pull --rebase", category: "git", shells: [] },
      { name: "gd", command: "git diff", description: "git diff", category: "git", shells: [] },
      { name: "gco", command: "git checkout", description: "git checkout", category: "git", shells: [] },
      { name: "gb", command: "git branch", description: "git branch", category: "git", shells: [] },
      { name: "glog", command: "git log --oneline --graph --decorate --all", description: "pretty git log", category: "git", shells: [] },
    ],
    functions: [],
  },
  {
    id: "docker",
    label: "Docker",
    description: "Docker & docker-compose shortcuts",
    aliases: [
      { name: "d", command: "docker", description: "docker", category: "docker", shells: [] },
      { name: "dp", command: "docker ps", description: "docker ps", category: "docker", shells: [] },
      { name: "dpa", command: "docker ps -a", description: "docker ps -a", category: "docker", shells: [] },
      { name: "di", command: "docker images", description: "docker images", category: "docker", shells: [] },
      { name: "drm", command: "docker rm", description: "docker rm", category: "docker", shells: [] },
      { name: "drmi", command: "docker rmi", description: "docker rmi", category: "docker", shells: [] },
      { name: "dc", command: "docker compose", description: "docker compose", category: "docker", shells: [] },
      { name: "dcu", command: "docker compose up -d", description: "compose up detached", category: "docker", shells: [] },
      { name: "dcd", command: "docker compose down", description: "compose down", category: "docker", shells: [] },
      { name: "dx", command: "docker exec -it", description: "docker exec -it", category: "docker", shells: [] },
    ],
    functions: [],
  },
  {
    id: "kubectl",
    label: "Kubernetes",
    description: "kubectl shortcuts",
    aliases: [
      { name: "k", command: "kubectl", description: "kubectl", category: "kubectl", shells: [] },
      { name: "kgp", command: "kubectl get pods", description: "get pods", category: "kubectl", shells: [] },
      { name: "kgs", command: "kubectl get svc", description: "get services", category: "kubectl", shells: [] },
      { name: "kgn", command: "kubectl get nodes", description: "get nodes", category: "kubectl", shells: [] },
      { name: "kctx", command: "kubectl config current-context", description: "current context", category: "kubectl", shells: [] },
      { name: "kdp", command: "kubectl describe pod", description: "describe pod", category: "kubectl", shells: [] },
      { name: "kdel", command: "kubectl delete", description: "kubectl delete", category: "kubectl", shells: [] },
    ],
    functions: [],
  },
  {
    id: "navigation",
    label: "Navigation",
    description: "Directory navigation",
    aliases: [
      { name: "..", command: "cd ..", description: "up one dir", category: "navigation", shells: [] },
      { name: "...", command: "cd ../..", description: "up two dirs", category: "navigation", shells: [] },
      { name: "....", command: "cd ../../..", description: "up three dirs", category: "navigation", shells: [] },
      { name: "-", command: "cd -", description: "previous dir", category: "navigation", shells: [] },
      { name: "mkcd", command: "mkdir -p", description: "make dir (use function for cd)", category: "navigation", shells: [] },
    ],
    functions: [
      {
        name: "mkcd",
        body: '  mkdir -p "$1" && cd "$1"',
        description: "mkdir -p then cd into it",
      },
    ],
  },
  {
    id: "safety",
    label: "Safety",
    description: "Confirm-before-destruct aliases",
    aliases: [
      { name: "rm", command: "rm -i", description: "confirm before rm", category: "safety", shells: [] },
      { name: "cp", command: "cp -i", description: "confirm before cp overwrite", category: "safety", shells: [] },
      { name: "mv", command: "mv -i", description: "confirm before mv overwrite", category: "safety", shells: [] },
    ],
    functions: [],
  },
  {
    id: "ls",
    label: "ls / Listing",
    description: "Colorful ls defaults",
    aliases: [
      { name: "ls", command: "ls --color=auto", description: "color ls", category: "ls", shells: [] },
      { name: "ll", command: "ls -alF --color=auto", description: "long list", category: "ls", shells: [] },
      { name: "la", command: "ls -A --color=auto", description: "all but . ..", category: "ls", shells: [] },
      { name: "l", command: "ls -CF --color=auto", description: "column list", category: "ls", shells: [] },
    ],
    functions: [],
  },
  {
    id: "dev",
    label: "Dev",
    description: "General dev shortcuts",
    aliases: [
      { name: "ports", command: "lsof -i -P -n | grep LISTEN", description: "show listening ports", category: "dev", shells: [] },
      { name: "ipy", command: "ipython", description: "ipython", category: "dev", shells: [] },
      { name: "serve", command: "python3 -m http.server 8000", description: "serve cwd on 8000", category: "dev", shells: [] },
      { name: "json", command: "python3 -m json.tool", description: "pretty-print JSON", category: "dev", shells: [] },
    ],
    functions: [],
  },
  {
    id: "devops",
    label: "DevOps",
    description: "DevOps utilities",
    aliases: [
      { name: "tf", command: "terraform", description: "terraform", category: "devops", shells: [] },
      { name: "tfa", command: "terraform apply", description: "tf apply", category: "devops", shells: [] },
      { name: "tfp", command: "terraform plan", description: "tf plan", category: "devops", shells: [] },
      { name: "ans", command: "ansible", description: "ansible", category: "devops", shells: [] },
      { name: "h", command: "helm", description: "helm", category: "devops", shells: [] },
    ],
    functions: [],
  },
  {
    id: "data-science",
    label: "Data Science",
    description: "Python / Jupyter / data tooling",
    aliases: [
      { name: "jp", command: "jupyter notebook", description: "jupyter notebook", category: "data-science", shells: [] },
      { name: "jlab", command: "jupyter lab", description: "jupyter lab", category: "data-science", shells: [] },
      { name: "pipup", command: "pip install --upgrade", description: "pip upgrade", category: "data-science", shells: [] },
      { name: "condaenv", command: "conda env list", description: "list conda envs", category: "data-science", shells: [] },
    ],
    functions: [],
  },
];

// ---------------------------------------------------------------------------
// Validation & utilities
// ---------------------------------------------------------------------------

let idCounter = 0;
export function makeId(prefix = "e"): string {
  idCounter += 1;
  return `${prefix}-${Date.now().toString(36)}-${idCounter}`;
}

/** Normalize an alias name (lowercased, alphanumeric + dash/underscore). */
export function normalizeAliasName(name: string): string {
  return (name || "").trim().replace(/[^\w-]/g, "");
}

/** Validate an alias name. */
export function validateAliasName(name: string): { ok: boolean; reason?: string } {
  const n = (name || "").trim();
  if (!n) return { ok: false, reason: "Empty" };
  if (!/^[A-Za-z][\w-]*$/.test(n)) {
    return { ok: false, reason: "Must start with a letter; only letters, digits, _ and -" };
  }
  return { ok: true };
}

/** Detect if a command references $1, $@, $#, $2 etc. — needs a function. */
export function needsFunction(command: string): boolean {
  return /\$\d+|\$@|\$\*|\$#/.test(command || "");
}

export type WarningSeverity = "warn" | "error" | "info";

export interface ValidationWarning {
  severity: WarningSeverity;
  code: "shadow-builtin" | "shadow-common" | "needs-function" | "recursive" | "zsh-only" | "bash-only" | "invalid-name" | "empty-command";
  message: string;
}

/**
 * Validate an alias entry. Returns warnings (e.g. shadowing builtins, needs
 * function, recursive).
 */
export function validateAlias(entry: AliasEntry): ValidationWarning[] {
  const out: ValidationWarning[] = [];
  const nameOk = validateAliasName(entry.name);
  if (!nameOk.ok) {
    out.push({ severity: "error", code: "invalid-name", message: nameOk.reason ?? "Invalid alias name" });
  }
  if (!entry.command.trim()) {
    out.push({ severity: "error", code: "empty-command", message: "Command is empty" });
  }
  const name = entry.name.trim();
  if (name) {
    if (BUILTIN_COMMANDS.has(name)) {
      out.push({ severity: "warn", code: "shadow-builtin", message: `"${name}" is a shell builtin; aliasing it can break expected behavior` });
    }
    if (COMMON_COMMANDS.has(name)) {
      out.push({ severity: "warn", code: "shadow-common", message: `"${name}" is a common command; aliasing it changes muscle-memory behavior` });
    }
    if (needsFunction(entry.command)) {
      out.push({ severity: "warn", code: "needs-function", message: `Command uses $1/$@ — aliases can't take args; use a function instead` });
    }
    // Recursive alias: `alias x='x something'`
    const cmdStart = entry.command.trim().split(/\s+/)[0];
    if (cmdStart && cmdStart === name) {
      out.push({ severity: "warn", code: "recursive", message: `Alias invokes itself — likely infinite recursion` });
    }
    if (entry.shells.length === 1 && entry.shells[0] === "zsh") {
      out.push({ severity: "info", code: "zsh-only", message: "zsh-only alias" });
    }
    if (entry.shells.length === 1 && entry.shells[0] === "bash") {
      out.push({ severity: "info", code: "bash-only", message: "bash-only alias" });
    }
  }
  return out;
}

/** Detect shadowing across the whole config (duplicate alias names). */
export function detectShadowing(aliases: AliasEntry[]): { name: string; count: number }[] {
  const counts = new Map<string, number>();
  for (const a of aliases) {
    const n = a.name.trim();
    if (!n) continue;
    counts.set(n, (counts.get(n) ?? 0) + 1);
  }
  return [...counts.entries()].filter(([, c]) => c > 1).map(([name, count]) => ({ name, count }));
}

// ---------------------------------------------------------------------------
// Parsing — import existing .aliases / .bashrc / .zshrc content
// ---------------------------------------------------------------------------

/** Strip leading `#` and surrounding whitespace from a comment. */
function stripComment(s: string): string {
  return s.replace(/^#+\s*/, "").trim();
}

/**
 * Parse an alias line: `alias name='value'` or `alias name="value"` or
 * `alias name=value`. Handles the shell-escaped form `'a'\''b'` produced by
 * `quoteAliasCommand` so configs round-trip cleanly.
 */
export function parseAliasLine(line: string): { name: string; command: string } | null {
  const m = /^\s*alias\s+([A-Za-z][\w-]*)\s*=\s*(.+?)\s*$/m.exec(line);
  if (!m) return null;
  const raw = m[2];
  let value: string;
  if (raw.startsWith("'")) {
    value = unquoteSingleShell(raw);
  } else if (raw.startsWith('"')) {
    value = raw.slice(1, -1).replace(/\\(["\\$`])/g, "$1");
  } else {
    value = raw;
  }
  return { name: m[1], command: value };
}

/**
 * Unquote a shell single-quoted value, supporting the `'a'\''b'` escape form
 * (close-quote, escaped-quote, reopen-quote) used by `quoteAliasCommand`.
 */
function unquoteSingleShell(s: string): string {
  let out = "";
  let i = 0;
  let inStr = false;
  while (i < s.length) {
    const ch = s[i];
    if (ch === "'") {
      // Check for `'\''` escape (close, escaped-quote, reopen).
      if (inStr && s[i + 1] === "\\" && s[i + 2] === "'" && s[i + 3] === "'") {
        out += "'";
        i += 4;
        // We're now back inside a single-quoted string.
        inStr = true;
        continue;
      }
      if (!inStr) {
        inStr = true;
        i += 1;
        continue;
      }
      // Closing quote.
      inStr = false;
      i += 1;
      continue;
    }
    if (ch === "\\" && inStr && s[i + 1] === "'") {
      // Rare escaped-quote form inside single quotes (technically not valid
      // in pure single quotes, but tolerate it).
      out += "'";
      i += 2;
      continue;
    }
    if (inStr) out += ch;
    i += 1;
  }
  return out;
}

/** Parse an export line: `export KEY='value'` or `export KEY=value`. */
export function parseExportLine(line: string): { key: string; value: string } | null {
  const m = /^\s*(?:export\s+)?([A-Za-z_][A-Za-z0-9_]*)\s*=\s*(.+?)\s*$/m.exec(line);
  if (!m) return null;
  let value = m[2];
  if (/^'(.*)'$/.test(value)) value = value.slice(1, -1);
  else if (/^"(.*)"$/.test(value)) value = value.slice(1, -1).replace(/\\(["\\$`])/g, "$1");
  return { key: m[1], value };
}

/**
 * Parse an existing aliases/rc file into a config. Recognizes:
 *  - `alias name='value'` lines
 *  - `export KEY='value'` lines
 *  - `# description` comments preceding an alias
 *  - `name() { ... }` one-line function definitions
 *  - `export PATH=/foo:$PATH` (PATH-prepend)
 *
 * Unknown lines are skipped. Pure, no side effects.
 */
export function parseExisting(content: string): AliasConfig {
  const lines = content.split(/\r?\n/);
  const cfg: AliasConfig = { aliases: [], functions: [], exports: [], paths: [] };
  let pendingComment = "";
  let inFunction = false;
  let fnName = "";
  let fnBody: string[] = [];

  for (const raw of lines) {
    const line = raw.trim();
    if (!line) { pendingComment = ""; continue; }

    if (inFunction) {
      fnBody.push(raw);
      if (/^\s*\}\s*$/.test(raw)) {
        cfg.functions.push({
          id: makeId("fn"),
          name: fnName,
          body: fnBody.slice(1, -1).join("\n"),
          description: pendingComment || undefined,
          enabled: true,
        });
        inFunction = false;
        fnName = "";
        fnBody = [];
        pendingComment = "";
      }
      continue;
    }

    if (line.startsWith("#")) {
      pendingComment = stripComment(line);
      continue;
    }

    // Function definition start: `name() {` or `function name {`
    const fnMatch = /^(?:function\s+)?([A-Za-z_][\w]*)\s*\(\s*\)\s*\{\s*$/.exec(line);
    if (fnMatch) {
      inFunction = true;
      fnName = fnMatch[1];
      fnBody = [raw];
      continue;
    }

    const alias = parseAliasLine(line);
    if (alias) {
      cfg.aliases.push({
        id: makeId("a"),
        name: alias.name,
        command: alias.command,
        description: pendingComment || undefined,
        category: "misc",
        shells: [],
        enabled: true,
      });
      pendingComment = "";
      continue;
    }

    // PATH manipulations
    const pathMatch = /^\s*(?:export\s+)?PATH\s*=\s*(.+?)\s*$/m.exec(line);
    if (pathMatch) {
      const val = pathMatch[1].replace(/^["']|["']$/g, "");
      const isPrepend = /(^|:)\$PATH(:|$)/.test(val);
      const cleaned = val.replace(/(^|:)\$PATH(:|$)/g, "").replace(/^:+|:+$/g, "");
      cfg.paths.push({
        id: makeId("p"),
        path: cleaned,
        description: pendingComment || undefined,
        mode: isPrepend ? "prepend" : "append",
        enabled: true,
      });
      pendingComment = "";
      continue;
    }

    const exp = parseExportLine(line);
    if (exp) {
      cfg.exports.push({
        id: makeId("x"),
        key: exp.key,
        value: exp.value,
        description: pendingComment || undefined,
        enabled: true,
      });
      pendingComment = "";
      continue;
    }
    pendingComment = "";
  }

  return cfg;
}

// ---------------------------------------------------------------------------
// Rendering — emit .aliases file content
// ---------------------------------------------------------------------------

/** Quote an alias command safely for shell output. */
export function quoteAliasCommand(command: string): string {
  const c = command || "";
  // Use single quotes if value contains no single quote.
  if (!c.includes("'")) return `'${c}'`;
  // Escape single quotes via '\'' (close, escaped-quote, reopen).
  return `'${c.replace(/'/g, "'\\''")}'`;
}

/** Quote a value for `export KEY=…`. Prefer single quotes; fall back to double. */
export function quoteExportValue(value: string): string {
  const v = value || "";
  if (!v.includes("'") && !v.includes("\\")) return `'${v}'`;
  return `"${v.replace(/(["\\$`])/g, "\\$1")}"`;
}

/** Render a single alias line. */
export function renderAlias(entry: AliasEntry): string {
  const lines: string[] = [];
  if (entry.description) lines.push(`# ${entry.description}`);
  if (entry.shells.length === 1) {
    if (entry.shells[0] === "zsh") lines.push("# zsh-only");
    if (entry.shells[0] === "bash") lines.push("# bash-only");
  }
  lines.push(`alias ${entry.name}=${quoteAliasCommand(entry.command)}`);
  return lines.join("\n");
}

/** Render a single function block. */
export function renderFunction(entry: FunctionEntry): string {
  const lines: string[] = [];
  if (entry.description) lines.push(`# ${entry.description}`);
  lines.push(`${entry.name}() {`);
  for (const ln of entry.body.split(/\r?\n/)) lines.push(ln);
  lines.push("}");
  return lines.join("\n");
}

/** Render a single export line. */
export function renderExport(entry: ExportEntry): string {
  const lines: string[] = [];
  if (entry.description) lines.push(`# ${entry.description}`);
  lines.push(`export ${entry.key}=${quoteExportValue(entry.value)}`);
  return lines.join("\n");
}

/** Render a single PATH manipulation line. */
export function renderPath(entry: PathEntry): string {
  const lines: string[] = [];
  if (entry.description) lines.push(`# ${entry.description}`);
  if (entry.mode === "prepend") {
    lines.push(`export PATH="${entry.path}:$PATH"`);
  } else {
    lines.push(`export PATH="$PATH:${entry.path}"`);
  }
  return lines.join("\n");
}

/** Group aliases by category for organized output. */
export function groupByCategory(aliases: AliasEntry[]): Record<AliasCategory, AliasEntry[]> {
  const out: Record<AliasCategory, AliasEntry[]> = {
    "git": [], "docker": [], "kubectl": [], "navigation": [], "safety": [],
    "ls": [], "dev": [], "devops": [], "data-science": [], "misc": [],
  };
  for (const a of aliases) {
    (out[a.category] ?? out.misc).push(a);
  }
  return out;
}

/**
 * Generate the .aliases file content. Sections are emitted in a stable order:
 * header → exports → PATH → aliases (grouped by category) → functions.
 * Disabled entries are skipped.
 */
export function generateAliasesFile(cfg: AliasConfig): string {
  const out: string[] = [];
  out.push("# ──────────────────────────────────────────────────────────────");
  out.push("# .aliases — generated by UnQTools bashrc/zshrc Alias Manager");
  out.push("# Source from .bashrc and .zshrc:");
  out.push("#   if [ -f ~/.aliases ]; then . ~/.aliases; fi");
  out.push("# ──────────────────────────────────────────────────────────────");
  out.push("");

  const enabledExports = cfg.exports.filter((e) => e.enabled && e.key.trim());
  if (enabledExports.length > 0) {
    out.push("# ── Exports / env vars ──────────────────────────────────────────");
    for (const e of enabledExports) out.push(renderExport(e));
    out.push("");
  }

  const enabledPaths = cfg.paths.filter((p) => p.enabled && p.path.trim());
  if (enabledPaths.length > 0) {
    out.push("# ── PATH ────────────────────────────────────────────────────────");
    for (const p of enabledPaths) out.push(renderPath(p));
    out.push("");
  }

  const enabledAliases = cfg.aliases.filter((a) => a.enabled && a.name.trim());
  const grouped = groupByCategory(enabledAliases);
  let anyAliases = false;
  for (const cat of Object.keys(grouped) as AliasCategory[]) {
    const list = grouped[cat];
    if (list.length === 0) continue;
    if (!anyAliases) {
      out.push("# ── Aliases ────────────────────────────────────────────────────");
      anyAliases = true;
    }
    out.push(`# ─ ${CATEGORY_LABELS[cat]}`);
    for (const a of list) out.push(renderAlias(a));
    out.push("");
  }

  const enabledFns = cfg.functions.filter((f) => f.enabled && f.name.trim());
  if (enabledFns.length > 0) {
    out.push("# ── Functions ──────────────────────────────────────────────────");
    for (const f of enabledFns) out.push(renderFunction(f));
    out.push("");
  }

  out.push("# ── End of .aliases ────────────────────────────────────────────");
  return out.join("\n");
}

/** Generate the sourcing snippet for ~/.bashrc. */
export function generateBashrcSnippet(): string {
  return [
    "# Source shared aliases (managed by UnQTools Alias Manager)",
    "if [ -f ~/.aliases ]; then",
    "  . ~/.aliases",
    "fi",
  ].join("\n");
}

/** Generate the sourcing snippet for ~/.zshrc (uses [[ -r ]] guard). */
export function generateZshrcSnippet(): string {
  return [
    "# Source shared aliases (managed by UnQTools Alias Manager)",
    "if [[ -r ~/.aliases ]]; then",
    "  source ~/.aliases",
    "fi",
  ].join("\n");
}

/** Generate both .bashrc and .zshrc combined output. */
export function generateRcBundle(cfg: AliasConfig): {
  aliases: string;
  bashrcSnippet: string;
  zshrcSnippet: string;
} {
  return {
    aliases: generateAliasesFile(cfg),
    bashrcSnippet: generateBashrcSnippet(),
    zshrcSnippet: generateZshrcSnippet(),
  };
}

// ---------------------------------------------------------------------------
// Dedup & merge
// ---------------------------------------------------------------------------

/** Deduplicate aliases by name (first wins). */
export function dedupeAliases(aliases: AliasEntry[]): AliasEntry[] {
  const seen = new Set<string>();
  const out: AliasEntry[] = [];
  for (const a of aliases) {
    const n = a.name.trim();
    if (!n || seen.has(n)) continue;
    seen.add(n);
    out.push(a);
  }
  return out;
}

/** Merge two configs (incoming overrides existing by name/key). */
export function mergeConfigs(base: AliasConfig, incoming: AliasConfig): AliasConfig {
  const aliasesByName = new Map<string, AliasEntry>();
  for (const a of base.aliases) aliasesByName.set(a.name.trim(), a);
  for (const a of incoming.aliases) aliasesByName.set(a.name.trim(), a);

  const fnsByName = new Map<string, FunctionEntry>();
  for (const f of base.functions) fnsByName.set(f.name.trim(), f);
  for (const f of incoming.functions) fnsByName.set(f.name.trim(), f);

  const exportsByKey = new Map<string, ExportEntry>();
  for (const e of base.exports) exportsByKey.set(e.key.trim(), e);
  for (const e of incoming.exports) exportsByKey.set(e.key.trim(), e);

  const pathsByPath = new Map<string, PathEntry>();
  for (const p of base.paths) pathsByPath.set(p.path.trim(), p);
  for (const p of incoming.paths) pathsByPath.set(p.path.trim(), p);

  return {
    aliases: [...aliasesByName.values()],
    functions: [...fnsByName.values()],
    exports: [...exportsByKey.values()],
    paths: [...pathsByPath.values()],
  };
}

// ---------------------------------------------------------------------------
// Stats
// ---------------------------------------------------------------------------

export interface ConfigStats {
  totalAliases: number;
  enabledAliases: number;
  totalFunctions: number;
  enabledFunctions: number;
  totalExports: number;
  enabledExports: number;
  totalPaths: number;
  enabledPaths: number;
  warnings: number;
  byCategory: Record<AliasCategory, number>;
}

export function computeStats(cfg: AliasConfig): ConfigStats {
  const byCategory: Record<AliasCategory, number> = {
    "git": 0, "docker": 0, "kubectl": 0, "navigation": 0, "safety": 0,
    "ls": 0, "dev": 0, "devops": 0, "data-science": 0, "misc": 0,
  };
  let warnings = 0;
  for (const a of cfg.aliases) {
    byCategory[a.category] = (byCategory[a.category] ?? 0) + 1;
    if (validateAlias(a).some((w) => w.severity === "warn" || w.severity === "error")) warnings += 1;
  }
  return {
    totalAliases: cfg.aliases.length,
    enabledAliases: cfg.aliases.filter((a) => a.enabled).length,
    totalFunctions: cfg.functions.length,
    enabledFunctions: cfg.functions.filter((f) => f.enabled).length,
    totalExports: cfg.exports.length,
    enabledExports: cfg.exports.filter((e) => e.enabled).length,
    totalPaths: cfg.paths.length,
    enabledPaths: cfg.paths.filter((p) => p.enabled).length,
    warnings,
    byCategory,
  };
}

// ---------------------------------------------------------------------------
// History (localStorage)
// ---------------------------------------------------------------------------

const HISTORY_KEY = "unqtools:bashrc-zshrc-alias-config-manager:history";
const HISTORY_MAX = 20;

export interface HistoryEntry {
  ts: number;
  totalAliases: number;
  totalFunctions: number;
  totalExports: number;
  totalPaths: number;
}

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

/**
 * Build a shareable URL encoding the config. Config is JSON-stringified,
 * then base64url-encoded. Stays under typical URL length limits for normal
 * configs.
 */
export function buildShareUrl(cfg: AliasConfig): string {
  const params = new URLSearchParams();
  // Only carry essential fields to keep URL short.
  const slim = {
    a: cfg.aliases.map((a) => [a.name, a.command, a.category, a.description ?? "", a.shells.join(""), a.enabled ? 1 : 0]),
    f: cfg.functions.map((f) => [f.name, f.body, f.description ?? "", f.enabled ? 1 : 0]),
    e: cfg.exports.map((e) => [e.key, e.value, e.description ?? "", e.enabled ? 1 : 0]),
    p: cfg.paths.map((p) => [p.path, p.mode, p.description ?? "", p.enabled ? 1 : 0]),
  };
  const json = JSON.stringify(slim);
  const b64 = typeof btoa === "function"
    ? btoa(unescape(encodeURIComponent(json)))
    : Buffer.from(json, "utf8").toString("base64");
  params.set("c", b64);
  if (typeof window === "undefined") return `?${params.toString()}`;
  return `${window.location.origin}${window.location.pathname}#${params.toString()}`;
}

export function parseShareUrl(hash: string): AliasConfig {
  const clean = hash.startsWith("#") ? hash.slice(1) : hash;
  if (!clean) return { aliases: [], functions: [], exports: [], paths: [] };
  const params = new URLSearchParams(clean);
  const b64 = params.get("c");
  if (!b64) return { aliases: [], functions: [], exports: [], paths: [] };
  try {
    let json: string;
    if (typeof atob === "function") {
      json = decodeURIComponent(escape(atob(b64)));
    } else {
      json = Buffer.from(b64, "base64").toString("utf8");
    }
    const slim = JSON.parse(json) as {
      a: [string, string, AliasCategory, string, string, number][];
      f: [string, string, string, number][];
      e: [string, string, string, number][];
      p: [string, "prepend" | "append", string, number][];
    };
    return {
      aliases: slim.a.map(([name, command, category, description, shells, enabled]) => ({
        id: makeId("a"),
        name, command, category, description: description || undefined,
        shells: shells === "bash" ? ["bash"] : shells === "zsh" ? ["zsh"] : [],
        enabled: enabled === 1,
      })),
      functions: slim.f.map(([name, body, description, enabled]) => ({
        id: makeId("fn"), name, body, description: description || undefined, enabled: enabled === 1,
      })),
      exports: slim.e.map(([key, value, description, enabled]) => ({
        id: makeId("x"), key, value, description: description || undefined, enabled: enabled === 1,
      })),
      paths: slim.p.map(([path, mode, description, enabled]) => ({
        id: makeId("p"), path, mode, description: description || undefined, enabled: enabled === 1,
      })),
    };
  } catch {
    return { aliases: [], functions: [], exports: [], paths: [] };
  }
}

// ---------------------------------------------------------------------------
// Presets — apply a starter pack to an existing config (dedupe by name)
// ---------------------------------------------------------------------------

export function applyPreset(cfg: AliasConfig, presetId: AliasCategory): AliasConfig {
  const preset = ALIAS_PRESETS.find((p) => p.id === presetId);
  if (!preset) return cfg;
  const existingNames = new Set(cfg.aliases.map((a) => a.name.trim()));
  const existingFnNames = new Set(cfg.functions.map((f) => f.name.trim()));
  const newAliases: AliasEntry[] = preset.aliases
    .filter((a) => !existingNames.has(a.name))
    .map((a) => ({ ...a, id: makeId("a"), enabled: true }));
  const newFns: FunctionEntry[] = preset.functions
    .filter((f) => !existingFnNames.has(f.name))
    .map((f) => ({ ...f, id: makeId("fn"), enabled: true }));
  return {
    aliases: [...cfg.aliases, ...newAliases],
    functions: [...cfg.functions, ...newFns],
    exports: cfg.exports,
    paths: cfg.paths,
  };
}

export function emptyConfig(): AliasConfig {
  return { aliases: [], functions: [], exports: [], paths: [] };
}
