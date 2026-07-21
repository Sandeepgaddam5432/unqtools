/**
 * rsync Command Builder — pure logic.
 *
 * Build correct `rsync` commands for local / push / pull sync from a
 * visual UI config — pick archive mode, verbose, compress, delete,
 * dry-run, excludes, SSH transport (key/port), bandwidth limit, partial,
 * checksum. Visualize the trailing-slash effect. Auto-suggest dry-run for
 * destructive runs. Explain every flag in plain English.
 *
 * Pure functions only — no DOM, no network. Commands are GENERATED, never
 * executed.
 */

// ---- Types ----

export type RsyncDirection = "local" | "push" | "pull";

export interface SshTransport {
  enabled: boolean;
  user: string;
  host: string;
  port: string;
  keyFile: string;
  extraOptions: string;
}

export interface BuilderConfig {
  direction: RsyncDirection;
  source: string;
  sourceTrailingSlash: boolean;
  destination: string;
  destTrailingSlash: boolean;
  archive: boolean; // -a (=-rlptgoD)
  recursive: boolean; // -r
  verbose: boolean; // -v
  compress: boolean; // -z
  humanReadable: boolean; // -h
  progress: boolean; // --progress
  partial: boolean; // --partial (resume)
  checksum: boolean; // -c (skip by checksum, not mtime+size)
  numericIds: boolean; // --numeric-ids
  dryRun: boolean; // -n
  delete: boolean; // --delete
  deleteExcluded: boolean; // --delete-excluded
  bwlimit: number; // KB/s, 0 = no limit
  excludes: string[];
  excludeFrom: string;
  ssh: SshTransport;
}

export interface BuiltCommand {
  command: string;
  notes: string[];
  warnings: string[];
}

export interface FlagExplanation {
  flag: string;
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
  direction: RsyncDirection;
  command: string;
}

// ---- Constants ----

export const DEFAULT_CONFIG: BuilderConfig = {
  direction: "local",
  source: "./src/",
  sourceTrailingSlash: true,
  destination: "./dest/",
  destTrailingSlash: true,
  archive: true,
  recursive: false,
  verbose: true,
  compress: false,
  humanReadable: false,
  progress: false,
  partial: false,
  checksum: false,
  numericIds: false,
  dryRun: false,
  delete: false,
  deleteExcluded: false,
  bwlimit: 0,
  excludes: [],
  excludeFrom: "",
  ssh: {
    enabled: false,
    user: "",
    host: "",
    port: "",
    keyFile: "",
    extraOptions: "",
  },
};

export const DIRECTION_LABELS: Record<RsyncDirection, string> = {
  local: "Local → local",
  push: "Push (local → remote)",
  pull: "Pull (remote → local)",
};

export const DIRECTION_HINTS: Record<RsyncDirection, string> = {
  local: "Both source and destination are local paths. No SSH transport needed.",
  push: "Copy FROM a local path TO a remote host (write to remote). Use '[user@]host:path' for destination.",
  pull: "Copy FROM a remote host TO a local path (read from remote). Use '[user@]host:path' for source.",
};

export const ARCHIVE_BREAKDOWN: { flag: string; label: string }[] = [
  { flag: "-r", label: "Recursive — descend into subdirectories." },
  { flag: "-l", label: "Copy symlinks AS symlinks (don't follow)." },
  { flag: "-p", label: "Preserve permissions (mode bits)." },
  { flag: "-t", label: "Preserve modification times (mtime)." },
  { flag: "-g", label: "Preserve group." },
  { flag: "-o", label: "Preserve owner (needs root)." },
  { flag: "-D", label: "Preserve devices & specials (needs root). Equivalent to --devices --specials." },
];

