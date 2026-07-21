/**
 * grep / ripgrep Command Builder — Tool Manifest.
 * Tool #327 — Category 4 (Developer & Code).
 *
 * Build correct `grep` and `ripgrep (rg)` commands from a UI — pattern,
 * flags, file globs, context lines — and test the pattern against sample
 * text live, with side-by-side grep↔rg flag translation. Per-flag
 * explanation. Plain-English command summary. Sample-text presets.
 * Common-recipe library. History (localStorage, max 20). Shareable URL.
 * 100% client-side — pattern testing runs locally, nothing uploaded.
 */
import type { ToolManifest } from "../../../lib/tool";

export const manifest: ToolManifest = {
  id: "grep-ripgrep-command-builder",
  name: "grep / ripgrep Command Builder",
  description:
    "Build grep and ripgrep (rg) commands side-by-side from a visual UI. Toggle flags (ignore-case, whole-word, invert, count, line-numbers, recursive, fixed-string), choose regex flavor (BRE / ERE / PCRE / Rust regex), add file globs and context lines, then test the pattern against sample text live with the correct regex flavor. Per-flag plain-English explanation, grep↔rg translation table, recipe library, history (max 20), shareable URL. 100% client-side — your sample text never leaves the browser.",
  category: "developer",
  keywords: [
    "grep command builder", "ripgrep command generator", "rg vs grep",
    "grep -E ERE", "grep -P PCRE", "grep recursive search", "rg glob",
    "grep include exclude", "grep context lines", "rg -U multiline",
    "regex grep tester", "grep flags", "ripgrep flags",
    "grep invert match", "grep fixed string",
  ],
  icon: "search",
  requiresNetwork: false,
  seo: {
    title: "grep / ripgrep Command Builder — Visual UI, Side-by-Side, Live Pattern Tester | UnQTools",
    faq: [
      {
        q: "What's the difference between grep and ripgrep (rg)?",
        a: "GNU grep is the ubiquitous baseline; ripgrep (rg) is a modern, fast alternative that respects .gitignore and skips hidden/binary files by default. Their flags differ in subtle ways: rg's -i is the same as grep's -i (ignore case), but rg uses --glob instead of --include/--exclude, rg's regex is Rust regex by default (similar to PCRE-ish) while grep defaults to BRE. This builder emits both commands side-by-side from the same intent and shows per-flag translation notes.",
      },
      {
        q: "Which regex flavors are supported?",
        a: "Four: grep BRE (default basic regex with \\{ \\} \\( \\) metacharacters), grep -E ERE (extended — same as egrep), grep -P PCRE (Perl-compatible — GNU grep only, not on BSD/macOS by default), and ripgrep's Rust regex (a modern PCRE-ish flavor with Unicode by default). The live pattern tester uses JavaScript's RegExp adapted to approximate each flavor — BRE escapes metacharacters that ERE doesn't, ERE adds ( ) { } + ? | without backslash, and PCRE/Rust regex adds \\d \\w \\s shortcuts and lookahead/lookbehind (the tester approximates; always verify with the real tool for production use).",
      },
      {
        q: "How do file globs work in grep vs ripgrep?",
        a: "grep uses --include='*.py' and --exclude='*.log' (multiple allowed, glob anchored to filename) and --exclude-dir='node_modules' for directories. ripgrep uses -g/--glob='*.py' (negate with leading !, e.g. -g '!*.log'), -t/--type=py for built-in file types, and -T/--type-not=py to exclude. The builder generates the right flags for whichever tool you target and explains the difference.",
      },
      {
        q: "Why does ripgrep skip some of my files?",
        a: "By default rg respects .gitignore files, skips hidden files (those starting with .), and skips binary files. To override: -u (don't skip hidden), -uu (also don't skip .gitignore), -uuu (also search binary files — equivalent to grep -a -r on everything). The builder shows a note recommending -uuu when you toggle 'no filtering', and the explanation panel describes each default-filter behavior so search results are never a mystery.",
      },
      {
        q: "What extra features does this tool have?",
        a: "(1) Side-by-side grep + rg commands from the same intent. (2) 8 toggle flags (ignore-case, whole-word, invert, count, line-numbers, recursive, fixed-string, only-matching). (3) 4 regex flavors (BRE / ERE / PCRE / Rust regex). (4) File include/exclude/type globs. (5) Context lines -A/-B/-C. (6) Live pattern tester with match highlighting per flavor. (7) Per-flag plain-English explanation for both tools. (8) grep↔rg translation table with default-behavior notes. (9) Replace preview (rg --replace, preview only). (10) Multiline toggle (rg -U). (11) Recipe library (10 common one-liners). (12) Sample-text presets (log, code, csv, config). (13) Shell-quoting of pattern. (14) Copy command + copy output. (15) localStorage history (max 20). (16) Shareable URL with embedded config + sample text. 100% client-side — your sample text never leaves the browser.",
      },
    ],
  },
  status: "done",
};
