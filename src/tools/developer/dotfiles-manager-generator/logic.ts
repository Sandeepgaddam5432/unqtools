/**
 * Dotfiles Manager Generator — pure logic.
 *
 * Scaffold a dotfiles repository and an idempotent install/bootstrap script
 * from your choices — which configs to track, which manager (GNU Stow /
 * bare-git / chezmoi / Dotbot) — so you can version and re-deploy your
 * shell, editor, and tool configs on any new machine. Emits:
 *
 *   - Repo structure (tree diagram).
 *   - README explaining the chosen manager.
 *   - Idempotent install.sh with backup of existing files.
 *   - Secret-safe .gitignore (keys, history, tokens).
 *   - "Never commit these" checklist.
 *
 * Pure functions only — no DOM, no network.
 */

// ---------------------------------------------------------------------------
// Public types
// ---------------------------------------------------------------------------

export type Manager = "stow" | "bare-git" | "chezmoi" | "dotbot";

export interface DotfileDef {
  /** Canonical dotfile path in $HOME (e.g. ".bashrc"). */
  target: string;
  /** Human-readable label. */
  label: string;
  /** Default filename inside the repo. */
  repoFilename: string;
  /** Default content the install script writes if absent. */
  defaultContent: string;
  /** Whether this is a directory (e.g. ~/.config/nvim). */
  isDirectory?: boolean;
  /** Whether this file often contains secrets — flagged in checklist. */
  secretRisk?: boolean;
}

export interface ManagerInfo {
  id: Manager;
  label: string;
  tagline: string;
  pros: string[];
  cons: string[];
  /** True if this manager uses symlinks (Stow, Dotbot). */
  usesSymlinks: boolean;
  /** True if this manager requires an external binary. */
  requiresBinary: boolean;
  /** Difficulty 1–3. */
  difficulty: 1 | 2 | 3;
}

export interface DotfileConfig {
  /** Selected manager. */
  manager: Manager;
  /** Set of dotfile targets selected for tracking. */
  selected: string[];
  /** Repo name / directory (used in README + tree). */
  repoName: string;
  /** Author name for README header. */
  author: string;
  /** Include OS-specific guards (macOS/Linux detection) in install.sh. */
  osGuards: boolean;
  /** Include a brew/apt package-install stub. */
  packageStub: boolean;
  /** Backup mode for existing files. */
  backupMode: "bak" | "skip" | "overwrite";
}

// ---------------------------------------------------------------------------
// Constants — catalog & manager comparison
// ---------------------------------------------------------------------------

/**
 * Catalog of common dotfiles to track. Curated from awesome-dotfiles,
 * dotfiles.github.io, and the GNU Stow manual.
 */
export const DOTFILE_CATALOG: DotfileDef[] = [
  {
    target: ".bashrc",
    label: "Bash config",
    repoFilename: "bashrc",
    defaultContent: "# .bashrc — managed by UnQTools Dotfiles Generator\n",
  },
  {
    target: ".zshrc",
    label: "Zsh config",
    repoFilename: "zshrc",
    defaultContent: "# .zshrc — managed by UnQTools Dotfiles Generator\n",
  },
  {
    target: ".vimrc",
    label: "Vim config",
    repoFilename: "vimrc",
    defaultContent: "\" .vimrc — managed by UnQTools Dotfiles Generator\n",
  },
  {
    target: ".config/nvim",
    label: "Neovim config (dir)",
    repoFilename: "config/nvim",
    defaultContent: "\" init.lua — managed by UnQTools Dotfiles Generator\n",
    isDirectory: true,
  },
  {
    target: ".tmux.conf",
    label: "tmux config",
    repoFilename: "tmux.conf",
    defaultContent: "# .tmux.conf — managed by UnQTools Dotfiles Generator\n",
  },
  {
    target: ".gitconfig",
    label: "Git config",
    repoFilename: "gitconfig",
    defaultContent: "[user]\n  name = \n  email = \n",
  },
  {
    target: ".gitignore_global",
    label: "Global gitignore",
    repoFilename: "gitignore_global",
    defaultContent: ".DS_Store\n",
  },
  {
    target: ".ssh/config",
    label: "SSH config",
    repoFilename: "ssh/config",
    defaultContent: "# SSH config — managed by UnQTools Dotfiles Generator\n",
    isDirectory: true,
    secretRisk: true,
  },
  {
    target: ".config/starship.toml",
    label: "Starship prompt",
    repoFilename: "config/starship.toml",
    defaultContent: "# starship.toml — managed by UnQTools Dotfiles Generator\n",
    isDirectory: true,
  },
  {
    target: ".editorconfig",
    label: "EditorConfig",
    repoFilename: "editorconfig",
    defaultContent: "root = true\n\n[*]\nend_of_line = lf\n",
  },
  {
    target: ".profile",
    label: "Login shell profile",
    repoFilename: "profile",
    defaultContent: "# .profile — managed by UnQTools Dotfiles Generator\n",
  },
  {
    target: ".inputrc",
    label: "Readline config",
    repoFilename: "inputrc",
    defaultContent: "# .inputrc — managed by UnQTools Dotfiles Generator\n",
  },
];

