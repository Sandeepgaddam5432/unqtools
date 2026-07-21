import { describe, it, expect, beforeEach } from "vitest";
import {
  SCOPES,
  PERM_BITS,
  SPECIAL_BITS,
  PRESETS,
  emptyMode,
  cloneMode,
  parseOctal,
  modeToOctal,
  modeToShortOctal,
  modeToSmartOctal,
  modeToSymbolic,
  modeToSymbolicShort,
  symbolicToMode,
  parseSymbolicExpr,
  applySymbolicExpr,
  applySymbolicString,
  toggleBit,
  setBit,
  toggleSpecial,
  setSpecial,
  setAllBits,
  buildChmodNumeric,
  buildChmodSymbolic,
  buildRecursiveSafe,
  modeToSymbolicExpr,
  lintMode,
  explainMode,
  computeUmask,
  smartParse,
  loadHistory,
  saveHistory,
  clearHistory,
  buildShareUrl,
  parseShareUrl,
  type ChmodMode,
  type Scope,
  type PermBit,
  type SpecialBit,
  type FileMode,
} from "./logic";

beforeEach(() => {
  const store: Record<string, string> = {};
  (globalThis as Record<string, unknown>).localStorage = {
    getItem: (k: string) => store[k] ?? null,
    setItem: (k: string, v: string) => { store[k] = v; },
    removeItem: (k: string) => { delete store[k]; },
    clear: () => { for (const k of Object.keys(store)) delete store[k]; },
    key: (i: number) => Object.keys(store)[i] ?? null,
    get length() { return Object.keys(store).length; },
  };
});

describe("chmod-calculator constants", () => {
  it("has 3 scopes / 3 perm bits / 3 special bits", () => {
    expect(SCOPES).toEqual(["owner", "group", "other"]);
    expect(PERM_BITS).toEqual(["read", "write", "execute"]);
    expect(SPECIAL_BITS).toEqual(["setuid", "setgid", "sticky"]);
  });
  it("has 10+ presets", () => {
    expect(PRESETS.length).toBeGreaterThanOrEqual(10);
    expect(PRESETS.map((p) => p.octal)).toContain("755");
    expect(PRESETS.map((p) => p.octal)).toContain("644");
    expect(PRESETS.map((p) => p.octal)).toContain("1777");
  });
});

describe("chmod-calculator emptyMode / cloneMode", () => {
  it("emptyMode has all bits off", () => {
    const m = emptyMode();
    expect(modeToOctal(m)).toBe("0000");
    expect(modeToSymbolic(m)).toBe("---------");
  });
  it("cloneMode produces an independent copy", () => {
    const a = emptyMode();
    const b = cloneMode(a);
    b.owner.read = true;
    expect(a.owner.read).toBe(false);
    expect(b.owner.read).toBe(true);
  });
});

describe("chmod-calculator parseOctal", () => {
  it("parses 3-digit octal", () => {
    const m = parseOctal("755")!;
    expect(m.owner).toEqual({ read: true, write: true, execute: true });
    expect(m.group).toEqual({ read: true, write: false, execute: true });
    expect(m.other).toEqual({ read: true, write: false, execute: true });
    expect(m.setuid).toBe(false);
    expect(m.setgid).toBe(false);
    expect(m.sticky).toBe(false);
  });
  it("parses 4-digit octal with special bits", () => {
    const m = parseOctal("4755")!;
    expect(m.setuid).toBe(true);
    expect(m.setgid).toBe(false);
    expect(m.sticky).toBe(false);
    expect(modeToShortOctal(m)).toBe("755");
  });
  it("parses 1777 (sticky)", () => {
    const m = parseOctal("1777")!;
    expect(m.sticky).toBe(true);
    expect(m.setuid).toBe(false);
    expect(modeToShortOctal(m)).toBe("777");
  });
  it("parses 2755 (setgid)", () => {
    const m = parseOctal("2755")!;
    expect(m.setgid).toBe(true);
  });
  it("parses leading-zero form 0755", () => {
    const m = parseOctal("0755");
    expect(m).not.toBeNull();
    expect(modeToShortOctal(m!)).toBe("755");
  });
  it("rejects invalid octal", () => {
    expect(parseOctal("855")).toBeNull();
    expect(parseOctal("abc")).toBeNull();
    expect(parseOctal("75")).toBeNull();
    expect(parseOctal("")).toBeNull();
    expect(parseOctal("77555")).toBeNull();
  });
});

