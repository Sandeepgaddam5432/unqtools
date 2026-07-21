/**
 * Shell Command Explainer — pure logic.
 *
 * Tokenize a shell command line and explain each token from a bundled
 * offline manpage/tldr dataset. Shell-grammar-aware: handles quotes,
 * escapes, combined short flags, flags that take a value, pipelines,
 * redirections, the &&/||/;/& operators, subcommand awareness
 * (git log, docker run), and a danger linter for destructive commands.
 * 100% client-side; the pasted command never leaves the browser.
 */

// ---------------------------------------------------------------------------
// Public types
// ---------------------------------------------------------------------------

export type Variant = "gnu" | "bsd";

export type TokenType =
  | "command"        // first token of a stage (or after `|`, `&&`, etc.)
  | "subcommand"     // recognized subcommand (git log, docker run)
  | "short-flag"     // -l
  | "long-flag"      // --long
  | "combined-flag"  // -la (will be split)
  | "flag-value"     // value consumed by a previous flag
  | "positional"     // a bare argument
  | "operator"       // |, &&, ||, ;, &
  | "redirect"       // >, >>, <, 2>, 2>&1, &>
  | "redirect-target" // path following a redirect
  | "pipe";          // |

export interface Token {
  /** Raw text as it appears in the input. */
  raw: string;
  /** Token type. */
  type: TokenType;
  /** Position (0-based char offset) in the original input. */
  start: number;
  /** Length in chars. */
  length: number;
}

export interface ExplainedToken extends Token {
  /** Human-readable description (empty if unknown). */
  description: string;
  /** Whether this token is the command for its stage. */
  isCommand: boolean;
  /** Whether this token is unrecognized / not in dataset. */
  unknown: boolean;
  /** Whether this token is flagged dangerous. */
  danger: boolean;
  /** Danger message (when danger=true). */
  dangerMessage?: string;
}

export interface PipelineStage {
  /** Tokens belonging to this stage (excludes the trailing operator). */
  tokens: Token[];
  /** Command name (first token's raw), or "" if empty. */
  commandName: string;
  /** Subcommand name (e.g. `log` for `git log`), or "". */
  subcommandName: string;
  /** Operator that ends this stage (|, &&, ||, ;, &, or "" for last). */
  trailingOperator: string;
}

export interface ParsedCommand {
  stages: PipelineStage[];
  /** All tokens in order (including operators/redirects). */
  tokens: Token[];
  /** Whether any stage had an unrecognized command. */
  hasUnknown: boolean;
}

export interface DangerWarning {
  level: "danger" | "warning" | "caution";
  message: string;
  /** Stage index the danger applies to, or -1 for whole-line. */
  stageIndex: number;
}

export interface ExplainResult {
  parsed: ParsedCommand;
  /** Per-stage explained tokens (aligned with parsed.stages). */
  explained: ExplainedToken[][];
  /** Whole-line plain-English summary. */
  summary: string;
  /** Detected dangers. */
  dangers: DangerWarning[];
  /** Variant used. */
  variant: Variant;
}

// ---------------------------------------------------------------------------
// Command reference database (curated, offline)
// ---------------------------------------------------------------------------

export interface FlagRef {
  short?: string;
  long?: string;
  /** Plain-English explanation. */
  description: string;
  /** Whether this flag consumes the next argument as its value. */
  takesValue?: boolean;
  /** Variant restriction (gnu-only / bsd-only). */
  variant?: Variant;
}

export interface CommandRef {
  name: string;
  summary: string;
  danger?: "destructive" | "caution";
  /** Per-flag metadata. */
  flags: FlagRef[];
  /** Subcommands (e.g. git log, docker run). */
  subcommands?: Record<string, { summary: string; flags?: FlagRef[] }>;
  /** Common examples. */
  examples?: { command: string; description: string }[];
}

