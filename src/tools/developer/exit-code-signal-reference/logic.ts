/**
 * Exit Code & Signal Reference — pure logic.
 *
 * Decodes any Unix exit code (0–255), including the 128+N signal rule,
 * and provides a complete bidirectional signal table. Includes
 * sysexits.h reference (64–78), reserved-range guidance, bash exit-code
 * scripting snippets, and search-by-code-or-name.
 *
 * Pure functions only — no DOM, no network.
 */

// ---------------------------------------------------------------------------
// Public types
// ---------------------------------------------------------------------------

export type ExitCodeCategory =
  | "success"
  | "shell-error"
  | "signal"
  | "sysexits"
  | "out-of-range";

export type SignalAction =
  | "terminate"
  | "terminate-core"
  | "ignore"
  | "stop"
  | "continue"
  | "discard";

export interface ExitCodeEntry {
  code: number;
  /** Short identifier, e.g. "SIGKILL", "EX_USAGE". */
  name: string;
  /** One-line plain-English description. */
  description: string;
  category: ExitCodeCategory;
  /** If this exit code is 128+N, the underlying signal (number). */
  signalNumber?: number;
  /** Optional platform / context note (e.g. Docker OOM). */
  note?: string;
}

export interface SignalEntry {
  number: number;
  /** Canonical name without leading "SIG", e.g. "KILL". */
  shortName: string;
  /** Full name with "SIG" prefix, e.g. "SIGKILL". */
  name: string;
  description: string;
  /** Default disposition when no handler installed. */
  action: SignalAction;
  /** Can the process install a handler to catch it? */
  catchable: boolean;
  /** Can the process ignore it (SIG_IGN)? */
  ignorable: boolean;
  /** Common keyboard shortcut if any (e.g. Ctrl+C for SIGINT). */
  keyboard?: string;
}

export interface ScriptSnippet {
  id: string;
  title: string;
  code: string;
  description: string;
}

export interface DecodedExit {
  code: number;
  /** Wrapped code (mod 256) — only differs when code > 255 or < 0. */
  wrappedCode: number;
  /** Whether the input was out of the 0–255 byte range. */
  wrapped: boolean;
  entry?: ExitCodeEntry;
  signal?: SignalEntry;
  /** Plain-English summary line. */
  summary: string;
  /** Optional platform / context note (e.g. Docker OOM 137). */
  note?: string;
  /** Whether this code is in a reserved range. */
  reserved: boolean;
  /** Whether this code is safely usable for your own scripts. */
  safeForCustom: boolean;
}

export interface RangeInfo {
  start: number;
  end: number;
  label: string;
  description: string;
  reserved: boolean;
}

export interface Stats {
  totalExitCodes: number;
  totalSignals: number;
  byCategory: Record<ExitCodeCategory, number>;
  sysexitsCount: number;
  signalDerivedCount: number;
}

export interface HistoryEntry {
  ts: number;
  query: string;
  kind: "code" | "signal";
  summary: string;
}

// ---------------------------------------------------------------------------
// Categories + labels
// ---------------------------------------------------------------------------

export const EXIT_CATEGORY_LABELS: Record<ExitCodeCategory, string> = {
  success: "Success",
  "shell-error": "Shell error",
  signal: "Signal-derived (128+N)",
  sysexits: "sysexits.h",
  "out-of-range": "Out-of-range",
};

export const SIGNAL_ACTION_LABELS: Record<SignalAction, string> = {
  terminate: "Terminate",
  "terminate-core": "Terminate + core dump",
  ignore: "Ignored by default",
  stop: "Stop the process",
  continue: "Continue if stopped",
  discard: "Discarded (no effect)",
};

// ---------------------------------------------------------------------------
// Exit codes dataset (53 entries — 50+ as required by the blueprint)
// ---------------------------------------------------------------------------

