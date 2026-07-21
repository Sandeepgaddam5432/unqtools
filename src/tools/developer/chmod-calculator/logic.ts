/**
 * Chmod (File Permission) Calculator — pure logic.
 *
 * Two-way converter between octal (755), symbolic (rwxr-xr-x), and a
 * 9-bit + 3-bit special grid. Supports symbolic-mode arithmetic
 * (u+x, go-w, a=r), a security linter, umask companion, and copy-ready
 * chmod command generation. 100% client-side; pure bitwise math.
 *
 * Bit layout (4-digit octal, special-first):
 *   special  owner  group  other
 *   ┌─┐      ┌─┬─┬─┐ ┌─┬─┬─┐ ┌─┬─┬─┐
 *   │S│      │r│w│x│ │r│w│x│ │r│w│x│
 *   └─┘      └─┴─┴─┘ └─┴─┴─┘ └─┴─┴─┘
 *   S = setuid(4) | setgid(2) | sticky(1)
 *   r=4 w=2 x=1   (same in each triplet)
 */

// ---------------------------------------------------------------------------
// Public types
// ---------------------------------------------------------------------------

export type Scope = "owner" | "group" | "other";
export type PermBit = "read" | "write" | "execute";
export type SpecialBit = "setuid" | "setgid" | "sticky";
export type FileMode = "file" | "directory";
export type ChmodVariant = "numeric" | "symbolic";

export interface Triplet {
  read: boolean;
  write: boolean;
  execute: boolean;
}

export interface ChmodMode {
  owner: Triplet;
  group: Triplet;
  other: Triplet;
  setuid: boolean;
  setgid: boolean;
  sticky: boolean;
}

export interface ModePreset {
  id: string;
  label: string;
  octal: string;
  description: string;
}

export interface LintIssue {
  level: "danger" | "warning" | "info";
  message: string;
}

export interface LintResult {
  issues: LintIssue[];
  ok: boolean;
}

export interface ExplainRow {
  scope: Scope | "special";
  bit: PermBit | SpecialBit;
  on: boolean;
  text: string;
}

export interface BuildOptions {
  /** Recursive (-R) flag on the chmod command. */
  recursive?: boolean;
  /** Use the verbose -v flag. */
  verbose?: boolean;
  /** Use the changes-only -c flag (implies verbose). */
  changes?: boolean;
  /** Use --reference=FILE instead of a numeric/symbolic mode. */
  reference?: string;
  /** Use the safer find -type d/-type f -exec pattern instead of -R. */
  safeRecursive?: boolean;
}

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

export const SCOPES: Scope[] = ["owner", "group", "other"];
export const PERM_BITS: PermBit[] = ["read", "write", "execute"];
export const SPECIAL_BITS: SpecialBit[] = ["setuid", "setgid", "sticky"];

export const SCOPE_LABELS: Record<Scope, string> = {
  owner: "Owner (user)",
  group: "Group",
  other: "Other (world)",
};

export const BIT_LABELS: Record<PermBit, string> = {
  read: "read",
  write: "write",
  execute: "execute",
};

export const BIT_VALUES: Record<PermBit, number> = {
  read: 4,
  write: 2,
  execute: 1,
};

export const SPECIAL_VALUES: Record<SpecialBit, number> = {
  setuid: 4,
  setgid: 2,
  sticky: 1,
};

export const PRESETS: ModePreset[] = [
  { id: "644", label: "644 — File", octal: "644", description: "Standard readable file: owner rw, group/other r." },
  { id: "755", label: "755 — Executable/Dir", octal: "755", description: "Owner rwx, group/other r-x. Executable files and traversable dirs." },
  { id: "600", label: "600 — Private file", octal: "600", description: "Owner rw only. Use for SSH private keys and secrets." },
  { id: "700", label: "700 — Private dir", octal: "700", description: "Owner rwx only. Use for ~/.ssh and other private dirs." },
  { id: "666", label: "666 — Read/write all", octal: "666", description: "rw for everyone. Avoid on real systems — no execute." },
  { id: "777", label: "777 — World-writable", octal: "777", description: "rwx for everyone. Almost always a security mistake." },
  { id: "1777", label: "1777 — Sticky /tmp", octal: "1777", description: "World-writable with sticky bit: only the file owner can delete. /tmp uses this." },
  { id: "4755", label: "4755 — setuid", octal: "4755", description: "setuid + 755. Runs as the file's owner (e.g. sudo, passwd)." },
  { id: "2755", label: "2755 — setgid dir", octal: "2755", description: "setgid + 755. New files in the dir inherit the dir's group." },
  { id: "750", label: "750 — Group executable", octal: "750", description: "Owner rwx, group r-x, other none. Common for shared binaries." },
  { id: "640", label: "640 — Group readable", octal: "640", description: "Owner rw, group r, other none. Common for shared config." },
];

