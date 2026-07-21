import { describe, it, expect, beforeEach } from "vitest";
import {
  EXIT_CODES,
  SIGNALS,
  RESERVED_RANGES,
  SAFE_CUSTOM_RANGES,
  SCRIPT_SNIPPETS,
  EXIT_CATEGORY_LABELS,
  SIGNAL_ACTION_LABELS,
  SYSEXITS_RANGE,
  getExitCode,
  getSignalByName,
  getSignalByNumber,
  wrapExitCode,
  isReserved,
  isSafeForCustom,
  findRange,
  decodeExitCode,
  decodeSignal,
  searchExitCodes,
  searchSignals,
  smartSearch,
  computeStats,
  loadHistory,
  saveHistory,
  clearHistory,
  buildShareUrl,
  parseShareUrl,
  renderExitSummary,
  renderSignalSummary,
  renderExitTable,
  renderSignalTable,
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

describe("exit-code-signal constants", () => {
  it("bundles 50+ exit codes", () => {
    expect(EXIT_CODES.length).toBeGreaterThanOrEqual(50);
  });
  it("bundles 30+ signals", () => {
    expect(SIGNALS.length).toBeGreaterThanOrEqual(30);
  });
  it("includes the canonical reserved codes (0, 1, 2, 126, 127, 128, 255)", () => {
    const codes = EXIT_CODES.map((e) => e.code);
    for (const c of [0, 1, 2, 126, 127, 128, 255]) {
      expect(codes).toContain(c);
    }
  });
  it("includes sysexits.h range (64–78)", () => {
    const codes = EXIT_CODES.map((e) => e.code);
    for (let c = SYSEXITS_RANGE.start; c <= SYSEXITS_RANGE.end; c++) {
      expect(codes).toContain(c);
    }
  });
  it("includes the 128+N signal-derived range for all 31 standard signals", () => {
    const codes = EXIT_CODES.map((e) => e.code);
    // 129..159 = SIGHUP..SIGSYS
    for (let c = 129; c <= 159; c++) {
      expect(codes).toContain(c);
    }
  });
  it("covers SIGHUP, SIGINT, SIGTERM, SIGKILL, SIGSEGV signals", () => {
    const names = SIGNALS.map((s) => s.name);
    for (const n of ["SIGHUP", "SIGINT", "SIGTERM", "SIGKILL", "SIGSEGV"]) {
      expect(names).toContain(n);
    }
  });
  it("every signal has number, name, description, action, catchable, ignorable", () => {
    for (const s of SIGNALS) {
      expect(typeof s.number).toBe("number");
      expect(s.name.startsWith("SIG")).toBe(true);
      expect(s.description.length).toBeGreaterThan(0);
      expect(typeof s.catchable).toBe("boolean");
      expect(typeof s.ignorable).toBe("boolean");
    }
  });
  it("SIGKILL and SIGSTOP are non-catchable and non-ignorable", () => {
    const kill = getSignalByName("SIGKILL")!;
    const stop = getSignalByName("SIGSTOP")!;
    expect(kill.catchable).toBe(false);
    expect(kill.ignorable).toBe(false);
    expect(stop.catchable).toBe(false);
    expect(stop.ignorable).toBe(false);
  });
  it("has 5 category labels and 6 action labels", () => {
    expect(Object.keys(EXIT_CATEGORY_LABELS)).toHaveLength(5);
    expect(Object.keys(SIGNAL_ACTION_LABELS)).toHaveLength(6);
  });
  it("has 8 bash scripting snippets", () => {
    expect(SCRIPT_SNIPPETS.length).toBeGreaterThanOrEqual(8);
  });
  it("defines reserved + safe ranges", () => {
    expect(RESERVED_RANGES.length).toBeGreaterThanOrEqual(5);
    expect(SAFE_CUSTOM_RANGES.length).toBeGreaterThanOrEqual(3);
    // Safe ranges should all have reserved=false
    expect(SAFE_CUSTOM_RANGES.every((r) => !r.reserved)).toBe(true);
  });
});

describe("exit-code-signal lookup", () => {
  it("getExitCode returns entry for known code", () => {
    const e = getExitCode(137)!;
    expect(e.name).toBe("SIGKILL");
    expect(e.category).toBe("signal");
    expect(e.signalNumber).toBe(9);
  });
  it("getExitCode returns undefined for unreserved code", () => {
    expect(getExitCode(100)).toBeUndefined();
  });
  it("getSignalByName matches SIGKILL, KILL, kill, sigkill", () => {
    expect(getSignalByName("SIGKILL")?.number).toBe(9);
    expect(getSignalByName("KILL")?.number).toBe(9);
    expect(getSignalByName("kill")?.number).toBe(9);
    expect(getSignalByName("sigkill")?.number).toBe(9);
  });
  it("getSignalByName is undefined for unknown name", () => {
    expect(getSignalByName("SIGFOO")).toBeUndefined();
    expect(getSignalByName("")).toBeUndefined();
  });
  it("getSignalByNumber returns entry for known number", () => {
    expect(getSignalByNumber(9)?.name).toBe("SIGKILL");
    expect(getSignalByNumber(15)?.name).toBe("SIGTERM");
  });
  it("getSignalByNumber returns undefined for unknown number", () => {
    expect(getSignalByNumber(99)).toBeUndefined();
  });
});

describe("exit-code-signal wrapExitCode", () => {
  it("returns values 0–255 unchanged", () => {
    expect(wrapExitCode(0)).toBe(0);
    expect(wrapExitCode(137)).toBe(137);
    expect(wrapExitCode(255)).toBe(255);
  });
  it("wraps >255 by mod 256 (256 → 0, 257 → 1)", () => {
    expect(wrapExitCode(256)).toBe(0);
    expect(wrapExitCode(257)).toBe(1);
    expect(wrapExitCode(300)).toBe(44);
  });
  it("wraps negative (-1 → 255, -2 → 254)", () => {
    expect(wrapExitCode(-1)).toBe(255);
    expect(wrapExitCode(-2)).toBe(254);
  });
  it("non-finite → 255", () => {
    expect(wrapExitCode(NaN)).toBe(255);
    expect(wrapExitCode(Infinity)).toBe(255);
  });
});

describe("exit-code-signal isReserved / isSafeForCustom / findRange", () => {
  it("marks 0, 1, 2, 127, 128, 255 as reserved", () => {
    for (const c of [0, 1, 2, 127, 128, 255]) {
      expect(isReserved(c)).toBe(true);
    }
  });
  it("marks 64–78 sysexits range as reserved", () => {
    for (let c = 64; c <= 78; c++) expect(isReserved(c)).toBe(true);
  });
  it("marks 129–159 signal-derived range as reserved", () => {
    for (let c = 129; c <= 159; c++) expect(isReserved(c)).toBe(true);
  });
  it("marks user-defined ranges (3–63, 79–125, 200–254) as safe", () => {
    for (const c of [3, 50, 63, 79, 100, 125, 200, 250, 254]) {
      expect(isSafeForCustom(c)).toBe(true);
      expect(isReserved(c)).toBe(false);
    }
  });
  it("findRange returns the matching range", () => {
    const r = findRange(137);
    expect(r?.label).toBe("Signal-derived (128+N)");
  });
});

describe("exit-code-signal decodeExitCode", () => {
  it("decodes 0 as success", () => {
    const d = decodeExitCode(0);
    expect(d.wrappedCode).toBe(0);
    expect(d.entry?.name).toBe("SUCCESS");
    expect(d.reserved).toBe(true);
    expect(d.wrapped).toBe(false);
  });
  it("decodes 137 as SIGKILL with the 128+N rule", () => {
    const d = decodeExitCode(137);
    expect(d.entry?.name).toBe("SIGKILL");
    expect(d.signal?.number).toBe(9);
    expect(d.signal?.name).toBe("SIGKILL");
    expect(d.summary).toContain("SIGKILL");
    expect(d.note).toContain("Docker OOM");
  });
  it("decodes 139 as SIGSEGV", () => {
    const d = decodeExitCode(139);
    expect(d.signal?.number).toBe(11);
    expect(d.signal?.name).toBe("SIGSEGV");
  });
  it("decodes 143 as SIGTERM", () => {
    const d = decodeExitCode(143);
    expect(d.signal?.number).toBe(15);
    expect(d.signal?.name).toBe("SIGTERM");
  });
  it("decodes 130 as SIGINT (Ctrl+C)", () => {
    const d = decodeExitCode(130);
    expect(d.signal?.number).toBe(2);
    expect(d.signal?.name).toBe("SIGINT");
  });
  it("decodes 127 as command-not-found", () => {
    const d = decodeExitCode(127);
    expect(d.entry?.name).toBe("COMMAND_NOT_FOUND");
    expect(d.reserved).toBe(true);
  });
  it("decodes 78 as EX_CONFIG (sysexits)", () => {
    const d = decodeExitCode(78);
    expect(d.entry?.name).toBe("EX_CONFIG");
    expect(d.entry?.category).toBe("sysexits");
  });
  it("marks 200 as safe for custom", () => {
    const d = decodeExitCode(200);
    expect(d.safeForCustom).toBe(true);
    expect(d.reserved).toBe(false);
  });
  it("wraps 256 → 0 with wrapped=true", () => {
    const d = decodeExitCode(256);
    expect(d.wrapped).toBe(true);
    expect(d.wrappedCode).toBe(0);
    expect(d.entry?.name).toBe("SUCCESS");
  });
  it("wraps -1 → 255 with wrapped=true", () => {
    const d = decodeExitCode(-1);
    expect(d.wrapped).toBe(true);
    expect(d.wrappedCode).toBe(255);
    expect(d.entry?.name).toBe("EXIT_OUT_OF_RANGE");
  });
  it("accepts numeric strings", () => {
    const d = decodeExitCode("137");
    expect(d.entry?.name).toBe("SIGKILL");
  });
  it("decodes 100 (unreserved) with safeForCustom=true", () => {
    const d = decodeExitCode(100);
    expect(d.safeForCustom).toBe(true);
    expect(d.entry).toBeUndefined();
  });
});

describe("exit-code-signal decodeSignal", () => {
  it("decodes signal by name (SIGKILL → 9)", () => {
    const s = decodeSignal("SIGKILL")!;
    expect(s.number).toBe(9);
  });
  it("decodes signal by short name (KILL → 9)", () => {
    const s = decodeSignal("KILL")!;
    expect(s.number).toBe(9);
  });
  it("decodes signal by number (15 → SIGTERM)", () => {
    const s = decodeSignal(15)!;
    expect(s.name).toBe("SIGTERM");
  });
  it("decodes signal by numeric string ('2' → SIGINT)", () => {
    const s = decodeSignal("2")!;
    expect(s.name).toBe("SIGINT");
  });
  it("returns undefined for unknown signal", () => {
    expect(decodeSignal("SIGFOO")).toBeUndefined();
    expect(decodeSignal(99)).toBeUndefined();
    expect(decodeSignal("")).toBeUndefined();
  });
});

describe("exit-code-signal search", () => {
  it("searchExitCodes finds by code", () => {
    const r = searchExitCodes("137");
    expect(r.some((e) => e.code === 137)).toBe(true);
  });
  it("searchExitCodes finds by name substring", () => {
    const r = searchExitCodes("SIGK");
    expect(r.some((e) => e.name === "SIGKILL")).toBe(true);
  });
  it("searchExitCodes finds by description substring", () => {
    const r = searchExitCodes("segmentation");
    expect(r.some((e) => e.name === "SIGSEGV")).toBe(true);
  });
  it("searchSignals finds by name", () => {
    const r = searchSignals("TERM");
    expect(r.some((s) => s.name === "SIGTERM")).toBe(true);
  });
  it("searchSignals finds by number", () => {
    const r = searchSignals("9");
    expect(r.some((s) => s.number === 9)).toBe(true);
  });
  it("searchExitCodes returns all for empty query", () => {
    expect(searchExitCodes("")).toHaveLength(EXIT_CODES.length);
  });
});

describe("exit-code-signal smartSearch", () => {
  it("treats numeric input as an exit code", () => {
    const r = smartSearch("137");
    expect(r.decoded?.entry?.name).toBe("SIGKILL");
    expect(r.decoded?.signal?.name).toBe("SIGKILL");
  });
  it("treats signal name input as a signal", () => {
    const r = smartSearch("SIGKILL");
    expect(r.signal?.number).toBe(9);
    expect(r.decoded?.wrappedCode).toBe(137); // 128 + 9
  });
  it("falls back to textual search for unknown terms", () => {
    const r = smartSearch("permission");
    expect(r.exitCodes.some((e) => e.name === "EX_NOPERM")).toBe(true);
  });
  it("returns full tables for empty query", () => {
    const r = smartSearch("");
    expect(r.exitCodes).toHaveLength(EXIT_CODES.length);
    expect(r.signals).toHaveLength(SIGNALS.length);
  });
});

describe("exit-code-signal computeStats", () => {
  it("counts exit codes, signals, and by-category", () => {
    const s = computeStats();
    expect(s.totalExitCodes).toBe(EXIT_CODES.length);
    expect(s.totalSignals).toBe(SIGNALS.length);
    expect(s.byCategory.success).toBe(1);
    expect(s.byCategory.sysexits).toBe(15); // 64..78
    expect(s.byCategory.signal).toBe(31);   // 129..159
    expect(s.sysexitsCount).toBe(15);
    expect(s.signalDerivedCount).toBe(31);
  });
});

describe("exit-code-signal history (localStorage)", () => {
  it("loads empty initially", () => {
    expect(loadHistory()).toEqual([]);
  });
  it("saves and loads", () => {
    saveHistory({ ts: 1, query: "137", kind: "code", summary: "SIGKILL" });
    expect(loadHistory()).toHaveLength(1);
  });
  it("dedupes by query+kind (keeps most recent)", () => {
    saveHistory({ ts: 1, query: "137", kind: "code", summary: "old" });
    saveHistory({ ts: 2, query: "137", kind: "code", summary: "new" });
    expect(loadHistory()).toHaveLength(1);
    expect(loadHistory()[0].summary).toBe("new");
  });
  it("allows code+signal with same query", () => {
    saveHistory({ ts: 1, query: "9", kind: "code", summary: "code 9" });
    saveHistory({ ts: 2, query: "9", kind: "signal", summary: "SIGKILL" });
    expect(loadHistory()).toHaveLength(2);
  });
  it("caps at 20", () => {
    for (let i = 0; i < 25; i++) {
      saveHistory({ ts: i, query: `q${i}`, kind: "code", summary: `s${i}` });
    }
    expect(loadHistory()).toHaveLength(20);
  });
  it("clears", () => {
    saveHistory({ ts: 1, query: "x", kind: "code", summary: "x" });
    clearHistory();
    expect(loadHistory()).toEqual([]);
  });
});

describe("exit-code-signal shareable URL", () => {
  it("builds share URL when window unavailable", () => {
    const origWindow = (globalThis as Record<string, unknown>).window;
    (globalThis as Record<string, unknown>).window = undefined;
    const url = buildShareUrl("137");
    expect(url).toContain("q=137");
    (globalThis as Record<string, unknown>).window = origWindow;
  });
  it("parses share URL back", () => {
    const p = parseShareUrl("q=SIGKILL");
    expect(p.query).toBe("SIGKILL");
  });
  it("handles empty hash", () => {
    expect(parseShareUrl("")).toEqual({ query: "" });
  });
  it("handles hash prefix", () => {
    expect(parseShareUrl("#q=137")).toEqual({ query: "137" });
  });
});

describe("exit-code-signal render helpers", () => {
  it("renderExitSummary joins code, name, description with tabs", () => {
    const s = renderExitSummary(getExitCode(137)!);
    expect(s.startsWith("137\tSIGKILL\t")).toBe(true);
  });
  it("renderSignalSummary includes action and catchable flag", () => {
    const s = renderSignalSummary(getSignalByName("SIGTERM")!);
    expect(s).toContain("15\tSIGTERM");
    expect(s).toContain("Terminate");
    expect(s).toContain("catchable");
  });
  it("renderExitTable has header + 50+ rows", () => {
    const t = renderExitTable();
    const lines = t.split("\n");
    expect(lines[0]).toContain("code\tname\tcategory");
    expect(lines.length).toBe(EXIT_CODES.length + 1);
  });
  it("renderSignalTable has header + 30+ rows", () => {
    const t = renderSignalTable();
    const lines = t.split("\n");
    expect(lines[0]).toContain("number\tname\taction");
    expect(lines.length).toBe(SIGNALS.length + 1);
  });
});