export const EXIT_CODES: ExitCodeEntry[] = [
  // ---- Success / shell-error ----
  {
    code: 0,
    name: "SUCCESS",
    description: "Success — the command completed without errors.",
    category: "success",
  },
  {
    code: 1,
    name: "GENERAL_ERROR",
    description:
      "Catchall for general errors. Most scripts use this for any non-specific failure.",
    category: "shell-error",
  },
  {
    code: 2,
    name: "MISUSE_OF_SHELL_BUILTIN",
    description:
      "Misuse of a shell builtin (e.g. missing keyword, syntax error, bad option to a builtin).",
    category: "shell-error",
  },
  {
    code: 126,
    name: "COMMAND_NOT_EXECUTABLE",
    description:
      "Command was found but cannot be executed — typically a permission problem (file not marked executable) or a non-executable file passed to exec().",
    category: "shell-error",
    note: "Fix with: chmod +x ./script.sh",
  },
  {
    code: 127,
    name: "COMMAND_NOT_FOUND",
    description:
      "Command not found — the shell could not find the command in $PATH, or a function/script being sourced does not exist.",
    category: "shell-error",
    note: "Check $PATH and that the binary/script is installed.",
  },
  {
    code: 128,
    name: "INVALID_EXIT_ARGUMENT",
    description:
      "Invalid argument to `exit` — `exit` was called with a non-numeric value (e.g. `exit foo`).",
    category: "shell-error",
  },
  {
    code: 255,
    name: "EXIT_OUT_OF_RANGE",
    description:
      "Exit status out of range. Returned when `exit` is given a value > 255 or < 0 (the byte wraps mod 256: exit -1 → 255, exit 256 → 0).",
    category: "out-of-range",
    note: "Remember: exit codes are a single byte (0–255). Negative or >255 inputs wrap mod 256.",
  },

  // ---- sysexits.h (64–78) ----
  {
    code: 64,
    name: "EX_USAGE",
    description: "Usage error — the command was used incorrectly (bad flags, missing args).",
    category: "sysexits",
  },
  {
    code: 65,
    name: "EX_DATAERR",
    description: "Data error — input data was incorrect or malformed.",
    category: "sysexits",
  },
  {
    code: 66,
    name: "EX_NOINPUT",
    description: "No input — an input file does not exist or is not readable.",
    category: "sysexits",
  },
  {
    code: 67,
    name: "EX_NOUSER",
    description: "No user — the specified user does not exist.",
    category: "sysexits",
  },
  {
    code: 68,
    name: "EX_NOHOST",
    description: "No host — the specified host does not exist or is unreachable.",
    category: "sysexits",
  },
  {
    code: 69,
    name: "EX_UNAVAILABLE",
    description: "Service unavailable — the requested service is currently unavailable.",
    category: "sysexits",
  },
  {
    code: 70,
    name: "EX_SOFTWARE",
    description: "Internal software error — a bug or assertion failure inside the program.",
    category: "sysexits",
  },
  {
    code: 71,
    name: "EX_OSERR",
    description: "System error — the OS reported an error the program cannot handle.",
    category: "sysexits",
  },
  {
    code: 72,
    name: "EX_OSFILE",
    description: "Critical OS file missing — a system file needed by the program cannot be found.",
    category: "sysexits",
  },
  {
    code: 73,
    name: "EX_CANTCREAT",
    description: "Cannot create user output file — typically a permission issue.",
    category: "sysexits",
  },
  {
    code: 74,
    name: "EX_IOERR",
    description: "Input/output error — a generic I/O error occurred during read/write.",
    category: "sysexits",
  },
  {
    code: 75,
    name: "EX_TEMPFAIL",
    description: "Temporary failure — the operation may succeed if retried later.",
    category: "sysexits",
  },
  {
    code: 76,
    name: "EX_PROTOCOL",
    description: "Remote protocol error — the remote end returned an invalid or unexpected response.",
    category: "sysexits",
  },
  {
    code: 77,
    name: "EX_NOPERM",
    description: "Permission denied — the user lacks the required privileges.",
    category: "sysexits",
  },
  {
    code: 78,
    name: "EX_CONFIG",
    description: "Configuration error — the program's configuration is invalid or incomplete.",
    category: "sysexits",
  },

  // ---- Signal-derived (128+N), N = 1..31 ----
  {
    code: 129,
    name: "SIGHUP",
    description: "Hangup detected on the controlling terminal or death of the controlling process.",
    category: "signal",
    signalNumber: 1,
    note: "Common use: tell a daemon to reload its config (kill -HUP $(cat /var/run/app.pid)).",
  },
  {
    code: 130,
    name: "SIGINT",
    description: "Interrupt from keyboard (Ctrl+C).",
    category: "signal",
    signalNumber: 2,
    note: "130 = 128 + 2. The most common Ctrl+C exit status.",
  },
  {
    code: 131,
    name: "SIGQUIT",
    description: "Quit from keyboard (Ctrl+\\) — produces a core dump by default.",
    category: "signal",
    signalNumber: 3,
  },
  {
    code: 132,
    name: "SIGILL",
    description: "Illegal instruction — the CPU executed an instruction the process should not (often a stack/binary corruption).",
    category: "signal",
    signalNumber: 4,
  },
  {
    code: 133,
    name: "SIGTRAP",
    description: "Trace/breakpoint trap — used by debuggers (gdb, strace).",
    category: "signal",
    signalNumber: 5,
  },
  {
    code: 134,
    name: "SIGABRT",
    description: "Abort signal from abort() — typically an assertion failure or uncaught C++ exception.",
    category: "signal",
    signalNumber: 6,
  },
  {
    code: 135,
    name: "SIGBUS",
    description: "Bus error — usually an unaligned memory access or mapping issue.",
    category: "signal",
    signalNumber: 7,
  },
  {
    code: 136,
    name: "SIGFPE",
    description: "Floating-point exception — usually an integer divide-by-zero or overflow.",
    category: "signal",
    signalNumber: 8,
  },
  {
    code: 137,
    name: "SIGKILL",
    description: "Kill signal — forcibly terminate the process. Cannot be caught, blocked, or ignored.",
    category: "signal",
    signalNumber: 9,
    note: "Docker OOM: containers that exceed their memory limit are killed with SIGKILL → exit 137. Also `kill -9 <pid>`.",
  },
  {
    code: 138,
    name: "SIGUSR1",
    description: "User-defined signal 1 — applications may use this for any purpose.",
    category: "signal",
    signalNumber: 10,
  },
  {
    code: 139,
    name: "SIGSEGV",
    description: "Segmentation fault — the process accessed memory it should not (null pointer, buffer overrun, use-after-free).",
    category: "signal",
    signalNumber: 11,
    note: "139 = 128 + 11. If you see this from your own code, you have a memory bug.",
  },
  {
    code: 140,
    name: "SIGUSR2",
    description: "User-defined signal 2 — applications may use this for any purpose.",
    category: "signal",
    signalNumber: 12,
  },
  {
    code: 141,
    name: "SIGPIPE",
    description: "Broken pipe — wrote to a pipe whose reading end has been closed.",
    category: "signal",
    signalNumber: 13,
    note: "Common with `cmd | head`. Suppress with `set -o pipefail` or `trap '' PIPE`.",
  },
  {
    code: 142,
    name: "SIGALRM",
    description: "Timer signal from alarm() — used to implement timeouts.",
    category: "signal",
    signalNumber: 14,
  },
  {
    code: 143,
    name: "SIGTERM",
    description: "Termination signal — the polite way to ask a process to exit. Catchable; the process should clean up and exit.",
    category: "signal",
    signalNumber: 15,
    note: "143 = 128 + 15. The default signal sent by `kill <pid>`.",
  },
  {
    code: 144,
    name: "SIGSTKFLT",
    description: "Stack fault on coprocessor — obsolete on x86, rarely used.",
    category: "signal",
    signalNumber: 16,
  },
  {
    code: 145,
    name: "SIGCHLD",
    description: "Child process stopped or terminated — sent to the parent. (As an exit code this is unusual: it means a parent was killed via a child-status signal.)",
    category: "signal",
    signalNumber: 17,
  },
  {
    code: 146,
    name: "SIGCONT",
    description: "Continue if stopped — resumes a process previously stopped with SIGSTOP/SIGTSTP.",
    category: "signal",
    signalNumber: 18,
  },
  {
    code: 147,
    name: "SIGSTOP",
    description: "Stop the process. Cannot be caught, blocked, or ignored.",
    category: "signal",
    signalNumber: 19,
  },
  {
    code: 148,
    name: "SIGTSTP",
    description: "Stop typed at terminal (Ctrl+Z) — catchable version of SIGSTOP.",
    category: "signal",
    signalNumber: 20,
  },
  {
    code: 149,
    name: "SIGTTIN",
    description: "Background process trying to read from the terminal.",
    category: "signal",
    signalNumber: 21,
  },
  {
    code: 150,
    name: "SIGTTOU",
    description: "Background process trying to write to the terminal.",
    category: "signal",
    signalNumber: 22,
  },
  {
    code: 151,
    name: "SIGURG",
    description: "Urgent condition on a socket (out-of-band data).",
    category: "signal",
    signalNumber: 23,
  },
  {
    code: 152,
    name: "SIGXCPU",
    description: "CPU time limit exceeded (setrlimit RLIMIT_CPU).",
    category: "signal",
    signalNumber: 24,
  },
  {
    code: 153,
    name: "SIGXFSZ",
    description: "File size limit exceeded (setrlimit RLIMIT_FSIZE).",
    category: "signal",
    signalNumber: 25,
  },
  {
    code: 154,
    name: "SIGVTALRM",
    description: "Virtual alarm clock — counts only CPU time used by the process.",
    category: "signal",
    signalNumber: 26,
  },
  {
    code: 155,
    name: "SIGPROF",
    description: "Profiling timer expired — used by profilers (gprof, perf).",
    category: "signal",
    signalNumber: 27,
  },
  {
    code: 156,
    name: "SIGWINCH",
    description: "Window size change — sent to a process when its controlling terminal is resized.",
    category: "signal",
    signalNumber: 28,
  },
  {
    code: 157,
    name: "SIGIO",
    description: "I/O now possible — asynchronous I/O notification (also known as SIGPOLL on some systems).",
    category: "signal",
    signalNumber: 29,
  },
  {
    code: 158,
    name: "SIGPWR",
    description: "Power failure — sent by UPS daemons when switching to battery.",
    category: "signal",
    signalNumber: 30,
  },
  {
    code: 159,
    name: "SIGSYS",
    description: "Bad system call — the process called an unknown or blocked syscall.",
    category: "signal",
    signalNumber: 31,
  },
];