// ---------------------------------------------------------------------------
// Constructors
// ---------------------------------------------------------------------------

export function emptyMode(): ChmodMode {
  return {
    owner: { read: false, write: false, execute: false },
    group: { read: false, write: false, execute: false },
    other: { read: false, write: false, execute: false },
    setuid: false,
    setgid: false,
    sticky: false,
  };
}

export function cloneMode(m: ChmodMode): ChmodMode {
  return {
    owner: { ...m.owner },
    group: { ...m.group },
    other: { ...m.other },
    setuid: m.setuid,
    setgid: m.setgid,
    sticky: m.sticky,
  };
}

// ---------------------------------------------------------------------------
// Octal ↔ mode
// ---------------------------------------------------------------------------

/** Parse a 3- or 4-digit octal string (e.g. "755", "0755", "4755") into a mode. */
export function parseOctal(input: string): ChmodMode | null {
  if (!input) return null;
  const cleaned = input.trim().replace(/^0+(?=\d{3,4}$)/, "");
  if (!/^[0-7]{3,4}$/.test(cleaned)) return null;
  let special = 0;
  let digits = cleaned;
  if (cleaned.length === 4) {
    special = parseInt(cleaned[0]!, 10);
    digits = cleaned.slice(1);
  }
  const o = parseInt(digits[0]!, 10);
  const g = parseInt(digits[1]!, 10);
  const w = parseInt(digits[2]!, 10);
  return {
    owner: {
      read: !!(o & 4),
      write: !!(o & 2),
      execute: !!(o & 1),
    },
    group: {
      read: !!(g & 4),
      write: !!(g & 2),
      execute: !!(g & 1),
    },
    other: {
      read: !!(w & 4),
      write: !!(w & 2),
      execute: !!(w & 1),
    },
    setuid: !!(special & 4),
    setgid: !!(special & 2),
    sticky: !!(special & 1),
  };
}

/** Render a mode as the canonical 4-digit octal (with leading zero if needed). */
export function modeToOctal(m: ChmodMode): string {
  const special =
    (m.setuid ? 4 : 0) + (m.setgid ? 2 : 0) + (m.sticky ? 1 : 0);
  const o = tripletToInt(m.owner);
  const g = tripletToInt(m.group);
  const w = tripletToInt(m.other);
  return `${special}${o}${g}${w}`;
}

/** Render a mode as the 3-digit octal without special bits (e.g. "755"). */
export function modeToShortOctal(m: ChmodMode): string {
  return `${tripletToInt(m.owner)}${tripletToInt(m.group)}${tripletToInt(m.other)}`;
}

/** Render a mode as the 3-digit octal but include a leading special digit when any is set (e.g. "4755"), otherwise 3 digits ("755"). */
export function modeToSmartOctal(m: ChmodMode): string {
  const special =
    (m.setuid ? 4 : 0) + (m.setgid ? 2 : 0) + (m.sticky ? 1 : 0);
  return special > 0
    ? `${special}${modeToShortOctal(m)}`
    : modeToShortOctal(m);
}

function tripletToInt(t: Triplet): number {
  return (t.read ? 4 : 0) + (t.write ? 2 : 0) + (t.execute ? 1 : 0);
}

// ---------------------------------------------------------------------------
// Symbolic ↔ mode (rwxr-xr-x style, 9 chars, with special-bit case)
// ---------------------------------------------------------------------------

/** Render a mode as 9-char rwxr-xr-x (no special bits). */
export function modeToSymbolicShort(m: ChmodMode): string {
  return `${tripletToSymbol(m.owner)}${tripletToSymbol(m.group)}${tripletToSymbol(m.other)}`;
}