export const COMMAND_DATABASE: CommandRef[] = [
  {
    name: "ls",
    summary: "List directory contents.",
    flags: [
      { short: "l", long: "long-listing", description: "Long listing format: permissions, links, owner, group, size, date, name." },
      { short: "a", long: "all", description: "Show entries starting with '.' (hidden files)." },
      { short: "A", long: "almost-all", description: "Like -a but don't show . and .." },
      { short: "h", long: "human-readable", description: "Print sizes in human-readable units (K, M, G)." },
      { short: "r", long: "reverse", description: "Reverse sort order." },
      { short: "t", description: "Sort by modification time (newest first)." },
      { short: "S", description: "Sort by file size (largest first)." },
      { short: "R", long: "recursive", description: "List subdirectories recursively." },
      { short: "d", long: "directory", description: "List directories themselves, not their contents." },
      { short: "i", long: "inode", description: "Print the index number of each file." },
      { short: "1", description: "One file per line." },
      { long: "color", description: "Colorize the output (when, always, auto, never)." },
    ],
  },
  {
    name: "cd",
    summary: "Change the current working directory.",
    flags: [
      { long: "help", description: "Display help and exit." },
    ],
  },
  {
    name: "cp",
    summary: "Copy files and directories.",
    flags: [
      { short: "r", long: "recursive", description: "Copy directories recursively." },
      { short: "R", long: "recursive", description: "Copy directories recursively (same as -r)." },
      { short: "i", long: "interactive", description: "Prompt before overwrite." },
      { short: "f", long: "force", description: "If an existing dest cannot be opened, remove it and retry." },
      { short: "v", long: "verbose", description: "Explain what is being done." },
      { short: "p", long: "preserve", description: "Preserve mode, ownership, timestamps." },
      { short: "n", long: "no-clobber", description: "Do not overwrite an existing file." },
      { short: "u", long: "update", description: "Copy only when source is newer than dest." },
      { long: "no-preserve", description: "Don't preserve the specified attributes.", takesValue: true },
    ],
  },
  {
    name: "mv",
    summary: "Move or rename files.",
    flags: [
      { short: "i", long: "interactive", description: "Prompt before overwrite." },
      { short: "f", long: "force", description: "Do not prompt before overwriting." },
      { short: "v", long: "verbose", description: "Explain what is being done." },
      { short: "n", long: "no-clobber", description: "Do not overwrite an existing file." },
      { short: "u", long: "update", description: "Move only when source is newer than dest." },
    ],
  },
  {
    name: "rm",
    summary: "Remove files or directories. DESTRUCTIVE — once removed, files are gone (no recycle bin on most filesystems).",
    danger: "destructive",
    flags: [
      { short: "r", long: "recursive", description: "Remove directories and their contents recursively." },
      { short: "R", long: "recursive", description: "Remove directories recursively (BSD alias)." },
      { short: "f", long: "force", description: "Ignore nonexistent files and never prompt." },
      { short: "i", long: "interactive", description: "Prompt before every removal." },
      { short: "I", description: "Prompt ONCE before removing 3+ files or recursively." },
      { short: "v", long: "verbose", description: "Explain what is being done." },
      { short: "d", long: "dir", description: "Remove empty directories." },
      { long: "no-preserve-root", description: "Do not treat '/' specially (DANGEROUS — lets you rm -rf /)." },
      { long: "preserve-root", description: "Do not remove '/' (default)." },
    ],
  },
  {
    name: "mkdir",
    summary: "Create directories.",
    flags: [
      { short: "p", long: "parents", description: "Create parent directories as needed; no error if exists." },
      { short: "v", long: "verbose", description: "Print a message for each created directory." },
      { short: "m", long: "mode", description: "Set file mode (as in chmod).", takesValue: true },
    ],
  },
  {
    name: "rmdir",
    summary: "Remove empty directories.",
    flags: [
      { short: "p", long: "parents", description: "Remove DIRECTORY and its ancestors (if empty)." },
      { short: "v", long: "verbose", description: "Verbose output." },
    ],
  },
  {
    name: "ln",
    summary: "Make links between files.",
    flags: [
      { short: "s", long: "symbolic", description: "Make a symbolic link (instead of a hard link)." },
      { short: "f", long: "force", description: "Remove existing destination files." },
      { short: "i", long: "interactive", description: "Prompt before removing destination." },
      { short: "v", long: "verbose", description: "Print name of each linked file." },
      { short: "n", long: "no-dereference", description: "Treat LINK_NAME as a normal file if it's a symlink to a dir." },
    ],
  },
  {
    name: "chmod",
    summary: "Change file mode (permissions) bits.",
    flags: [
      { short: "R", long: "recursive", description: "Change files and directories recursively." },
      { short: "v", long: "verbose", description: "Output a diagnostic for every file processed." },
      { short: "c", long: "changes", description: "Like verbose but report only when a change is made." },
      { short: "f", long: "silent", description: "Suppress most error messages." },
      { long: "reference", description: "Use MODE from REFERENCE_FILE.", takesValue: true },
    ],
  },
  {
    name: "chown",
    summary: "Change file owner and group.",
    flags: [
      { short: "R", long: "recursive", description: "Operate on files and directories recursively." },
      { short: "v", long: "verbose", description: "Diagnostic for every file processed." },
      { short: "c", long: "changes", description: "Like verbose but only when changed." },
      { short: "f", long: "silent", description: "Suppress most error messages." },
      { long: "reference", description: "Use owner:group from REFERENCE_FILE.", takesValue: true },
      { short: "h", long: "no-dereference", description: "Affect symlinks themselves instead of their targets." },
    ],
  },
  {
    name: "find",
    summary: "Search for files in a directory hierarchy.",
    flags: [
      { short: "L", description: "Follow symbolic links." },
      { short: "P", description: "Never follow symbolic links (default)." },
      { short: "H", description: "Follow command-line symlinks only." },
      { long: "name", description: "Base of file name matches shell PATTERN.", takesValue: true },
      { long: "iname", description: "Like -name but case-insensitive.", takesValue: true },
      { long: "path", description: "Full path matches PATTERN.", takesValue: true },
      { long: "type", description: "File type: f (file), d (dir), l (symlink), b, c, p, s.", takesValue: true },
      { long: "size", description: "File uses N units of space (c/k/M/G).", takesValue: true },
      { long: "mtime", description: "Modified N*24 hours ago.", takesValue: true },
      { long: "mmin", description: "Modified N minutes ago.", takesValue: true },
      { long: "perm", description: "Permission bits match MODE.", takesValue: true },
      { long: "user", description: "Owned by USER.", takesValue: true },
      { long: "group", description: "Belongs to GROUP.", takesValue: true },
      { long: "exec", description: "Execute COMMAND on each match; terminate with \\;", takesValue: true },
      { long: "execdir", description: "Like -exec but cd into the file's dir first.", takesValue: true },
      { long: "delete", description: "Delete matched files (DANGEROUS — implies -depth)." },
      { long: "print", description: "Print the path (default action)." },
      { long: "print0", description: "Print paths separated by NUL (for xargs -0)." },
      { long: "maxdepth", description: "Descend at most N levels.", takesValue: true },
      { long: "mindepth", description: "Don't apply tests above N levels.", takesValue: true },
      { short: "!", description: "Negate the next test." },
      { short: "a", description: "AND (default between tests)." },
      { short: "o", description: "OR." },
    ],
  },
  {
    name: "grep",
    summary: "Print lines matching a pattern.",
    flags: [
      { short: "i", long: "ignore-case", description: "Case-insensitive match." },
      { short: "v", long: "invert-match", description: "Invert match (select non-matching lines)." },
      { short: "r", long: "recursive", description: "Read all files under each directory, recursively." },
      { short: "R", long: "dereference-recursive", description: "Like -r but follow all symlinks." },
      { short: "l", long: "files-with-matches", description: "Print only filenames of matching files." },
      { short: "L", long: "files-without-match", description: "Print only filenames of non-matching files." },
      { short: "n", long: "line-number", description: "Prefix each line with its 1-based line number." },
      { short: "c", long: "count", description: "Print only a count of matching lines per file." },
      { short: "w", long: "word-regexp", description: "Match only whole words." },
      { short: "x", long: "line-regexp", description: "Match only whole lines." },
      { short: "e", long: "regexp", description: "Specify PATTERN (useful when starting with -).", takesValue: true },
      { short: "E", long: "extended-regexp", description: "Interpret PATTERN as an extended regular expression." },
      { short: "F", long: "fixed-strings", description: "Interpret PATTERN as fixed strings (literal)." },
      { short: "P", long: "perl-regexp", description: "Interpret PATTERN as a Perl-compatible regex." },
      { short: "o", long: "only-matching", description: "Print only the matched (non-empty) parts." },
      { short: "A", description: "Print N lines of trailing context.", takesValue: true },
      { short: "B", description: "Print N lines of leading context.", takesValue: true },
      { short: "C", description: "Print N lines of output context.", takesValue: true },
      { short: "q", long: "quiet", description: "Suppress normal output (use exit status)." },
      { long: "color", description: "Colorize matches." },
      { long: "exclude", description: "Skip files matching GLOB.", takesValue: true },
      { long: "include", description: "Search only files matching GLOB.", takesValue: true },
    ],
  },
  {
    name: "sed",
    summary: "Stream editor for filtering and transforming text.",
    flags: [
      { short: "n", long: "quiet", description: "Suppress automatic pattern-space printing." },
      { short: "i", long: "in-place", description: "Edit files in place (optional SUFFIX for backup)." },
      { short: "e", long: "expression", description: "Add SCRIPT to the commands.", takesValue: true },
      { short: "f", long: "file", description: "Add commands from FILE.", takesValue: true },
      { short: "E", long: "extended-regexp", description: "Use extended regex." },
      { short: "r", description: "Use extended regex (GNU alias for -E)." },
    ],
  },
  {
    name: "awk",
    summary: "Pattern scanning and processing language.",
    flags: [
      { short: "F", description: "Set field separator.", takesValue: true },
      { short: "v", description: "Assign VAR=VALUE before running.", takesValue: true },
      { short: "f", description: "Read program from FILE.", takesValue: true },
    ],
  },
  {
    name: "tar",
    summary: "Tape archive: bundle files into one archive, with optional compression.",
    flags: [
      { short: "c", long: "create", description: "Create a new archive." },
      { short: "x", long: "extract", description: "Extract files from an archive." },
      { short: "t", long: "list", description: "List archive contents." },
      { short: "v", long: "verbose", description: "Verbosely list files processed." },
      { short: "f", long: "file", description: "Use ARCHIVE file (next arg) — required for non-tape.", takesValue: true },
      { short: "z", long: "gzip", description: "Filter through gzip (.tar.gz)." },
      { short: "j", long: "bzip2", description: "Filter through bzip2 (.tar.bz2)." },
      { short: "J", long: "xz", description: "Filter through xz (.tar.xz)." },
      { short: "C", description: "Change to DIR before extracting.", takesValue: true },
      { short: "p", long: "preserve-permissions", description: "Extract all protection info." },
      { short: "r", long: "append", description: "Append files to end of archive." },
      { short: "u", long: "update", description: "Append files newer than copy in archive." },
      { short: "A", long: "catenate", description: "Append tar file to archive." },
      { short: "d", long: "diff", description: "Find differences between archive and file system." },
      { long: "exclude", description: "Exclude files matching PATTERN.", takesValue: true },
    ],
  },
  {
    name: "gzip",
    summary: "Compress files (replaces each FILE with FILE.gz).",
    flags: [
      { short: "d", long: "decompress", description: "Decompress (same as gunzip)." },
      { short: "k", long: "keep", description: "Keep original files." },
      { short: "v", long: "verbose", description: "Verbose." },
      { short: "r", long: "recursive", description: "Operate recursively on directories." },
      { short: "1", description: "Fastest compression (least ratio)." },
      { short: "9", description: "Best compression (slowest)." },
    ],
  },
  {
    name: "gunzip",
    summary: "Decompress .gz files (gzip -d).",
    flags: [
      { short: "k", long: "keep", description: "Keep the compressed file." },
      { short: "v", long: "verbose", description: "Verbose." },
      { short: "r", long: "recursive", description: "Operate recursively on directories." },
    ],
  },
  {
    name: "cat",
    summary: "Concatenate files and print to stdout.",
    flags: [
      { short: "n", long: "number", description: "Number all output lines." },
      { short: "b", long: "number-nonblank", description: "Number non-empty lines." },
      { short: "s", long: "squeeze-blank", description: "Suppress repeated empty lines." },
      { short: "A", long: "show-all", description: "Equivalent to -vET." },
      { short: "E", long: "show-ends", description: "Display $ at end of each line." },
      { short: "T", long: "show-tabs", description: "Display TAB as ^I." },
    ],
  },
  {
    name: "head",
    summary: "Output the first part of files.",
    flags: [
      { short: "n", long: "lines", description: "Print the first N lines.", takesValue: true },
      { short: "c", long: "bytes", description: "Print the first N bytes.", takesValue: true },
      { short: "q", long: "quiet", description: "Never print headers giving file names." },
      { short: "v", long: "verbose", description: "Always print headers." },
    ],
  },
  {
    name: "tail",
    summary: "Output the last part of files; can follow in real-time.",
    flags: [
      { short: "n", long: "lines", description: "Print the last N lines.", takesValue: true },
      { short: "c", long: "bytes", description: "Print the last N bytes.", takesValue: true },
      { short: "f", long: "follow", description: "Append data as the file grows." },
      { short: "F", description: "Like -f but also retry if the file is rotated." },
      { short: "q", long: "quiet", description: "Suppress file-name headers." },
      { short: "v", long: "verbose", description: "Always print headers." },
    ],
  },
  {
    name: "wc",
    summary: "Print newline, word, and byte counts for each file.",
    flags: [
      { short: "l", long: "lines", description: "Print line count." },
      { short: "w", long: "words", description: "Print word count." },
      { short: "c", long: "bytes", description: "Print byte count." },
      { short: "m", long: "chars", description: "Print character count." },
      { short: "L", long: "max-line-length", description: "Print length of longest line." },
    ],
  },
  {
    name: "sort",
    summary: "Sort lines of text files.",
    flags: [
      { short: "n", long: "numeric-sort", description: "Compare by string numeric value." },
      { short: "r", long: "reverse", description: "Reverse the result of comparisons." },
      { short: "u", long: "unique", description: "Output only the first of an equal run." },
      { short: "k", long: "key", description: "Sort via KEY (field).", takesValue: true },
      { short: "t", long: "field-separator", description: "Use SEP as field separator.", takesValue: true },
      { short: "f", long: "ignore-case", description: "Fold lower to upper case." },
      { short: "g", long: "general-numeric-sort", description: "Compare by general numeric value." },
      { short: "V", long: "version-sort", description: "Natural version sort." },
    ],
  },
  {
    name: "uniq",
    summary: "Report or omit repeated lines (input must be sorted).",
    flags: [
      { short: "c", long: "count", description: "Prefix lines with the number of occurrences." },
      { short: "d", long: "repeated", description: "Only print duplicate lines." },
      { short: "u", long: "unique", description: "Only print unique lines." },
      { short: "i", long: "ignore-case", description: "Case-insensitive comparison." },
      { short: "f", long: "skip-fields", description: "Skip first N fields.", takesValue: true },
      { short: "s", long: "skip-chars", description: "Skip first N chars.", takesValue: true },
    ],
  },
  {
    name: "cut",
    summary: "Remove sections from each line of files.",
    flags: [
      { short: "d", long: "delimiter", description: "Use DELIM as field delimiter.", takesValue: true },
      { short: "f", long: "fields", description: "Select only these fields.", takesValue: true },
      { short: "c", long: "characters", description: "Select only these characters.", takesValue: true },
      { short: "b", long: "bytes", description: "Select only these bytes.", takesValue: true },
      { short: "s", long: "only-delimited", description: "Do not print lines without delimiter." },
    ],
  },
  {
    name: "tr",
    summary: "Translate or delete characters (reads stdin, writes stdout).",
    flags: [
      { short: "d", long: "delete", description: "Delete characters in SET1." },
      { short: "s", long: "squeeze-repeats", description: "Replace each run of repeated char with single occurrence." },
      { short: "c", long: "complement", description: "Use the complement of SET1." },
      { short: "t", long: "truncate-set1", description: "Truncate SET1 to length of SET2." },
    ],
  },
  {
    name: "tee",
    summary: "Read stdin and write to stdout AND files (T-pipe).",
    flags: [
      { short: "a", long: "append", description: "Append to the given files (don't overwrite)." },
      { short: "i", long: "ignore-interrupts", description: "Ignore interrupt signals." },
    ],
  },
  {
    name: "xargs",
    summary: "Build and execute command lines from stdin.",
    flags: [
      { short: "0", long: "null", description: "Items are separated by NUL (for find -print0)." },
      { short: "n", description: "Use at most MAX-ARGS per command line.", takesValue: true },
      { short: "I", description: "Replace STR in command with input items.", takesValue: true },
      { short: "p", long: "interactive", description: "Prompt before each execution." },
      { short: "t", long: "verbose", description: "Print the command before executing." },
      { short: "r", long: "no-run-if-empty", description: "Do nothing if stdin is empty." },
      { short: "P", description: "Run up to MAX-PROCS in parallel.", takesValue: true },
    ],
  },
  {
    name: "echo",
    summary: "Write arguments to stdout.",
    flags: [
      { short: "n", description: "Do not output the trailing newline." },
      { short: "e", description: "Enable interpretation of backslash escapes." },
      { short: "E", description: "Disable interpretation of backslash escapes (default)." },
    ],
  },
  {
    name: "printf",
    summary: "Format and print data (C-style).",
    flags: [],
  },
  {
    name: "touch",
    summary: "Update file timestamps; create empty files if missing.",
    flags: [
      { short: "a", description: "Change only access time." },
      { short: "m", description: "Change only modification time." },
      { short: "d", long: "date", description: "Parse STRING as a date.", takesValue: true },
      { short: "t", description: "Use STAMP [[CC]YY]MMDDhhmm[.ss].", takesValue: true },
      { short: "r", long: "reference", description: "Use FILE's times.", takesValue: true },
      { short: "c", long: "no-create", description: "Do not create any files." },
    ],
  },
  {
    name: "stat",
    summary: "Display file or filesystem status.",
    flags: [
      { short: "f", long: "file-system", description: "Display filesystem status." },
      { short: "c", long: "format", description: "Use FORMAT instead of default.", takesValue: true },
      { short: "L", long: "dereference", description: "Follow links." },
      { short: "t", long: "terse", description: "Terse format." },
    ],
  },
  {
    name: "df",
    summary: "Report filesystem disk space usage.",
    flags: [
      { short: "h", long: "human-readable", description: "Sizes in powers of 1024 (K, M, G)." },
      { short: "H", long: "si", description: "Sizes in powers of 1000 (K, M, G)." },
      { short: "i", long: "inodes", description: "List inode information." },
      { short: "T", long: "print-type", description: "Print filesystem type." },
      { short: "a", long: "all", description: "Include dummy filesystems." },
      { short: "l", long: "local", description: "Limit to local filesystems." },
    ],
  },
  {
    name: "du",
    summary: "Estimate file space usage.",
    flags: [
      { short: "h", long: "human-readable", description: "Sizes in K, M, G." },
      { short: "s", long: "summarize", description: "Total only (no per-subdir lines)." },
      { short: "a", long: "all", description: "Write counts for all files, not just dirs." },
      { short: "d", long: "max-depth", description: "Print at most N levels.", takesValue: true },
      { short: "c", long: "total", description: "Produce a grand total." },
      { short: "S", long: "separate-dirs", description: "Don't include size of subdirectories." },
    ],
  },
  {
    name: "dd",
    summary: "Convert and copy a file. RAW-DEVICE writes are extremely dangerous.",
    danger: "destructive",
    flags: [
      { long: "if", description: "Read from FILE (default: stdin).", takesValue: true },
      { long: "of", description: "Write to FILE (default: stdout).", takesValue: true },
      { long: "bs", description: "Read/write BYTES at a time.", takesValue: true },
      { long: "count", description: "Copy only N input blocks.", takesValue: true },
      { long: "skip", description: "Skip N input blocks.", takesValue: true },
      { long: "seek", description: "Skip N output blocks.", takesValue: true },
      { long: "status", description: "Progress level: none, noxfer, progress.", takesValue: true },
      { long: "conv", description: "Comma-separated conversions (e.g. notrunc, sync, fsync).", takesValue: true },
    ],
  },
  {
    name: "mkfs",
    summary: "Build a Linux filesystem on a device. DESTRUCTIVE — destroys existing data on the target.",
    danger: "destructive",
    flags: [
      { short: "t", long: "type", description: "Filesystem type (ext4, xfs, btrfs, ...).", takesValue: true },
      { long: "force", description: "Force creation even if device is not a block device." },
    ],
  },
  {
    name: "mount",
    summary: "Mount a filesystem.",
    flags: [
      { short: "t", description: "Filesystem type.", takesValue: true },
      { short: "o", description: "Mount options (comma-separated).", takesValue: true },
      { short: "r", long: "read-only", description: "Mount read-only." },
      { short: "a", long: "all", description: "Mount all filesystems from fstab." },
    ],
  },
  {
    name: "umount",
    summary: "Unmount filesystems.",
    flags: [
      { short: "f", long: "force", description: "Force unmount (NFS only)." },
      { short: "l", long: "lazy", description: "Lazy unmount: detach now, cleanup later." },
      { short: "a", long: "all", description: "Unmount all (except /proc)." },
    ],
  },
  {
    name: "ps",
    summary: "Report a snapshot of current processes.",
    flags: [
      { short: "e", description: "Select all processes." },
      { short: "A", description: "Select all processes (alias)." },
      { short: "a", description: "All with tty except session leaders (BSD)." },
      { short: "x", description: "Processes without controlling tty (BSD)." },
      { short: "u", description: "User-oriented format.", takesValue: true },
      { short: "f", long: "full", description: "Full-format listing (forest view)." },
      { short: "F", long: "extra-full", description: "Extra-full format." },
      { short: "l", long: "long", description: "Long format." },
      { short: "w", long: "wide", description: "Wide output (don't truncate)." },
      { short: "o", long: "format", description: "User-defined format.", takesValue: true },
      { short: "p", long: "pid", description: "Select by PID.", takesValue: true },
      { short: "C", description: "Select by command name.", takesValue: true },
      { long: "sort", description: "Sort by SPEC.", takesValue: true },
    ],
  },
  {
    name: "kill",
    summary: "Send a signal to a process.",
    flags: [
      { short: "s", description: "Specify the SIGNAL (name or number).", takesValue: true },
      { short: "l", long: "list", description: "List signal names." },
      { short: "L", description: "List signal names in a table." },
      { short: "9", description: "Signal 9 = SIGKILL (cannot be caught)." },
      { short: "15", description: "Signal 15 = SIGTERM (default, graceful)." },
    ],
  },
  {
    name: "killall",
    summary: "Kill processes by name.",
    flags: [
      { short: "i", long: "interactive", description: "Ask for confirmation before killing." },
      { short: "u", long: "user", description: "Kill only processes owned by USER.", takesValue: true },
      { short: "q", long: "quiet", description: "Don't complain if no processes killed." },
      { short: "v", long: "verbose", description: "Report if the signal was sent." },
      { short: "9", description: "Send SIGKILL instead of SIGTERM." },
    ],
  },
  {
    name: "top",
    summary: "Display Linux processes (interactive).",
    flags: [
      { short: "b", long: "batch-mode", description: "Batch mode (no interactivity)." },
      { short: "n", description: "Maximum N iterations.", takesValue: true },
      { short: "d", description: "Delay between updates.", takesValue: true },
      { short: "p", description: "Monitor PIDs.", takesValue: true },
      { short: "H", long: "threads", description: "Show threads." },
    ],
  },
  {
    name: "free",
    summary: "Display amount of free and used memory.",
    flags: [
      { short: "h", long: "human", description: "Show all output in human-readable units." },
      { short: "b", long: "bytes", description: "Show output in bytes." },
      { short: "k", long: "kilo", description: "Show in kibibytes." },
      { short: "m", long: "mega", description: "Show in mebibytes." },
      { short: "g", long: "giga", description: "Show in gibibytes." },
      { short: "s", description: "Repeat every N seconds.", takesValue: true },
      { short: "t", long: "total", description: "Show line for total = RAM + swap." },
    ],
  },
  {
    name: "uname",
    summary: "Print system information.",
    flags: [
      { short: "a", long: "all", description: "Print all information." },
      { short: "s", long: "kernel-name", description: "Print the kernel name." },
      { short: "n", long: "nodename", description: "Print the network node hostname." },
      { short: "r", long: "kernel-release", description: "Print the kernel release." },
      { short: "v", long: "kernel-version", description: "Print the kernel version." },
      { short: "m", long: "machine", description: "Print the machine hardware name." },
      { short: "p", long: "processor", description: "Print the processor type." },
    ],
  },
  {
    name: "whoami",
    summary: "Print the user name associated with the current effective user ID.",
    flags: [],
  },
  {
    name: "id",
    summary: "Print real and effective user and group IDs.",
    flags: [
      { short: "u", long: "user", description: "Print only the effective user ID." },
      { short: "g", long: "group", description: "Print only the effective group ID." },
      { short: "G", long: "groups", description: "Print all group IDs." },
      { short: "n", long: "name", description: "Print a name instead of a number (with -u/-g/-G)." },
      { short: "r", long: "real", description: "Print real ID instead of effective." },
    ],
  },
  {
    name: "sudo",
    summary: "Execute a command as another user (default root). Use with caution.",
    danger: "caution",
    flags: [
      { short: "u", long: "user", description: "Run as USER (default root).", takesValue: true },
      { short: "i", long: "login", description: "Start a login shell." },
      { short: "s", long: "shell", description: "Run a shell." },
      { short: "l", long: "list", description: "List allowed (and forbidden) commands." },
      { short: "k", long: "reset-timestamp", description: "Invalidate timestamp (require password next time)." },
      { short: "v", long: "validate", description: "Update timestamp without running a command." },
      { short: "E", long: "preserve-env", description: "Preserve user environment." },
      { short: "A", long: "askpass", description: "Use a helper program for password." },
    ],
  },
  {
    name: "su",
    summary: "Switch user (default root).",
    flags: [
      { short: "l", long: "login", description: "Start a login shell." },
      { short: "c", long: "command", description: "Pass COMMAND to the shell.", takesValue: true },
      { short: "s", long: "shell", description: "Use SHELL.", takesValue: true },
      { short: "m", long: "preserve-environment", description: "Preserve environment." },
    ],
  },
  {
    name: "ssh",
    summary: "OpenSSH remote login client.",
    flags: [
      { short: "p", description: "Port to connect to on the remote host.", takesValue: true },
      { short: "i", description: "Identity (private key) file.", takesValue: true },
      { short: "L", description: "Local port forward [bind:]port:host:hostport.", takesValue: true },
      { short: "R", description: "Remote port forward.", takesValue: true },
      { short: "D", description: "Dynamic SOCKS port forward.", takesValue: true },
      { short: "N", description: "Do not execute a remote command (for tunnels)." },
      { short: "f", description: "Background before command execution." },
      { short: "v", long: "verbose", description: "Verbose mode." },
      { short: "t", description: "Force pseudo-terminal allocation." },
      { short: "T", description: "Disable pseudo-terminal allocation." },
      { short: "C", long: "compression", description: "Compress data." },
      { long: "no-pty", description: "Do not allocate a pty." },
    ],
  },
  {
    name: "scp",
    summary: "Secure copy (over SSH).",
    flags: [
      { short: "P", description: "Port (note capital P).", takesValue: true },
      { short: "i", description: "Identity file.", takesValue: true },
      { short: "r", long: "recursive", description: "Copy directories recursively." },
      { short: "p", long: "preserve-attributes", description: "Preserve mtime/atime/modes." },
      { short: "v", long: "verbose", description: "Verbose." },
      { short: "C", long: "compression", description: "Compress." },
      { short: "q", long: "quiet", description: "Quiet." },
    ],
  },
  {
    name: "rsync",
    summary: "Fast, flexible, remote (and local) file-copying tool.",
    flags: [
      { short: "a", long: "archive", description: "Archive mode: -rlptgoD (recursive, links, perms, times, group, owner, devices)." },
      { short: "v", long: "verbose", description: "Verbose." },
      { short: "z", long: "compress", description: "Compress file data during transfer." },
      { short: "P", description: "Equivalent to --partial --progress." },
      { short: "r", long: "recursive", description: "Recurse into directories." },
      { short: "l", long: "links", description: "Copy symlinks as symlinks." },
      { short: "p", long: "perms", description: "Preserve permissions." },
      { short: "t", long: "times", description: "Preserve modification times." },
      { short: "g", long: "group", description: "Preserve group." },
      { short: "o", long: "owner", description: "Preserve owner (super-user only)." },
      { short: "D", description: "Preserve device and special files (equivalent to --devices --specials)." },
      { short: "n", long: "dry-run", description: "Show what would have been transferred." },
      { short: "e", long: "rsh", description: "Specify remote shell.", takesValue: true },
      { long: "delete", description: "Delete extraneous files from the receiving side." },
      { long: "exclude", description: "Exclude files matching PATTERN.", takesValue: true },
      { long: "include", description: "Don't exclude files matching PATTERN.", takesValue: true },
      { long: "partial", description: "Keep partially transferred files." },
      { long: "progress", description: "Show progress during transfer." },
    ],
  },
  {
    name: "curl",
    summary: "Transfer data from or to a server (URL syntax).",
    flags: [
      { short: "o", long: "output", description: "Write to FILE instead of stdout.", takesValue: true },
      { short: "O", long: "remote-name", description: "Write to local file named as remote." },
      { short: "L", long: "location", description: "Follow redirects." },
      { short: "I", long: "head", description: "Fetch headers only." },
      { short: "s", long: "silent", description: "Silent mode (no progress)." },
      { short: "S", long: "show-error", description: "Show error even with --silent." },
      { short: "v", long: "verbose", description: "Verbose." },
      { short: "X", long: "request", description: "Specify request method (GET, POST, ...).", takesValue: true },
      { short: "d", long: "data", description: "Send DATA in POST body (x-www-form-urlencoded).", takesValue: true },
      { short: "H", long: "header", description: "Pass custom HEADER.", takesValue: true },
      { short: "k", long: "insecure", description: "Allow insecure SSL connections." },
      { short: "u", long: "user", description: "USER:PASSWORD for auth.", takesValue: true },
      { short: "A", long: "user-agent", description: "Send User-Agent.", takesValue: true },
      { short: "f", long: "fail", description: "Fail silently (no output) on HTTP errors." },
      { long: "compressed", description: "Request compression and decompress automatically." },
    ],
  },
  {
    name: "wget",
    summary: "Non-interactive network downloader.",
    flags: [
      { short: "O", long: "output-document", description: "Write documents to FILE.", takesValue: true },
      { short: "q", long: "quiet", description: "Quiet mode." },
      { short: "v", long: "verbose", description: "Verbose (default)." },
      { short: "c", long: "continue", description: "Resume a partial download." },
      { short: "r", long: "recursive", description: "Recursive download." },
      { short: "l", long: "level", description: "Maximum recursion depth.", takesValue: true },
      { short: "P", long: "directory-prefix", description: "Save to PREFIX/.", takesValue: true },
      { short: "i", long: "input-file", description: "Read URLs from FILE.", takesValue: true },
      { long: "no-check-certificate", description: "Don't validate server cert." },
      { long: "header", description: "Send HEADER.", takesValue: true },
    ],
  },
  {
    name: "git",
    summary: "Distributed version-control system.",
    flags: [
      { short: "C", description: "Run as if started in PATH.", takesValue: true },
      { short: "c", description: "Set config KEY=VALUE.", takesValue: true },
      { long: "git-dir", description: "Set the .git directory.", takesValue: true },
      { long: "work-tree", description: "Set the working tree.", takesValue: true },
    ],
    subcommands: {
      log: {
        summary: "Show commit logs.",
        flags: [
          { short: "n", description: "Limit to N commits.", takesValue: true },
          { short: "p", long: "patch", description: "Show the patch (diff) for each commit." },
          { short: "s", long: "stat", description: "Show diffstat for each commit." },
          { short: "S", description: "Look for differences that add/remove STRING.", takesValue: true },
          { short: "G", description: "Look for differences whose added/removed lines match REGEX.", takesValue: true },
          { long: "graph", description: "Draw a text-based commit graph." },
          { long: "oneline", description: "Shorthand for --pretty=oneline --abbrev-commit." },
          { long: "all", description: "Show all refs." },
          { long: "author", description: "Filter by author.", takesValue: true },
          { long: "since", description: "Show commits since DATE.", takesValue: true },
          { long: "until", description: "Show commits until DATE.", takesValue: true },
        ],
      },
      commit: {
        summary: "Record changes to the repository.",
        flags: [
          { short: "m", long: "message", description: "Use MESSAGE as the commit message.", takesValue: true },
          { short: "a", long: "all", description: "Stage modified & deleted tracked files (no untracked)." },
          { short: "p", long: "patch", description: "Use interactive patch-selection." },
          { short: "amend", long: "amend", description: "Modify the previous commit." },
          { short: "v", long: "verbose", description: "Show diff of what will be committed." },
          { long: "no-edit", description: "Don't open editor for --amend message." },
          { long: "allow-empty", description: "Allow a commit with no changes." },
        ],
      },
      push: {
        summary: "Update remote refs along with associated objects.",
        flags: [
          { short: "f", long: "force", description: "Force overwrite remote ref (DESTRUCTIVE)." },
          { short: "u", long: "set-upstream", description: "Add upstream tracking." },
          { short: "d", long: "delete", description: "Delete the remote ref." },
          { long: "tags", description: "Push all refs under refs/tags." },
          { long: "no-verify", description: "Bypass pre-push hooks." },
          { long: "force-with-lease", description: "Force, but only if remote matches our expectation." },
        ],
      },
      pull: {
        summary: "Fetch from and integrate with another repository or local branch.",
        flags: [
          { short: "r", long: "rebase", description: "Rebase the local commits on top of fetched." },
          { short: "f", long: "force", description: "Force (only with --rebase)." },
          { long: "no-rebase", description: "Override earlier --rebase." },
          { long: "ff-only", description: "Only fast-forward." },
        ],
      },
      fetch: {
        summary: "Download objects and refs from another repository.",
        flags: [
          { short: "a", long: "all", description: "Fetch all remotes." },
          { short: "p", long: "prune", description: "Remove remote-tracking refs that no longer exist." },
          { long: "tags", description: "Fetch all tags." },
          { long: "depth", description: "Shallow clone depth N.", takesValue: true },
        ],
      },
      clone: {
        summary: "Clone a repository.",
        flags: [
          { short: "b", long: "branch", description: "Checkout BRANCH instead of HEAD.", takesValue: true },
          { long: "depth", description: "Shallow clone (history truncated to N commits).", takesValue: true },
          { long: "single-branch", description: "Clone only one branch." },
          { long: "bare", description: "Make a bare repository." },
          { long: "recursive", description: "Initialize submodules." },
        ],
      },
      checkout: {
        summary: "Switch branches or restore working tree files.",
        flags: [
          { short: "b", description: "Create a new BRANCH.", takesValue: true },
          { short: "B", description: "Create/reset BRANCH.", takesValue: true },
          { short: "f", long: "force", description: "Force checkout (throw away local changes)." },
          { long: "orphan", description: "Create a branch with no history.", takesValue: true },
        ],
      },
      branch: {
        summary: "List, create, or delete branches.",
        flags: [
          { short: "d", long: "delete", description: "Delete a branch." },
          { short: "D", description: "Force-delete (alias for --delete --force)." },
          { short: "m", long: "move", description: "Rename a branch." },
          { short: "a", long: "all", description: "List all branches (local + remote)." },
          { short: "r", long: "remotes", description: "List remote branches." },
          { long: "force", description: "Force delete/rename." },
        ],
      },
      merge: {
        summary: "Join two or more development histories.",
        flags: [
          { long: "no-ff", description: "Create a merge commit even if fast-forward possible." },
          { long: "ff-only", description: "Refuse to merge unless fast-forward possible." },
          { short: "s", long: "strategy", description: "Merge STRATEGY.", takesValue: true },
          { short: "X", description: "Pass OPTION to merge strategy.", takesValue: true },
          { short: "m", long: "message", description: "Set the merge commit MESSAGE.", takesValue: true },
          { long: "abort", description: "Abort the current conflict resolution." },
        ],
      },
      rebase: {
        summary: "Reapply commits on top of another base tip.",
        flags: [
          { short: "i", long: "interactive", description: "Interactive rebase (list commits to edit)." },
          { long: "onto", description: "Rebase onto NEWBASE.", takesValue: true },
          { long: "abort", description: "Abort and restore original branch." },
          { long: "continue", description: "Continue after conflict resolution." },
          { long: "autosquash", description: "Squash fixup!/squash! commits." },
        ],
      },
      stash: {
        summary: "Stash the changes in a dirty working directory away.",
        flags: [
          { long: "list", description: "List stashes." },
          { long: "show", description: "Show the changes in a stash." },
          { long: "pop", description: "Apply and drop the top stash." },
          { long: "drop", description: "Drop a stash." },
          { long: "clear", description: "Drop all stashes." },
        ],
      },
      diff: {
        summary: "Show changes between commits, commit and working tree, etc.",
        flags: [
          { long: "stat", description: "Show diffstat summary." },
          { long: "cached", description: "Show staged changes (index vs HEAD)." },
          { long: "staged", description: "Alias for --cached." },
          { short: "w", long: "ignore-all-space", description: "Ignore whitespace." },
        ],
      },
    },
  },
  {
    name: "docker",
    summary: "Manage containers, images, volumes, and networks.",
    danger: "caution",
    flags: [],
    subcommands: {
      run: {
        summary: "Create and run a new container from an image.",
        flags: [
          { short: "d", long: "detach", description: "Run in the background." },
          { short: "i", long: "interactive", description: "Keep STDIN open even if not attached." },
          { short: "t", long: "tty", description: "Allocate a pseudo-TTY." },
          { short: "p", long: "publish", description: "Publish container port to host (HOST:CONTAINER).", takesValue: true },
          { short: "P", long: "publish-all", description: "Publish all exposed ports to random ports." },
          { short: "v", long: "volume", description: "Bind-mount a volume (HOST:CONTAINER).", takesValue: true },
          { short: "e", long: "env", description: "Set environment variables.", takesValue: true },
          { short: "w", long: "workdir", description: "Working directory inside the container.", takesValue: true },
          { short: "u", long: "user", description: "Username or UID.", takesValue: true },
          { long: "name", description: "Assign a NAME to the container.", takesValue: true },
          { long: "rm", description: "Automatically remove the container when it exits." },
          { long: "network", description: "Connect to NETWORK.", takesValue: true },
          { long: "restart", description: "Restart policy.", takesValue: true },
          { long: "entrypoint", description: "Override the default ENTRYPOINT.", takesValue: true },
        ],
      },
      build: {
        summary: "Build an image from a Dockerfile.",
        flags: [
          { short: "t", long: "tag", description: "Name and optionally a tag (NAME:TAG).", takesValue: true },
          { short: "f", long: "file", description: "Dockerfile path.", takesValue: true },
          { long: "no-cache", description: "Don't use cache when building." },
          { long: "pull", description: "Always attempt to pull a newer version of the image." },
        ],
      },
      ps: {
        summary: "List containers.",
        flags: [
          { short: "a", long: "all", description: "Show all containers (default: only running)." },
          { short: "q", long: "quiet", description: "Only display container IDs." },
          { short: "s", long: "size", description: "Display total file sizes." },
          { long: "filter", description: "Filter output (e.g. status=exited).", takesValue: true },
        ],
      },
      images: {
        summary: "List images.",
        flags: [
          { short: "a", long: "all", description: "Show all images (default: hide intermediate)." },
          { short: "q", long: "quiet", description: "Only image IDs." },
          { long: "no-trunc", description: "Don't truncate output." },
        ],
      },
      exec: {
        summary: "Run a command in a running container.",
        flags: [
          { short: "i", long: "interactive", description: "Keep STDIN open." },
          { short: "t", long: "tty", description: "Allocate a pseudo-TTY." },
          { short: "d", long: "detach", description: "Detached mode." },
          { short: "u", long: "user", description: "Run as USER.", takesValue: true },
          { short: "e", long: "env", description: "Set env vars.", takesValue: true },
          { short: "w", long: "workdir", description: "Working directory inside the container.", takesValue: true },
        ],
      },
      stop: {
        summary: "Stop one or more running containers.",
        flags: [
          { short: "t", long: "time", description: "Seconds to wait for stop before killing.", takesValue: true },
        ],
      },
      rm: {
        summary: "Remove one or more containers.",
        flags: [
          { short: "f", long: "force", description: "Force removal of a running container." },
          { short: "v", long: "volumes", description: "Remove anonymous volumes." },
          { short: "l", long: "link", description: "Remove the specified link." },
        ],
      },
      rmi: {
        summary: "Remove one or more images.",
        flags: [
          { short: "f", long: "force", description: "Force removal." },
          { long: "no-prune", description: "Don't delete untagged parents." },
        ],
      },
      pull: {
        summary: "Pull an image or repository from a registry.",
        flags: [
          { short: "a", long: "all-tags", description: "Pull all tagged images in the repository." },
          { long: "platform", description: "Set platform if server is multi-platform.", takesValue: true },
        ],
      },
      push: {
        summary: "Push an image or repository to a registry.",
        flags: [
          { short: "a", long: "all-tags", description: "Push all tags." },
          { long: "disable-content-trust", description: "Skip image signing." },
        ],
      },
      compose: {
        summary: "Run multi-container Docker applications (compose v2 subcommand).",
        flags: [],
      },
    },
  },
  {
    name: "man",
    summary: "An interface to system reference manuals.",
    flags: [
      { short: "k", long: "apropos", description: "Equivalent to apropos: search short descriptions." },
      { short: "f", long: "whatis", description: "Equivalent to whatis: show one-line description." },
      { short: "a", long: "all", description: "Display all available manual pages." },
      { short: "S", long: "sections", description: "Colon-separated section list.", takesValue: true },
    ],
  },
  {
    name: "less",
    summary: "Pager: opposite of more.",
    flags: [
      { short: "N", long: "LINE-NUMBERS", description: "Show line numbers." },
      { short: "i", long: "ignore-case", description: "Case-insensitive search." },
      { short: "F", long: "quit-if-one-screen", description: "Quit if entire file fits on one screen." },
      { short: "R", long: "RAW-CONTROL-CHARS", description: "Output raw ANSI color escapes." },
      { short: "S", long: "chop-long-lines", description: "Chop (truncate) long lines." },
      { short: "X", description: "Don't clear the screen on exit." },
    ],
  },
  {
    name: "more",
    summary: "Pager for viewing text one screenful at a time.",
    flags: [
      { short: "d", long: "help", description: "Display help instead of ringing bell." },
      { short: "f", long: "logical", description: "Count logical lines (don't wrap)." },
      { short: "s", long: "squeeze", description: "Squeeze multiple blank lines into one." },
    ],
  },
  {
    name: "history",
    summary: "Display or manipulate the shell's command history.",
    flags: [
      { short: "c", long: "clear", description: "Clear the history list." },
      { short: "d", description: "Delete the entry at OFFSET.", takesValue: true },
      { short: "a", long: "append", description: "Append new history lines to the history file." },
      { short: "r", long: "read", description: "Read the history file and append to the list." },
      { short: "w", long: "write", description: "Write the current history to the file." },
    ],
  },
  {
    name: "export",
    summary: "Set shell variables and mark them for export to child processes.",
    flags: [
      { short: "n", description: "Remove the export property from each NAME." },
      { short: "p", description: "Print all exported variables." },
    ],
  },
  {
    name: "source",
    summary: "Read and execute commands from FILE in the current shell (alias: .).",
    flags: [],
  },
  {
    name: "alias",
    summary: "Define or display aliases.",
    flags: [
      { short: "p", long: "print", description: "Print all defined aliases in reusable form." },
    ],
  },
  {
    name: "tree",
    summary: "List contents of directories in a tree-like format.",
    flags: [
      { short: "d", description: "List directories only." },
      { short: "a", long: "all", description: "All files (including hidden)." },
      { short: "L", description: "Max display depth.", takesValue: true },
      { short: "f", description: "Print full path prefix for each file." },
      { short: "h", long: "human-readable", description: "Print sizes in human-readable form." },
      { short: "F", description: "Append indicator: */=>@| for exec/dirs/symlinks/sockets." },
      { long: "dirsfirst", description: "List directories before files." },
      { long: "gitignore", description: "Honor .gitignore files." },
    ],
  },
  {
    name: "rg",
    summary: "ripgrep — recursively search directories for a regex pattern (faster than grep -r).",
    flags: [
      { short: "i", long: "ignore-case", description: "Case-insensitive." },
      { short: "v", long: "invert-match", description: "Invert match." },
      { short: "r", long: "replace", description: "Replace matches with TEXT.", takesValue: true },
      { short: "n", long: "line-number", description: "Show line numbers." },
      { short: "l", long: "files-with-matches", description: "Show only filenames." },
      { short: "w", long: "word-regexp", description: "Match whole words." },
      { short: "t", long: "type", description: "Search only TYPE files.", takesValue: true },
      { short: "T", long: "type-not", description: "Don't search TYPE files.", takesValue: true },
      { short: "g", long: "glob", description: "Glob include/exclude.", takesValue: true },
      { short: "S", long: "smart-case", description: "Smart case (case-insensitive unless uppercase)." },
      { short: "s", long: "case-sensitive", description: "Case-sensitive." },
      { short: "F", long: "fixed-strings", description: "Treat pattern as literal." },
      { short: "o", long: "only-matching", description: "Print only the matched parts." },
      { long: "max-depth", description: "Descend at most N directories.", takesValue: true },
      { long: "hidden", description: "Search hidden files." },
      { long: "no-ignore", description: "Don't honor .gitignore." },
    ],
  },
  {
    name: "fd",
    summary: "A simple, fast alternative to find.",
    flags: [
      { short: "H", long: "hidden", description: "Search hidden files and directories." },
      { short: "I", long: "no-ignore", description: "Show .gitignore'd entries." },
      { short: "u", long: "unrestricted", description: "Equivalent to -H -I." },
      { short: "t", long: "type", description: "Filter by TYPE (f, d, l, x).", takesValue: true },
      { short: "e", long: "extension", description: "Filter by EXTENSION.", takesValue: true },
      { short: "x", long: "exec", description: "Execute COMMAND for each result.", takesValue: true },
      { short: "X", long: "exec-batch", description: "Execute COMMAND once with all results.", takesValue: true },
      { short: "d", long: "max-depth", description: "Set max search depth.", takesValue: true },
      { short: "s", long: "case-sensitive", description: "Case-sensitive." },
      { short: "i", long: "ignore-case", description: "Case-insensitive." },
      { short: "g", long: "glob", description: "Use glob-style pattern." },
      { short: "F", long: "fixed-strings", description: "Treat pattern as literal string." },
      { short: "a", long: "absolute-path", description: "Show absolute paths." },
      { short: "p", long: "full-path", description: "Match full path, not just name." },
    ],
  },
  {
    name: "jq",
    summary: "Command-line JSON processor.",
    flags: [
      { short: "c", long: "compact", description: "Compact output (one line per result)." },
      { short: "r", long: "raw-output", description: "Output raw strings (no quotes)." },
      { short: "R", long: "raw-input", description: "Read raw strings (don't parse as JSON)." },
      { short: "s", long: "slurp", description: "Slurp all inputs into an array." },
      { short: "S", long: "sort-keys", description: "Sort object keys." },
      { short: "e", long: "exit-status", description: "Exit with 1 if last output is false/null." },
      { short: "n", long: "null-input", description: "Don't read input (use 'null' as input)." },
      { short: "f", long: "from-file", description: "Read FILTER from FILE.", takesValue: true },
      { short: "a", long: "ascii-output", description: "Force ASCII output (escape non-ASCII)." },
      { long: "arg", description: "Set $name to STRING.", takesValue: true },
      { long: "argjson", description: "Set $name to JSON value.", takesValue: true },
      { long: "tab", description: "Indent with a tab." },
      { long: "indent", description: "Indent with N spaces.", takesValue: true },
    ],
  },
  {
    name: "ping",
    summary: "Send ICMP ECHO_REQUEST packets to network hosts.",
    flags: [
      { short: "c", description: "Stop after N ECHO_REQUEST packets.", takesValue: true },
      { short: "i", description: "Wait SECONDS between packets.", takesValue: true },
      { short: "s", description: "Send N data bytes.", takesValue: true },
      { short: "W", description: "Time to wait for a response (seconds).", takesValue: true },
      { short: "w", description: "Deadline (seconds) before ping exits.", takesValue: true },
      { short: "q", long: "quiet", description: "Quiet output (only summary)." },
      { short: "v", long: "verbose", description: "Verbose output." },
    ],
  },
  {
    name: "nc",
    summary: "netcat — arbitrary TCP/UDP connections and listens.",
    flags: [
      { short: "l", long: "listen", description: "Listen for an incoming connection." },
      { short: "p", description: "Specify local PORT.", takesValue: true },
      { short: "v", long: "verbose", description: "Verbose." },
      { short: "z", long: "zero", description: "Zero-I/O mode (scan)." },
      { short: "u", long: "udp", description: "Use UDP." },
      { short: "w", description: "Timeout for connects and final net reads.", takesValue: true },
      { short: "n", long: "no-dns", description: "Numeric-only IP (no DNS)." },
      { short: "k", long: "keep-open", description: "Keep listening after a client disconnects." },
    ],
  },
  {
    name: "ifconfig",
    summary: "Configure a network interface (legacy; prefer ip on modern Linux).",
    flags: [],
  },
  {
    name: "ip",
    summary: "Show / manipulate routing, devices, policy routing and tunnels.",
    flags: [
      { short: "a", long: "all", description: "Display all (e.g. ip a)." },
      { short: "r", description: "Routes (e.g. ip r)." },
      { short: "br", long: "brief", description: "Brief output." },
      { short: "j", long: "json", description: "Output as JSON." },
      { short: "s", long: "stats", description: "Output statistics." },
    ],
  },
  {
    name: "systemctl",
    summary: "Control the systemd system and service manager.",
    flags: [
      { short: "s", long: "signal", description: "Signal to send (with kill).", takesValue: true },
      { long: "no-pager", description: "Don't pipe output into a pager." },
      { long: "no-legend", description: "Don't print the column legend." },
      { short: "q", long: "quiet", description: "Suppress hints." },
    ],
  },
];

