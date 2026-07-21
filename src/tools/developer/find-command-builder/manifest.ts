/**
 * find Command Builder — Tool Manifest.
 * Tool #328 — Category 4 (Developer & Code).
 *
 * Assemble correct `find` commands from a UI — path, name/glob, type,
 * size, time, depth, and actions like -exec/-delete — with plain-English
 * explanation, GNU-vs-BSD variant toggle, dangerous-action warnings,
 * -print0/xargs -0 safe-filename pattern, and recipe library. Pure
 * client-side command generation; nothing is executed or uploaded.
 */
import type { ToolManifest } from "../../../lib/tool";

export const manifest: ToolManifest = {
  id: "find-command-builder",
  name: "find Command Builder",
  description:
    "Build correct find commands visually — path, name glob, type (f/d/l), size, time (mtime/mmin/newer), depth, permissions, owner, actions (print, exec \\; / exec +, xargs, delete), boolean AND/OR/NOT with properly-escaped parentheses. Toggle GNU vs BSD/macOS variants. Per-option plain-English explanation, dangerous-action warnings (-delete/-exec rm), -print0/xargs -0 safe pattern, recipe library, history (max 20), shareable URL. 100% client-side — commands are generated, never executed.",
  category: "developer",
  keywords: [
    "find command builder", "find command generator", "find exec example",
    "find by size", "find files modified", "GNU vs BSD find", "find delete files",
    "find by name", "find by type", "find mtime", "find permissions",
    "find newer than", "find -print0 xargs", "find predicate",
    "find empty files",
  ],
  icon: "folder-search",
  requiresNetwork: false,
  seo: {
    title: "find Command Builder — Visual UI, GNU/BSD Variants, Per-Option Explanation | UnQTools",
    faq: [
      {
        q: "What's the difference between GNU find and BSD/macOS find?",
        a: "GNU findutils (Linux) supports -printf for custom output formatting, -regextype for choosing regex engines (emacs, posix-awk, posix-egrep), -delete with implicit depth-first ordering, and -execdir. BSD/macOS find lacks -printf (you pipe to stat or use ls -la), uses posix-basic or posix-extended regex via -E, and has stricter -delete semantics that require the directory to be empty. This builder has a GNU/BSD toggle that switches unavailable features and shows variant-specific notes.",
      },
      {
        q: "What's the difference between -exec cmd {} \\; and -exec cmd {} + ?",
        a: "\\; runs the command once PER matching file (cmd file1; cmd file2; ...). + batches matching files into as few invocations as possible (cmd file1 file2 file3 ...) — much faster, but {} must be the LAST argument before +. The builder picks the right terminator based on your choice and explains the difference. For destructive commands like rm, + can be risky because one bad path passes everything to rm at once.",
      },
      {
        q: "Why is -delete dangerous and how does the builder help?",
        a: "find -delete silently removes files matching your predicates. Common mistakes: forgetting -name so EVERYTHING under the path gets deleted, or putting -delete before -name so find evaluates -delete on every entry before filtering. The builder (1) always places predicates BEFORE actions in the generated command, (2) shows a red destructive badge whenever -delete or -exec rm is selected, (3) recommends a -print preview first, and (4) suggests -print0 | xargs -0 rm as the safer xargs pattern for filenames with spaces.",
      },
      {
        q: "How does -mtime n work? What about +n and -n?",
        a: "find -mtime n matches files modified EXACTLY n*24h ago (fractional days round down, so -mtime 1 means between 24h and 48h ago). -mtime +n means MORE than n*24h ago (older). -mtime -n means LESS than n*24h ago (newer). For finer granularity use -mmin (minutes). For relative comparison use -newer file (modified after file) or -newermt '2024-01-01' (GNU only, after a date). The builder explains the boundary semantics with each option.",
      },
      {
        q: "What extra features does this tool have?",
        a: "(1) Visual predicate composer: name/iname, type (f/d/l/b/c/p), size (+/-N with k/M/G units), time (mtime/mmin, +n/n/-n, -newer), depth (maxdepth/mindepth), perm (octal/symbolic), user/group, empty, paths. (2) Boolean AND/OR/NOT with properly-escaped \\( \\) groups. (3) Action: print (default), -exec cmd {} \\; / {} +, xargs (-print0 | xargs -0), -delete (guarded). (4) GNU vs BSD variant toggle with feature-availability notes. (5) Per-option plain-English explanation. (6) Plain-English command summary. (7) Dangerous-action warnings. (8) -print0/xargs -0 safe-filename pattern. (9) Recipe library (12 common one-liners). (10) Shell-quoting of arguments. (11) Copy command + download. (12) Validation with errors + warnings. (13) localStorage history (max 20). (14) Shareable URL with embedded config. 100% client-side — nothing is executed or uploaded.",
      },
    ],
  },
  status: "done",
};