/** Render a mode as 9-char rwxr-xr-x with special-bit case substitution (s/S/t/T). */
export function modeToSymbolic(m: ChmodMode): string {
  const o = tripletToSymbol(m.owner);
  const g = tripletToSymbol(m.group);
  const w = tripletToSymbol(m.other);
  // Special bit case logic:
  //   setuid + x → 's', setuid without x → 'S' (replaces owner execute position)
  //   setgid + x → 's', setgid without x → 'S' (replaces group execute position)
  //   sticky + x → 't', sticky without x → 'T' (replaces other execute position)
  const oArr = o.split("");
  const gArr = g.split("");
  const wArr = w.split("");
  if (m.setuid) oArr[2] = m.owner.execute ? "s" : "S";
  if (m.setgid) gArr[2] = m.group.execute ? "s" : "S";
  if (m.sticky) wArr[2] = m.other.execute ? "t" : "T";
  return `${oArr.join("")}${gArr.join("")}${wArr.join("")}`;
}

function tripletToSymbol(t: Triplet): string {
  return `${t.read ? "r" : "-"}${t.write ? "w" : "-"}${t.execute ? "x" : "-"}`;
}

/**
 * Parse a symbolic permission string (9 chars rwxr-xr-x, with optional
 * s/S/t/T in the execute positions) into a mode. Returns null on
 * unparseable input.
 */
export function symbolicToMode(sym: string): ChmodMode | null {
  if (!sym) return null;
  // Strip a leading file-type char if present (e.g. "drwxr-xr-x").
  let s = sym.trim();
  if (s.length === 10 && /^[dlbcps-]/.test(s)) s = s.slice(1);
  if (!/^[-rwxstST]{9}$/.test(s)) return null;
  const chars = s.split("");
  const owner = symToTriplet(chars[0]!, chars[1]!, chars[2]!);
  const group = symToTriplet(chars[3]!, chars[4]!, chars[5]!);
  const other = symToTriplet(chars[6]!, chars[7]!, chars[8]!);
  // Decode special bits from case in the execute column.
  const setuid = chars[2] === "s" || chars[2] === "S";
  const setgid = chars[5] === "s" || chars[5] === "S";
  const sticky = chars[8] === "t" || chars[8] === "T";
  // Restore the real execute bit: lowercase s/t means execute is on;
  // uppercase S/T means execute is off (the special bit is set without x).
  if (chars[2] === "s") owner.execute = true;
  if (chars[2] === "S") owner.execute = false;
  if (chars[5] === "s") group.execute = true;
  if (chars[5] === "S") group.execute = false;
  if (chars[8] === "t") other.execute = true;
  if (chars[8] === "T") other.execute = false;
  return { owner, group, other, setuid, setgid, sticky };
}

function symToTriplet(r: string, w: string, x: string): Triplet {
  return {
    read: r === "r",
    write: w === "w",
    execute: x === "x",
  };
}

// ---------------------------------------------------------------------------
// Symbolic-mode arithmetic (chmod u+x,go-w style)
// ---------------------------------------------------------------------------

export interface SymbolicClause {
  /** Who: subset of u/g/o/a. Empty means 'a' (all). */
  who: ("u" | "g" | "o")[];
  /** Operation: +, -, = */
  op: "+" | "-" | "=";
  /** What bits to apply: r/w/x/X/s/t. */
  bits: string;
}

/** Parse a comma-separated symbolic expression like "u+x,go-w,a=r". */
export function parseSymbolicExpr(input: string): SymbolicClause[] | null {
  if (!input) return null;
  const trimmed = input.trim();
  if (!trimmed) return null;
  const parts = trimmed.split(",").map((p) => p.trim()).filter(Boolean);
  if (parts.length === 0) return null;
  const clauses: SymbolicClause[] = [];
  for (const p of parts) {
    // [ugoa]*[+-=][rwxXstugo]+   (require at least one bit so "u+" is rejected)
    const m = /^([ugoa]*)([+\-=])([rwxXstugo]+)$/.exec(p);
    if (!m) return null;
    const whoRaw = m[1] || "a";
    const op = m[2] as "+" | "-" | "=";
    const bits = m[3] || "";
    const who: ("u" | "g" | "o")[] = [];
    if (whoRaw.includes("a") || whoRaw === "") {
      who.push("u", "g", "o");
    } else {
      if (whoRaw.includes("u")) who.push("u");
      if (whoRaw.includes("g")) who.push("g");
      if (whoRaw.includes("o")) who.push("o");
    }
    clauses.push({ who, op, bits });
  }
  return clauses;
}