export const COMMAND_NAMES: string[] = COMMAND_DATABASE.map((c) => c.name);

/** Lookup a command reference by name. */
export function lookupCommand(name: string): CommandRef | null {
  const lower = name.toLowerCase();
  return COMMAND_DATABASE.find((c) => c.name === lower) ?? null;
}

// ---------------------------------------------------------------------------
// Operators
// ---------------------------------------------------------------------------

/** Recognized shell operators (longest-first so && beats &). */
export const OPERATORS: { token: string; description: string; kind: "operator" | "redirect" | "pipe" }[] = [
  { token: "&&", description: "Run the next command only if the previous one succeeded (exit 0).", kind: "operator" },
  { token: "||", description: "Run the next command only if the previous one failed (non-zero exit).", kind: "operator" },
  { token: "2>&1", description: "Redirect stderr (fd 2) to wherever stdout (fd 1) currently goes.", kind: "redirect" },
  { token: "&>", description: "Redirect both stdout and stderr to the next file.", kind: "redirect" },
  { token: ">>", description: "Append stdout to the next file (create if missing).", kind: "redirect" },
  { token: "2>", description: "Redirect stderr to the next file (truncate).", kind: "redirect" },
  { token: ">", description: "Redirect stdout to the next file (truncate).", kind: "redirect" },
  { token: "<", description: "Redirect stdin from the next file.", kind: "redirect" },
  { token: "|", description: "Pipe: connect the previous command's stdout to the next command's stdin.", kind: "pipe" },
  { token: ";", description: "Sequential: run the next command after the previous finishes (regardless of exit).", kind: "operator" },
  { token: "&", description: "Background: run the preceding command asynchronously, return to the prompt.", kind: "operator" },
];

