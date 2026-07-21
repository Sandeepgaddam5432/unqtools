/**
 * tar / Archive Command Builder — Tool Manifest.
 * Tool #329 — Category 4 (Developer & Code).
 *
 * Build correct `tar` commands for create / extract / list / append modes
 * from a visual UI — pick compression (none / gzip / bzip2 / xz / zstd),
 * verbosity, excludes, strip-components, target dir (-C), format
 * (gnu/posix/ustar/pax), preserve permissions / xattrs. Per-flag
 * plain-English explanation, tar-bomb guard, common recipes. History
 * (localStorage, max 20). Shareable URL. 100% client-side — commands are
 * generated, never executed.
 */
import type { ToolManifest } from "../../../lib/tool";

export const manifest: ToolManifest = {
  id: "tar-archive-command-builder",
  name: "tar Archive Command Builder",
  description:
    "Build correct tar commands from a visual UI — create / extract / list / append modes, compression (gzip .gz / bzip2 .bz2 / xz .xz / zstd .zst), verbose, exclude patterns, strip-components, target dir -C, format selector (gnu/posix/ustar/pax), preserve permissions/xattrs. Auto-matching compression flag + extension, tar-bomb and absolute-path guards, per-flag plain-English explanation, recipe library, history (max 20), shareable URL. 100% client-side — commands are generated, never executed.",
  category: "developer",
  keywords: [
    "tar command builder", "tar command generator", "tar czvf", "tar xzvf",
    "tar extract to directory", "tar -C", "tar exclude files", "tar.gz",
    "tar.bz2", "tar.xz", "tar.zst", "tar strip components", "tar list files",
    "tar append update", "gnu tar", "bsd tar", "tar bomb", "tar preserve permissions",
  ],
  icon: "archive",
  requiresNetwork: false,
  seo: {
    title: "tar Archive Command Builder — Visual tar Command Generator with Per-Flag Explanation | UnQTools",
    faq: [
      {
        q: "Why does this tar builder exist when I can just google 'tar czvf'?",
        a: "Because the #1 tar footgun is flag-order confusion: people forget that f must precede the filename, mix up c (create) / x (extract) / t (list), and pair the wrong compression flag with the wrong extension (z = gzip .gz, j = bzip2 .bz2, J = xz .xz, --zstd = zstd .zst). This builder picks the right mode letter, the right compression flag, the matching extension, and the right ordering for c/x/t, then explains each flag in plain English so you actually learn the syntax instead of cargo-culting it.",
      },
      {
        q: "How do I extract a tar.gz into a specific directory?",
        a: "Use -C <dir> AFTER the archive name: 'tar -xzf archive.tar.gz -C /target/dir'. The order matters — f must come before the filename, and -C must come after the archive name so tar knows which archive's contents go into that directory. With strip-components=N you can also strip N leading path elements, e.g. 'tar -xzf archive.tar.gz --strip-components=1 -C /target/dir' to drop the top-level folder.",
      },
      {
        q: "What is a tar bomb and how do I avoid it?",
        a: "A 'tar bomb' is an archive that doesn't have a single top-level directory — extracting it dumps all files into the current working directory, polluting it. The builder warns whenever you're extracting without -C (extract-to-directory) and recommends the safe pattern: first list contents ('tar -tzf archive.tar.gz'), then extract into a fresh directory ('mkdir out && tar -xzf archive.tar.gz -C out'). The tool also flags absolute paths and ../ in entries which would escape the target dir.",
      },
      {
        q: "What's the difference between GNU tar and BSD tar (macOS)?",
        a: "GNU tar (Linux default) supports --zstd, --xattrs, --acls, --format=gnu|posix|ustar|pax, -J for xz, and --strip-components natively. BSD tar (macOS / FreeBSD, the 'bsdtar' binary) uses different default formats, auto-detects compression from the file extension (so you can often write 'tar xf archive.tar.gz' without the z), and supports libarchive formats (zip, iso, etc). The builder generates GNU-tar-valid commands by default and adds a BSD note when the syntax differs (e.g. --zstd needs GNU tar ≥ 1.31).",
      },
      {
        q: "What extra features does this tool have?",
        a: "(1) 4 modes — create / extract / list / append-update. (2) 5 compression choices with auto-matching flag and extension. (3) Verbose, preserve-permissions, preserve-xattrs, numeric-owner toggles. (4) Exclude patterns (--exclude / -X exclude-file). (5) --strip-components for extract. (6) Target dir -C with correct ordering. (7) Format selector (gnu/posix/ustar/pax). (8) Tar-bomb + absolute-path + ../ guards with warnings. (9) Per-flag plain-English explanation. (10) Verify mode (-W) toggle. (11) Recipe library (10 common one-liners). (12) GNU/BSD notes. (13) Shell-quoting of archive name and paths. (14) Copy command + download. (15) localStorage history (max 20). (16) Shareable URL with embedded config. 100% client-side — commands are generated, never executed.",
      },
    ],
  },
  status: "done",
};
