import { describe, it, expect, beforeEach } from "vitest";
import {
  LOOKUP_MECHANISMS,
  QUALIFIER_TABLE,
  explainMechanism,
  explainQualifier,
  isValidIpv4Cidr,
  isValidIpv6Cidr,
  isValidDomain,
  stripQualifier,
  buildRecord,
  parseRecord,
  validateRecord,
  detectMultipleSpfRecords,
  generateCommands,
  loadHistory,
  saveHistory,
  clearHistory,
  buildShareUrl,
  parseShareUrl,
  type SpfInput,
  type HistoryEntry,
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

describe("spf constants", () => {
  it("has 6 lookup-type mechanisms (include, a, mx, ptr, exists, redirect)", () => {
    expect(LOOKUP_MECHANISMS.size).toBe(6);
    for (const m of ["include", "a", "mx", "ptr", "exists", "redirect"]) {
      expect(LOOKUP_MECHANISMS.has(m as never)).toBe(true);
    }
  });
  it("has 4 qualifiers in the reference table", () => {
    expect(QUALIFIER_TABLE).toHaveLength(4);
    expect(QUALIFIER_TABLE.map((q) => q.qualifier).sort()).toEqual(["+", "-", "?", "~"]);
  });
});

describe("spf explainMechanism / explainQualifier", () => {
  it("explains all mechanism", () => {
    const e = explainMechanism("all");
    expect(e.short.length).toBeGreaterThan(0);
    expect(e.countsAsLookup).toBe(false);
  });
  it("explains include mechanism as counting as lookup", () => {
    const e = explainMechanism("include");
    expect(e.countsAsLookup).toBe(true);
  });
  it("explains ip4 mechanism as not counting as lookup", () => {
    const e = explainMechanism("ip4");
    expect(e.countsAsLookup).toBe(false);
  });
  it("flags ptr as deprecated", () => {
    const e = explainMechanism("ptr");
    expect(e.long.toLowerCase()).toContain("deprecated");
  });
  it("explains - qualifier as Fail", () => {
    expect(explainQualifier("-")).toContain("Fail");
  });
  it("explains ~ qualifier as SoftFail", () => {
    expect(explainQualifier("~")).toContain("SoftFail");
  });
});

describe("spf validators", () => {
  it("validates IPv4 CIDR", () => {
    expect(isValidIpv4Cidr("192.0.2.0/24")).toBe(true);
    expect(isValidIpv4Cidr("192.0.2.0")).toBe(true);
    expect(isValidIpv4Cidr("192.0.2.999")).toBe(false);
    expect(isValidIpv4Cidr("not-an-ip")).toBe(false);
  });
  it("validates IPv6 CIDR", () => {
    expect(isValidIpv6Cidr("2001:db8::/32")).toBe(true);
    expect(isValidIpv6Cidr("2001:db8::")).toBe(true);
    expect(isValidIpv6Cidr("not-an-ip")).toBe(false);
  });
  it("validates domain", () => {
    expect(isValidDomain("example.com")).toBe(true);
    expect(isValidDomain("mail.example.com")).toBe(true);
    expect(isValidDomain("not valid")).toBe(false);
    expect(isValidDomain("")).toBe(false);
  });
  it("strips qualifier from token", () => {
    expect(stripQualifier("-all")).toEqual({ qualifier: "-", rest: "all" });
    expect(stripQualifier("~include:example.com")).toEqual({ qualifier: "~", rest: "include:example.com" });
    expect(stripQualifier("ip4:1.2.3.4")).toEqual({ qualifier: null, rest: "ip4:1.2.3.4" });
  });
});

describe("spf buildRecord", () => {
  it("builds a basic record with -all", () => {
    const input: SpfInput = {
      ip4: ["192.0.2.0/24"],
      ip6: [],
      a: [],
      mx: [],
      include: [],
      all: "-",
    };
    expect(buildRecord(input)).toBe("v=spf1 ip4:192.0.2.0/24 -all");
  });
  it("builds with multiple mechanisms", () => {
    const input: SpfInput = {
      ip4: ["192.0.2.0/24"],
      ip6: ["2001:db8::/32"],
      a: [""],
      mx: [""],
      include: ["_spf.google.com"],
      all: "~",
    };
    const r = buildRecord(input);
    expect(r).toBe("v=spf1 ip4:192.0.2.0/24 ip6:2001:db8::/32 a mx include:_spf.google.com ~all");
  });
  it("builds with redirect instead of all", () => {
    const input: SpfInput = {
      ip4: ["192.0.2.0/24"],
      ip6: [],
      a: [],
      mx: [],
      include: [],
      redirect: "spf.example.com",
      all: "none",
    };
    expect(buildRecord(input)).toBe("v=spf1 ip4:192.0.2.0/24 redirect=spf.example.com");
  });
  it("deduplicates identical mechanisms", () => {
    const input: SpfInput = {
      ip4: ["192.0.2.0/24", "192.0.2.0/24"],
      ip6: [],
      a: [],
      mx: [],
      include: [],
      all: "-",
    };
    const r = buildRecord(input);
    expect(r.match(/ip4:192\.0\.2\.0\/24/g)?.length).toBe(1);
  });
  it("supports all=none (no all mechanism)", () => {
    const input: SpfInput = {
      ip4: ["192.0.2.0/24"],
      ip6: [],
      a: [],
      mx: [],
      include: [],
      all: "none",
    };
    expect(buildRecord(input)).toBe("v=spf1 ip4:192.0.2.0/24");
  });
});

describe("spf parseRecord", () => {
  it("parses a basic record", () => {
    const r = parseRecord("v=spf1 ip4:192.0.2.0/24 -all");
    expect(r.mechanisms).toHaveLength(2);
    expect(r.mechanisms[0].type).toBe("ip4");
    expect(r.mechanisms[1].type).toBe("all");
    expect(r.mechanisms[1].qualifier).toBe("-");
  });
  it("parses include with default qualifier", () => {
    const r = parseRecord("v=spf1 include:_spf.google.com ~all");
    expect(r.mechanisms[0]).toEqual({ type: "include", qualifier: "+", value: "_spf.google.com" });
  });
  it("parses redirect= modifier", () => {
    const r = parseRecord("v=spf1 redirect=spf.example.com");
    expect(r.hasRedirect).toBe(true);
    expect(r.mechanisms[0].type).toBe("redirect");
  });
  it("rejects record without v=spf1", () => {
    const r = parseRecord("ip4:1.2.3.4 -all");
    expect(r.issues.some((i) => i.code === "no-version")).toBe(true);
  });
  it("flags unknown mechanism", () => {
    const r = parseRecord("v=spf1 bogusmech:example.com -all");
    expect(r.issues.some((i) => i.code === "unknown-mechanism")).toBe(true);
  });
});

describe("spf validateRecord", () => {
  it("validates a clean record", () => {
    const v = validateRecord("v=spf1 ip4:192.0.2.0/24 -all");
    expect(v.valid).toBe(true);
    expect(v.lookupCount).toBe(0);
    expect(v.hasAll).toBe(true);
    expect(v.hasRedirect).toBe(false);
  });
  it("counts include as 1 lookup", () => {
    const v = validateRecord("v=spf1 include:_spf.google.com -all");
    expect(v.lookupCount).toBe(1);
  });
  it("counts a, mx as lookups", () => {
    const v = validateRecord("v=spf1 a mx -all");
    expect(v.lookupCount).toBe(2);
  });
  it("does not count ip4/ip6", () => {
    const v = validateRecord("v=spf1 ip4:1.2.3.4 ip6:::1 -all");
    expect(v.lookupCount).toBe(0);
  });
  it("counts redirect as lookup", () => {
    const v = validateRecord("v=spf1 redirect=spf.example.com");
    expect(v.lookupCount).toBe(1);
  });
  it("adds recursive depth when includeDepth provided", () => {
    const v = validateRecord("v=spf1 include:_spf.google.com -all", {
      includeDepth: { "_spf.google.com": 3 },
    });
    expect(v.lookupCount).toBe(4); // 1 (include) + 3 (nested)
  });
  it("errors when all is not last", () => {
    const v = validateRecord("v=spf1 -all ip4:1.2.3.4");
    expect(v.issues.some((i) => i.code === "all-not-last")).toBe(true);
    expect(v.valid).toBe(false);
  });
  it("errors when redirect is not last", () => {
    const v = validateRecord("v=spf1 redirect=spf.example.com ip4:1.2.3.4");
    expect(v.issues.some((i) => i.code === "redirect-not-last")).toBe(true);
    expect(v.valid).toBe(false);
  });
  it("errors when both all and redirect present", () => {
    const v = validateRecord("v=spf1 -all redirect=spf.example.com");
    expect(v.issues.some((i) => i.code === "all-and-redirect")).toBe(true);
    expect(v.valid).toBe(false);
  });
  it("warns on deprecated ptr", () => {
    const v = validateRecord("v=spf1 ptr -all");
    expect(v.issues.some((i) => i.code === "deprecated-ptr" && i.level === "warning")).toBe(true);
  });
  it("errors on invalid ip4", () => {
    const v = validateRecord("v=spf1 ip4:not-an-ip -all");
    expect(v.issues.some((i) => i.code === "bad-ip4")).toBe(true);
    expect(v.valid).toBe(false);
  });
  it("errors on invalid include domain", () => {
    const v = validateRecord("v=spf1 include:not a domain -all");
    expect(v.issues.some((i) => i.code === "bad-domain" || i.code === "unknown-mechanism")).toBe(true);
  });
  it("warns when no all and no redirect", () => {
    const v = validateRecord("v=spf1 ip4:1.2.3.4");
    expect(v.issues.some((i) => i.code === "no-all")).toBe(true);
  });
  it("errors when lookup limit exceeded", () => {
    const rec = "v=spf1 " + Array.from({ length: 11 }, (_, i) => `include:d${i}.com`).join(" ") + " -all";
    const v = validateRecord(rec);
    expect(v.lookupCount).toBe(11);
    expect(v.issues.some((i) => i.code === "lookup-limit")).toBe(true);
    expect(v.valid).toBe(false);
  });
  it("warns when lookup count is near limit (>7)", () => {
    const rec = "v=spf1 " + Array.from({ length: 8 }, (_, i) => `include:d${i}.com`).join(" ") + " -all";
    const v = validateRecord(rec);
    expect(v.lookupCount).toBe(8);
    expect(v.issues.some((i) => i.code === "lookup-near-limit")).toBe(true);
  });
  it("flags macros as info", () => {
    const v = validateRecord("v=spf1 exists:%{i}.spf.example.com -all");
    expect(v.issues.some((i) => i.code === "macro")).toBe(true);
  });
  it("flags duplicate mechanisms", () => {
    const v = validateRecord("v=spf1 ip4:1.2.3.4 ip4:1.2.3.4 -all");
    expect(v.issues.some((i) => i.code === "duplicate")).toBe(true);
  });
});

describe("spf detectMultipleSpfRecords", () => {
  it("returns null for a single SPF record", () => {
    const txts = ['"v=spf1 -all"', '"google-site-verification=abc"'];
    expect(detectMultipleSpfRecords(txts)).toBeNull();
  });
  it("returns an issue for 2 SPF records", () => {
    const txts = ['"v=spf1 -all"', '"v=spf1 ip4:1.2.3.4 -all"'];
    const issue = detectMultipleSpfRecords(txts);
    expect(issue).not.toBeNull();
    expect(issue?.code).toBe("multiple-spf");
    expect(issue?.level).toBe("error");
  });
  it("returns null for empty list", () => {
    expect(detectMultipleSpfRecords([])).toBeNull();
  });
});

describe("spf generateCommands", () => {
  it("generates commands for a domain", () => {
    const cmds = generateCommands("example.com");
    expect(cmds.length).toBeGreaterThanOrEqual(5);
    expect(cmds.some((c) => c.tool === "dig" && c.command.includes("example.com"))).toBe(true);
    expect(cmds.some((c) => c.tool === "kdig")).toBe(true);
    expect(cmds.some((c) => c.tool === "curl" && c.command.includes("dns-query"))).toBe(true);
  });
  it("returns empty for empty input", () => {
    expect(generateCommands("")).toEqual([]);
  });
  it("includes grep filter for SPF-only output", () => {
    const cmds = generateCommands("example.com");
    expect(cmds.some((c) => c.command.includes("grep"))).toBe(true);
  });
});

describe("spf history (localStorage)", () => {
  it("loads empty initially", () => {
    expect(loadHistory()).toEqual([]);
  });
  it("saves and loads", () => {
    saveHistory({ ts: 1, action: "generate", count: 3 });
    expect(loadHistory()).toHaveLength(1);
  });
  it("caps at 20", () => {
    for (let i = 0; i < 25; i++) {
      saveHistory({ ts: i, action: "validate", count: i });
    }
    expect(loadHistory()).toHaveLength(20);
  });
  it("clears", () => {
    saveHistory({ ts: 1, action: "generate", count: 1 });
    clearHistory();
    expect(loadHistory()).toEqual([]);
  });
  it("does not store the record itself (privacy)", () => {
    const entry: HistoryEntry = { ts: 1, action: "generate", count: 3 };
    saveHistory(entry);
    const loaded = loadHistory();
    expect(loaded[0]).toEqual(entry);
    expect(Object.keys(loaded[0])).toEqual(["ts", "action", "count"]);
  });
});

describe("spf shareable URL", () => {
  it("builds share URL when window unavailable", () => {
    const origWindow = (globalThis as Record<string, unknown>).window;
    (globalThis as Record<string, unknown>).window = undefined;
    const url = buildShareUrl({ tab: "validate", record: "v=spf1 -all" });
    expect(url).toContain("tab=validate");
    expect(url).toContain("r=v%3Dspf1");
    (globalThis as Record<string, unknown>).window = origWindow;
  });
  it("parses share URL back", () => {
    const p = parseShareUrl("tab=validate&r=v%3Dspf1%20-all");
    expect(p.tab).toBe("validate");
    expect(p.record).toBe("v=spf1 -all");
  });
  it("handles empty hash", () => {
    expect(parseShareUrl("")).toEqual({});
  });
  it("ignores unknown tab values", () => {
    const p = parseShareUrl("tab=unknown");
    expect(p.tab).toBeUndefined();
  });
});