export const RECIPES: Recipe[] = [
  {
    id: "local-mirror",
    label: "Local mirror (archive + delete)",
    description: "Mirror ./src/ to ./dest/ — same permissions, deletes files removed from src.",
    config: {
      direction: "local",
      source: "./src/",
      sourceTrailingSlash: true,
      destination: "./dest/",
      destTrailingSlash: true,
      archive: true,
      verbose: true,
      delete: true,
      dryRun: true,
    },
  },
  {
    id: "push-ssh",
    label: "Push over SSH (archive + compress)",
    description: "Push a local folder to a remote server over SSH with compression enabled.",
    config: {
      direction: "push",
      source: "./project/",
      sourceTrailingSlash: true,
      destination: "/var/www/project/",
      destTrailingSlash: true,
      archive: true,
      verbose: true,
      compress: true,
      humanReadable: true,
      progress: true,
      ssh: { enabled: true, user: "deploy", host: "example.com", port: "22", keyFile: "~/.ssh/deploy_key", extraOptions: "" },
    },
  },
  {
    id: "pull-backup",
    label: "Pull remote backup home (archive)",
    description: "Pull your home directory from a remote server to a local backup folder.",
    config: {
      direction: "pull",
      source: "/home/alice/",
      sourceTrailingSlash: true,
      destination: "./backups/alice/",
      destTrailingSlash: true,
      archive: true,
      verbose: true,
      partial: true,
      ssh: { enabled: true, user: "alice", host: "example.com", port: "22", keyFile: "", extraOptions: "" },
    },
  },
  {
    id: "dry-run-delete",
    label: "Dry-run preview of a destructive delete",
    description: "Preview exactly what --delete would remove BEFORE you run it for real.",
    config: {
      direction: "local",
      source: "./src/",
      sourceTrailingSlash: true,
      destination: "./dest/",
      destTrailingSlash: true,
      archive: true,
      verbose: true,
      delete: true,
      dryRun: true,
    },
  },
  {
    id: "exclude-git",
    label: "Sync project excluding .git and node_modules",
    description: "Mirror a project but skip .git/, node_modules/, and *.log files.",
    config: {
      direction: "local",
      source: "./project/",
      sourceTrailingSlash: true,
      destination: "./release/",
      destTrailingSlash: true,
      archive: true,
      verbose: true,
      excludes: [".git/", "node_modules/", "*.log"],
    },
  },
  {
    id: "bandwidth-limit",
    label: "Sync with bandwidth limit (--bwlimit)",
    description: "Limit transfer to 1000 KB/s (~1 MB/s) to avoid saturating the uplink.",
    config: {
      direction: "push",
      source: "./large-files/",
      sourceTrailingSlash: true,
      destination: "/backup/large-files/",
      destTrailingSlash: true,
      archive: true,
      verbose: true,
      progress: true,
      partial: true,
      bwlimit: 1000,
      ssh: { enabled: true, user: "backup", host: "storage.example.com", port: "22", keyFile: "", extraOptions: "" },
    },
  },
  {
    id: "checksum-sync",
    label: "Sync using checksums (skip by content)",
    description: "Use checksums instead of mtime+size — slower but catches files with same size/mtime but different content.",
    config: {
      direction: "local",
      source: "./src/",
      sourceTrailingSlash: true,
      destination: "./dest/",
      destTrailingSlash: true,
      archive: true,
      checksum: true,
      verbose: true,
    },
  },
  {
    id: "resume-partial",
    label: "Resume a large transfer (--partial)",
    description: "Keep partially-transferred files so a re-run resumes instead of restarting.",
    config: {
      direction: "pull",
      source: "/data/backup.tar.gz",
      sourceTrailingSlash: false,
      destination: "./backup.tar.gz",
      destTrailingSlash: false,
      archive: false,
      verbose: true,
      progress: true,
      partial: true,
      ssh: { enabled: true, user: "user", host: "example.com", port: "22", keyFile: "", extraOptions: "" },
    },
  },
  {
    id: "ssh-custom-port",
    label: "Push over SSH on a custom port",
    description: "Sync to a server that runs SSH on port 2222 with a specific identity key.",
    config: {
      direction: "push",
      source: "./dist/",
      sourceTrailingSlash: true,
      destination: "/srv/app/dist/",
      destTrailingSlash: true,
      archive: true,
      verbose: true,
      compress: true,
      ssh: { enabled: true, user: "deploy", host: "example.com", port: "2222", keyFile: "~/.ssh/deploy_id_ed25519", extraOptions: "" },
    },
  },
  {
    id: "exact-mirror-delete-excluded",
    label: "Exact mirror (--delete-excluded)",
    description: "Make dest an EXACT match of src — delete excluded files in dest too. DANGEROUS — dry-run first!",
    config: {
      direction: "local",
      source: "./src/",
      sourceTrailingSlash: true,
      destination: "./dest/",
      destTrailingSlash: true,
      archive: true,
      verbose: true,
      delete: true,
      deleteExcluded: true,
      dryRun: true,
      excludes: ["*.tmp"],
    },
  },
];

