/**
 * Exit Code & Signal Reference — Tool Manifest.
 * Tool #340 — Category 4 (Developer & Code).
 *
 * Decode any Unix exit code (0–255), including the 128+N signal rule
 * (137 = SIGKILL, 139 = SIGSEGV, 143 = SIGTERM). Full bidirectional
 * signal table (number ↔ name ↔ default action ↔ catchable). sysexits.h
 * reference (64–78). Bash scripting snippets (`$?`, `trap`, `set -e`).
 * 100% client-side — pure lookup, no network.
 */
import type { ToolManifest } from "../../../lib/tool";

export const manifest: ToolManifest = {
  id: "exit-code-signal-reference",
  name: "Exit Code & Signal Reference",
  description:
    "Decode any Unix exit code (0–255) including the 128+N signal rule (137 = SIGKILL, 139 = SIGSEGV, 143 = SIGTERM), with a complete bidirectional signal table (number ↔ name ↔ default action ↔ catchable), sysexits.h reference (EX_USAGE 64 … EX_CONFIG 78), reserved-range guidance, bash scripting snippets ($?, trap, set -e), Docker OOM 137 callout, and search by code OR signal name. 100% client-side — pure lookup, runs offline, no ads.",
  category: "developer",
  keywords: [
    "linux exit codes", "exit code 137", "exit code 139",
    "exit code 127", "exit code 130", "exit code 143",
    "128+signal", "bash exit status", "signal numbers list",
    "unix signals", "sigkill", "sigsegv", "sigterm", "sigint",
    "sysexits", "docker oom 137", "exit code reference",
  ],
  icon: "log-out",
  requiresNetwork: false,
  seo: {
    title: "Exit Code & Signal Reference — Decode 128+N, sysexits.h, Signal Table | UnQTools",
    faq: [
      {
        q: "What does exit code 137 mean?",
        a: "Exit code 137 = 128 + 9 = SIGKILL — the process was forcibly killed. In Docker, 137 almost always means the container hit its memory limit and the kernel OOM-killer sent SIGKILL. Outside Docker, you may have run `kill -9 <pid>`. SIGKILL cannot be caught, blocked, or ignored, so the process is terminated immediately by the kernel.",
      },
      {
        q: "How does the 128+N signal rule work?",
        a: "When a Unix process is terminated by a signal `N`, the parent shell reports the exit status as `128 + N`. So 130 = 128 + 2 = SIGINT (Ctrl+C), 139 = 128 + 11 = SIGSEGV (segfault), 143 = 128 + 15 = SIGTERM. Note: this rule only applies to signal-terminated processes — your own `exit 137` does NOT mean SIGKILL, it just exits with the integer 137.",
      },
      {
        q: "What are the reserved bash exit codes I should not use?",
        a: "Avoid 0 (success), 1 (general error), 2 (misuse of builtins), 126 (not executable), 127 (command not found), 128 (invalid exit argument), 128+N (signal termination, N=1..31), and 255 (out-of-range). The sysexits.h range 64–78 is also reserved by convention (EX_USAGE … EX_CONFIG). For your own scripts, pick codes in 3–63 or 79–125 to avoid collisions.",
      },
      {
        q: "Why does exit 256 still return 0?",
        a: "Unix exit codes are a single unsigned byte (0–255). Any integer passed to `exit` is taken modulo 256: `exit 256` becomes 0, `exit 257` becomes 1, `exit -1` becomes 255. This is why 255 is often shown as 'out-of-range' — it is what you get from any negative or >255 input. The tool explains this wrap-around for every code above 128.",
      },
      {
        q: "What extra features does this tool have compared to scattered blog posts?",
        a: "(1) Decode any code 0–255 with the 128+N signal rule auto-applied. (2) Complete signal table — number, name, default action, catchable/ignorable flags. (3) Reverse lookup by signal name (SIGKILL → 9) or by number (9 → SIGKILL). (4) sysexits.h reference (EX_USAGE 64 … EX_CONFIG 78) with usage notes. (5) Reserved-range guide + safe custom-code suggestion. (6) Bash scripting snippets ($?, trap, set -e, set -o pipefail, command || exit). (7) Docker OOM 137 callout. (8) Day-of-week vs day-of-month-style confusions (SIGINT 130 vs SIGTERM 143 vs SIGKILL 137). (9) Code-wrap explanation (mod 256). (10) Searchable both ways (code → meaning, signal name ↔ number). (11) Shareable deep-link to any code or signal. (12) Recent history (localStorage, last 20). 100% client-side — no ads, no tracking.",
      },
    ],
  },
  status: "done",
};