// ---------------------------------------------------------------------------
// Tokenizer
// ---------------------------------------------------------------------------

/**
 * Split a command line into raw tokens, honoring quotes and escapes.
 * Returns the tokens in order; operators like `|`, `>`, `&&` are kept
 * as their own tokens so the classifier can annotate them.
 */
export function tokenize(input: string): Token[] {
  const out: Token[] = [];
  if (!input) return out;
  let i = 0;
  const n = input.length;
  while (i < n) {
    // Skip whitespace.
    while (i < n && /\s/.test(input[i]!)) i++;
    if (i >= n) break;
    const start = i;
    // Try to match an operator first (longest-first).
    const op = matchOperator(input, i);
    if (op) {
      out.push({ raw: op, type: "operator", start, length: op.length });
      i += op.length;
      continue;
    }
    // Otherwise, consume a "word" — possibly quoted.
    let buf = "";
    let hasQuote = false;
    while (i < n) {
      const ch = input[i]!;
      // Unescaped whitespace ends the word.
      if (ch === "\\") {
        // Escape: take the next char literally.
        if (i + 1 < n) {
          buf += input[i + 1];
          i += 2;
          continue;
        }
        i++;
        continue;
      }
      if (ch === '"') {
        hasQuote = true;
        i++;
        while (i < n && input[i] !== '"') {
          if (input[i] === "\\" && i + 1 < n) {
            buf += input[i + 1] ?? "";
            i += 2;
            continue;
          }
          buf += input[i]!;
          i++;
        }
        i++; // closing quote
        continue;
      }
      if (ch === "'") {
        hasQuote = true;
        i++;
        while (i < n && input[i] !== "'") {
          buf += input[i]!;
          i++;
        }
        i++; // closing quote
        continue;
      }
      if (ch === "`") {
        hasQuote = true;
        buf += "`";
        i++;
        while (i < n && input[i] !== "`") {
          buf += input[i]!;
          i++;
        }
        buf += "`";
        i++; // closing backtick
        continue;
      }
      if (/\s/.test(ch)) break;
      // Check for an inline operator boundary (e.g. `foo|bar`, `a>b`).
      // We only break on `|`, `>`, `<`, `&`, `;` when they're NOT preceded by a quote/escape.
      if (isOperatorStart(ch) && buf.length > 0) {
        // Don't break on `&` if part of `&&` or `2>&1` — let the loop emit them.
        break;
      }
      buf += ch;
      i++;
    }
    // If buf is empty but we consumed quotes, we still have an empty token.
    out.push({
      raw: buf,
      type: hasQuote ? "positional" : "positional", // reclassified later
      start,
      length: i - start,
    });
  }
  return out;
}