/** Apply a parsed symbolic expression to a mode (returns a new mode). */
export function applySymbolicExpr(mode: ChmodMode, clauses: SymbolicClause[]): ChmodMode {
  const next = cloneMode(mode);
  for (const c of clauses) {
    for (const w of c.who) {
      const scope = w === "u" ? "owner" : w === "g" ? "group" : "other";
      applyClauseToScope(next, scope, c);
    }
    // setuid/setgid/sticky handled globally for 'a' or 'u'/'g'/'o' mapping.
    if (c.bits.includes("s")) {
      // 's' applies to owner (setuid) and/or group (setgid) depending on who.
      const setSetuid = c.who.includes("u");
      const setSetgid = c.who.includes("g");
      if (c.op === "+" || c.op === "=") {
        if (setSetuid) next.setuid = true;
        if (setSetgid) next.setgid = true;
      } else if (c.op === "-") {
        if (setSetuid) next.setuid = false;
        if (setSetgid) next.setgid = false;
      }
    }
    if (c.bits.includes("t")) {
      // sticky bit only meaningful for "other" or "a".
      if (c.op === "+" || c.op === "=") next.sticky = true;
      else if (c.op === "-") next.sticky = false;
    }
  }
  return next;
}

function applyClauseToScope(mode: ChmodMode, scope: Scope, c: SymbolicClause): void {
  const t = mode[scope];
  if (c.op === "=") {
    t.read = c.bits.includes("r");
    t.write = c.bits.includes("w");
    // 'x' (always) or 'X' (only if already a dir, or any execute bit is set).
    t.execute = computeExecuteBit(c.bits, mode, scope);
  } else if (c.op === "+") {
    if (c.bits.includes("r")) t.read = true;
    if (c.bits.includes("w")) t.write = true;
    if (c.bits.includes("x") || c.bits.includes("X")) {
      const x = computeExecuteBit(c.bits, mode, scope);
      if (x) t.execute = true;
    }
  } else if (c.op === "-") {
    if (c.bits.includes("r")) t.read = false;
    if (c.bits.includes("w")) t.write = false;
    if (c.bits.includes("x") || c.bits.includes("X")) t.execute = false;
  }
}

/** 'X' = conditional execute: apply only if file is a directory OR any execute bit is already set. */
function computeExecuteBit(bits: string, mode: ChmodMode, _scope: Scope): boolean {
  if (bits.includes("x") && !bits.includes("X")) return true;
  if (bits.includes("X")) {
    // Conditional execute: true if any execute bit already on (in the mode)
    // OR if treating as a directory (we treat as a directory externally via
    // a flag; here we use "any execute already on" as the heuristic).
    return mode.owner.execute || mode.group.execute || mode.other.execute;
  }
  return false;
}

/** Convenience: parse + apply a symbolic expression string in one call. */
export function applySymbolicString(mode: ChmodMode, input: string): ChmodMode | null {
  const clauses = parseSymbolicExpr(input);
  if (!clauses) return null;
  return applySymbolicExpr(mode, clauses);
}

// ---------------------------------------------------------------------------
// Grid mutators
// ---------------------------------------------------------------------------

export function toggleBit(mode: ChmodMode, scope: Scope, bit: PermBit): ChmodMode {
  const next = cloneMode(mode);
  next[scope][bit] = !next[scope][bit];
  return next;
}

export function setBit(mode: ChmodMode, scope: Scope, bit: PermBit, on: boolean): ChmodMode {
  const next = cloneMode(mode);
  next[scope][bit] = on;
  return next;
}

export function toggleSpecial(mode: ChmodMode, special: SpecialBit): ChmodMode {
  const next = cloneMode(mode);
  next[special] = !next[special];
  return next;
}

export function setSpecial(mode: ChmodMode, special: SpecialBit, on: boolean): ChmodMode {
  const next = cloneMode(mode);
  next[special] = on;
  return next;
}

/** Toggle all 9 grid bits on/off at once. */
export function setAllBits(mode: ChmodMode, on: boolean): ChmodMode {
  const next = cloneMode(mode);
  for (const s of SCOPES) {
    for (const b of PERM_BITS) next[s][b] = on;
  }
  return next;
}

// ---------------------------------------------------------------------------
// chmod command generation
// ---------------------------------------------------------------------------