/** Comparison table for the four supported managers. */
export const MANAGERS: ManagerInfo[] = [
  {
    id: "stow",
    label: "GNU Stow",
    tagline: "Symlink farm — each package dir maps to $HOME",
    pros: [
      "Tiny, ubiquitous, in most package managers",
      "Trivial mental model: dir per package",
      "Per-package roll-back (just `stow -D pkg`)",
    ],
    cons: [
      "No templating — config is literal",
      "Symlink conflicts require manual resolve",
      "No secrets support",
    ],
    usesSymlinks: true,
    requiresBinary: true,
    difficulty: 1,
  },
  {
    id: "bare-git",
    label: "Bare git repo",
    tagline: "git --git-dir=$HOME/.cfg --work-tree=$HOME",
    pros: [
      "No extra binary — uses git only",
      "Files live at their real paths",
      "Branching for host-specific config",
    ],
    cons: [
      "`status.showUntrackedFiles no` hides new files",
      "Easy to accidentally commit secrets",
      "Manual backup of existing files",
    ],
    usesSymlinks: false,
    requiresBinary: false,
    difficulty: 2,
  },
  {
    id: "chezmoi",
    label: "chezmoi",
    tagline: "Templated source state → $HOME",
    pros: [
      "Full templating + encrypted secrets (age/gpg)",
      "Host + OS-specific includes built-in",
      "Excellent docs + active project",
    ],
    cons: [
      "Heavier binary (~25MB)",
      "Steeper learning curve",
      "Templates can hide bugs",
    ],
    usesSymlinks: false,
    requiresBinary: true,
    difficulty: 3,
  },
  {
    id: "dotbot",
    label: "Dotbot",
    tagline: "Python bootstrap with YAML config",
    pros: [
      "Single YAML describes all links + shell hooks",
      "Idempotent — safe to re-run",
      "No runtime dependency (bundled python)",
    ],
    cons: [
      "Requires python at install time",
      "Less ecosystem than Stow/chezmoi",
      "Symlink-only — no templating",
    ],
    usesSymlinks: true,
    requiresBinary: true,
    difficulty: 2,
  },
];

export function getManager(id: Manager): ManagerInfo {
  return MANAGERS.find((m) => m.id === id) ?? MANAGERS[0];
}

/**
 * Glob patterns for files that should be in .gitignore by default to keep
 * secrets out of git. Curated from GitHub's gitignore templates + common
 * dotfiles leaks.
 */
export const SECRET_PATTERNS: string[] = [
  ".ssh/id_*",
  ".ssh/*.pem",
  ".ssh/known_hosts",
  ".ssh/authorized_keys",
  ".gnupg/",
  ".aws/credentials",
  ".aws/config",
  ".config/gh/hosts.yml",
  ".netrc",
  ".env",
  ".env.*",
  "*.pem",
  "*.key",
  "*.p12",
  "*.pfx",
  ".zsh_history",
  ".bash_history",
  ".python_history",
  ".node_repl_history",
  ".local/share/password-store/",
  ".config/spotify/Users/*/user.prefs",
  ".docker/config.json",
  ".kube/config",
  ".terraform.d/credentials.tfrc.json",
];

