/**
 * Glob Pattern Tester — Tool Manifest.
 * Tool #333 — Category 4 (Developer & Code).
 *
 * Test glob patterns against a set of file paths with selectable flavors
 * (shell, .gitignore, minimatch/picomatch, tsconfig), include/exclude
 * multi-pattern resolution, per-token explanation, match highlighting, a
 * directory tree view, and copyable matched/unmatched lists. 100% client-side.
 */
import type { ToolManifest } from "../../../lib/tool";

export const manifest: ToolManifest = {
  id: "glob-pattern-tester",
  name: "Glob Pattern Tester",
  description:
    "Test glob patterns against file paths with *, **, ?, [abc], [a-z], [!x], and {a,b} brace expansion. Convert glob to regex, explain each token, highlight matches, and resolve multi-pattern include/exclude sets. Four flavors: shell glob, .gitignore, minimatch/picomatch, and tsconfig. Toggle case-sensitivity, dot (hidden files), and globstar. Directory tree view, sample paths, presets, history (localStorage), and shareable URL. 100% client-side.",
  category: "developer",
  keywords: [
    "glob", "glob pattern", "glob tester", "glob regex",
    "minimatch", "picomatch", "gitignore tester", "globstar",
    "wildcard matcher", "brace expansion", "char class",
    "tsconfig include", "file pattern matcher",
  ],
  icon: "file-search",
  requiresNetwork: false,
  seo: {
    title: "Glob Pattern Tester — *, **, ?, [], {} · 4 Flavors · Live Match | UnQTools",
    faq: [
      {
        q: "Which glob syntax features are supported?",
        a: "All five core wildcards: `*` (any chars except `/`), `**` (globstar — crosses `/` when enabled), `?` (single char), `[abc]` / `[a-z]` / `[!xyz]` (character classes with negation), and `{a,b,c}` (brace expansion). Backslash path separators are auto-normalized to forward slashes; regex-special literal chars (`.`, `+`, `(`, `)`, etc.) are auto-escaped so they match literally.",
      },
      {
        q: "What's the difference between the four flavors?",
        a: "(1) Shell glob — POSIX bash/zsh behavior. (2) .gitignore — trailing `/` matches directories only, leading `/` anchors to the gitignore file's directory, `!` prefix negates (un-ignores). (3) minimatch / picomatch — npm/webpack/eslint/ripgrep --glob semantics, equivalent to shell with globstar on. (4) tsconfig — TypeScript's include/exclude field semantics, equivalent to minimatch.",
      },
      {
        q: "How do include + exclude (negation) patterns work?",
        a: "Add multiple patterns and toggle each as Include or Exclude. A path is included only if at least one Include pattern matches AND no Exclude pattern matches. With no Include patterns, everything is included by default (then Exclude filters apply). For gitignore flavor, you can also use the `!` prefix directly in the pattern text — the tester treats it the same way.",
      },
      {
        q: "How does the dot toggle work?",
        a: "When dot is off (default), `*` and `?` will NOT match a leading `.` in a filename — so `*` matches `foo.txt` but not `.env`. This mirrors the standard shell/gitignore default. Toggle dot on to match dotfiles with `*`.",
      },
      {
        q: "What extra features does this tool have versus other glob testers?",
        a: "(1) Four flavors: shell, .gitignore, minimatch/picomatch, tsconfig. (2) Multi-pattern include/exclude with negation `!`. (3) Per-token explanation of every wildcard in the pattern. (4) Glob → regex conversion with the source string shown. (5) Match highlighting — which parts of each path matched. (6) Directory tree view of all paths with matched/unmatched/excluded colors. (7) Three toggles: case-sensitive, dot (hidden files), globstar. (8) Brace `{a,b,c}` and char-class `[a-z]` / `[!x]` support with examples. (9) Windows backslash path normalization. (10) Sample path tree loader + preset patterns. (11) Copy matched list / shareable URL. (12) Stats (total / matched / unmatched / excluded). (13) History (localStorage, last 20). 100% client-side — your paths are never uploaded, no ads.",
      },
    ],
  },
  status: "done",
};