describe("chmod-calculator modeToOctal / modeToSmartOctal", () => {
  it("renders 4-digit canonical octal", () => {
    expect(modeToOctal(parseOctal("755")!)).toBe("0755");
  });
  it("includes special digit when set", () => {
    expect(modeToOctal(parseOctal("4755")!)).toBe("4755");
  });
  it("smart-octal drops leading 0 when no special bits", () => {
    expect(modeToSmartOctal(parseOctal("755")!)).toBe("755");
  });
  it("smart-octal keeps special digit when present", () => {
    expect(modeToSmartOctal(parseOctal("4755")!)).toBe("4755");
    expect(modeToSmartOctal(parseOctal("1777")!)).toBe("1777");
  });
});

describe("chmod-calculator modeToSymbolic / symbolicToMode", () => {
  it("renders 755 as rwxr-xr-x", () => {
    expect(modeToSymbolic(parseOctal("755")!)).toBe("rwxr-xr-x");
  });
  it("renders 644 as rw-r--r--", () => {
    expect(modeToSymbolic(parseOctal("644")!)).toBe("rw-r--r--");
  });
  it("renders setuid + x as 's' (lowercase)", () => {
    expect(modeToSymbolic(parseOctal("4755")!)).toBe("rwsr-xr-x");
  });
  it("renders setuid without x as 'S' (uppercase)", () => {
    // 4644 = setuid + rw-r--r--
    expect(modeToSymbolic(parseOctal("4644")!)).toBe("rwSr--r--");
  });
  it("renders setgid without x as 'S'", () => {
    expect(modeToSymbolic(parseOctal("2644")!)).toBe("rw-r-Sr--");
  });
  it("renders sticky + x as 't' (lowercase)", () => {
    expect(modeToSymbolic(parseOctal("1755")!)).toBe("rwxr-xr-t");
  });
  it("renders sticky without x as 'T' (uppercase)", () => {
    expect(modeToSymbolic(parseOctal("1644")!)).toBe("rw-r--r-T");
  });
  it("parses symbolic back to mode (round-trip)", () => {
    const sym = modeToSymbolic(parseOctal("4755")!);
    const back = symbolicToMode(sym)!;
    expect(modeToOctal(back)).toBe("4755");
  });
  it("parses symbolic with leading file-type char", () => {
    const m = symbolicToMode("drwxr-xr-x")!;
    expect(modeToShortOctal(m)).toBe("755");
  });
  it("rejects invalid symbolic", () => {
    expect(symbolicToMode("rwxr-xr")).toBeNull();
    expect(symbolicToMode("rwxr-xr-z")).toBeNull();
    expect(symbolicToMode("")).toBeNull();
  });
  it("short symbolic excludes special bits", () => {
    expect(modeToSymbolicShort(parseOctal("4755")!)).toBe("rwxr-xr-x");
  });
});