// ---- Shell quoting ----

/** Shell-quote a single argument (POSIX-style). Empty string becomes ''. */
export function shellQuote(s: string): string {
  if (s === "") return "''";
  if (/^[A-Za-z0-9_@%+=:,./~-]+$/.test(s)) return s;
  return `'${s.replace(/'/g, "'\\''")}'`;
}

// ---- Helpers ----

/** Apply or remove a trailing slash on a path. */
export function withTrailingSlash(path: string, on: boolean): string {
  const trimmed = path.replace(/\/+$/, "");
  return on && trimmed ? `${trimmed}/` : trimmed;
}

/** Detect whether a path looks like a remote ('[user@]host:path'). */
export function isRemotePath(path: string): boolean {
  // A remote path has a colon BEFORE any slash, e.g. user@host:/path
  // (Windows drive letters like C:/ are unusual in rsync context.)
  const colon = path.indexOf(":");
  if (colon < 0) return false;
  const slash = path.indexOf("/");
  return slash < 0 || colon < slash;
}

/** Parse a remote '[user@]host:path' into its parts. */
export function parseRemotePath(path: string): { user: string; host: string; pathPart: string; ok: boolean } {
  const colon = path.indexOf(":");
  if (colon < 0) return { user: "", host: "", pathPart: path, ok: false };
  const before = path.slice(0, colon);
  const after = path.slice(colon + 1);
  const atIdx = before.indexOf("@");
  if (atIdx >= 0) {
    return { user: before.slice(0, atIdx), host: before.slice(atIdx + 1), pathPart: after, ok: true };
  }
  return { user: "", host: before, pathPart: after, ok: true };
}

/** Build the SSH transport string for -e, e.g. 'ssh -i ~/.ssh/key -p 2222'. */
export function buildSshString(ssh: SshTransport): { string: string; quoted: string; present: boolean } {
  if (!ssh.enabled) return { string: "", quoted: "", present: false };
  const parts: string[] = ["ssh"];
  if (ssh.keyFile) parts.push("-i", ssh.keyFile);
  if (ssh.port) parts.push("-p", ssh.port);
  if (ssh.extraOptions) parts.push(ssh.extraOptions);
  const str = parts.join(" ");
  return { string: str, quoted: shellQuote(str), present: parts.length > 1 };
}

/** Render the effective source/destination paths after applying slash rules. */
export function renderEffectivePaths(config: BuilderConfig): { source: string; dest: string } {
  const src = withTrailingSlash(config.source, config.sourceTrailingSlash);
  const dest = withTrailingSlash(config.destination, config.destTrailingSlash);
  return { source: src, dest };
}

/** Trailing-slash visualization: what lands where. */
export function visualizeSlashEffect(config: BuilderConfig): {
  sourceMode: "contents" | "dir";
  explanation: string;
  example: string;
} {
  const srcBase = config.source.replace(/\/+$/, "").split("/").filter(Boolean).pop() ?? "(empty)";
  const srcFile = "file.txt";
  if (config.sourceTrailingSlash) {
    return {
      sourceMode: "contents",
      explanation: `Trailing slash on source: rsync copies the CONTENTS of the source dir into destination. The source dir itself is NOT created at the destination.`,
      example: `src/${srcFile}  →  ${config.destination.replace(/\/+$/, "")}/${srcFile}`,
    };
  }
  return {
    sourceMode: "dir",
    explanation: `No trailing slash on source: rsync copies the source DIRECTORY itself (with its contents) into the destination.`,
    example: `${srcBase}/${srcFile}  →  ${config.destination.replace(/\/+$/, "")}/${srcBase}/${srcFile}`,
  };
}

