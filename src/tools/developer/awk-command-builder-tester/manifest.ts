/**
 * awk Command Builder & Tester — Tool Manifest.
 * Tool #325 — Category 4 (Developer & Code).
 *
 * Build and test awk one-liners in the browser. A pure-JavaScript awk
 * interpreter (no WASM, no network) runs the program against sample
 * input — supporting BEGIN/END blocks, pattern { action } rules,
 * field separators (-F / FS), -v variables, $0/$1/$N, NR/NF, OFS,
 * print/printf, if/while/for, length/tolower/toupper/substr/split,
 * regex patterns, arithmetic, comparisons, and string concatenation.
 * Plus a visual builder (columns, condition, aggregation), per-option
 * explanation, reverse program explainer, sample-data library, recipe
 * presets, history (localStorage, max 20), and shareable URL. 100%
 * client-side — your data never leaves the device.
 */
import type { ToolManifest } from "../../../lib/tool";

export const manifest: ToolManifest = {
  id: "awk-command-builder-tester",
  name: "awk Command Builder & Tester",
  description:
    "Build and test awk one-liners in the browser. A pure-JavaScript awk interpreter (no WASM, no network) runs BEGIN/END blocks, pattern { action } rules, field separators (-F / FS), -v variables, $0/$1/$N, NR/NF, OFS, print/printf, if/while/for, length/tolower/toupper/substr/split, regex patterns, arithmetic, comparisons, and string concatenation. Visual builder (pick columns, add a condition, choose an aggregation → generates the program), per-option plain-English explanation, reverse program explainer, sample-data library, recipe presets, GNU vs POSIX toggle, copy-ready `awk -F',' '{print $1,$3}' file` command, history (max 20), shareable URL. 100% client-side.",
  category: "developer",
  keywords: [
    "awk online", "awk tester", "awk command builder", "awk explainer",
    "awk print columns", "awk field separator", "awk sum column",
    "awk one-liner", "awk playground", "learn awk", "awk -F",
    "awk BEGIN END", "awk NR NF", "awk filter rows", "awk vs sed",
  ],
  icon: "terminal",
  requiresNetwork: false,
  seo: {
    title: "awk Command Builder & Tester — Pure-JS awk, Visual Builder, Explainer | UnQTools",
    faq: [
      {
        q: "Is this a real awk engine?",
        a: "It's a small pure-JavaScript awk interpreter built from scratch — no WASM, no network. It supports BEGIN/END blocks, pattern { action } rules, $0/$1/$N field access, NR/NF special variables, the -F field-separator flag, -v variable assignment, FS/OFS, print and printf, if/else, while, for, length/tolower/toupper/substr/split, arithmetic (+ - * / %), comparisons (== != < > <= >=), logical operators (&& || !), string concatenation, and /regex/ patterns. For features outside this subset (e.g. gawk-only extensions, associative arrays, functions, BEGINFILE/ENDFILE) use awk.js.org or gawk directly.",
      },
      {
        q: "How does the visual builder work?",
        a: "Pick the columns to print (comma-separated, e.g. 1,3), optionally add a condition (e.g. $2 > 100 or /pattern/), optionally choose an aggregation (sum, avg, min, max, count), choose a field separator, and the builder generates a valid awk program AND a copy-ready command `awk -F',' '{print $1,$3}' file`. Each option has a plain-English explanation showing what -F, -v, BEGIN, END, NR, NF, and OFS do in your specific program.",
      },
      {
        q: "What does the reverse explainer do?",
        a: "Paste any awk program (from a Stack Overflow answer or shell history) and the explainer annotates each token: $1, $2 → first/second field; NR → current record number; NF → field count; BEGIN{}/END{} → setup/teardown blocks; -F',' → comma field separator; -v var=val → variable pre-assignment; /pattern/ → regex match; print → output. Each annotation is plain English so non-experts can read the program.",
      },
      {
        q: "How does field separator handling work?",
        a: "Use -F',' (or FS=\",\" in BEGIN) for CSV, -F'\t' for TSV, -F':' for /etc/passwd. Default whitespace FS treats runs of spaces/tabs as a single separator and trims leading/trailing — matching awk CLI behavior. Multi-character literal separators (e.g. -F'::') are supported; regex separators (e.g. -F'[,:]' to split on either comma or colon) are also supported by the interpreter.",
      },
      {
        q: "What extra features does this tool have versus awk.js.org?",
        a: "(1) Pure-JS interpreter — instant load, works offline, no WASM. (2) Visual builder that generates valid awk for print columns, filter by pattern, sum/avg/min/max/count. (3) Per-option explanation in plain English. (4) Reverse explainer that annotates a pasted program. (5) Recipe library (10 common one-liners). (6) Sample data library (CSV, TSV, /etc/passwd, access log). (7) GNU vs POSIX toggle changes the example invocation comment. (8) Auto shell-quoting of the program (single quotes, with proper escaping). (9) Copy command + copy output. (10) localStorage history (max 20). (11) Shareable URL with embedded program + input. 100% client-side — your text never leaves the device.",
      },
    ],
  },
  status: "done",
};