// ---------------------------------------------------------------------------
// Signals dataset (31 entries — 30+ as required by the blueprint)
// ---------------------------------------------------------------------------

export const SIGNALS: SignalEntry[] = [
  { number: 1, shortName: "HUP", name: "SIGHUP", description: "Hangup detected on controlling terminal or death of controlling process.", action: "terminate", catchable: true, ignorable: true },
  { number: 2, shortName: "INT", name: "SIGINT", description: "Interrupt from keyboard.", action: "terminate", catchable: true, ignorable: true, keyboard: "Ctrl+C" },
  { number: 3, shortName: "QUIT", name: "SIGQUIT", description: "Quit from keyboard.", action: "terminate-core", catchable: true, ignorable: true, keyboard: "Ctrl+\\" },
  { number: 4, shortName: "ILL", name: "SIGILL", description: "Illegal instruction.", action: "terminate-core", catchable: true, ignorable: true },
  { number: 5, shortName: "TRAP", name: "SIGTRAP", description: "Trace/breakpoint trap.", action: "terminate-core", catchable: true, ignorable: true },
  { number: 6, shortName: "ABRT", name: "SIGABRT", description: "Abort signal from abort().", action: "terminate-core", catchable: true, ignorable: true },
  { number: 7, shortName: "BUS", name: "SIGBUS", description: "Bus error (bad memory access).", action: "terminate-core", catchable: true, ignorable: true },
  { number: 8, shortName: "FPE", name: "SIGFPE", description: "Floating-point exception.", action: "terminate-core", catchable: true, ignorable: true },
  { number: 9, shortName: "KILL", name: "SIGKILL", description: "Kill signal. Cannot be caught, blocked, or ignored.", action: "terminate", catchable: false, ignorable: false, note: "The nuclear option. Always works (the kernel handles it directly)." },
  { number: 10, shortName: "USR1", name: "SIGUSR1", description: "User-defined signal 1.", action: "terminate", catchable: true, ignorable: true },
  { number: 11, shortName: "SEGV", name: "SIGSEGV", description: "Segmentation violation (invalid memory reference).", action: "terminate-core", catchable: true, ignorable: true },
  { number: 12, shortName: "USR2", name: "SIGUSR2", description: "User-defined signal 2.", action: "terminate", catchable: true, ignorable: true },
  { number: 13, shortName: "PIPE", name: "SIGPIPE", description: "Broken pipe: write to a pipe with no readers.", action: "terminate", catchable: true, ignorable: true },
  { number: 14, shortName: "ALRM", name: "SIGALRM", description: "Timer signal from alarm().", action: "terminate", catchable: true, ignorable: true },
  { number: 15, shortName: "TERM", name: "SIGTERM", description: "Termination signal — the polite way to ask a process to exit.", action: "terminate", catchable: true, ignorable: true, note: "Default signal sent by `kill <pid>`." },
  { number: 16, shortName: "STKFLT", name: "SIGSTKFLT", description: "Stack fault on coprocessor (unused on x86).", action: "terminate", catchable: true, ignorable: true },
  { number: 17, shortName: "CHLD", name: "SIGCHLD", description: "Child stopped or terminated.", action: "ignore", catchable: true, ignorable: true },
  { number: 18, shortName: "CONT", name: "SIGCONT", description: "Continue if stopped.", action: "continue", catchable: true, ignorable: true },
  { number: 19, shortName: "STOP", name: "SIGSTOP", description: "Stop process. Cannot be caught, blocked, or ignored.", action: "stop", catchable: false, ignorable: false, note: "Like SIGKILL, this is handled by the kernel — your process cannot prevent it." },
  { number: 20, shortName: "TSTP", name: "SIGTSTP", description: "Stop typed at terminal (catchable Ctrl+Z).", action: "stop", catchable: true, ignorable: true, keyboard: "Ctrl+Z" },
  { number: 21, shortName: "TTIN", name: "SIGTTIN", description: "Background read from tty.", action: "stop", catchable: true, ignorable: true },
  { number: 22, shortName: "TTOU", name: "SIGTTOU", description: "Background write to tty.", action: "stop", catchable: true, ignorable: true },
  { number: 23, shortName: "URG", name: "SIGURG", description: "Urgent condition on socket (OOB data).", action: "ignore", catchable: true, ignorable: true },
  { number: 24, shortName: "XCPU", name: "SIGXCPU", description: "CPU time limit exceeded (RLIMIT_CPU).", action: "terminate-core", catchable: true, ignorable: true },
  { number: 25, shortName: "XFSZ", name: "SIGXFSZ", description: "File size limit exceeded (RLIMIT_FSIZE).", action: "terminate-core", catchable: true, ignorable: true },
  { number: 26, shortName: "VTALRM", name: "SIGVTALRM", description: "Virtual alarm clock (CPU time).", action: "terminate", catchable: true, ignorable: true },
  { number: 27, shortName: "PROF", name: "SIGPROF", description: "Profiling timer expired.", action: "terminate", catchable: true, ignorable: true },
  { number: 28, shortName: "WINCH", name: "SIGWINCH", description: "Window size change.", action: "ignore", catchable: true, ignorable: true },
  { number: 29, shortName: "IO", name: "SIGIO", description: "I/O now possible (async I/O).", action: "terminate", catchable: true, ignorable: true },
  { number: 30, shortName: "PWR", name: "SIGPWR", description: "Power failure (UPS).", action: "terminate", catchable: true, ignorable: true },
  { number: 31, shortName: "SYS", name: "SIGSYS", description: "Bad system call.", action: "terminate-core", catchable: true, ignorable: true },
];

