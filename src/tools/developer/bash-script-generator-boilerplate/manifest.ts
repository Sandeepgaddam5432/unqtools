/**
 * Bash Script Generator / Boilerplate — Tool Manifest.
 * Tool #323 — Category 4 (Developer & Code).
 *
 * Generate a hardened, shellcheck-clean Bash script skeleton from a
 * few choices: shebang, strict mode, getopts-style flag parser with
 * auto-generated usage(), EXIT/ERR/INT traps with temp-dir cleanup,
 * logging helpers (info/warn/error to stderr with optional colors),
 * dependency-check block, dry-run scaffolding, root-required check,
 * OS detection, and positional argument validation. Five bundled
 * presets cover file ops, system info, backup, deployment, and
 * monitoring. 100% client-side templating; nothing uploaded.
 */
import type { ToolManifest } from "../../../lib/tool";

export const manifest: ToolManifest = {
  id: "bash-script-generator-boilerplate",
  name: "Bash Script Generator / Boilerplate",
  description:
    "Generate a hardened, shellcheck-clean Bash script skeleton from a few choices: shebang, strict mode (set -euo pipefail), getopts/long-option flag parser with auto-generated usage() and --help, EXIT/ERR/INT traps with temp-dir cleanup, logging helpers (info/warn/error to stderr with optional colors), dependency-check, dry-run scaffolding, root-required check, OS detection, and positional argument validation. Five presets: file ops, system info, backup, deployment, monitoring. Copy/download .sh, shareable URL. 100% client-side.",
  category: "developer",
  keywords: [
    "bash script generator", "bash boilerplate", "bash strict mode",
    "set -euo pipefail", "getopts generator", "bash argument parser",
    "shell script skeleton", "bash template", "bash scaffolding",
    "shellcheck clean", "trap cleanup bash", "bash usage generator",
  ],
  icon: "terminal",
  requiresNetwork: false,
  seo: {
    title: "Bash Script Generator / Boilerplate — Strict Mode, getopts, Traps | UnQTools",
    faq: [
      {
        q: "What does the Bash Script Generator produce?",
        a: "A hardened, shellcheck-clean Bash skeleton assembled from your choices: shebang (#!/usr/bin/env bash or #!/bin/bash), strict mode (set -euo pipefail, IFS=$'\\n\\t'), an auto-generated usage() and --help from your declared flags, a getopts/long-option argument parser, EXIT/ERR/INT traps with mktemp -d cleanup, logging helpers (info/warn/error to stderr with optional colors and --verbose/--quiet), a dependency-check block, dry-run scaffolding, optional root-required check, optional OS detection, and positional argument validation.",
      },
      {
        q: "How do I declare flags and positional arguments?",
        a: "Add a flag row with a short letter (e.g. f), a long name (e.g. --file), a description, whether it takes a value, whether it's required, and an optional default. Add a positional with a name, description, and required toggle. The generator emits a parser that handles short/long flags (with `--flag=value` and `--flag value` forms), validates required flags, applies defaults, validates required positionals, and prints usage on error or --help.",
      },
      {
        q: "Are the generated traps and cleanup safe?",
        a: "Yes. When traps are enabled the script creates a temp dir with `TMP_DIR=\"$(mktemp -d)\"` and registers a cleanup function on EXIT, INT, and ERR that `rm -rf \"$TMP_DIR\"`. The ERR trap prints the failing line number and exit code. On ERR the script exits non-zero so `set -e` semantics are preserved. Inline comments explain each section.",
      },
      {
        q: "Will the output pass ShellCheck?",
        a: "Yes — the generator targets ShellCheck-clean output. Every variable expansion is double-quoted, `$(...)` is used instead of backticks, `[` is replaced with `[[`, `echo -e` is avoided in favor of `printf`, and `function` keyword is omitted. There are a few intentional SC2086-free patterns (e.g. inside `(( ))`); each is documented with a comment.",
      },
      {
        q: "What extra features does this tool have versus copy-paste gists?",
        a: "(1) Shebang + strict-mode toggles. (2) Flag declaration table → generated parser with --help. (3) Positional argument declarations with required validation. (4) EXIT/ERR/INT traps with mktemp -d cleanup. (5) Logging helpers (info/warn/error to stderr, optional colors, --verbose/--quiet). (6) Dependency-check block (command -v guards). (7) Dry-run scaffolding (--dry-run flag wired in). (8) Root-required check. (9) OS detection. (10) Five presets: file-ops, system-info, backup, deployment, monitoring. (11) Live preview as you edit. (12) Copy / download .sh. (13) Shareable URL preset. (14) Inline explanatory comments. (15) Configurable script name + description. 100% client-side — your config never leaves the browser.",
      },
    ],
  },
  status: "done",
};
