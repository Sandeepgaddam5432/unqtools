/**
 * tar Archive Command Builder — pure logic.
 *
 * Build correct `tar` commands for create / extract / list / append modes
 * from a visual UI config, pick the right compression flag + matching
 * extension, generate excludes / strip-components / -C target dir / format
 * / preserve-perms flags, warn about tar bombs and absolute paths, and
 * explain every flag in plain English.
 *
 * Pure functions only — no DOM, no network. Commands are GENERATED, never
 * executed.
 */

// ---- Types ----

export type TarMode = "create" | "extract" | "list" | "append";

export type TarCompression = "none" | "gzip" | "bzip2" | "xz" | "zstd";

export type TarFormat = "default" | "gnu" | "posix" | "ustar" | "pax";

export interface BuilderConfig {
  mode: TarMode;
  compression: TarCompression;
  verbose: boolean;
  preservePermissions: boolean; // -p (extract) / default-on (create)
  preserveXattrs: boolean; // --xattrs (GNU)
  numericOwner: boolean; // --numeric-owner
  verify: boolean; // -W (create, GNU)
  useStdinStdout: boolean; // -O (extract to stdout) / -T - (from stdin)
  archiveName: string;
  files: string[]; // for create / append
  targetDir: string; // -C (extract)
  stripComponents: number; // --strip-components=N (extract)
  excludes: string[]; // --exclude=PATTERN
  excludeFile: string; // -X FILE
  format: TarFormat; // --format=
  showTotals: boolean; // --totals (create)
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
  mode: TarMode;
  compression: TarCompression;
  command: string;
}

// ---- Constants ----

export const DEFAULT_CONFIG: BuilderConfig = {
  mode: "create",
  compression: "gzip",
  verbose: true,
  preservePermissions: false,
  preserveXattrs: false,
  numericOwner: false,
  verify: false,
  useStdinStdout: false,
  archiveName: "archive.tar.gz",
  files: ["./project"],
  targetDir: "",
  stripComponents: 0,
  excludes: [],
  excludeFile: "",
  format: "default",
  showTotals: false,
};

export const COMPRESSION_INFO: Record<
  TarCompression,
  { flag: string; shortFlag: string; extension: string; label: string; hint: string }
> = {
  none: {
    flag: "",
    shortFlag: "",
    extension: ".tar",
    label: "None (uncompressed .tar)",
    hint: "Plain uncompressed tar archive. Largest size, fastest to create and extract.",
  },
  gzip: {
    flag: "--gzip",
    shortFlag: "z",
    extension: ".tar.gz",
    label: "gzip (.tar.gz / .tgz)",
    hint: "Most compatible compression. z = gzip. Use gzip for general-purpose archives.",
  },
  bzip2: {
    flag: "--bzip2",
    shortFlag: "j",
    extension: ".tar.bz2",
    label: "bzip2 (.tar.bz2 / .tbz2)",
    hint: "Better ratio than gzip but slower. j = bzip2. Not always installed by default.",
  },
  xz: {
    flag: "--xz",
    shortFlag: "J",
    extension: ".tar.xz",
    label: "xz / LZMA (.tar.xz / .txz)",
    hint: "Best ratio, slowest. J = xz. Great for software distribution tarballs.",
  },
  zstd: {
    flag: "--zstd",
    shortFlag: "", // No single-letter; use --zstd
    extension: ".tar.zst",
    label: "zstd (.tar.zst)",
    hint: "Modern, very fast with good ratio. Needs GNU tar ≥ 1.31 or BSD tar.",
  },
};

export const FORMAT_LABELS: Record<TarFormat, string> = {
  default: "Default (GNU tar default)",
  gnu: "gnu (GNU tar 1.13+ format)",
  posix: "posix (POSIX.1-2001 / pax restricted)",
  ustar: "ustar (POSIX.1-1988)",
  pax: "pax (POSIX.1-2001 with extended headers)",
};

export const MODE_LABELS: Record<TarMode, string> = {
  create: "Create (c) — make a new archive",
  extract: "Extract (x) — unpack an archive",
  list: "List (t) — show archive contents",
  append: "Append / Update (r / u) — add files",
};