describe("chmod-calculator parseSymbolicExpr", () => {
  it("parses single clause u+x", () => {
    const c = parseSymbolicExpr("u+x")!;
    expect(c).toHaveLength(1);
    expect(c[0].who).toEqual(["u"]);
    expect(c[0].op).toBe("+");
    expect(c[0].bits).toBe("x");
  });
  it("expands 'a' to u/g/o", () => {
    const c = parseSymbolicExpr("a+r")!;
    expect(c[0].who).toEqual(["u", "g", "o"]);
  });
  it("parses multi-clause u+x,go-w", () => {
    const c = parseSymbolicExpr("u+x,go-w")!;
    expect(c).toHaveLength(2);
    expect(c[0].who).toEqual(["u"]);
    expect(c[1].who).toEqual(["g", "o"]);
    expect(c[1].op).toBe("-");
    expect(c[1].bits).toBe("w");
  });
  it("parses assignment a=r", () => {
    const c = parseSymbolicExpr("a=r")!;
    expect(c[0].op).toBe("=");
    expect(c[0].bits).toBe("r");
  });
  it("returns null for invalid input", () => {
    expect(parseSymbolicExpr("u+")).toBeNull();
    expect(parseSymbolicExpr("u+9")).toBeNull();
    expect(parseSymbolicExpr("")).toBeNull();
  });
});

describe("chmod-calculator applySymbolicExpr", () => {
  it("u+x adds execute to owner only", () => {
    const start = parseOctal("644")!;
    const next = applySymbolicString(start, "u+x")!;
    expect(modeToShortOctal(next)).toBe("744");
  });
  it("go-w removes write from group and other", () => {
    const start = parseOctal("666")!;
    const next = applySymbolicString(start, "go-w")!;
    expect(modeToShortOctal(next)).toBe("644");
  });
  it("a=r sets read-only for everyone (clears w and x)", () => {
    const start = parseOctal("777")!;
    const next = applySymbolicString(start, "a=r")!;
    expect(modeToShortOctal(next)).toBe("444");
  });
  it("u=rwx,go=rx builds 755 from 000", () => {
    const next = applySymbolicString(emptyMode(), "u=rwx,go=rx")!;
    expect(modeToShortOctal(next)).toBe("755");
  });
  it("u+s sets setuid", () => {
    const next = applySymbolicString(parseOctal("755")!, "u+s")!;
    expect(next.setuid).toBe(true);
    expect(modeToSmartOctal(next)).toBe("4755");
  });
  it("o+t sets sticky", () => {
    const next = applySymbolicString(parseOctal("777")!, "o+t")!;
    expect(next.sticky).toBe(true);
    expect(modeToSmartOctal(next)).toBe("1777");
  });
  it("returns null for invalid expression", () => {
    expect(applySymbolicString(emptyMode(), "u+9")).toBeNull();
  });
});

describe("chmod-calculator grid mutators", () => {
  it("toggleBit flips a single bit", () => {
    const m = toggleBit(emptyMode(), "owner", "read");
    expect(m.owner.read).toBe(true);
    const m2 = toggleBit(m, "owner", "read");
    expect(m2.owner.read).toBe(false);
  });
  it("setBit sets absolute value", () => {
    const m = setBit(emptyMode(), "group", "execute", true);
    expect(m.group.execute).toBe(true);
  });
  it("toggleSpecial flips special bit", () => {
    const m = toggleSpecial(emptyMode(), "sticky");
    expect(m.sticky).toBe(true);
  });
  it("setSpecial sets absolute value", () => {
    const m = setSpecial(emptyMode(), "setuid", true);
    expect(m.setuid).toBe(true);
  });
  it("setAllBits sets all 9 bits", () => {
    const m = setAllBits(emptyMode(), true);
    expect(modeToShortOctal(m)).toBe("777");
  });
});

