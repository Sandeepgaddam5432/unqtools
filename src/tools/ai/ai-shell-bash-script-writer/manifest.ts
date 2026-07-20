import type { ToolManifest } from "../../../lib/tool";

export const manifest: ToolManifest = {
  id: "ai-shell-bash-script-writer",
  name: "AI Shell & Bash Script Writer",
  description:
    "Write safe, commented Bash/shell scripts from plain English. Generates shebang, strict-mode (set -euo pipefail), arg parsing, usage block, error handling, and per-section comments. shellcheck-style lint flags unquoted vars, eval, cd-without-check, and destructive commands (rm -rf, dd, mkfs). POSIX vs Bash toggle, cron-ready wrapper, dry-run guard, explain-existing-script mode, copy/download, history (localStorage), shareable URL, optional BYO-key LLM. 100% client-side — nothing uploaded.",
  category: "ai",
  keywords: [
    "bash script generator", "shell script writer", "bash",
    "shell", "sh", "zsh", "plain english to bash",
    "bash script writer free", "shellcheck", "ai script generator",
    "no login bash", "CodeConvert alternative", "Workik alternative",
  ],
  icon: "terminal",
  requiresNetwork: false,
  seo: {
    title: "AI Shell & Bash Script Writer — Plain English to Safe Bash, Private | UnQTools",
    faq: [
      {
        q: "How does the AI Shell/Bash Script Writer work?",
        a: "Type a task in plain English (e.g., 'back up this folder daily and rotate old backups', 'find all .log files older than 30 days') and the tool generates a commented Bash script with safe defaults: proper shebang, `set -euo pipefail`, argument parsing, a usage/help block, error handling, and per-section comments. A rule-based keyword matcher picks the closest template family (file ops, system info, backup, deployment, monitoring, generic), then assembles the final script locally — no model upload.",
      },
      {
        q: "What safety features does the generator include?",
        a: "Every script starts with `#!/usr/bin/env bash` (or `#!/bin/sh` in POSIX mode), enables `set -euo pipefail`, and uses quoted variable expansions. The lint panel runs shellcheck-style heuristics and flags: unquoted variable expansions, eval/exec usage, cd without `|| exit`, command-substitution without quoting, world-writable chmod, and the dangerous commands (rm -rf, dd, mkfs, :(){:|:&};:) which get a red destructive-command banner and a suggested dry-run guard.",
      },
      {
        q: "What is the 'explain existing script' mode?",
        a: "Paste any existing Bash/shell script and the explainer annotates it section-by-section: it identifies the shebang line, strict-mode flags, function definitions, control structures, and notable commands, then returns a plain-English walkthrough. This is rule-based (best-effort) — it does not execute or 'understand' arbitrary code the way a BYO-key LLM can, but it works 100% offline and never uploads your script.",
      },
      {
        q: "What extra features does this tool have compared to others?",
        a: "(1) Plain-English → Bash generator with 6 template families. (2) POSIX `/bin/sh` vs Bash toggle. (3) Auto-generated usage block + `getopts` arg parser. (4) Strict-mode defaults (`set -euo pipefail`, quoted vars). (5) shellcheck-style linter (10+ rules). (6) Destructive-command detection with red banner + dry-run guard suggestion. (7) Per-section plain-English explanation. (8) Cron-ready wrapper output (lockfile + logging). (9) Dry-run mode guard injection. (10) Explain-existing-script mode. (11) Local history (last 20). (12) Shareable URL with task + options encoded. (13) Copy / download .sh. (14) Optional BYO-key LLM polish (OpenAI/Anthropic) for tricky tasks. (15) Honesty disclaimers (rule-based generator is weaker than BYO-key LLM for complex logic; always test scripts on non-critical data first).",
      },
      {
        q: "Is my data sent anywhere?",
        a: "No. All template matching, linting, explaining, and cron/dry-run wrapping run locally in your browser. Your task description and any pasted script never leave this device. The only network call is if you paste your own LLM API key and click 'Polish with LLM' — that request goes directly from your browser to the LLM provider you choose (OpenAI or Anthropic).",
      },
    ],
  },
  status: "done",
};