// ---------------------------------------------------------------------------
// Reserved / safe ranges
// ---------------------------------------------------------------------------

export const RESERVED_RANGES: RangeInfo[] = [
  { start: 0, end: 2, label: "Shell reserved", description: "0 success, 1 general error, 2 misuse of builtins — never use for custom meanings.", reserved: true },
  { start: 3, end: 63, label: "User-defined (safe)", description: "Free for your scripts. sysexits.h starts at 64, so stop at 63 to avoid collisions.", reserved: false },
  { start: 64, end: 78, label: "sysexits.h", description: "Reserved by the BSD sysexits.h convention (EX_USAGE … EX_CONFIG). Avoid for custom meanings.", reserved: true },
  { start: 79, end: 125, label: "User-defined (safe)", description: "Free for your scripts — the largest safe range.", reserved: false },
  { start: 126, end: 128, label: "Shell reserved", description: "126 not executable, 127 not found, 128 invalid exit arg — never use.", reserved: true },
  { start: 129, end: 159, label: "Signal-derived (128+N)", description: "Reserved — these codes mean 'killed by signal N'. Using them for your own meanings will confuse debuggers.", reserved: true },
  { start: 160, end: 199, label: "User-defined (safe)", description: "Free for your scripts.", reserved: false },
  { start: 200, end: 254, label: "User-defined (safe)", description: "Free for your scripts — a popular choice for application-specific codes.", reserved: false },
  { start: 255, end: 255, label: "Out-of-range", description: "Returned for negative or >255 exit args (mod 256). Do not use.", reserved: true },
];

