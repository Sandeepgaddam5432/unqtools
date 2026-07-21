/**
 * rsync Command Builder — Tool Manifest.
 * Tool #330 — Category 4 (Developer & Code).
 *
 * Build correct `rsync` commands for local / push / pull sync — pick
 * archive mode, verbose, compress, delete, dry-run, excludes, SSH
 * transport (key/port), bandwidth limit, partial, checksum. Visualize the
 * trailing-slash effect, auto-suggest dry-run for destructive runs, explain
 * every flag in plain English. Common recipe library. History (localStorage,
 * max 20). Shareable URL. 100% client-side — commands are generated, never
 * executed.
 */
import type { ToolManifest } from "../../../lib/tool";

export const manifest: ToolManifest = {
  id: "rsync-command-builder",
  name: "rsync Command Builder",
  description:
    "Build correct rsync commands from a visual UI — local, push, and pull direction, trailing-slash visualizer (src/ copies contents vs src copies the dir), archive -a, verbose -v, compress -z, human -h, progress --progress, --delete (guarded with dry-run nudge), --delete-excluded, --exclude / --exclude-from, --partial, --bwlimit, --checksum, --numeric-ids, SSH transport (-e 'ssh -i key -p port'), preserve-detail breakdown of -a as -rlptgoD. Per-flag plain-English explanation, recipe library, history (max 20), shareable URL. 100% client-side — commands are generated, never executed.",
  category: "developer",
  keywords: [
    "rsync command builder", "rsync command generator", "rsync trailing slash",
    "rsync over ssh", "rsync delete option", "rsync exclude", "rsync dry run",
    "rsync archive mode", "rsync -a -v -z", "rsync -e ssh", "rsync push pull",
    "rsync bandwidth limit", "rsync partial", "rsync checksum", "rsync numeric ids",
  ],
  icon: "refresh-cw",
  requiresNetwork: false,
  seo: {
    title: "rsync Command Builder — Visual rsync Generator with Trailing-Slash Visualizer | UnQTools",
    faq: [
      {
        q: "Why does the trailing slash on the source matter so much in rsync?",
        a: "It is the #1 rsync footgun. `rsync -a src/ dest/` copies the CONTENTS of src/ into dest/ (so dest/file.txt). `rsync -a src dest/` (no trailing slash) copies the src DIRECTORY itself into dest/ (so dest/src/file.txt). The trailing slash on the DESTINATION is generally irrelevant. This builder visualizes exactly what lands where for both source variants so you can verify before you run.",
      },
      {
        q: "How does this builder handle the dangerous --delete flag?",
        a: "rsync --delete removes files in the destination that no longer exist in the source — it is genuinely dangerous and a frequent cause of data loss. The builder always recommends --dry-run alongside --delete (a red badge + nudge), warns when --delete is enabled without --dry-run, and shows a tip about --delete-excluded (which also deletes excluded files in dest, even more dangerous). The default archive mode (-a) preserves perms, times, ownership, symlinks, devices; --delete only adds removal of missing files.",
      },
      {
        q: "How do I sync over SSH with a custom key and port?",
        a: "Use -e 'ssh -i ~/.ssh/key -p 2222' (single-quoted so the inner flags are passed to ssh verbatim). For a push: `rsync -avz -e 'ssh -i ~/.ssh/key -p 2222' ./local/ user@host:/remote/path/`. For a pull, swap source and destination: `rsync -avz -e 'ssh -i ~/.ssh/key -p 2222' user@host:/remote/path/ ./local/`. The builder builds the -e string for you from the SSH key, port, and extra ssh options fields.",
      },
      {
        q: "What does -a (archive mode) actually do?",
        a: "-a is shorthand for -rlptgoD: r=recursive, l=symlinks (copy as symlinks), p=permissions, t=times (mtime), g=group, o=owner (needs root), D=devices+specials (needs root). It does NOT include -H (hard links), -A (ACLs), -X (xattrs), or -z (compression). The builder's explanation panel breaks down each sub-flag so you know exactly what -a buys you and what you might want to add.",
      },
      {
        q: "What extra features does this tool have?",
        a: "(1) Direction selector — local, push (local→remote), pull (remote→local). (2) Trailing-slash visualizer showing what lands where. (3) 9 toggle flags — archive, verbose, compress, human-readable, progress, partial, checksum, numeric-ids, dry-run. (4) --delete and --delete-excluded (guarded, with dry-run nudge). (5) Excludes list + --exclude-from file. (6) Bandwidth limit (--bwlimit KB/s). (7) SSH transport builder — key, port, extra ssh options. (8) Preserve-detail breakdown of -a as -rlptgoD. (9) Per-flag plain-English explanation. (10) Recipe library (10 common one-liners). (11) Shell-quoting of paths and SSH strings. (12) Copy command + download. (13) localStorage history (max 20). (14) Shareable URL with embedded config. 100% client-side — commands are generated, never executed.",
      },
    ],
  },
  status: "done",
};