/** Build the numeric chmod command (e.g. `chmod 755 file`). */
export function buildChmodNumeric(
  m: ChmodMode,
  target = "file",
  opts: BuildOptions = {},
): string {
  const flags = buildFlags(opts);
  const mode = opts.reference ? `--reference=${opts.reference}` : modeToSmartOctal(m);
  return `chmod${flags} ${mode} ${target}`.trim().replace(/\s+/g, " ");
}

/** Build the symbolic chmod command (e.g. `chmod u=rwx,go=rx file`). */
export function buildChmodSymbolic(
  m: ChmodMode,
  target = "file",
  opts: BuildOptions = {},
): string {
  const flags = buildFlags(opts);
  const mode = opts.reference ? `--reference=${opts.reference}` : modeToSymbolicExpr(m);
  return `chmod${flags} ${mode} ${target}`.trim().replace(/\s+/g, " ");
}

/** Build a `find … -type d/-type f -exec chmod …` safer-recursive pattern. */
export function buildRecursiveSafe(
  m: ChmodMode,
  target = ".",
  opts: BuildOptions = {},
): string {
  const flags = buildFlags(opts);
  const oct = modeToSmartOctal(m);
  // For directories use the user's mode; for files we strip the execute bits
  // unless they had execute, since chmod -R +x on files is almost never wanted.
  const fileMode = stripExecuteIfUnset(m);
  const dirOct = oct;
  const fileOct = fileMode;
  return [
    `find ${target} -type d -exec chmod${flags} ${dirOct} {} \\;`,
    `find ${target} -type f -exec chmod${flags} ${fileOct} {} \\;`,
  ].join("\n");
}

function buildFlags(opts: BuildOptions): string {
  const out: string[] = [];
  if (opts.recursive && !opts.safeRecursive) out.push("-R");
  if (opts.verbose) out.push("-v");
  if (opts.changes) out.push("-c");
  return out.length ? ` ${out.join(" ")}` : "";
}

/** Convert a mode back to the canonical symbolic-expression form: u=rwx,go=rx */
export function modeToSymbolicExpr(m: ChmodMode): string {
  const parts: string[] = [];
  parts.push(`u=${tripletToLetter(m.owner)}`);
  parts.push(`g=${tripletToLetter(m.group)}`);
  parts.push(`o=${tripletToLetter(m.other)}`);
  // Append special bits in chmod's symbolic syntax.
  if (m.setuid) parts.push("u+s");
  if (m.setgid) parts.push("g+s");
  if (m.sticky) parts.push("o+t");
  return parts.join(",");
}

function tripletToLetter(t: Triplet): string {
  let s = "";
  if (t.read) s += "r";
  if (t.write) s += "w";
  if (t.execute) s += "x";
  return s || "";
}

/** Strip execute bits if none were originally set (used for the file-only branch of safe-recursive). */
function stripExecuteIfUnset(m: ChmodMode): string {
  // If any execute is set in the original, keep the mode as-is; otherwise
  // produce the equivalent mode with execute stripped from all scopes.
  const anyExec = m.owner.execute || m.group.execute || m.other.execute;
  if (anyExec) return modeToSmartOctal(m);
  const stripped: ChmodMode = {
    owner: { ...m.owner, execute: false },
    group: { ...m.group, execute: false },
    other: { ...m.other, execute: false },
    setuid: false,
    setgid: false,
    sticky: m.sticky,
  };
  return modeToSmartOctal(stripped);
}

// ---------------------------------------------------------------------------
// Security linter
// ---------------------------------------------------------------------------