describe("chmod-calculator command builders", () => {
  it("buildChmodNumeric emits chmod 755 file", () => {
    expect(buildChmodNumeric(parseOctal("755")!, "myfile")).toBe("chmod 755 myfile");
  });
  it("buildChmodNumeric includes 4-digit when specials present", () => {
    expect(buildChmodNumeric(parseOctal("4755")!, "bin")).toBe("chmod 4755 bin");
  });
  it("buildChmodNumeric supports -R", () => {
    expect(buildChmodNumeric(parseOctal("755")!, ".", { recursive: true })).toBe("chmod -R 755 .");
  });
  it("buildChmodNumeric supports -v and -c", () => {
    expect(buildChmodNumeric(parseOctal("755")!, "f", { verbose: true })).toBe("chmod -v 755 f");
    expect(buildChmodNumeric(parseOctal("755")!, "f", { changes: true })).toBe("chmod -c 755 f");
  });
  it("buildChmodSymbolic emits chmod u=rwx,g=rx,o=rx file", () => {
    expect(buildChmodSymbolic(parseOctal("755")!, "myfile")).toBe("chmod u=rwx,g=rx,o=rx myfile");
  });
  it("buildChmodSymbolic includes specials", () => {
    expect(buildChmodSymbolic(parseOctal("4755")!, "bin")).toBe("chmod u=rwx,g=rx,o=rx,u+s bin");
  });
  it("buildRecursiveSafe emits find -type d/-type f -exec pair", () => {
    const out = buildRecursiveSafe(parseOctal("755")!, ".");
    expect(out).toContain("find . -type d -exec chmod 755 {} \\;");
    expect(out).toContain("find . -type f -exec chmod");
  });
  it("modeToSymbolicExpr builds u=rwx,g=rx,o=rx for 755", () => {
    expect(modeToSymbolicExpr(parseOctal("755")!)).toBe("u=rwx,g=rx,o=rx");
  });
});

describe("chmod-calculator lintMode", () => {
  it("flags 777 as danger", () => {
    const r = lintMode(parseOctal("777")!);
    expect(r.ok).toBe(false);
    expect(r.issues.some((i) => i.level === "danger" && i.message.includes("777"))).toBe(true);
  });
  it("flags world-writable", () => {
    const r = lintMode(parseOctal("666")!);
    expect(r.issues.some((i) => i.level === "danger" && i.message.includes("World-writable"))).toBe(true);
  });
  it("does not flag world-writable when sticky is set", () => {
    const r = lintMode(parseOctal("1777")!);
    expect(r.issues.some((i) => i.message.includes("World-writable"))).toBe(false);
  });
  it("flags setuid+world-writable as catastrophic", () => {
    const r = lintMode(parseOctal("4777")!);
    expect(r.issues.some((i) => i.level === "danger" && i.message.includes("trivial root"))).toBe(true);
  });
  it("flags setuid on file", () => {
    const r = lintMode(parseOctal("4755")!, "file");
    expect(r.issues.some((i) => i.level === "warning" && i.message.includes("setuid"))).toBe(true);
  });
  it("flags sticky on file as info", () => {
    const r = lintMode(parseOctal("1644")!, "file");
    expect(r.issues.some((i) => i.level === "info" && i.message.includes("no-op"))).toBe(true);
  });
  it("passes safe modes (755, 644, 600)", () => {
    expect(lintMode(parseOctal("755")!).ok).toBe(true);
    expect(lintMode(parseOctal("644")!).ok).toBe(true);
    expect(lintMode(parseOctal("600")!).ok).toBe(true);
  });
});

describe("chmod-calculator explainMode", () => {
  it("produces 9 rows for basic mode", () => {
    const rows = explainMode(parseOctal("755")!);
    expect(rows.length).toBe(9);
    expect(rows.filter((r) => r.on)).toHaveLength(7); // 7 bits on in 755
  });
  it("adds special-bit rows when set", () => {
    const rows = explainMode(parseOctal("4755")!);
    expect(rows.some((r) => r.bit === "setuid")).toBe(true);
  });
  it("uses directory-aware wording for execute on dirs", () => {
    const rows = explainMode(parseOctal("755")!, "directory");
    const execRow = rows.find((r) => r.scope === "owner" && r.bit === "execute")!;
    expect(execRow.text).toContain("traverse");
  });
});