/** "Never commit these" checklist shown to the user. */
export const NEVER_COMMIT_LIST: { item: string; why: string; severity: "critical" | "warn" }[] = [
  { item: "SSH private keys (~/.ssh/id_*)", why: "Allows anyone to impersonate you on every server the key grants access to", severity: "critical" },
  { item: "AWS / GCP / Azure credentials (~/.aws/credentials, ~/.kube/config)", why: "Cloud account takeover — can cost thousands in crypto mining", severity: "critical" },
  { item: ".netrc (HTTP basic-auth credentials)", why: "Plaintext credentials for FTP/HTTP services", severity: "critical" },
  { item: ".env files", why: "App secrets, DB passwords, API tokens", severity: "critical" },
  { item: "GnuPG dir (~/.gnupg)", why: "Private keys + keyring", severity: "critical" },
  { item: "Shell history (.bash_history, .zsh_history)", why: "May contain tokens typed in commands, file paths revealing structure", severity: "warn" },
  { item: "Git credentials (~/.config/gh/hosts.yml)", why: "GitHub OAuth tokens", severity: "critical" },
  { item: "password-store (~/.local/share/password-store)", why: "Encrypted password vault — still don't expose", severity: "critical" },
  { item: ".docker/config.json", why: "Registry auth tokens", severity: "critical" },
];

// ---------------------------------------------------------------------------
// Validation
// ---------------------------------------------------------------------------

export interface ValidationResult {
  ok: boolean;
  issues: { severity: "warn" | "error"; message: string }[];
}

export function validateConfig(cfg: DotfileConfig): ValidationResult {
  const issues: { severity: "warn" | "error"; message: string }[] = [];
  if (!cfg.repoName.trim()) {
    issues.push({ severity: "error", message: "Repo name is empty" });
  }
  if (cfg.selected.length === 0) {
    issues.push({ severity: "warn", message: "No dotfiles selected — install script will be a no-op" });
  }
  if (cfg.manager === "bare-git" && cfg.selected.includes(".ssh/config")) {
    issues.push({ severity: "warn", message: "Tracking .ssh/config with bare-git is risky — easy to accidentally commit private keys" });
  }
  if (cfg.backupMode === "overwrite") {
    issues.push({ severity: "warn", message: "Backup mode 'overwrite' will clobber existing files without backup" });
  }
  return { ok: !issues.some((i) => i.severity === "error"), issues };
}

/** Resolve a dotfile def from its target path. */
export function resolveDotfile(target: string): DotfileDef | null {
  return DOTFILE_CATALOG.find((d) => d.target === target) ?? null;
}

// ---------------------------------------------------------------------------
// Repo structure (tree)
// ---------------------------------------------------------------------------

/** Render an ASCII tree diagram of the repo layout for the chosen manager. */
export function generateRepoTree(cfg: DotfileConfig): string {
  const lines: string[] = [`${cfg.repoName || "dotfiles"}/`];
  const selected = cfg.selected
    .map((t) => resolveDotfile(t))
    .filter((d): d is DotfileDef => d !== null);

  if (cfg.manager === "stow") {
    // Group by package (one package per dotfile category, simplified to one
    // package per dotfile).
    for (const d of selected) {
      lines.push(`├── ${d.repoFilename.split("/")[0]}/`);
      const parts = d.repoFilename.split("/");
      if (parts.length > 1) {
        for (let i = 1; i < parts.length; i++) {
          const isLast = i === parts.length - 1;
          lines.push(`│   ${isLast ? "└── " : "├── "}${parts[i]}${d.isDirectory && isLast ? "/" : ""}`);
        }
      } else {
        lines.push(`│   └── ${parts[0]}${d.isDirectory ? "/" : ""}`);
      }
    }
    lines.push("├── install.sh");
    lines.push("├── .gitignore");
    lines.push("└── README.md");
  } else if (cfg.manager === "bare-git") {
    lines.push("├── .gitignore");
    lines.push("├── README.md");
    lines.push("└── .cfg/   (bare git dir, not in $HOME normally)");
    lines.push("");
    lines.push("# Files live at their real $HOME paths (not in a repo dir).");
    lines.push("# Track with: /usr/bin/git --git-dir=$HOME/.cfg --work-tree=$HOME add <file>");
  } else if (cfg.manager === "chezmoi") {
    lines.push("├── .chezmoi.toml.tmpl");
    lines.push("├── dot_bashrc");
    lines.push("├── dot_zshrc");
    lines.push("├── dot_vimrc");
    lines.push("├── dot_gitconfig");
    lines.push("├── dot_tmux.conf");
    lines.push("├── private_dot_ssh/");
    lines.push("│   └── config");
    lines.push("├── .chezmoiignore");
    lines.push("├── .gitignore");
    lines.push("└── README.md");
    if (selected.length === 0) {
      lines.push("");
      lines.push("# (Select dotfiles above — tree shown is the default chezmoi layout.)");
    }
  } else if (cfg.manager === "dotbot") {
    for (const d of selected) {
      const parts = d.repoFilename.split("/");
      if (parts.length > 1) {
        lines.push(`├── ${parts[0]}/`);
        for (let i = 1; i < parts.length; i++) {
          const isLast = i === parts.length - 1;
          lines.push(`│   ${isLast ? "└── " : "├── "}${parts[i]}${d.isDirectory && isLast ? "/" : ""}`);
        }
      } else {
        lines.push(`├── ${d.repoFilename}${d.isDirectory ? "/" : ""}`);
      }
    }
    lines.push("├── install.conf.yaml");
    lines.push("├── install.sh");
    lines.push("├── .gitignore");
    lines.push("├── .gitmodules   (Dotbot submodule)");
    lines.push("└── README.md");
  }
  return lines.join("\n");
}