export const SAFE_CUSTOM_RANGES: RangeInfo[] = RESERVED_RANGES.filter((r) => !r.reserved);

export const SYSEXITS_RANGE = { start: 64, end: 78 } as const;

// ---------------------------------------------------------------------------
// Bash scripting snippets
// ---------------------------------------------------------------------------

export const SCRIPT_SNIPPETS: ScriptSnippet[] = [
  {
    id: "capture-last-exit",
    title: "Capture the last exit code ($?)",
    code: `#!/usr/bin/env bash
cmd
status=$?
if [ $status -eq 0 ]; then
  echo "success"
else
  echo "failed with exit $status"
fi`,
    description: "Run a command, capture its exit code into a variable, then branch on it. Always save $? immediately — any other command will overwrite it.",
  },
  {
    id: "if-cmd-then",
    title: "if cmd; then … fi",
    code: `#!/usr/bin/env bash
if grep -q "error" /var/log/syslog; then
  echo "found errors"
else
  echo "no errors"
fi`,
    description: "The classic pattern — `if` runs the command and checks its exit status: 0 = true, non-zero = false.",
  },
  {
    id: "command-or-exit",
    title: "Exit on first failure (command || exit)",
    code: `#!/usr/bin/env bash
set -e          # exit on any non-zero status
set -o pipefail # treat a failed pipe as a failure
set -u          # treat unset variables as an error

mkdir -p /opt/app
cp ./app.bin /opt/app/
systemctl restart app`,
    description: "`set -euo pipefail` is the defensive-scripting starter pack — exit on error, treat unset vars as errors, and propagate failures through pipelines.",
  },
  {
    id: "trap-cleanup",
    title: "Trap signals for cleanup",
    code: `#!/usr/bin/env bash
cleanup() {
  echo "Cleaning up..."
  rm -f /tmp/app.lock
  exit
}
# Catch SIGINT (Ctrl+C), SIGTERM (kill), and EXIT (script end)
trap cleanup INT TERM EXIT

echo "Running..."
touch /tmp/app.lock
sleep 60`,
    description: "Use `trap` to run a cleanup function when the script exits — whether normally, via Ctrl+C, or via SIGTERM. Critical for releasing lock files.",
  },
  {
    id: "case-on-status",
    title: "Branch on exit code",
    code: `#!/usr/bin/env bash
pgrep nginx >/dev/null
case $? in
  0)   echo "nginx is running" ;;
  1)   echo "nginx is NOT running" ;;
  2)   echo "syntax error in pgrep" ;;
  127) echo "pgrep not found" ;;
  *)   echo "unexpected exit $?" ;;
esac`,
    description: "A case statement on $? is the cleanest way to handle a known set of exit codes (0/1/2/127).",
  },
  {
    id: "retry-on-tempfail",
    title: "Retry on temporary failure (sysexits EX_TEMPFAIL=75)",
    code: `#!/usr/bin/env bash
for attempt in 1 2 3 4 5; do
  curl -fsS https://api.example.com/health && exit 0
  echo "attempt $attempt failed; sleeping..."
  sleep $((attempt * 2))
done
exit 75  # EX_TEMPFAIL — operation may succeed if retried later`,
    description: "Use the sysexits.h convention: return 75 (EX_TEMPFAIL) when the caller should retry. Pair with exponential backoff.",
  },
  {
    id: "kill-process",
    title: "Send a signal with kill",
    code: `#!/usr/bin/env bash
# Polite shutdown — give the process 10s to clean up
kill -TERM "$pid"   # SIGTERM (15) — default
sleep 10

# Still alive? Force-kill — no chance to clean up
if kill -0 "$pid" 2>/dev/null; then
  kill -KILL "$pid" # SIGKILL (9) — cannot be caught
fi`,
    description: "Two-phase shutdown: SIGTERM first (catchable, lets the process clean up), then SIGKILL as a last resort (cannot be caught, blocked, or ignored).",
  },
  {
    id: "exit-with-code",
    title: "Exit with an explicit code",
    code: `#!/usr/bin/env bash
if [ -z "$API_KEY" ]; then
  echo "ERROR: API_KEY is not set" >&2
  exit 78  # EX_CONFIG — configuration error
fi

# ... do work ...
exit 0   # success`,
    description: "Use the sysexits.h range (64–78) for application-specific errors so your scripts can branch on them. Here, 78 = EX_CONFIG means a config problem, not a runtime failure.",
  },
];