export function lintMode(m: ChmodMode, kind: FileMode = "file"): LintResult {
  const issues: LintIssue[] = [];
  const oct = modeToSmartOctal(m);
  const num = parseInt(modeToShortOctal(m), 10);

  // 777 — world-writable + world-executable
  if (num === 777) {
    issues.push({
      level: "danger",
      message: "Mode 777 grants read, write, AND execute to everyone. This is almost always a security mistake; prefer 755 for executables/dirs or 644 for files.",
    });
  }
  // World-writable (any mode with the other write bit set, unless sticky is on).
  if (m.other.write && !m.sticky) {
    issues.push({
      level: "danger",
      message: `World-writable (${oct}): anyone with system access can modify this ${kind}. Use sticky (1xxx) for shared dirs like /tmp, otherwise drop the other-write bit.`,
    });
  }
  // Group-writable + world-executable often signals a web root risk.
  if (m.group.write && m.other.execute && kind === "directory") {
    issues.push({
      level: "warning",
      message: "Group-writable + world-executable directory: if the group is broad (e.g. www-data), any member can replace files served to the web. Tighten to 755.",
    });
  }
  // setuid/setgid on a non-binary is a privilege-escalation vector.
  if (kind === "file" && (m.setuid || m.setgid)) {
    issues.push({
      level: "warning",
      message: "setuid/setgid on a script (shell, Python, etc.) is a classic privilege-escalation vector and is ignored by most kernels. Reserve for compiled binaries you audit.",
    });
  }
  // Sticky bit on a non-directory is a no-op on modern systems.
  if (m.sticky && kind === "file") {
    issues.push({
      level: "info",
      message: "Sticky bit on a regular file is a no-op on modern Linux/BSD — it only affects directory deletion semantics (used on /tmp).",
    });
  }
  // setuid + world-writable is catastrophic.
  if (m.setuid && m.other.write) {
    issues.push({
      level: "danger",
      message: "setuid + world-writable: ANY user can overwrite the binary that then runs as the owner. This is a trivial root compromise.",
    });
  }
  return { issues, ok: issues.length === 0 };
}

// ---------------------------------------------------------------------------
// Plain-English explainer
// ---------------------------------------------------------------------------

export function explainMode(m: ChmodMode, kind: FileMode = "file"): ExplainRow[] {
  const rows: ExplainRow[] = [];
  const execMeaning = kind === "directory"
    ? "traverse (enter) the directory and access names inside it"
    : "execute the file as a program/command";
  for (const s of SCOPES) {
    rows.push({
      scope: s,
      bit: "read",
      on: m[s].read,
      text: `${scopeVerb(s)} can ${kind === "directory" ? "list the directory contents" : "read the file"}.`,
    });
    rows.push({
      scope: s,
      bit: "write",
      on: m[s].write,
      text: `${scopeVerb(s)} can ${kind === "directory" ? "add, rename, or delete files in the directory" : "modify the file"}.`,
    });
    rows.push({
      scope: s,
      bit: "execute",
      on: m[s].execute,
      text: `${scopeVerb(s)} can ${execMeaning}.`,
    });
  }
  if (m.setuid) {
    rows.push({
      scope: "special",
      bit: "setuid",
      on: true,
      text: "When the file is executed, the process runs with the effective UID of the file's owner (not the caller). Used by sudo, passwd, ping.",
    });
  }
  if (m.setgid) {
    rows.push({
      scope: "special",
      bit: "setgid",
      on: true,
      text: kind === "directory"
        ? "New files and subdirectories created inside inherit the directory's group (not the creator's primary group). Common on shared team dirs."
        : "When the file is executed, the process runs with the effective GID of the file's group.",
    });
  }
  if (m.sticky) {
    rows.push({
      scope: "special",
      bit: "sticky",
      on: true,
      text: kind === "directory"
        ? "Only the file's owner (or the directory's owner, or root) can delete or rename files inside — even if other users have write on the directory. /tmp uses this."
        : "Legacy: the kernel would try to keep the file's text image in swap. No-op on modern systems.",
    });
  }
  return rows;
}

function scopeVerb(s: Scope): string {
  return s === "owner" ? "The owner" : s === "group" ? "Members of the group" : "Anyone";
}

// ---------------------------------------------------------------------------
// umask companion
// ---------------------------------------------------------------------------

/**
 * Given a umask (3- or 4-digit octal string), compute the default
 * permissions a newly created file and directory will receive.
 * File = 0666 & ~umask;  Dir = 0777 & ~umask.
 */
export function computeUmask(umaskInput: string): { file: ChmodMode; directory: ChmodMode; fileOctal: string; dirOctal: string } | null {
  if (!umaskInput) return null;
  const cleaned = umaskInput.trim().replace(/^0+(?=\d{3,4}$)/, "");
  if (!/^[0-7]{3,4}$/.test(cleaned)) return null;
  let specialMask = 0;
  let digits = cleaned;
  if (cleaned.length === 4) {
    specialMask = parseInt(cleaned[0]!, 10);
    digits = cleaned.slice(1);
  }
  // Parse the 3-digit mask as OCTAL (not decimal).
  const maskInt = parseInt(digits, 8);
  const filePerms = 0o666 & ~maskInt;
  const dirPerms = 0o777 & ~maskInt;
  const fileMode = parseOctal(filePerms.toString(8).padStart(3, "0"))!;
  const dirMode = parseOctal(dirPerms.toString(8).padStart(3, "0"))!;
  // Special bits in umask (rarely used) — clear any that the mask would deny.
  if (specialMask & 4) { fileMode.setuid = false; dirMode.setuid = false; }
  if (specialMask & 2) { fileMode.setgid = false; dirMode.setgid = false; }
  if (specialMask & 1) { fileMode.sticky = false; dirMode.sticky = false; }
  return {
    file: fileMode,
    directory: dirMode,
    fileOctal: modeToSmartOctal(fileMode),
    dirOctal: modeToSmartOctal(dirMode),
  };
}