// ---------------------------------------------------------------------------
// Install script (idempotent, backs up existing files)
// ---------------------------------------------------------------------------

/**
 * Generate the install.sh for the chosen manager. Always idempotent — running
 * it twice produces the same end-state. Existing files are backed up to
 * `.bak.<timestamp>` unless backup mode is "skip" or "overwrite".
 */
export function generateInstallScript(cfg: DotfileConfig): string {
  const selected = cfg.selected
    .map((t) => resolveDotfile(t))
    .filter((d): d is DotfileDef => d !== null);
  const lines: string[] = [];
  lines.push("#!/usr/bin/env bash");
  lines.push("#");
  lines.push(`# ${cfg.repoName || "dotfiles"} — install script (generated by UnQTools Dotfiles Manager)`);
  lines.push(`# Manager: ${getManager(cfg.manager).label}`);
  lines.push("# Idempotent — safe to re-run. Existing files are backed up.");
  lines.push("set -euo pipefail");
  lines.push("");
  lines.push('REPO_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"');
  lines.push('TIMESTAMP="$(date +%Y%m%d-%H%M%S)"');
  lines.push("");
  lines.push("# ── Helpers ────────────────────────────────────────────────────");
  lines.push("backup_file() {");
  lines.push("  local target=\"$1\"");
  if (cfg.backupMode === "bak") {
    lines.push('  if [ -e "$target" ] && [ ! -L "$target" ]; then');
    lines.push('    mv "$target" "$target.bak.$TIMESTAMP"');
    lines.push('    echo "  Backed up $target → $target.bak.$TIMESTAMP"');
    lines.push("  fi");
  } else if (cfg.backupMode === "skip") {
    lines.push('  if [ -e "$target" ] && [ ! -L "$target" ]; then');
    lines.push('    echo "  Skipping $target (already exists)"');
    lines.push("    return 1");
    lines.push("  fi");
  } else {
    lines.push('  if [ -e "$target" ] && [ ! -L "$target" ]; then');
    lines.push('    rm -rf "$target"');
    lines.push('    echo "  Overwrote $target"');
    lines.push("  fi");
  }
  lines.push("}");
  lines.push("");
  lines.push("link() {");
  lines.push("  local src=\"$1\" dst=\"$2\"");
  lines.push("  backup_file \"$dst\" || return 0");
  lines.push('  mkdir -p "$(dirname "$dst")"');
  lines.push('  ln -sfn "$src" "$dst"');
  lines.push('  echo "  Linked $dst → $src"');
  lines.push("}");
  lines.push("");

  if (cfg.osGuards) {
    lines.push("# ── OS detection ───────────────────────────────────────────────");
    lines.push('OS="unknown"');
    lines.push('case "$(uname -s)" in');
    lines.push('  Darwin*) OS="macOS" ;;');
    lines.push('  Linux*)  OS="Linux" ;;');
    lines.push('  CYGWIN*|MINGW*|MSYS*) OS="Windows" ;;');
    lines.push("esac");
    lines.push('echo "Detected OS: $OS"');
    lines.push("");
  }

  if (cfg.packageStub) {
    lines.push("# ── Package install stub ──────────────────────────────────────");
    lines.push('if [ "$OS" = "macOS" ] && command -v brew >/dev/null 2>&1; then');
    lines.push('  brew bundle --file="$REPO_DIR/Brewfile" 2>/dev/null || echo "  (no Brewfile — skipping)"');
    lines.push('elif [ "$OS" = "Linux" ] && command -v apt >/dev/null 2>&1; then');
    lines.push('  sudo apt update && sudo apt install -y git stow 2>/dev/null || true');
    lines.push("fi");
    lines.push("");
  }

  lines.push("# ── Install ───────────────────────────────────────────────────");
  lines.push('echo "Installing ${cfg.repoName} via ${getManager(cfg.manager).label}..."');

  if (cfg.manager === "stow") {
    if (selected.length === 0) {
      lines.push('echo "  (no dotfiles selected)"');
    }
    for (const d of selected) {
      const pkg = d.repoFilename.split("/")[0];
      lines.push(`echo "→ ${d.target}"`);
      lines.push(`stow --target="$HOME" --restow "${pkg}" 2>/dev/null || echo "  (stow ${pkg} failed — check conflicts)"`);
    }
  } else if (cfg.manager === "bare-git") {
    lines.push('GIT_DIR="$HOME/.cfg"');
    lines.push('if [ ! -d "$GIT_DIR" ]; then');
    lines.push('  git init --bare "$GIT_DIR"');
    lines.push('  git --git-dir="$GIT_DIR" --work-tree="$HOME" config status.showUntrackedFiles no');
    lines.push("fi");
    lines.push('echo "  Bare repo at $GIT_DIR"');
    lines.push('echo "  Track files with: git --git-dir=$HOME/.cfg --work-tree=$HOME add <file>"');
  } else if (cfg.manager === "chezmoi") {
    lines.push('if ! command -v chezmoi >/dev/null 2>&1; then');
    lines.push('  echo "  Installing chezmoi..."');
    lines.push('  sh -c "$(curl -fsLS get.chezmoi.io)" -- -b "$HOME/.local/bin"');
    lines.push("fi");
    lines.push('chezmoi init --source="$REPO_DIR"');
    lines.push('chezmoi apply --source="$REPO_DIR"');
  } else if (cfg.manager === "dotbot") {
    lines.push('DOTBOT_DIR="$REPO_DIR/dotbot"');
    lines.push('DOTBOT_BIN="bin/dotbot"');
    lines.push('BASEDIR="$REPO_DIR"');
    lines.push("");
    lines.push('cd "${BASEDIR}"');
    lines.push("");
    lines.push('git -C "${DOTBOT_DIR}" submodule update --init --recursive || \\');
    lines.push('  git submodule update --init --recursive "${DOTBOT_DIR}"');
    lines.push("");
    lines.push('"${BASEDIR}/${DOTBOT_DIR}/${DOTBOT_BIN}" -d "${BASEDIR}" -c "${BASEDIR}/install.conf.yaml" "${@}"');
  }
  lines.push("");
  lines.push('echo "Done. Restart your shell or run: exec $SHELL"');

  return lines.join("\n");
}