// ---------------------------------------------------------------------------
// Lookup + decode
// ---------------------------------------------------------------------------

export function getExitCode(code: number): ExitCodeEntry | undefined {
  return EXIT_CODES.find((e) => e.code === code);
}

export function getSignalByName(name: string): SignalEntry | undefined {
  const lower = name.trim().toLowerCase();
  if (!lower) return undefined;
  return SIGNALS.find((s) => {
    const variants = [s.name.toLowerCase(), s.shortName.toLowerCase(), s.name.toLowerCase().replace(/^sig/, "")];
    return variants.includes(lower);
  });
}

export function getSignalByNumber(num: number): SignalEntry | undefined {
  return SIGNALS.find((s) => s.number === num);
}

/** Wrap an exit code into the 0–255 byte range (mod 256). */
export function wrapExitCode(code: number): number {
  if (!Number.isFinite(code)) return 255;
  // Handle negative values correctly: -1 → 255, -2 → 254, etc.
  return ((Math.trunc(code) % 256) + 256) % 256;
}

export function isReserved(code: number): boolean {
  return RESERVED_RANGES.some((r) => code >= r.start && code <= r.end && r.reserved);
}

export function isSafeForCustom(code: number): boolean {
  return SAFE_CUSTOM_RANGES.some((r) => code >= r.start && code <= r.end);
}

/** Find the range that contains a given code. */
export function findRange(code: number): RangeInfo | undefined {
  return RESERVED_RANGES.find((r) => code >= r.start && code <= r.end);
}

/**
 * Decode any integer (or numeric string) as an exit code.
 *
 * - Wraps values outside 0–255 (mod 256).
 * - Auto-applies the 128+N signal rule (codes 129–159 = SIG HUP…SYS).
 * - Explains 255 = out-of-range.
 * - Provides reserved / safe-for-custom guidance.
 */