/** Parse a comma- or newline-separated list of excludes. */
export function parseList(input: string): string[] {
  if (!input) return [];
  return input.split(/[\n,]+/).map((s) => s.trim()).filter(Boolean);
}

// ---- Build the command ----

/** Build the rsync command from the config. */
export function buildCommand(config: BuilderConfig): BuiltCommand {
  const parts: string[] = ["rsync"];
  const notes: string[] = [];
  const warnings: string[] = [];

  // 1) Short flags cluster: -a (or -rlptgoD), -v, -z, -h, -c, -n, -r (if not -a)
  const shortFlags: string[] = [];
  if (config.archive) shortFlags.push("a");
  else if (config.recursive) shortFlags.push("r");
  if (config.verbose) shortFlags.push("v");
  if (config.compress) shortFlags.push("z");
  if (config.humanReadable) shortFlags.push("h");
  if (config.checksum) shortFlags.push("c");
  if (config.dryRun) shortFlags.push("n");
  if (shortFlags.length > 0) parts.push(`-${shortFlags.join("")}`);

  // 2) Long-only flags.
  if (config.progress) {
    parts.push("--progress");
    notes.push("--progress shows per-file transfer progress during the sync.");
  }
  if (config.partial) {
    parts.push("--partial");
    notes.push("--partial keeps partially-transferred files so a re-run resumes from where it left off. Combine with --progress for a friendly resume (`-P`).");
  }
  if (config.numericIds) {
    parts.push("--numeric-ids");
    notes.push("--numeric-ids sends numeric UID/GID instead of names — avoids name-resolution mismatches when restoring across systems.");
  }
  if (config.delete) {
    parts.push("--delete");
    notes.push("--delete removes files in the destination that no longer exist in the source. DANGEROUS — always test with --dry-run first.");
    if (!config.dryRun) {
      warnings.push("--delete is enabled WITHOUT --dry-run. Consider adding -n to preview what would be deleted before running for real.");
    }
  }
  if (config.deleteExcluded) {
    parts.push("--delete-excluded");
    notes.push("--delete-excluded also deletes files in dest that match your --exclude patterns (even if they would normally be untouched). VERY DANGEROUS.");
    warnings.push("--delete-excluded removes dest files matching your excludes — make sure your exclude patterns are exactly right. Dry-run first!");
    if (!config.delete) {
      warnings.push("--delete-excluded without --delete has no effect; consider also enabling --delete.");
    }
  }
  if (config.bwlimit > 0) {
    parts.push(`--bwlimit=${config.bwlimit}`);
    notes.push(`--bwlimit=${config.bwlimit} caps the transfer rate at ${config.bwlimit} KB/s (~${(config.bwlimit / 1024).toFixed(2)} MB/s).`);
  }

  // 3) Excludes (long flag, before source/dest).
  for (const ex of config.excludes) {
    parts.push(`--exclude=${shellQuote(ex)}`);
  }
  if (config.excludeFrom) {
    parts.push(`--exclude-from=${shellQuote(config.excludeFrom)}`);
    notes.push(`--exclude-from=${config.excludeFrom} reads exclude patterns from a file (one per line).`);
  }

  // 4) SSH transport: -e 'ssh ...'
  const ssh = buildSshString(config.ssh);
  if (ssh.present) {
    parts.push("-e", ssh.quoted);
    notes.push(`-e ${ssh.string} uses this SSH transport for remote paths. The single quotes pass the inner flags verbatim to ssh.`);
  }

  // 5) Direction validation.
  if (config.direction === "local") {
    if (isRemotePath(config.source) || isRemotePath(config.destination)) {
      warnings.push("Direction is 'local' but a path looks remote ('[user@]host:path'). Switch to push/pull or fix the path.");
    }
    if (config.ssh.enabled) {
      notes.push("SSH transport is enabled but direction is 'local' — it will be ignored unless source/dest is remote.");
    }
  } else {
    // push or pull — one side must be remote.
    const srcRemote = isRemotePath(config.source);
    const destRemote = isRemotePath(config.destination);
    if (config.direction === "push") {
      if (!destRemote) warnings.push("Direction is 'push' but destination doesn't look remote ('[user@]host:path'). Add 'user@host:' prefix to destination.");
      if (srcRemote) warnings.push("Direction is 'push' but source looks remote — that's actually a pull. Swap direction or fix paths.");
    } else if (config.direction === "pull") {
      if (!srcRemote) warnings.push("Direction is 'pull' but source doesn't look remote ('[user@]host:path'). Add 'user@host:' prefix to source.");
      if (destRemote) warnings.push("Direction is 'pull' but destination looks remote — that's actually a push. Swap direction or fix paths.");
    }
    if (!config.ssh.enabled && (srcRemote || destRemote)) {
      notes.push("Remote path detected but SSH transport not enabled — rsync will default to ssh for host:path syntax. Add -e for custom key/port.");
    }
  }

  // 6) Source + destination with trailing slash applied.
  const src = withTrailingSlash(config.source, config.sourceTrailingSlash);
  const dest = withTrailingSlash(config.destination, config.destTrailingSlash);
  if (!src) warnings.push("Source is empty.");
  if (!dest) warnings.push("Destination is empty.");
  parts.push(shellQuote(src));
  parts.push(shellQuote(dest));

  return { command: parts.join(" "), notes, warnings };
}