/**
 * Generate the Dotbot YAML config (install.conf.yaml) for the selected
 * dotfiles. Only relevant when manager is "dotbot".
 */
export function generateDotbotConf(cfg: DotfileConfig): string {
  const selected = cfg.selected
    .map((t) => resolveDotfile(t))
    .filter((d): d is DotfileDef => d !== null);
  const links: string[] = [];
  for (const d of selected) {
    links.push(`    ${d.repoFilename}: ${d.target}`);
  }
  return [
    "- defaults:",
    "    link:",
    "      relink: true",
    "      create: true",
    "      force: true",
    "",
    "- clean: ['~']",
    "",
    "- link:",
    ...(links.length > 0 ? links : ["    # (no dotfiles selected)"]),
    "",
    "- shell:",
    "  - [git submodule update --init --recursive, Installing submodules]",
    "",
  ].join("\n");
}

/**
 * Generate the chezmoi config template (`.chezmoi.toml.tmpl`). Only relevant
 * when manager is "chezmoi".
 */
export function generateChezmoiConf(cfg: DotfileConfig): string {
  return [
    "{{- /* .chezmoi.toml.tmpl — generated by UnQTools Dotfiles Manager */ -}}",
    '{{- $email := promptString "email" -}}',
    '{{- $name := promptString "name" -}}',
    "",
    "[data]",
    '    email = "{{ $email }}"',
    '    name = "{{ $name }}"',
    `    repo = "${cfg.repoName || "dotfiles"}"`,
    "",
  ].join("\n");
}