function matchOperator(s: string, pos: number): string | null {
  for (const op of OPERATORS) {
    if (s.startsWith(op.token, pos)) return op.token;
  }
  return null;
}

function isOperatorStart(ch: string): boolean {
  return "|<>;&".includes(ch);
}

// ---------------------------------------------------------------------------
// Combined-flag splitter
// ---------------------------------------------------------------------------

/**
 * Given a short-flag token like "-la", return the individual flags
 * `["-l", "-a"]`. If the token isn't a combined short flag, return [token].
 * A combined flag is `-` followed by 2+ letters.
 */
export function splitCombinedFlags(token: string): string[] {
  if (!token) return [token];
  // Don't split a single short flag.
  if (/^-[a-zA-Z0-9]$/.test(token)) return [token];
  // Combined short flag: `-xyz` → `-x`, `-y`, `-z`.
  if (/^-[a-zA-Z0-9]{2,}$/.test(token)) {
    return token.slice(1).split("").map((c) => `-${c}`);
  }
  return [token];
}

// ---------------------------------------------------------------------------
// Pipeline parsing
// ---------------------------------------------------------------------------

/**
 * Split a token stream into pipeline stages separated by `|`, `&&`,
 * `||`, `;`, or trailing `&`. Each stage gets its trailing operator
 * annotated. Redirects (`>`, `<`, etc.) stay inside their stage.
 */