/** Plain-English summary of the command's intent. */
export function explainIntent(config: BuilderConfig): string {
  const dirVerb: Record<RsyncDirection, string> = {
    local: "Sync locally",
    push: "Push from local to remote",
    pull: "Pull from remote to local",
  };
  const bits: string[] = [];
  bits.push(`${dirVerb[config.direction]}.`);
  if (config.archive) bits.push("Archive mode (-a = -rlptgoD) — recursive, preserve perms/times/owner/group/symlinks/devices.");
  else if (config.recursive) bits.push("Recursive (-r) without full archive metadata.");
  if (config.verbose) bits.push("Verbose (-v) — list each file.");
  if (config.compress) bits.push("Compress (-z) during transfer.");
  if (config.humanReadable) bits.push("Human-readable numbers (-h).");
  if (config.progress) bits.push("Show per-file progress (--progress).");
  if (config.partial) bits.push("Keep partial files for resume (--partial).");
  if (config.checksum) bits.push("Skip by checksum, not mtime+size (-c — slower).");
  if (config.numericIds) bits.push("Use numeric UID/GID (--numeric-ids).");
  if (config.dryRun) bits.push("DRY RUN (-n) — preview only, no changes.");
  if (config.delete) bits.push("DELETE missing files in dest (--delete).");
  if (config.deleteExcluded) bits.push("Also delete dest files matching excludes (--delete-excluded).");
  if (config.bwlimit > 0) bits.push(`Limit to ${config.bwlimit} KB/s (--bwlimit).`);
  if (config.excludes.length > 0) bits.push(`Exclude: ${config.excludes.join(", ")}.`);
  if (config.excludeFrom) bits.push(`Excludes from file ${config.excludeFrom}.`);
  if (config.ssh.enabled) {
    const ssh = buildSshString(config.ssh);
    if (ssh.present) bits.push(`SSH transport: ${ssh.string}.`);
  }
  const slashInfo = config.sourceTrailingSlash
    ? "Trailing slash on source → copy CONTENTS into dest."
    : "NO trailing slash on source → copy the SOURCE DIR itself into dest.";
  bits.push(slashInfo);
  return bits.join(" ");
}