// ---------------------------------------------------------------------------
// Smart input parser (paste anything)
// ---------------------------------------------------------------------------

export interface SmartParseResult {
  mode: ChmodMode;
  source: "octal" | "symbolic" | "expr";
  canonicalOctal: string;
  canonicalSymbolic: string;
}

/**
 * Try to interpret arbitrary pasted input as a chmod mode:
 *   1. Octal 3-4 digit (755, 4755, 0755)
 *   2. Symbolic 9-char (rwxr-xr-x) or 10-char (drwxr-xr-x)
 *   3. Symbolic expression applied to 000 (u=rwx,go=rx, or u+x,go-w)
 */
export function smartParse(input: string): SmartParseResult | null {
  if (!input) return null;
  const trimmed = input.trim();
  // Try octal first.
  if (/^[0-7]{3,4}$/.test(trimmed.replace(/^0+(?=\d{3,4}$)/, ""))) {
    const mode = parseOctal(trimmed);
    if (mode) {
      return {
        mode,
        source: "octal",
        canonicalOctal: modeToSmartOctal(mode),
        canonicalSymbolic: modeToSymbolic(mode),
      };
    }
  }
  // Try 9/10-char symbolic.
  if (/^[-rwxstST]{9}$/.test(trimmed) || /^([dlbcps-])([-rwxstST]{9})$/.test(trimmed)) {
    const mode = symbolicToMode(trimmed);
    if (mode) {
      return {
        mode,
        source: "symbolic",
        canonicalOctal: modeToSmartOctal(mode),
        canonicalSymbolic: modeToSymbolic(mode),
      };
    }
  }
  // Try symbolic expression applied to a zero base.
  if (/^([ugoa]*[+\-=][rwxXstugo]*)+(,([ugoa]*[+\-=][rwxXstugo]*)+)*$/.test(trimmed)) {
    const clauses = parseSymbolicExpr(trimmed);
    if (clauses) {
      const mode = applySymbolicExpr(emptyMode(), clauses);
      return {
        mode,
        source: "expr",
        canonicalOctal: modeToSmartOctal(mode),
        canonicalSymbolic: modeToSymbolic(mode),
      };
    }
  }
  return null;
}

// ---------------------------------------------------------------------------
// History (localStorage)
// ---------------------------------------------------------------------------

const HISTORY_KEY = "unqtools:chmod-calculator:history";
const HISTORY_MAX = 20;

export interface HistoryEntry {
  ts: number;
  octal: string;
  symbolic: string;
  kind: FileMode;
}

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
  const next = [entry, ...loadHistory()].slice(0, HISTORY_MAX);
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
// Shareable URL
// ---------------------------------------------------------------------------

export function buildShareUrl(octal: string, kind: FileMode, variant: ChmodVariant = "numeric"): string {
  const params = new URLSearchParams();
  if (octal) params.set("m", octal);
  if (kind) params.set("k", kind);
  if (variant) params.set("v", variant);
  if (typeof window === "undefined") return `?${params.toString()}`;
  return `${window.location.origin}${window.location.pathname}#${params.toString()}`;
}

export function parseShareUrl(hash: string): { octal: string; kind: FileMode; variant: ChmodVariant } {
  const clean = hash.startsWith("#") ? hash.slice(1) : hash;
  if (!clean) return { octal: "", kind: "file", variant: "numeric" };
  const params = new URLSearchParams(clean);
  const octal = params.get("m") ?? "";
  const kindRaw = params.get("k");
  const variantRaw = params.get("v");
  const kind: FileMode = kindRaw === "directory" ? "directory" : "file";
  const variant: ChmodVariant = variantRaw === "symbolic" ? "symbolic" : "numeric";
  return { octal, kind, variant };
}