// ---------------------------------------------------------------------------
// .gitignore (secret-safe by default)
// ---------------------------------------------------------------------------

export function generateGitignore(cfg: DotfileConfig): string {
  const lines: string[] = [
    "# .gitignore — generated by UnQTools Dotfiles Manager",
    "# Secret-safe by default. Review and adjust as needed.",
    "",
    "# ── OS junk ──",
    ".DS_Store",
    "Thumbs.db",
    "desktop.ini",
    "",
    "# ── Editor / IDE ──",
    ".vscode/",
    ".idea/",
    "*.swp",
    "*.swo",
    "*~",
    "",
    "# ── Secrets (never commit these) ──",
    ...SECRET_PATTERNS,
    "",
    "# ── Manager-specific ──",
  ];
  if (cfg.manager === "stow") {
    lines.push("*.bak.*");
  } else if (cfg.manager === "bare-git") {
    lines.push("# Bare-git already hides untracked files via status.showUntrackedFiles=no");
    lines.push("# Be extra careful with anything matching secret patterns above.");
  } else if (cfg.manager === "chezmoi") {
    lines.push(".chezmoi.toml   # local config (use .chezmoi.toml.tmpl in repo)");
    lines.push("chezmoi-dump*");
  } else if (cfg.manager === "dotbot") {
    lines.push("*.bak.*");
  }
  lines.push("");
  return lines.join("\n");
}

// ---------------------------------------------------------------------------
// README
// ---------------------------------------------------------------------------

export function generateReadme(cfg: DotfileConfig): string {
  const m = getManager(cfg.manager);
  const selected = cfg.selected
    .map((t) => resolveDotfile(t))
    .filter((d): d is DotfileDef => d !== null);
  const lines: string[] = [];
  lines.push(`# ${cfg.repoName || "dotfiles"}`);
  lines.push("");
  if (cfg.author) {
    lines.push(`> ${cfg.author}'s dotfiles — managed with **${m.label}** (${m.tagline}).`);
  } else {
    lines.push(`> Dotfiles managed with **${m.label}** (${m.tagline}).`);
  }
  lines.push("");
  lines.push("## Why " + m.label + "?");
  lines.push("");
  lines.push("**Pros**");
  for (const p of m.pros) lines.push(`- ${p}`);
  lines.push("");
  lines.push("**Cons**");
  for (const c of m.cons) lines.push(`- ${c}`);
  lines.push("");
  if (m.difficulty === 1) lines.push("Difficulty: beginner-friendly.");
  else if (m.difficulty === 2) lines.push("Difficulty: intermediate.");
  else lines.push("Difficulty: advanced (read the docs before deploying).");
  lines.push("");
  lines.push("## Tracked dotfiles");
  if (selected.length === 0) {
    lines.push("- _(none selected)_");
  } else {
    for (const d of selected) {
      const flag = d.secretRisk ? " ⚠️ (may contain secrets)" : "";
      lines.push(`- \`${d.target}\` — ${d.label}${flag}`);
    }
  }
  lines.push("");
  lines.push("## Install on a new machine");
  lines.push("");
  lines.push("```bash");
  lines.push(`git clone https://github.com/${cfg.author || "you"}/${cfg.repoName || "dotfiles"}.git`);
  lines.push(`cd ${cfg.repoName || "dotfiles"}`);
  lines.push("./install.sh");
  lines.push("```");
  lines.push("");
  lines.push("The install script is **idempotent** — running it twice produces the same");
  if (cfg.backupMode === "bak") {
    lines.push("state. Existing files are backed up to `*.bak.<timestamp>`.");
  } else if (cfg.backupMode === "skip") {
    lines.push("state. Existing files are skipped.");
  } else {
    lines.push("state. Existing files are overwritten.");
  }
  lines.push("");
  lines.push("## Repo layout");
  lines.push("");
  lines.push("```");
  lines.push(generateRepoTree(cfg));
  lines.push("```");
  lines.push("");
  lines.push("## Never commit these");
  lines.push("");
  lines.push("See `.gitignore` — secrets are excluded by default. If you genuinely need");
  lines.push("to track sensitive files, use [git-crypt](https://github.com/AGWA/git-crypt)");
  lines.push("or [age](https://github.com/FiloSottile/age) (chezmoi supports age natively).");
  lines.push("");
  lines.push("## License");
  lines.push("");
  lines.push("MIT — see [LICENSE](./LICENSE).");
  return lines.join("\n");
}