/** Per-flag explanations for the active config. */
export function explainFlags(config: BuilderConfig): FlagExplanation[] {
  const out: FlagExplanation[] = [];
  if (config.archive) {
    out.push({ flag: "-a", explanation: "Archive mode — recursively copies and preserves perms, times, owner, group, symlinks, devices, specials. Shorthand for -rlptgoD. Add -H for hard links, -A for ACLs, -X for xattrs." });
  } else if (config.recursive) {
    out.push({ flag: "-r", explanation: "Recurse into subdirectories. (Included in -a.)" });
  }
  if (config.verbose) out.push({ flag: "-v", explanation: "Verbose — print each file as it's transferred." });
  if (config.compress) out.push({ flag: "-z", explanation: "Compress file data during transfer. Use on slow links; skip on fast LANs (CPU cost)." });
  if (config.humanReadable) out.push({ flag: "-h", explanation: "Human-readable numbers (K, M, G) in --progress and --stats output." });
  if (config.progress) out.push({ flag: "--progress", explanation: "Show per-file transfer progress (% done, speed, eta). Use --info=progress2 for a single overall progress bar." });
  if (config.partial) out.push({ flag: "--partial", explanation: "Keep partially-transferred files in dest so the next run resumes instead of restarting. Combine with --progress as -P." });
  if (config.checksum) out.push({ flag: "-c", explanation: "Skip files based on checksum, not mtime+size. Slower but catches files with same size/mtime but different content." });
  if (config.numericIds) out.push({ flag: "--numeric-ids", explanation: "Don't map UID/GID to names — transfer raw numbers. Avoids name-resolution issues when restoring across systems." });
  if (config.dryRun) out.push({ flag: "-n", explanation: "Dry run — show what WOULD happen, without actually transferring or deleting anything. Always use with --delete." });
  if (config.delete) out.push({ flag: "--delete", explanation: "Delete files in dest that don't exist in source. DANGEROUS — pair with -n (dry-run) to preview." });
  if (config.deleteExcluded) out.push({ flag: "--delete-excluded", explanation: "Also delete dest files matching your --exclude patterns. Even more dangerous — preview with -n first." });
  if (config.bwlimit > 0) out.push({ flag: `--bwlimit=${config.bwlimit}`, explanation: `Cap transfer rate at ${config.bwlimit} KB/s (~${(config.bwlimit / 1024).toFixed(2)} MB/s).` });
  for (const ex of config.excludes) {
    out.push({ flag: `--exclude=${ex}`, explanation: `Skip files matching this pattern. Patterns are relative to the source root; use a trailing slash to match directories only.` });
  }
  if (config.excludeFrom) {
    out.push({ flag: `--exclude-from=${config.excludeFrom}`, explanation: "Read exclude patterns from a file, one per line." });
  }
  const ssh = buildSshString(config.ssh);
  if (ssh.present) {
    out.push({ flag: `-e ${ssh.string}`, explanation: "Use this command as the remote transport. Single quotes pass the inner flags verbatim to ssh (so -i and -p go to ssh, not rsync)." });
  }
  return out;
}

/** Validate the config; return errors + warnings. */
export function validateConfig(config: BuilderConfig): { errors: string[]; warnings: string[] } {
  const errors: string[] = [];
  const warnings: string[] = [];
  if (!config.source) warnings.push("Source is empty.");
  if (!config.destination) warnings.push("Destination is empty.");
  if (config.direction === "local") {
    if (isRemotePath(config.source) || isRemotePath(config.destination)) {
      warnings.push("Direction is 'local' but a path looks remote — switch to push/pull or remove the host: prefix.");
    }
  } else if (config.direction === "push") {
    if (!isRemotePath(config.destination)) warnings.push("Direction is 'push' but destination doesn't look remote.");
    if (isRemotePath(config.source)) warnings.push("Direction is 'push' but source looks remote — that's actually a pull.");
  } else {
    if (!isRemotePath(config.source)) warnings.push("Direction is 'pull' but source doesn't look remote.");
    if (isRemotePath(config.destination)) warnings.push("Direction is 'pull' but destination looks remote — that's actually a push.");
  }
  if (config.delete && !config.dryRun) {
    warnings.push("--delete is enabled WITHOUT --dry-run. Preview first with -n.");
  }
  if (config.deleteExcluded && !config.delete) {
    warnings.push("--delete-excluded without --delete has no effect.");
  }
  if (config.deleteExcluded) {
    warnings.push("--delete-excluded is very dangerous — preview with -n and double-check your excludes.");
  }
  return { errors, warnings };
}

