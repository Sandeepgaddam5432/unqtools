/**
 * sed Command Builder & Tester — Tool Manifest.
 * Tool #326 — Category 4 (Developer & Code).
 *
 * Build and test sed commands against sample text in the browser. A
 * pure-JavaScript sed interpreter (no WASM, no network) supports
 * substitute (s///), delete (d), print (p), insert (i), append (a),
 * change (c), and next (n) commands with line addressing (single,
 * range, $, /regex/), BRE and ERE (-E) regex flavours, flags
 * (g, i, p, N), -n suppress-auto-print, -i in-place (preview only),
 * auto delimiter selection (/, |, #, ~, ^) when search/replace
 * contains a slash, GNU-vs-BSD -i guidance, and per-command plain-
 * English explanation. Plus visual builder, reverse explainer, recipe
 * library, sample-text presets, history (localStorage, max 20), and
 * shareable URL. 100% client-side — preview only, never edits files.
 */
import type { ToolManifest } from "../../../lib/tool";

export const manifest: ToolManifest = {
  id: "sed-command-builder-tester",
  name: "sed Command Builder & Tester",
  description:
    "Build and test sed commands against sample text in the browser. A pure-JavaScript sed interpreter (no WASM, no network) supports substitute (s///), delete (d), print (p), insert (i), append (a), change (c), and next (n) commands with line addressing (single line, range, $, /regex/), BRE and ERE (-E) regex flavours, flags (g, i, p, N), -n suppress-auto-print, -i in-place preview, auto delimiter selection (/, |, #, ~, ^) when search/replace contains a slash, GNU-vs-BSD -i guidance, backreference helper (\\1..\\9 and &), and per-command plain-English explanation. Visual builder, reverse explainer, recipe library, sample-text presets, history (max 20), shareable URL. Preview only — never edits real files. 100% client-side.",
  category: "developer",
  keywords: [
    "sed online", "sed tester", "sed command generator", "sed find and replace",
    "sed -i in place", "sed delete lines", "GNU vs BSD sed", "sed playground",
    "sed substitute", "s command sed", "sed regex", "sed one-liner",
    "learn sed", "sed -n -e", "sed insert append",
  ],
  icon: "terminal",
  requiresNetwork: false,
  seo: {
    title: "sed Command Builder & Tester — Pure-JS sed, Visual Builder, ERE/BRE | UnQTools",
    faq: [
      {
        q: "Is this a real sed engine?",
        a: "It's a small pure-JavaJavaScript sed interpreter built from scratch — no WASM, no network. It supports the seven most-used commands — s (substitute), d (delete), p (print), i (insert), a (append), c (change), n (next) — with line addressing (single line N, range N,M, last line $, /regex/ pattern addresses), BRE and ERE (-E) regex flavours, flags (g, i, p, N), -n suppress-auto-print, and -i in-place preview. For features outside this subset (e.g. hold space hHgGxNPD, branch labels, multi-line N, runtime :labels) use sed.js.org or GNU sed directly.",
      },
      {
        q: "How does the visual builder work?",
        a: "Pick a command (substitute, delete, insert, append, change, print), fill in a small form (search, replace, line range, flags, delimiter), and the builder generates a valid sed script AND a copy-ready command `sed -E 's/foo/bar/g' file`. The auto-delimiter picks a safe separator (|, #, ~, ^) when your search or replace contains a /, so paths like /usr/local/bin don't break the command. Each command has a plain-English explanation.",
      },
      {
        q: "How does the auto-delimiter work?",
        a: "sed's s command uses / as the default delimiter: s/search/replace/. If your search or replace string contains / (e.g. a file path), the command would break. The builder detects this and switches to a different character — | by default, then #, ~, ^, %, @, !, ;, :, ,, . — whichever doesn't appear in your strings. The generated command uses the chosen delimiter consistently: s|/usr/local/bin|/opt/bin|g.",
      },
      {
        q: "What about sed -i (in-place editing)?",
        a: "This tool NEVER edits real files — it's a preview-only tester. But the generated command shows the correct -i syntax for both GNU sed (Linux: `sed -i 's/.../.../' file` or with backup `sed -i.bak 's/.../.../' file`) and BSD/macOS sed (`sed -i '' 's/.../.../' file` or `sed -i.bak 's/.../.../' file`). Toggle the GNU/BSD switch to see the right invocation for your platform.",
      },
      {
        q: "What extra features does this tool have versus sed.js.org?",
        a: "(1) Pure-JS interpreter — instant load, works offline, no WASM. (2) Visual builder for s/d/p/i/a/c/n with line addressing. (3) Auto-delimiter selection (|, #, ~, ^, …) when search/replace contains /. (4) BRE vs ERE (-E) toggle with backreference helper (\\1..\\9 and &). (5) Per-command plain-English explanation. (6) Reverse explainer that annotates a pasted sed script. (7) GNU vs BSD/macOS -i guidance. (8) Recipe library (12 common one-liners). (9) Sample-text library (CSV, log, code, config). (10) -n suppress-auto-print flag. (11) Diff view between input and output. (12) Copy command + copy output. (13) localStorage history (max 20). (14) Shareable URL with embedded script + input. 100% client-side — preview only, never edits real files.",
      },
    ],
  },
  status: "done",
};