export function parsePipeline(input: string): ParsedCommand {
  const tokens = tokenize(input);
  const stages: PipelineStage[] = [];
  let current: Token[] = [];
  let trailingOp = "";
  let hasUnknown = false;
  const flush = (op: string) => {
    const commandName = current.length > 0 ? stripQuotes(current[0]!.raw) : "";
    let subcommandName = "";
    const cmd = lookupCommand(commandName);
    if (cmd && cmd.subcommands && current.length > 1) {
      const second = stripQuotes(current[1]!.raw);
      if (cmd.subcommands[second]) subcommandName = second;
    }
    if (cmd === null && commandName !== "") hasUnknown = true;
    stages.push({
      tokens: current,
      commandName,
      subcommandName,
      trailingOperator: op,
    });
    current = [];
  };
  for (const t of tokens) {
    const op = OPERATORS.find((o) => o.token === t.raw);
    if (op && (op.kind === "pipe" || op.kind === "operator")) {
      flush(op.token);
      trailingOp = op.token;
    } else {
      current.push(t);
      trailingOp = "";
    }
  }
  flush("");
  return { stages, tokens, hasUnknown };
}

function stripQuotes(s: string): string {
  if (!s) return s;
  if ((s.startsWith('"') && s.endsWith('"')) || (s.startsWith("'") && s.endsWith("'"))) {
    return s.slice(1, -1);
  }
  return s;
}