/** Render recipes as plain text for download. */
export function renderRecipesText(): string {
  return RECIPES.map((r) => {
    const c = { ...DEFAULT_CONFIG, ...r.config, ssh: { ...DEFAULT_CONFIG.ssh, ...(r.config.ssh ?? {}) } } as BuilderConfig;
    const built = buildCommand(c);
    return `${r.label}\n  ${r.description}\n  ${built.command}`;
  }).join("\n\n");
}

// ---- History (localStorage) ----

const HISTORY_KEY = "unqtools:rsync-command-builder:history";
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
  params.set("d", config.direction);
  params.set("s", config.source);
  params.set("ss", config.sourceTrailingSlash ? "1" : "0");
  params.set("t", config.destination);
  params.set("ts", config.destTrailingSlash ? "1" : "0");
  const flags: string[] = [];
  if (config.archive) flags.push("a");
  if (config.recursive) flags.push("r");
  if (config.verbose) flags.push("v");
  if (config.compress) flags.push("z");
  if (config.humanReadable) flags.push("h");
  if (config.progress) flags.push("P");
  if (config.partial) flags.push("p");
  if (config.checksum) flags.push("c");
  if (config.numericIds) flags.push("N");
  if (config.dryRun) flags.push("n");
  if (config.delete) flags.push("D");
  if (config.deleteExcluded) flags.push("X");
  if (flags.length > 0) params.set("f", flags.join(""));
  if (config.bwlimit > 0) params.set("bw", String(config.bwlimit));
  if (config.excludes.length > 0) params.set("ex", config.excludes.join(","));
  if (config.excludeFrom) params.set("xf", config.excludeFrom);
  if (config.ssh.enabled) {
    params.set("se", "1");
    if (config.ssh.user) params.set("su", config.ssh.user);
    if (config.ssh.host) params.set("sh", config.ssh.host);
    if (config.ssh.port) params.set("sp", config.ssh.port);
    if (config.ssh.keyFile) params.set("sk", config.ssh.keyFile);
    if (config.ssh.extraOptions) params.set("sx", config.ssh.extraOptions);
  }
  if (typeof window === "undefined") return `?${params.toString()}`;
  return `${window.location.origin}${window.location.pathname}#${params.toString()}`;
}

export function parseShareUrl(hash: string): { config: Partial<BuilderConfig> } {
  const clean = hash.startsWith("#") ? hash.slice(1) : hash;
  if (!clean) return { config: {} };
  const params = new URLSearchParams(clean);
  const config: Partial<BuilderConfig> = {};
  const d = params.get("d") as RsyncDirection | null;
  if (d && ["local", "push", "pull"].includes(d)) config.direction = d;
  if (params.has("s")) config.source = params.get("s")!;
  if (params.has("ss")) config.sourceTrailingSlash = params.get("ss") === "1";
  if (params.has("t")) config.destination = params.get("t")!;
  if (params.has("ts")) config.destTrailingSlash = params.get("ts") === "1";
  const flags = params.get("f") ?? "";
  if (flags) {
    config.archive = flags.includes("a");
    config.recursive = flags.includes("r");
    config.verbose = flags.includes("v");
    config.compress = flags.includes("z");
    config.humanReadable = flags.includes("h");
    config.progress = flags.includes("P");
    config.partial = flags.includes("p");
    config.checksum = flags.includes("c");
    config.numericIds = flags.includes("N");
    config.dryRun = flags.includes("n");
    config.delete = flags.includes("D");
    config.deleteExcluded = flags.includes("X");
  }
  if (params.has("bw")) config.bwlimit = Math.max(0, parseInt(params.get("bw")!, 10) || 0);
  if (params.has("ex")) config.excludes = params.get("ex")!.split(",").filter(Boolean);
  if (params.has("xf")) config.excludeFrom = params.get("xf")!;
  const ssh: SshTransport = {
    enabled: params.get("se") === "1",
    user: params.get("su") ?? "",
    host: params.get("sh") ?? "",
    port: params.get("sp") ?? "",
    keyFile: params.get("sk") ?? "",
    extraOptions: params.get("sx") ?? "",
  };
  if (ssh.enabled || ssh.user || ssh.host || ssh.port || ssh.keyFile || ssh.extraOptions) {
    config.ssh = ssh;
  }
  return { config };
}