describe("chmod-calculator computeUmask", () => {
  it("022 yields 644 files / 755 dirs", () => {
    const r = computeUmask("022")!;
    expect(r.fileOctal).toBe("644");
    expect(r.dirOctal).toBe("755");
  });
  it("077 yields 600 files / 700 dirs", () => {
    const r = computeUmask("077")!;
    expect(r.fileOctal).toBe("600");
    expect(r.dirOctal).toBe("700");
  });
  it("002 yields 664 files / 775 dirs", () => {
    const r = computeUmask("002")!;
    expect(r.fileOctal).toBe("664");
    expect(r.dirOctal).toBe("775");
  });
  it("rejects invalid input", () => {
    expect(computeUmask("999")).toBeNull();
    expect(computeUmask("")).toBeNull();
  });
});

describe("chmod-calculator smartParse", () => {
  it("parses octal", () => {
    const r = smartParse("755")!;
    expect(r.source).toBe("octal");
    expect(r.canonicalOctal).toBe("755");
  });
  it("parses symbolic rwxr-xr-x", () => {
    const r = smartParse("rwxr-xr-x")!;
    expect(r.source).toBe("symbolic");
    expect(r.canonicalOctal).toBe("755");
  });
  it("parses drwxr-xr-x with leading file-type char", () => {
    const r = smartParse("drwxr-xr-x")!;
    expect(r.canonicalOctal).toBe("755");
  });
  it("parses symbolic expression u=rwx,go=rx", () => {
    const r = smartParse("u=rwx,go=rx")!;
    expect(r.source).toBe("expr");
    expect(r.canonicalOctal).toBe("755");
  });
  it("returns null for garbage", () => {
    expect(smartParse("hello world")).toBeNull();
    expect(smartParse("")).toBeNull();
  });
});

describe("chmod-calculator history (localStorage)", () => {
  it("loads empty initially", () => { expect(loadHistory()).toEqual([]); });
  it("saves and loads", () => {
    saveHistory({ ts: 1, octal: "755", symbolic: "rwxr-xr-x", kind: "file" });
    expect(loadHistory()).toHaveLength(1);
    expect(loadHistory()[0].octal).toBe("755");
  });
  it("caps at 20", () => {
    for (let i = 0; i < 25; i++) {
      saveHistory({ ts: i, octal: String(i).padStart(3, "0"), symbolic: "---------", kind: "file" });
    }
    expect(loadHistory()).toHaveLength(20);
  });
  it("clears", () => {
    saveHistory({ ts: 1, octal: "755", symbolic: "rwxr-xr-x", kind: "file" });
    clearHistory();
    expect(loadHistory()).toEqual([]);
  });
});

describe("chmod-calculator shareable URL", () => {
  it("builds share URL when window unavailable", () => {
    const origWindow = (globalThis as Record<string, unknown>).window;
    (globalThis as Record<string, unknown>).window = undefined;
    const url = buildShareUrl("755", "file", "numeric");
    expect(url).toContain("m=755");
    expect(url).toContain("k=file");
    expect(url).toContain("v=numeric");
    (globalThis as Record<string, unknown>).window = origWindow;
  });
  it("parses share URL back", () => {
    const p = parseShareUrl("m=755&k=directory&v=symbolic");
    expect(p.octal).toBe("755");
    expect(p.kind).toBe("directory");
    expect(p.variant).toBe("symbolic");
  });
  it("handles empty hash", () => {
    expect(parseShareUrl("")).toEqual({ octal: "", kind: "file", variant: "numeric" });
  });
  it("defaults invalid kind/variant to file/numeric", () => {
    const p = parseShareUrl("m=4755&k=invalid&v=invalid");
    expect(p.kind).toBe("file");
    expect(p.variant).toBe("numeric");
  });
});

// Suppress unused-import lint.
export type _Unused = { s: Scope; b: PermBit; sb: SpecialBit; fm: FileMode; m: ChmodMode };