// ---------------------------------------------------------------------------
// Per-stage token classification
// ---------------------------------------------------------------------------

/**
 * Reclassify the tokens in a stage into command / short-flag / long-flag
 * / flag-value / positional / redirect / redirect-target. The first
 * token is the command; the second may be a subcommand. After that,
 * tokens starting with `-` are flags, and a flag with `takesValue=true`
 * consumes the following token as its value.
 */
export function classifyStage(stage: PipelineStage): Token[] {
  const out: Token[] = [];
  const cmdRef = lookupCommand(stage.commandName);
  const subRef = cmdRef?.subcommands?.[stage.subcommandName];
  const flagList: FlagRef[] = subRef?.flags ?? cmdRef?.flags ?? [];
  // Build quick lookup tables.
  const shortMap = new Map<string, FlagRef>();
  const longMap = new Map<string, FlagRef>();
  for (const f of flagList) {
    if (f.short) shortMap.set(f.short, f);
    if (f.long) longMap.set(f.long, f);
  }
  let seenCommand = false;
  let seenSubcommand = false;
  let expectValueFor: FlagRef | null = null;
  let pastDashDash = false;
  for (let idx = 0; idx < stage.tokens.length; idx++) {
    const raw = stage.tokens[idx]!.raw;
    const t: Token = { ...stage.tokens[idx]! };
    if (pastDashDash) {
      t.type = "positional";
      out.push(t);
      continue;
    }
    // Operator/redirect within the stage?
    const op = OPERATORS.find((o) => o.token === raw);
    if (op) {
      t.type = op.kind === "pipe" ? "pipe" : op.kind === "redirect" ? "redirect" : "operator";
      out.push(t);
      expectValueFor = null;
      continue;
    }
    // Command or subcommand?
    if (!seenCommand) {
      t.type = "command";
      seenCommand = true;
      out.push(t);
      continue;
    }
    if (cmdRef?.subcommands && !seenSubcommand && subRef && stripQuotes(raw) === stage.subcommandName) {
      t.type = "subcommand";
      seenSubcommand = true;
      out.push(t);
      continue;
    }
    // Pending flag-value?
    if (expectValueFor) {
      t.type = "flag-value";
      out.push(t);
      expectValueFor = null;
      continue;
    }
    // -- separator.
    if (raw === "--") {
      t.type = "operator";
      out.push(t);
      pastDashDash = true;
      continue;
    }
    // Long flag.
    if (raw.startsWith("--")) {
      const name = raw.slice(2).split("=")[0]!;
      t.type = "long-flag";
      out.push(t);
      const ref = longMap.get(name);
      if (ref?.takesValue && !raw.includes("=")) expectValueFor = ref;
      continue;
    }
    // Short flag (single or combined).
    if (/^-[^-]/.test(raw)) {
      // If the combined flag's last char takes a value, the rest is the value.
      const chars = raw.slice(1).split("");
      const lastChar = chars[chars.length - 1]!;
      const lastRef = shortMap.get(lastChar);
      if (chars.length > 1 && lastRef?.takesValue) {
        // Split into N-1 flags, then treat the remainder as the value.
        for (let k = 0; k < chars.length - 1; k++) {
          out.push({
            ...t,
            type: "short-flag",
            raw: `-${chars[k]}`,
            length: 2,
          });
        }
        const rest = chars.slice(0, -1).join("");
        const valuePart = raw.slice(1 + rest.length);
        out.push({
          ...t,
          type: "flag-value",
          raw: valuePart,
          length: valuePart.length,
        });
        continue;
      }
      // Combined-flag token (will be split for display later).
      if (chars.length > 1) {
        t.type = "combined-flag";
      } else {
        t.type = "short-flag";
      }
      out.push(t);
      if (lastRef?.takesValue) expectValueFor = lastRef;
      continue;
    }
    // Otherwise positional.
    t.type = "positional";
    out.push(t);
  }
  return out;
}

// ---------------------------------------------------------------------------
// Per-token explanation
// ---------------------------------------------------------------------------

/** Produce an ExplainedToken stream for a stage. */
export function explainStage(stage: PipelineStage, variant: Variant): ExplainedToken[] {
  const classified = classifyStage(stage);
  const cmdRef = lookupCommand(stage.commandName);
  const subRef = cmdRef?.subcommands?.[stage.subcommandName];
  const flagList: FlagRef[] = subRef?.flags ?? cmdRef?.flags ?? [];
  const shortMap = new Map<string, FlagRef>();
  const longMap = new Map<string, FlagRef>();
  for (const f of flagList) {
    if (f.short) shortMap.set(f.short, f);
    if (f.long) longMap.set(f.long, f);
  }
  return classified.map((t) => {
    const et: ExplainedToken = {
      ...t,
      description: "",
      isCommand: false,
      unknown: false,
      danger: false,
    };
    switch (t.type) {
      case "command": {
        et.isCommand = true;
        if (cmdRef) {
          et.description = cmdRef.summary;
          if (cmdRef.danger === "destructive") {
            et.danger = true;
            et.dangerMessage = `${stage.commandName} is destructive.`;
          } else if (cmdRef.danger === "caution") {
            et.danger = true;
            et.dangerMessage = `${stage.commandName} requires elevated privileges; verify before running.`;
          }
        } else {
          et.unknown = true;
          et.description = `Not in bundled dataset. The structure is still parsed; install tldr or run \`man ${stage.commandName}\` locally for the canonical reference.`;
        }
        break;
      }
      case "subcommand": {
        et.description = subRef?.summary ?? `${stage.commandName} ${stage.subcommandName} — ${stage.commandName} subcommand.`;
        break;
      }
      case "short-flag": {
        const c = t.raw.slice(1);
        const ref = shortMap.get(c);
        et.description = ref
          ? (ref.variant && ref.variant !== variant
            ? `${ref.description} (${ref.variant} only — flag may not exist on ${variant === "gnu" ? "BSD/macOS" : "GNU/Linux"}).`
            : ref.description)
          : `Unknown short flag -${c} for ${stage.commandName}.`;
        et.unknown = !ref;
        break;
      }
      case "long-flag": {
        const c = t.raw.slice(2).split("=")[0]!;
        const ref = longMap.get(c);
        et.description = ref
          ? (ref.variant && ref.variant !== variant
            ? `${ref.description} (${ref.variant} only — flag may not exist on ${variant === "gnu" ? "BSD/macOS" : "GNU/Linux"}).`
            : ref.description)
          : `Unknown long flag --${c} for ${stage.commandName}.`;
        et.unknown = !ref;
        break;
      }
      case "combined-flag": {
        const chars = t.raw.slice(1).split("");
        const parts = chars.map((c) => {
          const ref = shortMap.get(c);
          return `-${c} (${ref ? ref.description.split(".")[0] : "unknown"})`;
        });
        et.description = `Combined short flag, equivalent to: ${parts.join(", ")}.`;
        break;
      }
      case "flag-value": {
        et.description = "Value consumed by the previous flag.";
        break;
      }
      case "positional": {
        et.description = cmdRef
          ? `Positional argument to ${stage.commandName}.`
          : "Positional argument.";
        break;
      }
      case "operator":
      case "redirect":
      case "pipe": {
        const op = OPERATORS.find((o) => o.token === t.raw);
        et.description = op?.description ?? "Shell operator.";
        break;
      }
      case "redirect-target": {
        et.description = "Redirect target file.";
        break;
      }
    }
    return et;
  });
}

// ---------------------------------------------------------------------------
// Danger linter
// ---------------------------------------------------------------------------

