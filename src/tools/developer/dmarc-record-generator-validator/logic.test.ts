import { describe, it, expect, beforeEach } from "vitest";
import {
  VALID_POLICIES,
  VALID_ALIGNMENTS,
  VALID_FAILURE_OPTIONS,
  VALID_REPORT_FORMATS,
  TAG_ORDER,
  DMARC_RI_DEFAULT,
  DMARC_PCT_DEFAULT,
  explainTag,
  explainAllTags,
  explainPolicy,
  explainAllPolicies,
  explainAlignment,
  explainFailureOption,
  explainAllFailureOptions,
  isValidDomain,
  isValidPolicy,
  isValidAlignment,
  isValidFailureOption,
  isValidReportFormat,
  validateMailtoUri,
  validateMailtoList,
  computePolicyStrength,
  buildRecord,
  buildDmarcName,
  parseRecord,
  validateRecord,
  detectMultipleDmarcRecords,
  generateEnforcementRoadmap,
  generateDigCommands,
  loadHistory,
  saveHistory,
  clearHistory,
  buildShareUrl,
  parseShareUrl,
  type DmarcInput,
  type DmarcPolicy,
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

// ---------------------------------------------------------------------------
describe("dmarc constants", () => {
  it("has 3 valid policies", () => {
    expect(VALID_POLICIES.size).toBe(3);
    for (const p of ["none", "quarantine", "reject"]) {
      expect(VALID_POLICIES.has(p as never)).toBe(true);
    }
  });
  it("has 2 valid alignment modes", () => {
    expect(VALID_ALIGNMENTS.size).toBe(2);
  });
  it("has 4 valid failure options", () => {
    expect(VALID_FAILURE_OPTIONS.size).toBe(4);
    for (const f of ["0", "1", "d", "s"]) {
      expect(VALID_FAILURE_OPTIONS.has(f as never)).toBe(true);
    }
  });
  it("has 1 valid report format", () => {
    expect(VALID_REPORT_FORMATS.size).toBe(1);
  });
  it("has 11 tags in TAG_ORDER (v,p,sp,rua,ruf,fo,adkim,aspf,pct,rf,ri)", () => {
    expect(TAG_ORDER).toHaveLength(11);
    expect(TAG_ORDER[0]).toBe("v");
    expect(TAG_ORDER[1]).toBe("p");
  });
  it("defaults are 86400 / 100", () => {
    expect(DMARC_RI_DEFAULT).toBe(86400);
    expect(DMARC_PCT_DEFAULT).toBe(100);
  });
});

// ---------------------------------------------------------------------------
describe("dmarc explainTag / explainPolicy / explainAlignment / explainFailureOption", () => {
  it("explains v tag as required", () => {
    const e = explainTag("v");
    expect(e.required).toBe(true);
    expect(e.short.toLowerCase()).toContain("version");
  });
  it("explains p tag as required", () => {
    const e = explainTag("p");
    expect(e.required).toBe(true);
    expect(e.short.toLowerCase()).toContain("policy");
  });
  it("explainAllTags returns all 11 tags in order", () => {
    const all = explainAllTags();
    expect(all).toHaveLength(11);
    expect(all.map((t) => t.tag)).toEqual([
      "v", "p", "sp", "rua", "ruf", "fo", "adkim", "aspf", "pct", "rf", "ri",
    ]);
  });
  it("explains p=reject as maximum strength (100)", () => {
    const e = explainPolicy("reject");
    expect(e.strength).toBe(100);
    expect(e.short.toLowerCase()).toContain("reject");
  });
  it("explains p=none as zero strength", () => {
    expect(explainPolicy("none").strength).toBe(0);
  });
  it("explainAllPolicies returns 3 policies", () => {
    expect(explainAllPolicies()).toHaveLength(3);
  });
  it("explains adkim=s as strict", () => {
    expect(explainAlignment("s").short.toLowerCase()).toContain("strict");
  });
  it("explains fo=1 as either-fails", () => {
    expect(explainFailureOption("1").short.toLowerCase()).toContain("either");
  });
  it("explainAllFailureOptions returns 4 options", () => {
    expect(explainAllFailureOptions()).toHaveLength(4);
  });
});

// ---------------------------------------------------------------------------
describe("dmarc validators", () => {
  it("validates domain", () => {
    expect(isValidDomain("example.com")).toBe(true);
    expect(isValidDomain("mail.example.com")).toBe(true);
    expect(isValidDomain("not valid")).toBe(false);
    expect(isValidDomain("")).toBe(false);
  });
  it("validates policy", () => {
    expect(isValidPolicy("none")).toBe(true);
    expect(isValidPolicy("reject")).toBe(true);
    expect(isValidPolicy("disable")).toBe(false);
  });
  it("validates alignment", () => {
    expect(isValidAlignment("r")).toBe(true);
    expect(isValidAlignment("s")).toBe(true);
    expect(isValidAlignment("x")).toBe(false);
  });
  it("validates failure option", () => {
    expect(isValidFailureOption("0")).toBe(true);
    expect(isValidFailureOption("d")).toBe(true);
    expect(isValidFailureOption("x")).toBe(false);
  });
  it("validates report format", () => {
    expect(isValidReportFormat("afrf")).toBe(true);
    expect(isValidReportFormat("xml")).toBe(false);
  });
});

// ---------------------------------------------------------------------------
describe("dmarc validateMailtoUri", () => {
  it("accepts simple mailto:", () => {
    const r = validateMailtoUri("mailto:user@example.com");
    expect(r.ok).toBe(true);
    expect(r.email).toBe("user@example.com");
  });
  it("accepts mailto: with DMARC size suffix", () => {
    const r = validateMailtoUri("mailto:user@example.com!10m");
    expect(r.ok).toBe(true);
    expect(r.email).toBe("user@example.com");
    expect(r.size).toBe("10m");
  });
  it("rejects non-mailto: prefix", () => {
    expect(validateMailtoUri("user@example.com").ok).toBe(false);
  });
  it("rejects invalid email", () => {
    expect(validateMailtoUri("mailto:not-an-email").ok).toBe(false);
  });
  it("rejects invalid size suffix", () => {
    expect(validateMailtoUri("mailto:user@example.com!abc").ok).toBe(false);
  });
  it("rejects empty", () => {
    expect(validateMailtoUri("").ok).toBe(false);
  });
});

// ---------------------------------------------------------------------------
describe("dmarc validateMailtoList", () => {
  it("returns empty results for empty input", () => {
    const r = validateMailtoList("");
    expect(r.ok).toBe(true);
    expect(r.results).toHaveLength(0);
  });
  it("validates each comma-separated URI", () => {
    const r = validateMailtoList("mailto:a@example.com, mailto:b@example.com");
    expect(r.ok).toBe(true);
    expect(r.results).toHaveLength(2);
  });
  it("fails if any URI is invalid", () => {
    const r = validateMailtoList("mailto:a@example.com, not-a-uri");
    expect(r.ok).toBe(false);
  });
});

// ---------------------------------------------------------------------------
describe("dmarc computePolicyStrength", () => {
  it("p=none gives strength 0 (label none)", () => {
    const r = computePolicyStrength("none", null, 100);
    expect(r.strength).toBe(0);
    expect(r.label).toBe("none");
  });
  it("p=quarantine pct=100 gives strength 50 (moderate)", () => {
    const r = computePolicyStrength("quarantine", null, 100);
    expect(r.strength).toBe(50);
    expect(r.label).toBe("moderate");
  });
  it("p=reject pct=100 gives strength 100 (maximum)", () => {
    const r = computePolicyStrength("reject", null, 100);
    expect(r.strength).toBe(100);
    expect(r.label).toBe("maximum");
  });
  it("p=reject pct=50 gives strength 50", () => {
    expect(computePolicyStrength("reject", null, 50).strength).toBe(50);
  });
  it("p=reject pct=10 gives strength 10 (weak)", () => {
    expect(computePolicyStrength("reject", null, 10).label).toBe("weak");
  });
  it("deducts 5 when sp is weaker than p", () => {
    const r = computePolicyStrength("reject", "none", 100);
    expect(r.strength).toBe(95); // 100 - 5
  });
  it("clamps pct to default 100 when out of range", () => {
    expect(computePolicyStrength("reject", null, 200).strength).toBe(100);
  });
});

// ---------------------------------------------------------------------------
describe("dmarc buildRecord", () => {
  it("builds a minimal p=reject record", () => {
    const input: DmarcInput = {
      domain: "example.com",
      policy: "reject",
    };
    expect(buildRecord(input)).toBe("v=DMARC1; p=reject");
  });
  it("builds with all tags", () => {
    const input: DmarcInput = {
      domain: "example.com",
      policy: "quarantine",
      subdomainPolicy: "reject",
      rua: "mailto:dmarc@example.com",
      ruf: "mailto:forensic@example.com",
      fo: ["1", "d"],
      adkim: "s",
      aspf: "r",
      pct: 50,
      rf: "afrf",
      ri: 3600,
    };
    const r = buildRecord(input);
    expect(r).toContain("v=DMARC1");
    expect(r).toContain("p=quarantine");
    expect(r).toContain("sp=reject");
    expect(r).toContain("rua=mailto:dmarc@example.com");
    expect(r).toContain("ruf=mailto:forensic@example.com");
    expect(r).toContain("fo=1:d");
    expect(r).toContain("adkim=s");
    // aspf=r and rf=afrf are defaults — should NOT be emitted.
    expect(r).not.toContain("aspf=r");
    expect(r).not.toContain("rf=afrf");
    expect(r).toContain("pct=50");
    expect(r).toContain("ri=3600");
  });
  it("omits defaults (adkim=r, aspf=r, pct=100, rf=afrf, ri=86400)", () => {
    const input: DmarcInput = {
      domain: "example.com",
      policy: "none",
      adkim: "r",
      aspf: "r",
      pct: 100,
      rf: "afrf",
      ri: 86400,
    };
    expect(buildRecord(input)).toBe("v=DMARC1; p=none");
  });
  it("omits fo=0 alone (default)", () => {
    const input: DmarcInput = {
      domain: "example.com",
      policy: "none",
      fo: ["0"],
    };
    expect(buildRecord(input)).toBe("v=DMARC1; p=none");
  });
  it("keeps fo=0 when combined with other options", () => {
    const input: DmarcInput = {
      domain: "example.com",
      policy: "none",
      fo: ["0", "d"],
    };
    expect(buildRecord(input)).toContain("fo=0:d");
  });
  it("deduplicates fo options", () => {
    const input: DmarcInput = {
      domain: "example.com",
      policy: "none",
      fo: ["1", "1", "d"],
    };
    expect(buildRecord(input)).toContain("fo=1:d");
    expect(buildRecord(input)).not.toContain("fo=1:1:d");
  });
});

// ---------------------------------------------------------------------------
describe("dmarc buildDmarcName", () => {
  it("builds _dmarc.<domain>", () => {
    expect(buildDmarcName("example.com")).toBe("_dmarc.example.com");
  });
  it("lowercases", () => {
    expect(buildDmarcName("EXAMPLE.com")).toBe("_dmarc.example.com");
  });
  it("returns empty for empty input", () => {
    expect(buildDmarcName("")).toBe("");
  });
});

// ---------------------------------------------------------------------------
describe("dmarc parseRecord", () => {
  it("parses semicolon-separated record", () => {
    const r = parseRecord("v=DMARC1; p=reject; rua=mailto:d@example.com");
    expect(r.tags.v).toBe("DMARC1");
    expect(r.tags.p).toBe("reject");
    expect(r.tags.rua).toBe("mailto:d@example.com");
    expect(r.issues).toHaveLength(0);
  });
  it("parses record wrapped in dig double quotes", () => {
    const r = parseRecord('"v=DMARC1; p=none"');
    expect(r.tags.v).toBe("DMARC1");
  });
  it("parses whitespace-separated record", () => {
    const r = parseRecord("v=DMARC1 p=quarantine pct=50");
    expect(r.tags.v).toBe("DMARC1");
    expect(r.tags.p).toBe("quarantine");
    expect(r.tags.pct).toBe("50");
  });
  it("flags duplicate tags", () => {
    const r = parseRecord("v=DMARC1; p=none; p=reject");
    expect(r.issues.some((i) => i.code === "duplicate-tag")).toBe(true);
    expect(r.tags.p).toBe("reject"); // last wins
  });
  it("flags tokens that are not tag=value pairs", () => {
    const r = parseRecord("v=DMARC1; notatag; p=none");
    expect(r.issues.some((i) => i.code === "not-a-tag")).toBe(true);
  });
  it("returns error for empty input", () => {
    const r = parseRecord("");
    expect(r.issues.some((i) => i.code === "empty")).toBe(true);
  });
});

// ---------------------------------------------------------------------------
describe("dmarc validateRecord", () => {
  it("validates a clean p=reject record", () => {
    const v = validateRecord("v=DMARC1; p=reject; rua=mailto:d@example.com");
    expect(v.valid).toBe(true);
    expect(v.policy).toBe("reject");
    expect(v.strength).toBe(100);
    expect(v.strengthLabel).toBe("maximum");
    expect(v.hasRua).toBe(true);
    expect(v.hasRuf).toBe(false);
  });
  it("validates p=none as valid but warns on weak-policy", () => {
    const v = validateRecord("v=DMARC1; p=none");
    expect(v.valid).toBe(true);
    expect(v.issues.some((i) => i.code === "weak-policy" && i.level === "warning")).toBe(true);
    expect(v.strength).toBe(0);
  });
  it("errors when v= is missing", () => {
    const v = validateRecord("p=reject");
    expect(v.issues.some((i) => i.code === "no-version")).toBe(true);
    expect(v.valid).toBe(false);
  });
  it("errors when v= has wrong value", () => {
    const v = validateRecord("v=DMARC2; p=reject");
    expect(v.issues.some((i) => i.code === "bad-version")).toBe(true);
    expect(v.valid).toBe(false);
  });
  it("errors when v= is not first", () => {
    const v = validateRecord("p=reject; v=DMARC1");
    expect(v.issues.some((i) => i.code === "v-not-first")).toBe(true);
    expect(v.valid).toBe(false);
  });
  it("errors when p= is missing", () => {
    const v = validateRecord("v=DMARC1; rua=mailto:d@example.com");
    expect(v.issues.some((i) => i.code === "no-policy")).toBe(true);
    expect(v.valid).toBe(false);
  });
  it("errors on invalid p=", () => {
    const v = validateRecord("v=DMARC1; p=disable");
    expect(v.issues.some((i) => i.code === "bad-policy")).toBe(true);
    expect(v.valid).toBe(false);
  });
  it("errors on invalid sp=", () => {
    const v = validateRecord("v=DMARC1; p=reject; sp=quarantined");
    expect(v.issues.some((i) => i.code === "bad-sp")).toBe(true);
    expect(v.valid).toBe(false);
  });
  it("info on sp weaker than p", () => {
    const v = validateRecord("v=DMARC1; p=reject; sp=none");
    expect(v.issues.some((i) => i.code === "sp-weaker-than-p" && i.level === "info")).toBe(true);
  });
  it("errors on invalid rua mailto", () => {
    const v = validateRecord("v=DMARC1; p=reject; rua=not-a-uri");
    expect(v.issues.some((i) => i.code === "bad-rua")).toBe(true);
    expect(v.valid).toBe(false);
  });
  it("info on rua external-destination requirement", () => {
    const v = validateRecord("v=DMARC1; p=reject; rua=mailto:d@other.com");
    expect(v.issues.some((i) => i.code === "rua-external-destination")).toBe(true);
  });
  it("info on ruf PII risk", () => {
    const v = validateRecord("v=DMARC1; p=reject; ruf=mailto:f@example.com");
    expect(v.issues.some((i) => i.code === "ruf-pii")).toBe(true);
  });
  it("errors on invalid fo option", () => {
    const v = validateRecord("v=DMARC1; p=reject; fo=x");
    expect(v.issues.some((i) => i.code === "bad-fo")).toBe(true);
    expect(v.valid).toBe(false);
  });
  it("info on fo without ruf", () => {
    const v = validateRecord("v=DMARC1; p=reject; fo=1");
    expect(v.issues.some((i) => i.code === "fo-without-ruf")).toBe(true);
  });
  it("errors on invalid adkim", () => {
    const v = validateRecord("v=DMARC1; p=reject; adkim=x");
    expect(v.issues.some((i) => i.code === "bad-adkim")).toBe(true);
    expect(v.valid).toBe(false);
  });
  it("errors on invalid aspf", () => {
    const v = validateRecord("v=DMARC1; p=reject; aspf=x");
    expect(v.issues.some((i) => i.code === "bad-aspf")).toBe(true);
    expect(v.valid).toBe(false);
  });
  it("errors on pct out of range", () => {
    const v = validateRecord("v=DMARC1; p=reject; pct=150");
    expect(v.issues.some((i) => i.code === "bad-pct")).toBe(true);
    expect(v.valid).toBe(false);
  });
  it("errors on non-numeric pct", () => {
    const v = validateRecord("v=DMARC1; p=reject; pct=abc");
    expect(v.issues.some((i) => i.code === "bad-pct")).toBe(true);
    expect(v.valid).toBe(false);
  });
  it("info on partial enforcement (pct<100)", () => {
    const v = validateRecord("v=DMARC1; p=quarantine; pct=50");
    expect(v.issues.some((i) => i.code === "partial-enforcement")).toBe(true);
  });
  it("errors on invalid rf", () => {
    const v = validateRecord("v=DMARC1; p=reject; rf=xml");
    expect(v.issues.some((i) => i.code === "bad-rf")).toBe(true);
    expect(v.valid).toBe(false);
  });
  it("errors on non-numeric ri", () => {
    const v = validateRecord("v=DMARC1; p=reject; ri=abc");
    expect(v.issues.some((i) => i.code === "bad-ri")).toBe(true);
    expect(v.valid).toBe(false);
  });
  it("warns on ri < 1 hour", () => {
    const v = validateRecord("v=DMARC1; p=reject; ri=60");
    expect(v.issues.some((i) => i.code === "ri-too-small" && i.level === "warning")).toBe(true);
  });
  it("computes strength for p=quarantine pct=50", () => {
    const v = validateRecord("v=DMARC1; p=quarantine; pct=50");
    expect(v.strength).toBe(25);
    expect(v.strengthLabel).toBe("weak");
  });
});

// ---------------------------------------------------------------------------
describe("dmarc detectMultipleDmarcRecords", () => {
  it("returns null for a single DMARC record", () => {
    const txts = ['"v=DMARC1; p=reject"', '"google-site-verification=abc"'];
    expect(detectMultipleDmarcRecords(txts)).toBeNull();
  });
  it("returns an issue for 2 DMARC records", () => {
    const txts = ['"v=DMARC1; p=none"', '"v=DMARC1; p=reject"'];
    const issue = detectMultipleDmarcRecords(txts);
    expect(issue).not.toBeNull();
    expect(issue?.code).toBe("multiple-dmarc");
    expect(issue?.level).toBe("error");
  });
  it("returns null for empty list", () => {
    expect(detectMultipleDmarcRecords([])).toBeNull();
  });
  it("ignores non-DMARC TXT records", () => {
    const txts = [`"v=spf1 -all"`, `"google-site-verification=abc"`];
    expect(detectMultipleDmarcRecords(txts)).toBeNull();
  });
});

// ---------------------------------------------------------------------------
describe("dmarc generateEnforcementRoadmap", () => {
  it("marks level 0 (none) as current for p=none", () => {
    const steps = generateEnforcementRoadmap("none", 100);
    expect(steps).toHaveLength(5);
    expect(steps[0].isCurrent).toBe(true);
    expect(steps[1].isCurrent).toBe(false);
  });
  it("marks level 1 (quarantine ramp) as current for p=quarantine pct=50", () => {
    const steps = generateEnforcementRoadmap("quarantine", 50);
    expect(steps[1].isCurrent).toBe(true);
    expect(steps[2].isCurrent).toBe(false);
  });
  it("marks level 2 (quarantine full) as current for p=quarantine pct=100", () => {
    const steps = generateEnforcementRoadmap("quarantine", 100);
    expect(steps[2].isCurrent).toBe(true);
  });
  it("marks level 3 (reject ramp) as current for p=reject pct=50", () => {
    const steps = generateEnforcementRoadmap("reject", 50);
    expect(steps[3].isCurrent).toBe(true);
  });
  it("marks level 4 (maximum) as current for p=reject pct=100", () => {
    const steps = generateEnforcementRoadmap("reject", 100);
    expect(steps[4].isCurrent).toBe(true);
    expect(steps[4].isDone).toBe(false);
  });
  it("marks earlier levels as done", () => {
    const steps = generateEnforcementRoadmap("reject", 100);
    expect(steps[0].isDone).toBe(true);
    expect(steps[3].isDone).toBe(true);
  });
});

// ---------------------------------------------------------------------------
describe("dmarc generateDigCommands", () => {
  it("generates commands for a domain", () => {
    const cmds = generateDigCommands("example.com");
    expect(cmds.length).toBeGreaterThanOrEqual(5);
    expect(cmds.some((c) => c.tool === "dig" && c.command.includes("_dmarc.example.com"))).toBe(true);
    expect(cmds.some((c) => c.tool === "kdig")).toBe(true);
    expect(cmds.some((c) => c.tool === "curl" && c.command.includes("dns-query"))).toBe(true);
    expect(cmds.some((c) => c.tool === "host")).toBe(true);
  });
  it("returns empty for empty input", () => {
    expect(generateDigCommands("")).toEqual([]);
  });
  it("includes grep filter for DMARC-only output", () => {
    const cmds = generateDigCommands("example.com");
    expect(cmds.some((c) => c.command.includes("grep"))).toBe(true);
  });
});

// ---------------------------------------------------------------------------
describe("dmarc history (localStorage)", () => {
  it("loads empty initially", () => {
    expect(loadHistory()).toEqual([]);
  });
  it("saves and loads", () => {
    saveHistory({ ts: 1, action: "generate", policy: "reject", strength: 100 });
    expect(loadHistory()).toHaveLength(1);
  });
  it("caps at 20", () => {
    for (let i = 0; i < 25; i++) {
      saveHistory({ ts: i, action: "validate", policy: "none", strength: 0 });
    }
    expect(loadHistory()).toHaveLength(20);
  });
  it("clears", () => {
    saveHistory({ ts: 1, action: "generate", policy: "reject", strength: 100 });
    clearHistory();
    expect(loadHistory()).toEqual([]);
  });
  it("does not store the record or domain (privacy)", () => {
    const entry: HistoryEntry = { ts: 1, action: "generate", policy: "reject", strength: 100 };
    saveHistory(entry);
    const loaded = loadHistory();
    expect(loaded[0]).toEqual(entry);
    expect(Object.keys(loaded[0])).toEqual(["ts", "action", "policy", "strength"]);
  });
});

// ---------------------------------------------------------------------------
describe("dmarc shareable URL", () => {
  it("builds share URL when window unavailable", () => {
    const origWindow = (globalThis as Record<string, unknown>).window;
    (globalThis as Record<string, unknown>).window = undefined;
    const url = buildShareUrl({ tab: "validate", record: "v=DMARC1; p=reject" });
    expect(url).toContain("tab=validate");
    expect(url).toContain("r=v%3DDMARC1");
    (globalThis as Record<string, unknown>).window = origWindow;
  });
  it("parses share URL back", () => {
    const p = parseShareUrl("tab=validate&r=v%3DDMARC1%3B%20p%3Dreject");
    expect(p.tab).toBe("validate");
    expect(p.record).toBe("v=DMARC1; p=reject");
  });
  it("handles empty hash", () => {
    expect(parseShareUrl("")).toEqual({});
  });
  it("ignores unknown tab values", () => {
    const p = parseShareUrl("tab=unknown");
    expect(p.tab).toBeUndefined();
  });
});

// Suppress unused-import lint for type-only imports.
export type _Unused = DmarcPolicy;