export function decodeExitCode(input: number | string): DecodedExit {
  const raw = typeof input === "string" ? parseInt(input.trim(), 10) : input;
  const isNumericInput = typeof input === "number" || (typeof input === "string" && input.trim() !== "" && /^-?\d+$/.test(input.trim()));
  const wrapped = wrapExitCode(raw);
  const wrappedFlag = isNumericInput && raw !== wrapped;
  const entry = getExitCode(wrapped);
  let signal: SignalEntry | undefined;
  if (wrapped >= 129 && wrapped <= 159) {
    const sigNum = wrapped - 128;
    signal = getSignalByNumber(sigNum);
  }
  const reserved = isReserved(wrapped);
  const safeForCustom = isSafeForCustom(wrapped);

  let summary: string;
  if (entry) {
    summary = `${wrapped} — ${entry.name}: ${entry.description}`;
  } else if (wrapped >= 129 && wrapped <= 159 && signal) {
    summary = `${wrapped} = 128 + ${signal.number} = ${signal.name} — ${signal.description}`;
  } else if (wrapped === 0) {
    summary = "0 — Success";
  } else if (wrapped === 255) {
    summary = "255 — Exit status out of range (the byte wrapped mod 256).";
  } else {
    const range = findRange(wrapped);
    summary = range
      ? `${wrapped} — ${range.label}: ${range.description}`
      : `${wrapped} — Unreserved exit code (safe for custom use).`;
  }

  return {
    code: raw,
    wrappedCode: wrapped,
    wrapped: wrappedFlag,
    entry,
    signal,
    summary,
    note: entry?.note ?? signal?.note,
    reserved,
    safeForCustom,
  };
}

/** Decode a signal input — accepts a number (1–31) or a name (SIGKILL, KILL, sigkill). */
export function decodeSignal(input: string | number): SignalEntry | undefined {
  if (typeof input === "number") return getSignalByNumber(input);
  const trimmed = input.trim();
  if (!trimmed) return undefined;
  // Try as integer first
  if (/^-?\d+$/.test(trimmed)) {
    const n = parseInt(trimmed, 10);
    return getSignalByNumber(n);
  }
  return getSignalByName(trimmed);
}

// ---------------------------------------------------------------------------
// Search
// ---------------------------------------------------------------------------

export function searchExitCodes(query: string): ExitCodeEntry[] {
  const q = query.trim().toLowerCase();
  if (!q) return EXIT_CODES.slice();
  const exact: ExitCodeEntry[] = [];
  const startsWith: ExitCodeEntry[] = [];
  const includes: ExitCodeEntry[] = [];
  for (const e of EXIT_CODES) {
    const name = e.name.toLowerCase();
    const desc = e.description.toLowerCase();
    const codeStr = String(e.code);
    if (codeStr === q || name === q) exact.push(e);
    else if (codeStr.startsWith(q) || name.startsWith(q)) startsWith.push(e);
    else if (name.includes(q) || desc.includes(q)) includes.push(e);
  }
  return [...exact, ...startsWith, ...includes];
}

export function searchSignals(query: string): SignalEntry[] {
  const q = query.trim().toLowerCase();
  if (!q) return SIGNALS.slice();
  const exact: SignalEntry[] = [];
  const startsWith: SignalEntry[] = [];
  const includes: SignalEntry[] = [];
  for (const s of SIGNALS) {
    const name = s.name.toLowerCase();
    const shortName = s.shortName.toLowerCase();
    const desc = s.description.toLowerCase();
    const numStr = String(s.number);
    if (numStr === q || name === q || shortName === q) exact.push(s);
    else if (numStr.startsWith(q) || name.startsWith(q) || shortName.startsWith(q)) startsWith.push(s);
    else if (name.includes(q) || shortName.includes(q) || desc.includes(q)) includes.push(s);
  }
  return [...exact, ...startsWith, ...includes];
}

/** Smart query — figures out whether you typed a code or a signal name. */
export function smartSearch(query: string): {
  decoded?: DecodedExit;
  signal?: SignalEntry;
  exitCodes: ExitCodeEntry[];
  signals: SignalEntry[];
} {
  const q = query.trim();
  if (!q) {
    return { exitCodes: EXIT_CODES.slice(), signals: SIGNALS.slice() };
  }
  // Numeric? → decode as exit code
  if (/^-?\d+$/.test(q)) {
    const decoded = decodeExitCode(parseInt(q, 10));
    return {
      decoded,
      exitCodes: searchExitCodes(q),
      signals: searchSignals(q),
    };
  }
  // Signal name? → decode as signal
  const sig = decodeSignal(q);
  if (sig) {
    return {
      signal: sig,
      decoded: decodeExitCode(128 + sig.number), // also decode the corresponding exit code
      exitCodes: searchExitCodes(q),
      signals: searchSignals(q),
    };
  }
  // Fallback: textual search across both tables
  return {
    exitCodes: searchExitCodes(q),
    signals: searchSignals(q),
  };
}