/** Detect destructive patterns across the whole command line. */
export function detectDangers(parsed: ParsedCommand): DangerWarning[] {
  const out: DangerWarning[] = [];
  // Fork bomb: `:(){ :|:& };:`  (allow any whitespace between tokens)
  const joined = parsed.tokens.map((t) => t.raw).join(" ").replace(/\s+/g, " ");
  if (/:\s*\(\)\s*\{\s*:\s*\|\s*:\s*&\s*\}\s*;\s*:/.test(joined)) {
    out.push({
      level: "danger",
      message: "This is a fork bomb (:(){ :|:& };:). It spawns processes exponentially until the system runs out of PIDs and locks up. NEVER run on a system you don't want to crash.",
      stageIndex: -1,
    });
  }
  // curl | sh / wget | bash (pipe-to-shell).
  for (let i = 0; i < parsed.stages.length - 1; i++) {
    const a = parsed.stages[i]!;
    const b = parsed.stages[i + 1]!;
    const aCmd = a.commandName;
    const bCmd = b.commandName;
    if (a.trailingOperator === "|") {
      if ((aCmd === "curl" || aCmd === "wget") && (bCmd === "sh" || bCmd === "bash" || bCmd === "zsh" || bCmd === "python" || bCmd === "python3")) {
        out.push({
          level: "danger",
          message: `Pipe-to-shell: '${aCmd} … | ${bCmd}' runs whatever the URL returns as a shell/python script. If the URL is tampered with you've executed arbitrary code. Download the script first, read it, then run it.`,
          stageIndex: i,
        });
      }
    }
  }
  // Per-stage dangers.
  parsed.stages.forEach((stage, idx) => {
    const cmd = stage.commandName;
    const flags = stage.tokens
      .filter((t) => t.raw.startsWith("-"))
      .map((t) => t.raw);
    const hasRF = flags.some((f) => f.includes("r") && f.includes("f")) || (flags.includes("-r") && flags.includes("-f"));
    const hasRcapF = flags.some((f) => f.includes("R") && f.includes("f")) || (flags.includes("-R") && flags.includes("-f"));
    const targets = stage.tokens
      .filter((t) => !t.raw.startsWith("-") && !OPERATORS.some((o) => o.token === t.raw))
      .slice(stage.subcommandName ? 2 : 1)
      .map((t) => stripQuotes(t.raw));
    if (cmd === "rm") {
      if (hasRF || hasRcapF) {
        const dangerousTargets = targets.filter((t) => t === "/" || t === "/*" || t === "~" || t === "$HOME" || t === "*" || t === ".");
        if (dangerousTargets.length > 0) {
          out.push({
            level: "danger",
            message: `rm -rf ${dangerousTargets.join(" ")} will delete everything${dangerousTargets.includes("/") ? " on the system" : ""} — including the bootloader${dangerousTargets.includes("/") ? " (system won't boot after)" : ""}. NEVER run this.`,
            stageIndex: idx,
          });
        } else {
          out.push({
            level: "danger",
            message: "rm -rf recursively force-deletes without prompting. Verify the path(s) carefully — there is no undo and no recycle bin on most filesystems.",
            stageIndex: idx,
          });
        }
      }
    }
    if (cmd === "chmod") {
      const modes = targets.length > 0 ? targets[0]! : "";
      if (modes === "777" || modes === "0777" || modes === "a=rwx" || modes === "u=rwx,go=rwx" || modes === "u=rwx,g=rwx,o=rwx") {
        out.push({
          level: "warning",
          message: "chmod 777 grants world read+write+execute. This is almost always a security mistake — prefer 755 for executables/dirs or 644 for files.",
          stageIndex: idx,
        });
      }
    }
    if (cmd === "dd") {
      const ofTok = stage.tokens.find((t) => t.raw.startsWith("of="));
      if (ofTok) {
        const dev = ofTok.raw.slice(3);
        if (/^\/dev\/(sd|nvme|vd|hd|disk)/.test(dev)) {
          out.push({
            level: "danger",
            message: `dd ${ofTok.raw} writes raw data directly to block device ${dev}, destroying the existing filesystem and ALL data on the disk. Triple-check the device name (lsblk) before running.`,
            stageIndex: idx,
          });
        }
      }
    }
    if (cmd === "mkfs") {
      const devTarget = targets.find((t) => /^\/dev\/(sd|nvme|vd|hd)/.test(t));
      if (devTarget) {
        out.push({
          level: "danger",
          message: `mkfs on ${devTarget} creates a fresh filesystem, destroying all existing data on that device. Confirm with lsblk first.`,
          stageIndex: idx,
        });
      }
    }
    if (cmd === "git" && stage.subcommandName === "push") {
      if (flags.includes("-f") || flags.includes("--force")) {
        out.push({
          level: "warning",
          message: "git push --force overwrites the remote ref history. If anyone else has pulled the old history, they'll have a divergent repo. Prefer --force-with-lease (it aborts if the remote has moved).",
          stageIndex: idx,
        });
      }
    }
    if (cmd === "kill") {
      // `-9` and `-1` are flags (start with -), not positionals.
      const sigFlag = flags.find((f) => /^-\d+$/.test(f));
      if (sigFlag === "-1" || targets.includes("-1")) {
        out.push({
          level: "danger",
          message: "kill -1 sends SIGHUP to ALL processes the user can signal — this typically logs the user out and restarts many daemons. Confirm intent.",
          stageIndex: idx,
        });
      } else if (sigFlag === "-9") {
        out.push({
          level: "warning",
          message: "kill -9 (SIGKILL) cannot be caught or ignored — the process is terminated immediately with no chance to clean up (no flush, no unlock). Prefer -15 (SIGTERM) first.",
          stageIndex: idx,
        });
      }
    }
    if (cmd === "sudo") {
      out.push({
        level: "caution",
        message: "sudo runs the rest of the line as root. Read the FULL command before pressing Enter; a typo after sudo can destroy the system.",
        stageIndex: idx,
      });
    }
  });
  // Whole-line redirect to a raw device.
  if (/>\s*\/dev\/(sd|nvme|vd|hd|disk)/.test(joined)) {
    out.push({
      level: "danger",
      message: "Redirecting output to a raw block device (e.g. > /dev/sda) overwrites the partition table and filesystem metadata — the disk becomes unbootable. Almost certainly a typo.",
      stageIndex: -1,
    });
  }
  return out;
}

// ---------------------------------------------------------------------------
// Plain-English summary
// ---------------------------------------------------------------------------

/** Build a one- or two-sentence plain-English summary of the whole line. */
export function summarize(parsed: ParsedCommand): string {
  if (parsed.stages.length === 0) return "Empty command.";
  // If the only stage is empty (e.g. blank input), treat as empty.
  if (parsed.stages.length === 1 && parsed.stages[0].tokens.length === 0) {
    return "Empty command.";
  }
  const parts: string[] = [];
  for (let i = 0; i < parsed.stages.length; i++) {
    const s = parsed.stages[i]!;
    const ref = lookupCommand(s.commandName);
    const sub = s.subcommandName ? ref?.subcommands?.[s.subcommandName] : null;
    const verb = ref
      ? (sub ? `${s.commandName} ${s.subcommandName} — ${sub.summary}` : ref.summary)
      : `Run '${s.commandName}' (unrecognized command — not in dataset).`;
    parts.push(verb);
    if (s.trailingOperator === "|") parts.push(" Pipe its output into:");
    else if (s.trailingOperator === "&&") parts.push(" If it succeeded, then:");
    else if (s.trailingOperator === "||") parts.push(" If it failed, then:");
    else if (s.trailingOperator === ";") parts.push(" Then:");
    else if (s.trailingOperator === "&") parts.push(" (in the background)");
  }
  return parts.join(" ");
}

// ---------------------------------------------------------------------------
// Top-level explain()
// ---------------------------------------------------------------------------

export function explain(input: string, variant: Variant = "gnu"): ExplainResult {
  const parsed = parsePipeline(input);
  const explained = parsed.stages.map((s) => explainStage(s, variant));
  const dangers = detectDangers(parsed);
  const summary = summarize(parsed);
  return { parsed, explained, summary, dangers, variant };
}

/** Render an explanation as plain text (for copy/download). */
export function formatExplanation(result: ExplainResult): string {
  const lines: string[] = [];
  lines.push(`Summary: ${result.summary}`);
  lines.push("");
  if (result.dangers.length > 0) {
    lines.push("Warnings:");
    for (const d of result.dangers) {
      lines.push(`  [${d.level.toUpperCase()}] ${d.message}`);
    }
    lines.push("");
  }
  for (let i = 0; i < result.parsed.stages.length; i++) {
    const stage = result.parsed.stages[i]!;
    const tokens = result.explained[i] ?? [];
    lines.push(`Stage ${i + 1}: ${stage.commandName}${stage.subcommandName ? " " + stage.subcommandName : ""}`);
    for (const t of tokens) {
      const tag = t.unknown ? "[unknown]" : t.danger ? "[DANGER]" : `[${t.type}]`;
      lines.push(`  ${tag} ${t.raw}`);
      if (t.description) lines.push(`      → ${t.description}`);
      if (t.dangerMessage) lines.push(`      ⚠ ${t.dangerMessage}`);
    }
    if (stage.trailingOperator) {
      lines.push(`  (operator: ${stage.trailingOperator})`);
    }
    lines.push("");
  }
  return lines.join("\n").trimEnd();
}

// ---------------------------------------------------------------------------
// History (localStorage)
// ---------------------------------------------------------------------------

const HISTORY_KEY = "unqtools:shell-command-explainer:history";
const HISTORY_MAX = 20;

export interface HistoryEntry {
  ts: number;
  command: string;
  stageCount: number;
  dangerCount: number;
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

export function buildShareUrl(command: string, variant: Variant = "gnu"): string {
  const params = new URLSearchParams();
  if (command) params.set("c", command);
  if (variant) params.set("v", variant);
  if (typeof window === "undefined") return `?${params.toString()}`;
  return `${window.location.origin}${window.location.pathname}#${params.toString()}`;
}

export function parseShareUrl(hash: string): { command: string; variant: Variant } {
  const clean = hash.startsWith("#") ? hash.slice(1) : hash;
  if (!clean) return { command: "", variant: "gnu" };
  const params = new URLSearchParams(clean);
  const command = params.get("c") ?? "";
  const vRaw = params.get("v");
  const variant: Variant = vRaw === "bsd" ? "bsd" : "gnu";
  return { command, variant };
}
