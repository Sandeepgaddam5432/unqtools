/**
 * man Page / TLDR Command Reference — Tool Manifest.
 * Tool #339 — Category 4 (Developer & Code).
 *
 * Fast, searchable, example-first TLDR pages for 60+ common CLI tools
 * (ls, grep, find, tar, ssh, curl, …) — plus a deep-link to the full
 * man7.org man page when you need the details. Bundled corpus runs
 * 100% client-side; nothing is uploaded.
 */
import type { ToolManifest } from "../../../lib/tool";

export const manifest: ToolManifest = {
  id: "man-page-tldr-command-reference",
  name: "man Page / TLDR Command Reference",
  description:
    "Instant, offline-capable, example-first TLDR reference for 60+ common CLI commands (ls, grep, find, tar, ssh, curl, docker, kubectl, git, …) — searchable by command name or by task ('compress a folder' → tar/zip examples), with platform variants (common / linux / osx / windows / sunos), related-commands see-also links, deep-links to the full man7.org man page, favorites and recent history (localStorage), and a shareable deep-link to any command. 100% client-side — the tldr corpus is bundled, nothing is uploaded. No ads.",
  category: "developer",
  keywords: [
    "tldr", "tldr pages", "man page", "command examples",
    "linux commands", "unix commands", "command reference",
    "simplified man pages", "how to use tar", "how to use find",
    "how to use curl", "command line cheatsheet",
  ],
  icon: "book-open",
  requiresNetwork: false,
  seo: {
    title: "man Page / TLDR Command Reference — Example-First CLI Cheatsheet | UnQTools",
    faq: [
      {
        q: "How does the TLDR command reference work?",
        a: "Type a command name in the search bar (e.g. `tar`, `grep`, `find`) and the tool instantly shows an example-first TLDR page: a one-line description, the 3–6 most common invocations with plain-English explanations, a see-also list of related commands, and a deep-link to the full man7.org man page. The whole corpus is bundled — no install, no cache update, no network.",
      },
      {
        q: "Can I search by task instead of command name?",
        a: "Yes. Type a task phrase like 'compress a folder', 'find a file', 'download a url', or 'show running processes' and the tool matches against each command's keywords list. For example, 'compress a folder' returns tar, zip, gzip, 7z, and zstd with the exact flags you need. This is the feature the standard `man` cannot do.",
      },
      {
        q: "What about platform differences (Linux vs macOS vs Windows)?",
        a: "Each command lists which platforms it applies to (common / linux / osx / windows / sunos). Use the platform selector to filter — for example, switching to `osx` shows BSD variants of `sed`, `find`, and `tar` while hiding Linux-only flags. Commands that exist on every platform are tagged `common`.",
      },
      {
        q: "Is the corpus up to date?",
        a: "The corpus is a bundled community snapshot — see the snapshot date shown in the toolbar. It may lag the very latest `tldr-pages` updates, but the common invocations rarely change. For authoritative flags and edge cases, click the 'Open full man page' link to man7.org (or your system's `man <cmd>`).",
      },
      {
        q: "What extra features does this tool have versus the tldr CLI?",
        a: "(1) No install or cache update — the corpus is bundled. (2) Search by command name OR by task ('compress a folder'). (3) Platform filter (common / linux / osx / windows / sunos). (4) Deep-link to the full man7.org man page for every command. (5) Copy any example with one click. (6) See-also related-commands chips. (7) Favorites (star a command, stored in localStorage). (8) Recent history (last 20 viewed). (9) Snapshot date displayed in the toolbar (honesty clause). (10) Shareable deep-link to any command. (11) Category filter (files, text, network, process, system, archive, package, user, git, misc). (12) Grouped results by category. (13) Graceful fallback ('command not in tldr, here is the man page link + contribute a page note') for unknown commands. 100% client-side — no ads.",
      },
    ],
  },
  status: "done",
};