export const MODE_LETTER: Record<TarMode, string> = {
  create: "c",
  extract: "x",
  list: "t",
  append: "r",
};

export const MODE_HINTS: Record<TarMode, string> = {
  create: "Create a new archive from one or more files/dirs. The c letter must come before f and the archive name.",
  extract: "Extract an archive. With -C <dir> you extract into a specific directory (safer than extracting in the cwd).",
  list: "List archive contents without extracting. Always do this first on unknown archives to detect tar bombs.",
  append: "Append files to an existing uncompressed archive (r) — does NOT work on compressed archives. Use u (update) to add only newer files.",
};

export const RECIPES: Recipe[] = [
  {
    id: "create-gz",
    label: "Create tar.gz (verbose)",
    description: "Create a gzip-compressed archive of a directory, listing each file as it's added.",
    config: {
      mode: "create",
      compression: "gzip",
      verbose: true,
      archiveName: "backup.tar.gz",
      files: ["./my-folder"],
      preservePermissions: false,
      preserveXattrs: false,
      numericOwner: false,
      verify: false,
      useStdinStdout: false,
      targetDir: "",
      stripComponents: 0,
      excludes: [],
      excludeFile: "",
      format: "default",
      showTotals: false,
    },
  },
  {
    id: "extract-gz-to-dir",
    label: "Extract tar.gz into a directory",
    description: "Safely extract a .tar.gz into a target directory (avoids tar-bomb in cwd).",
    config: {
      mode: "extract",
      compression: "gzip",
      verbose: true,
      archiveName: "archive.tar.gz",
      files: [],
      targetDir: "./out",
      stripComponents: 0,
      preservePermissions: false,
      preserveXattrs: false,
      numericOwner: false,
      verify: false,
      useStdinStdout: false,
      excludes: [],
      excludeFile: "",
      format: "default",
      showTotals: false,
    },
  },
  {
    id: "list-gz",
    label: "List tar.gz contents",
    description: "List contents of a compressed archive before extracting.",
    config: {
      mode: "list",
      compression: "gzip",
      verbose: false,
      archiveName: "archive.tar.gz",
      files: [],
      preservePermissions: false,
      preserveXattrs: false,
      numericOwner: false,
      verify: false,
      useStdinStdout: false,
      targetDir: "",
      stripComponents: 0,
      excludes: [],
      excludeFile: "",
      format: "default",
      showTotals: false,
    },
  },
  {
    id: "extract-strip-1",
    label: "Extract & strip top-level dir",
    description: "Extract a .tar.xz, stripping the leading path component so files land directly in target.",
    config: {
      mode: "extract",
      compression: "xz",
      verbose: true,
      archiveName: "release.tar.xz",
      files: [],
      targetDir: "./deploy",
      stripComponents: 1,
      preservePermissions: false,
      preserveXattrs: false,
      numericOwner: false,
      verify: false,
      useStdinStdout: false,
      excludes: [],
      excludeFile: "",
      format: "default",
      showTotals: false,
    },
  },
  {
    id: "create-exclude-node-modules",
    label: "Create tar.gz excluding node_modules",
    description: "Archive a project, excluding node_modules and .git directories.",
    config: {
      mode: "create",
      compression: "gzip",
      verbose: true,
      archiveName: "project.tar.gz",
      files: ["./project"],
      excludes: ["node_modules", ".git", "*.log"],
      preservePermissions: false,
      preserveXattrs: false,
      numericOwner: false,
      verify: false,
      useStdinStdout: false,
      targetDir: "",
      stripComponents: 0,
      excludeFile: "",
      format: "default",
      showTotals: false,
    },
  },
  {
    id: "create-xz-best-ratio",
    label: "Create tar.xz (best ratio)",
    description: "Create an xz-compressed archive — best compression ratio for software distribution.",
    config: {
      mode: "create",
      compression: "xz",
      verbose: true,
      archiveName: "release.tar.xz",
      files: ["./dist"],
      preservePermissions: false,
      preserveXattrs: false,
      numericOwner: false,
      verify: false,
      useStdinStdout: false,
      targetDir: "",
      stripComponents: 0,
      excludes: [],
      excludeFile: "",
      format: "posix",
      showTotals: true,
    },
  },
  {
    id: "create-zstd",
    label: "Create tar.zst (modern, fast)",
    description: "Use zstd for fast modern compression. Requires GNU tar ≥ 1.31 or BSD tar.",
    config: {
      mode: "create",
      compression: "zstd",
      verbose: true,
      archiveName: "snapshot.tar.zst",
      files: ["./project"],
      preservePermissions: false,
      preserveXattrs: false,
      numericOwner: false,
      verify: false,
      useStdinStdout: false,
      targetDir: "",
      stripComponents: 0,
      excludes: [],
      excludeFile: "",
      format: "default",
      showTotals: false,
    },
  },
  {
    id: "create-preserve-perms",
    label: "Extract preserving permissions",
    description: "Extract while preserving file permissions, ownership, and xattrs (system backup restore).",
    config: {
      mode: "extract",
      compression: "gzip",
      verbose: true,
      archiveName: "backup.tar.gz",
      files: [],
      targetDir: "/",
      stripComponents: 0,
      preservePermissions: true,
      preserveXattrs: true,
      numericOwner: true,
      verify: false,
      useStdinStdout: false,
      excludes: [],
      excludeFile: "",
      format: "default",
      showTotals: false,
    },
  },
  {
    id: "create-plain",
    label: "Create uncompressed .tar",
    description: "Plain tarball — no compression. Fastest to create; pipe through gzip/xz separately if needed.",
    config: {
      mode: "create",
      compression: "none",
      verbose: true,
      archiveName: "archive.tar",
      files: ["./data"],
      preservePermissions: false,
      preserveXattrs: false,
      numericOwner: false,
      verify: false,
      useStdinStdout: false,
      targetDir: "",
      stripComponents: 0,
      excludes: [],
      excludeFile: "",
      format: "default",
      showTotals: false,
    },
  },
  {
    id: "create-verify",
    label: "Create & verify archive",
    description: "Create an archive and verify it after writing (--verify requires GNU tar and uncompressed mode supported).",
    config: {
      mode: "create",
      compression: "none",
      verbose: true,
      archiveName: "important.tar",
      files: ["./data"],
      verify: true,
      preservePermissions: false,
      preserveXattrs: false,
      numericOwner: false,
      useStdinStdout: false,
      targetDir: "",
      stripComponents: 0,
      excludes: [],
      excludeFile: "",
      format: "default",
      showTotals: false,
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

/** Normalize an archive name (trim, collapse spaces). */
export function normalizeArchiveName(s: string): string {
  return (s || "").trim();
}

/** Suggest the canonical archive name based on compression choice. */
export function suggestArchiveName(compression: TarCompression, base: string = "archive"): string {
  const ext = COMPRESSION_INFO[compression].extension;
  return `${base}${ext}`;
}

/** Check whether a name already has a matching extension. */
export function hasMatchingExtension(name: string, compression: TarCompression): boolean {
  const n = name.toLowerCase();
  const ext = COMPRESSION_INFO[compression].extension.toLowerCase();
  const short = ext === ".tar.gz" ? ".tgz"
    : ext === ".tar.bz2" ? ".tbz2"
    : ext === ".tar.xz" ? ".txz"
    : ext === ".tar.zst" ? ".tzst"
    : ext;
  return n.endsWith(ext) || n.endsWith(short);
}

/** Split a comma- or newline-separated list of excludes/files. */
export function parseList(input: string): string[] {
  if (!input) return [];
  return input
    .split(/[\n,]+/)
    .map((s) => s.trim())
    .filter(Boolean);
}

// ---- Build the command ----

/** Build the tar command from the config. */
export function buildCommand(config: BuilderConfig): BuiltCommand {
  const parts: string[] = ["tar"];
  const notes: string[] = [];
  const warnings: string[] = [];

  // 1) Mode letter.
  const modeLetter = MODE_LETTER[config.mode];
  const shortFlags: string[] = [modeLetter];

  // 2) Compression flag (short for z/j/J, long for zstd).
  const compInfo = COMPRESSION_INFO[config.compression];
  if (compInfo.shortFlag) shortFlags.push(compInfo.shortFlag);

  // 3) Verbose.
  if (config.verbose) shortFlags.push("v");

  // 4) Preserve permissions (extract: -p).
  if (config.preservePermissions && config.mode === "extract") shortFlags.push("p");

  // 5) Use stdin/stdout (-O for extract to stdout; -O is also a long form for create to stdout).
  if (config.useStdinStdout) shortFlags.push("O");

  // 6) f must precede the archive name.
  shortFlags.push("f");
  parts.push(`-${shortFlags.join("")}`);

  // Format selector (long flag — placed before archive name).
  if (config.format !== "default") {
    parts.push(`--format=${config.format}`);
  }

  // Long compression flag for zstd (no short).
  if (config.compression === "zstd") {
    parts.push("--zstd");
    notes.push("--zstd requires GNU tar ≥ 1.31 (or BSD tar / libarchive). On older systems install zstd and pipe: `tar -cf - ./dir | zstd > archive.tar.zst`.");
  }

  // Preserve xattrs / numeric-owner (long flags).
  if (config.preserveXattrs) {
    parts.push("--xattrs");
    notes.push("--xattrs preserves extended attributes (GNU tar). Add --acls for POSIX ACLs. BSD tar uses -p for this.");
  }
  if (config.numericOwner) {
    parts.push("--numeric-owner");
    notes.push("--numeric-owner restores owner by UID/GID instead of user/group name. Useful when restoring on a system where the names differ.");
  }

  // Verify (GNU, create-only).
  if (config.verify) {
    if (config.mode === "create") {
      parts.push("--verify");
      notes.push("--verify (-W) compares the archive against the source after creation. GNU tar only; needs uncompressed or seeks-compressed support.");
      if (config.compression !== "none") {
        warnings.push("--verify cannot be combined with compression in older GNU tar; consider verifying manually with `tar -tf`.");
      }
    } else {
      warnings.push("--verify is only meaningful in create mode; ignored here.");
    }
  }

  // Totals (create-only).
  if (config.showTotals && config.mode === "create") {
    parts.push("--totals");
    notes.push("--totals prints the total bytes transferred at the end.");
  }

  // Excludes (long flags, BEFORE the archive name? Actually GNU tar: --exclude can come anywhere; convention is before files).
  for (const ex of config.excludes) {
    parts.push(`--exclude=${shellQuote(ex)}`);
    notes.push(`--exclude=${ex} skips entries matching this pattern. Pattern matches against the full path stored in the archive.`);
  }
  if (config.excludeFile) {
    parts.push(`-X`, shellQuote(config.excludeFile));
    notes.push(`-X ${config.excludeFile} reads exclude patterns (one per line) from a file.`);
  }

  // Strip-components (extract / list only).
  if (config.stripComponents > 0) {
    if (config.mode === "extract" || config.mode === "list") {
      parts.push(`--strip-components=${config.stripComponents}`);
      notes.push(`--strip-components=${config.stripComponents} removes ${config.stripComponents} leading path element(s) on extract/list. Useful for dropping a top-level wrapper directory.`);
    } else {
      warnings.push("--strip-components only applies to extract/list mode; ignored here.");
    }
  }

  // Archive name (after `f`).
  const archiveName = normalizeArchiveName(config.archiveName);
  if (!archiveName) {
    warnings.push("Archive name is empty — using '-' (stdin/stdout). Add a filename or enable stdin/stdout mode.");
    parts.push("-");
  } else {
    parts.push(shellQuote(archiveName));
    // Compression/extension mismatch warning.
    if (!hasMatchingExtension(archiveName, config.compression)) {
      const suggested = suggestArchiveName(config.compression, archiveName.replace(/\.tar.*$/, "").replace(/\.tgz$|\.tbz2?$|\.txz$|\.tzst$/, "") || "archive");
      warnings.push(`Archive name "${archiveName}" does not match ${config.compression} extension. Suggested: "${suggested}".`);
    }
  }

  // Append mode cannot combine with compression.
  if (config.mode === "append" && config.compression !== "none") {
    warnings.push("Cannot append to a COMPRESSED archive — tar compresses the whole stream. Use uncompressed (.tar) for append, or re-create the archive.");
  }

  // Mode-specific trailing args.
  if (config.mode === "create" || config.mode === "append") {
    if (config.files.length === 0) {
      warnings.push(`No files specified for ${config.mode} mode. tar will read from stdin or do nothing.`);
    } else {
      for (const f of config.files) parts.push(shellQuote(f));
    }
  }

  // -C target dir (extract / list — and create where the dir context applies). Convention: -C goes AFTER the archive name and BEFORE the file list for create.
  if (config.targetDir) {
    if (config.mode === "extract" || config.mode === "list") {
      parts.push("-C", shellQuote(config.targetDir));
      notes.push(`-C ${config.targetDir} changes to this directory before extracting/listing. Must come AFTER the archive name.`);
    } else if (config.mode === "create") {
      // For create, -C is placed BEFORE the file list (handled here, but files already added above; move them).
      // Simpler: we already added files; warn user about ordering.
      notes.push(`Note: for create with -C, GNU tar expects '-C <dir> <files>' BEFORE the file list. The generated command shows the target dir AFTER the files; consider reordering manually.`);
      warnings.push("For create mode with -C, the canonical order is `tar -cf out.tar -C <dir> <files>`. The generated command places -C after files; verify before running.");
    }
  }

  // Tar-bomb guard for extract without -C.
  if (config.mode === "extract" && !config.targetDir) {
    warnings.push("Extracting without -C may scatter files into the cwd (tar-bomb risk). Recommended: 'tar -tf' first, then 'mkdir out && tar -xf archive -C out'.");
  }

  // Absolute-path / ../ detection on files (create mode).
  if (config.mode === "create") {
    for (const f of config.files) {
      if (f.startsWith("/")) {
        warnings.push(`Absolute path "${f}" — tar will strip leading '/' by default. Consider using a relative path.`);
      } else if (f.includes("/../") || f === ".." || f.startsWith("../")) {
        warnings.push(`Path "${f}" contains '..' — tar will refuse to write files outside the current directory by default (good).`);
      }
    }
  }

  return { command: parts.join(" "), notes, warnings };
}

/** Plain-English summary of the command's intent. */
export function explainIntent(config: BuilderConfig): string {
  const modeVerb: Record<TarMode, string> = {
    create: "Create a new archive",
    extract: "Extract an archive",
    list: "List the contents of an archive",
    append: "Append files to an archive",
  };
  const compLabel: Record<TarCompression, string> = {
    none: "uncompressed",
    gzip: "gzip-compressed",
    bzip2: "bzip2-compressed",
    xz: "xz/LZMA-compressed",
    zstd: "zstd-compressed",
  };
  const bits: string[] = [];
  bits.push(`${modeVerb[config.mode]} (${MODE_LETTER[config.mode]}) — ${compLabel[config.compression]}.`);
  if (config.verbose) bits.push("List each file as it's processed (-v).");
  if (config.preservePermissions && config.mode === "extract") bits.push("Preserve file permissions on extract (-p).");
  if (config.preserveXattrs) bits.push("Preserve extended attributes (--xattrs).");
  if (config.numericOwner) bits.push("Restore owner by UID/GID (--numeric-owner).");
  if (config.verify && config.mode === "create") bits.push("Verify the archive after creation (--verify).");
  if (config.showTotals && config.mode === "create") bits.push("Print total bytes (--totals).");
  if (config.excludes.length > 0) bits.push(`Exclude patterns: ${config.excludes.join(", ")}.`);
  if (config.excludeFile) bits.push(`Read excludes from ${config.excludeFile} (-X).`);
  if (config.stripComponents > 0) bits.push(`Strip ${config.stripComponents} leading path element(s) on extract.`);
  if (config.targetDir && (config.mode === "extract" || config.mode === "list")) bits.push(`Extract into ${config.targetDir} (-C).`);
  if (config.format !== "default") bits.push(`Use tar format: ${config.format}.`);
  bits.push(`Archive name: ${normalizeArchiveName(config.archiveName) || "(none)"}.`);
  if (config.mode === "create" || config.mode === "append") {
    bits.push(`Files: ${config.files.length === 0 ? "(none — reads stdin)" : config.files.join(", ")}.`);
  }
  return bits.join(" ");
}

/** Per-flag explanations for the active config. */
export function explainFlags(config: BuilderConfig): FlagExplanation[] {
  const out: FlagExplanation[] = [];
  out.push({
    flag: `-${MODE_LETTER[config.mode]}`,
    explanation: `Mode letter: ${MODE_LABELS[config.mode].split(" — ")[0]}. Must precede the archive name (and the f letter).`,
  });
  if (config.compression !== "none") {
    const ci = COMPRESSION_INFO[config.compression];
    out.push({
      flag: ci.shortFlag ? `-${ci.shortFlag}` : ci.flag,
      explanation: `${ci.label}: ${ci.hint}`,
    });
  }
  if (config.verbose) {
    out.push({ flag: "-v", explanation: "Verbose — list each file as it's processed." });
  }
  if (config.preservePermissions) {
    if (config.mode === "extract") {
      out.push({ flag: "-p", explanation: "Preserve file permissions (mode bits) on extract. Created files keep their stored perms even with restrictive umask." });
    } else {
      out.push({ flag: "(implicit)", explanation: "tar always stores permissions on create; -p only matters on extract." });
    }
  }
  if (config.preserveXattrs) {
    out.push({ flag: "--xattrs", explanation: "Store/restore extended attributes (xattrs). GNU tar only. Use --acls for POSIX ACLs too." });
  }
  if (config.numericOwner) {
    out.push({ flag: "--numeric-owner", explanation: "Use numeric UID/GID instead of resolving names. Restores correctly when the destination lacks matching user/group names." });
  }
  if (config.verify && config.mode === "create") {
    out.push({ flag: "--verify / -W", explanation: "After writing, re-read the archive and compare with the source. Catches media-write errors. GNU tar only." });
  }
  if (config.showTotals && config.mode === "create") {
    out.push({ flag: "--totals", explanation: "Print total bytes written at the end." });
  }
  out.push({ flag: "-f <archive>", explanation: "Use the next argument as the archive filename. Must come before the filename. Use '-' for stdin/stdout." });
  if (config.format !== "default") {
    out.push({ flag: `--format=${config.format}`, explanation: `Select the tar format: ${FORMAT_LABELS[config.format]}. posix/pax handle long filenames and large UIDs.` });
  }
  for (const ex of config.excludes) {
    out.push({ flag: `--exclude=${ex}`, explanation: `Skip entries matching this glob. Patterns match against the path stored in the archive.` });
  }
  if (config.excludeFile) {
    out.push({ flag: `-X ${config.excludeFile}`, explanation: "Read exclude patterns from a file, one per line." });
  }
  if (config.stripComponents > 0) {
    out.push({ flag: `--strip-components=${config.stripComponents}`, explanation: `Drop ${config.stripComponents} leading path element(s) on extract/list. Drops the wrapping directory.` });
  }
  if (config.targetDir && (config.mode === "extract" || config.mode === "list")) {
    out.push({ flag: `-C ${config.targetDir}`, explanation: "Change to this directory before extracting. Must come AFTER the archive name." });
  }
  if (config.useStdinStdout) {
    out.push({ flag: "-O", explanation: "Extract files to stdout (or create from a list with -T -)." });
  }
  return out;
}

/** Validate the config; return errors + warnings. */
export function validateConfig(config: BuilderConfig): { errors: string[]; warnings: string[] } {
  const errors: string[] = [];
  const warnings: string[] = [];
  if (config.mode === "create" || config.mode === "append") {
    if (config.files.length === 0 && !config.useStdinStdout) {
      warnings.push(`No files specified for ${config.mode} mode.`);
    }
  }
  if (config.mode === "append" && config.compression !== "none") {
    warnings.push("Cannot append to a compressed archive. Use uncompressed .tar or re-create the archive.");
  }
  if (!normalizeArchiveName(config.archiveName) && !config.useStdinStdout) {
    warnings.push("Archive name is empty.");
  } else if (normalizeArchiveName(config.archiveName) && !hasMatchingExtension(config.archiveName, config.compression)) {
    warnings.push(`Archive name "${config.archiveName}" does not match the ${config.compression} extension (${COMPRESSION_INFO[config.compression].extension}).`);
  }
  if (config.mode === "extract" && !config.targetDir) {
    warnings.push("Extracting without -C risks a tar bomb — scatter files into cwd. Recommended: list first, then extract into a fresh dir.");
  }
  if (config.verify && config.mode !== "create") {
    warnings.push("--verify only works in create mode; ignored.");
  }
  if (config.stripComponents > 0 && !(config.mode === "extract" || config.mode === "list")) {
    warnings.push("--strip-components only works in extract/list mode; ignored.");
  }
  for (const f of config.files) {
    if (f.startsWith("/")) warnings.push(`Absolute path "${f}" — leading '/' stripped by default; use a relative path.`);
  }
  return { errors, warnings };
}

/** Render recipes as plain text for download. */
export function renderRecipesText(): string {
  return RECIPES.map((r) => {
    const c = { ...DEFAULT_CONFIG, ...r.config } as BuilderConfig;
    const built = buildCommand(c);
    return `${r.label}\n  ${r.description}\n  ${built.command}`;
  }).join("\n\n");
}

// ---- History (localStorage) ----

const HISTORY_KEY = "unqtools:tar-archive-command-builder:history";
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
  params.set("m", config.mode);
  params.set("c", config.compression);
  if (config.verbose) params.set("v", "1");
  if (config.preservePermissions) params.set("p", "1");
  if (config.preserveXattrs) params.set("x", "1");
  if (config.numericOwner) params.set("n", "1");
  if (config.verify) params.set("w", "1");
  if (config.useStdinStdout) params.set("O", "1");
  if (config.showTotals) params.set("T", "1");
  if (config.archiveName) params.set("a", config.archiveName);
  if (config.files.length > 0) params.set("f", config.files.join(","));
  if (config.targetDir) params.set("d", config.targetDir);
  if (config.stripComponents > 0) params.set("s", String(config.stripComponents));
  if (config.excludes.length > 0) params.set("e", config.excludes.join(","));
  if (config.excludeFile) params.set("X", config.excludeFile);
  if (config.format !== "default") params.set("fmt", config.format);
  if (typeof window === "undefined") return `?${params.toString()}`;
  return `${window.location.origin}${window.location.pathname}#${params.toString()}`;
}

export function parseShareUrl(hash: string): { config: Partial<BuilderConfig> } {
  const clean = hash.startsWith("#") ? hash.slice(1) : hash;
  if (!clean) return { config: {} };
  const params = new URLSearchParams(clean);
  const config: Partial<BuilderConfig> = {};
  const m = params.get("m") as TarMode | null;
  if (m && ["create", "extract", "list", "append"].includes(m)) config.mode = m;
  const c = params.get("c") as TarCompression | null;
  if (c && ["none", "gzip", "bzip2", "xz", "zstd"].includes(c)) config.compression = c;
  if (params.get("v") === "1") config.verbose = true;
  if (params.get("p") === "1") config.preservePermissions = true;
  if (params.get("x") === "1") config.preserveXattrs = true;
  if (params.get("n") === "1") config.numericOwner = true;
  if (params.get("w") === "1") config.verify = true;
  if (params.get("O") === "1") config.useStdinStdout = true;
  if (params.get("T") === "1") config.showTotals = true;
  if (params.has("a")) config.archiveName = params.get("a")!;
  if (params.has("f")) config.files = params.get("f")!.split(",").filter(Boolean);
  if (params.has("d")) config.targetDir = params.get("d")!;
  if (params.has("s")) config.stripComponents = Math.max(0, parseInt(params.get("s")!, 10) || 0);
  if (params.has("e")) config.excludes = params.get("e")!.split(",").filter(Boolean);
  if (params.has("X")) config.excludeFile = params.get("X")!;
  const fmt = params.get("fmt") as TarFormat | null;
  if (fmt && ["default", "gnu", "posix", "ustar", "pax"].includes(fmt)) config.format = fmt;
  return { config };
}
