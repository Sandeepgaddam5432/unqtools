/**
 * Shell Command Explainer — Tool Manifest.
 * Tool #322 — Category 4 (Developer & Code).
 *
 * Tokenize a shell command line and explain each token (command,
 * flag, flag-value, positional arg, operator) from a bundled offline
 * manpage/tldr dataset. Splits combined short flags, tracks which
 * flags consume the next argument, breaks pipelines and redirections
 * into stages, and flags destructive commands (rm -rf, dd, mkfs,
 * chmod 777, fork bombs). 100% client-side; the command you paste
 * never leaves the browser.
 */
import type { ToolManifest } from "../../../lib/tool";

export const manifest: ToolManifest = {
  id: "shell-command-explainer",
  name: "Shell Command Explainer",
  description:
    "Paste any shell command line and get every token (command, flags, flag-values, positionals, operators) explained from a bundled offline manpage/tldr dataset. Splits combined short flags (ls -la → -l + -a), knows which flags take a value, decomposes pipelines (|, &&, ||, ;), redirections (> >> < 2>&1 &>), and flags destructive commands (rm -rf, dd of=/dev/sdX, mkfs, chmod 777, fork bombs). 100% client-side; nothing uploaded.",
  category: "developer",
  keywords: [
    "shell", "command", "explain shell command", "bash explainer",
    "explainshell", "explainshell alternative", "what does this command do",
    "terminal command", "command line", "linux command explainer",
    "pipeline", "redirection", "rm -rf", "flag explainer",
  ],
  icon: "terminal",
  requiresNetwork: false,
  seo: {
    title: "Shell Command Explainer — Tokenize, Explain Flags, Flag Dangers | UnQTools",
    faq: [
      {
        q: "How does the shell command explainer work?",
        a: "First a shell-aware tokenizer splits your command line into tokens (respecting single/double quotes, backslash escapes, and the -- separator). Each command's flags are looked up in a bundled offline manpage/tldr snapshot. Combined short flags like `ls -la` are split into `-l` and `-a`. The explainer knows which flags consume the next argument (`grep -e PATTERN`, `find -name GLOB`), so flag-values are classified correctly. Pipelines, redirections, and the &&, ||, ;, & operators are each broken out as separate stages.",
      },
      {
        q: "Does it warn me about dangerous commands?",
        a: "Yes. The danger linter flags: `rm -rf` (especially on /, ~, or $HOME), `dd of=/dev/sd*` or any raw-disk write, `mkfs` on a real device, `chmod 777`, fork bombs (`:(){ :|:& };:`), `kill -9 -1`, pipe-to-shell (`curl … | sh`), and `> /dev/sda`. Each warning explains what the command does and suggests a safer alternative where one exists.",
      },
      {
        q: "Can it handle pipelines and redirections?",
        a: "Yes. The tokenizer recognizes `|`, `>`, `>>`, `<`, `2>`, `2>&1`, `&>`, `&&`, `||`, `;`, and trailing `&`. Each segment between operators becomes a pipeline stage with its own per-token breakdown, and the operators themselves are annotated with their shell semantics.",
      },
      {
        q: "What if a command isn't in the bundled dataset?",
        a: "The structure of the command is still parsed and explained token-by-token — the command itself is marked 'not in dataset' and you get a hint to install tldr/man locally for the canonical reference. Honesty clause: the bundled snapshot is a curated subset of common GNU/BSD tools; it can lag your exact local version.",
      },
      {
        q: "What extra features does this tool have versus explainshell?",
        a: "(1) 100% client-side — no server, no manpage scraping, works offline. (2) Shell-grammar-aware tokenizer handling quotes, escapes, $() and backticks. (3) Combined short-flag splitter (`-la` → `-l -a`). (4) Per-flag 'takes a value' detection so flag-values aren't misclassified as positionals. (5) Pipeline & redirection decomposition with per-stage explanation. (6) Danger linter for rm -rf / dd / mkfs / chmod 777 / fork bombs / pipe-to-shell. (7) Plain-English whole-line summary. (8) GNU vs BSD variant toggle where flags differ. (9) Subcommand awareness (git log, docker run). (10) Hover/click-to-highlight a token. (11) Copy annotated explanation as text. (12) localStorage history (max 20). (13) Shareable URL. (14) `--` separator handling. 100% offline once loaded.",
      },
    ],
  },
  status: "done",
};