// ---------------------------------------------------------------------------
// Full bundle
// ---------------------------------------------------------------------------

export interface GeneratedBundle {
  tree: string;
  installScript: string;
  gitignore: string;
  readme: string;
  dotbotConf?: string;
  chezmoiConf?: string;
  checklist: { item: string; why: string; severity: "critical" | "warn" }[];
}

/** Generate the entire bundle for download / preview. */
export function generateBundle(cfg: DotfileConfig): GeneratedBundle {
  const bundle: GeneratedBundle = {
    tree: generateRepoTree(cfg),
    installScript: generateInstallScript(cfg),
    gitignore: generateGitignore(cfg),
    readme: generateReadme(cfg),
    checklist: NEVER_COMMIT_LIST,
  };
  if (cfg.manager === "dotbot") bundle.dotbotConf = generateDotbotConf(cfg);
  if (cfg.manager === "chezmoi") bundle.chezmoiConf = generateChezmoiConf(cfg);
  return bundle;
}

// ---------------------------------------------------------------------------
// Stats
// ---------------------------------------------------------------------------

export interface BundleStats {
  totalSelected: number;
  withSecretRisk: number;
  directories: number;
  files: number;
  installScriptLines: number;
  gitignorePatterns: number;
}

export function computeStats(cfg: DotfileConfig): BundleStats {
  const selected = cfg.selected
    .map((t) => resolveDotfile(t))
    .filter((d): d is DotfileDef => d !== null);
  const installScript = generateInstallScript(cfg);
  return {
    totalSelected: selected.length,
    withSecretRisk: selected.filter((d) => d.secretRisk).length,
    directories: selected.filter((d) => d.isDirectory).length,
    files: selected.filter((d) => !d.isDirectory).length,
    installScriptLines: installScript.split("\n").length,
    gitignorePatterns: SECRET_PATTERNS.length,
  };
}

// ---------------------------------------------------------------------------
// History (localStorage)
// ---------------------------------------------------------------------------

const HISTORY_KEY = "unqtools:dotfiles-manager-generator:history";
const HISTORY_MAX = 20;

export interface HistoryEntry {
  ts: number;
  manager: Manager;
  selectedCount: number;
  repoName: string;
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

export function buildShareUrl(cfg: DotfileConfig): string {
  const params = new URLSearchParams();
  params.set("m", cfg.manager);
  params.set("r", cfg.repoName);
  params.set("a", cfg.author);
  params.set("s", cfg.selected.join(","));
  params.set("o", cfg.osGuards ? "1" : "0");
  params.set("p", cfg.packageStub ? "1" : "0");
  params.set("b", cfg.backupMode);
  if (typeof window === "undefined") return `?${params.toString()}`;
  return `${window.location.origin}${window.location.pathname}#${params.toString()}`;
}

export function parseShareUrl(hash: string): DotfileConfig {
  const clean = hash.startsWith("#") ? hash.slice(1) : hash;
  if (!clean) return defaultConfig();
  const params = new URLSearchParams(clean);
  const validManagers: Manager[] = ["stow", "bare-git", "chezmoi", "dotbot"];
  const m = params.get("m");
  const validTargets = new Set(DOTFILE_CATALOG.map((d) => d.target));
  const selected = (params.get("s") ?? "")
    .split(",")
    .filter((t) => validTargets.has(t));
  return {
    manager: m && validManagers.includes(m as Manager) ? (m as Manager) : "stow",
    repoName: params.get("r") ?? "dotfiles",
    author: params.get("a") ?? "",
    selected,
    osGuards: params.get("o") === "1",
    packageStub: params.get("p") === "1",
    backupMode: (params.get("b") as DotfileConfig["backupMode"]) ?? "bak",
  };
}

export function defaultConfig(): DotfileConfig {
  return {
    manager: "stow",
    repoName: "dotfiles",
    author: "",
    selected: [".bashrc", ".zshrc", ".vimrc", ".gitconfig", ".tmux.conf"],
    osGuards: true,
    packageStub: false,
    backupMode: "bak",
  };
}