// ---------------------------------------------------------------------------
// Stats
// ---------------------------------------------------------------------------

export function computeStats(): Stats {
  const byCategory: Record<ExitCodeCategory, number> = {
    success: 0,
    "shell-error": 0,
    signal: 0,
    sysexits: 0,
    "out-of-range": 0,
  };
  for (const e of EXIT_CODES) byCategory[e.category] += 1;
  return {
    totalExitCodes: EXIT_CODES.length,
    totalSignals: SIGNALS.length,
    byCategory,
    sysexitsCount: byCategory.sysexits,
    signalDerivedCount: byCategory.signal,
  };
}

// ---------------------------------------------------------------------------
// History (localStorage)
// ---------------------------------------------------------------------------

const HISTORY_KEY = "unqtools:exit-code-signal-reference:history";
const HISTORY_MAX = 20;

export function loadHistory(): HistoryEntry[] {
  if (typeof localStorage === "undefined") return [];
  try {
    const raw = localStorage.getItem(HISTORY_KEY);
    if (!raw) return [];
    const arr = JSON.parse(raw) as HistoryEntry[];
    return Array.isArray(arr) ? arr.slice(0, HISTORY_MAX) : [];
  } catch {
    return [];
  }
}

export function saveHistory(entry: HistoryEntry): HistoryEntry[] {
  // Dedupe by query+kind (keep most recent)
  const prev = loadHistory().filter(
    (h) => !(h.query === entry.query && h.kind === entry.kind),
  );
  const next = [entry, ...prev].slice(0, HISTORY_MAX);
  if (typeof localStorage !== "undefined") {
    try {
      localStorage.setItem(HISTORY_KEY, JSON.stringify(next));
    } catch {
      // ignore
    }
  }
  return next;
}

export function clearHistory(): void {
  if (typeof localStorage === "undefined") return;
  try {
    localStorage.removeItem(HISTORY_KEY);
  } catch {
    // ignore
  }
}

// ---------------------------------------------------------------------------
// Shareable deep-link to a code or signal
// ---------------------------------------------------------------------------

export function buildShareUrl(query: string): string {
  const params = new URLSearchParams();
  if (query.trim()) params.set("q", query.trim());
  if (typeof window === "undefined") return `?${params.toString()}`;
  return `${window.location.origin}${window.location.pathname}#${params.toString()}`;
}

export function parseShareUrl(hash: string): { query: string } {
  const clean = hash.startsWith("#") ? hash.slice(1) : hash;
  if (!clean) return { query: "" };
  const params = new URLSearchParams(clean);
  return { query: (params.get("q") ?? "").trim() };
}

// ---------------------------------------------------------------------------
// Render helpers
// ---------------------------------------------------------------------------

/** Render an exit-code entry as a single-line summary. */
export function renderExitSummary(e: ExitCodeEntry): string {
  return `${e.code}\t${e.name}\t${e.description}`;
}

/** Render a signal entry as a single-line summary. */
export function renderSignalSummary(s: SignalEntry): string {
  const parts = [
    String(s.number),
    s.name,
    SIGNAL_ACTION_LABELS[s.action],
    s.catchable ? "catchable" : "non-catchable",
    s.ignorable ? "ignorable" : "non-ignorable",
  ];
  if (s.keyboard) parts.push(`(${s.keyboard})`);
  parts.push(s.description);
  return parts.join("\t");
}

/** Render the full exit-code table as TSV (header + rows). */
export function renderExitTable(): string {
  const header = "code\tname\tcategory\tdescription";
  const rows = EXIT_CODES.map((e) =>
    [String(e.code), e.name, EXIT_CATEGORY_LABELS[e.category], e.description].join("\t"),
  );
  return [header, ...rows].join("\n");
}

/** Render the full signal table as TSV (header + rows). */
export function renderSignalTable(): string {
  const header = "number\tname\taction\tcatchable\tignorable\tkeyboard\tdescription";
  const rows = SIGNALS.map((s) =>
    [
      String(s.number),
      s.name,
      SIGNAL_ACTION_LABELS[s.action],
      s.catchable ? "yes" : "no",
      s.ignorable ? "yes" : "no",
      s.keyboard ?? "",
      s.description,
    ].join("\t"),
  );
  return [header, ...rows].join("\n");
}
