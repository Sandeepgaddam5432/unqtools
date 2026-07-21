import { describe, it, expect, beforeEach } from "vitest";
import {
  HISTORY_MAX,
  RECORD_TYPES,
  REGIONS,
  REGION_LABELS,
  RESOLVERS,
  getResolver,
  resolversByRegion,
  normalizeDomain,
  isValidDomain,
  generateCommand,
  generateCommands,
  buildCompareCommand,
  generateAuthoritativeCompare,
  computeEta,
  generateBashScript,
  generatePowershellScript,
  renderCsv,
  renderJson,
  loadHistory,
  saveHistory,
  clearHistory,
  buildShareUrl,
  parseShareUrl,
  type RecordType,
  type CommandTool,
  type MatchMode,
  type Region,
  type DigFlag,
  type CommandOptions,
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

describe("dns-propagation constants", () => {
  it("has 20+ resolver presets", () => {
    expect(RESOLVERS.length).toBeGreaterThanOrEqual(20);
  });
  it("includes google, cloudflare, quad9, opendns", () => {
    const ids = RESOLVERS.map((r) => r.id);
    expect(ids).toContain("google");
    expect(ids).toContain("cloudflare");
    expect(ids).toContain("quad9");
    expect(ids).toContain("opendns");
  });
  it("has 8 record types", () => {
    expect(RECORD_TYPES).toHaveLength(8);
  });
  it("has 7 regions", () => {
    expect(REGIONS).toHaveLength(7);
  });
  it("enforces a 20-entry history cap", () => {
    expect(HISTORY_MAX).toBe(20);
  });
  it("region labels cover every region id", () => {
    for (const r of REGIONS) {
      expect(REGION_LABELS[r.id]).toBeTruthy();
    }
  });
  it("every resolver has a non-empty server and region", () => {
    for (const r of RESOLVERS) {
      expect(r.server).toBeTruthy();
      expect(r.region).toBeTruthy();
      expect(REGION_LABELS[r.region]).toBeTruthy();
    }
  });
  it("returns the resolver by id", () => {
    expect(getResolver("google")?.server).toBe("8.8.8.8");
  });
  it("returns undefined for unknown resolver id", () => {
    expect(getResolver("nonexistent")).toBeUndefined();
  });
});

describe("dns-propagation resolversByRegion", () => {
  it("returns all resolvers when no regions provided", () => {
    expect(resolversByRegion([])).toHaveLength(RESOLVERS.length);
  });
  it("filters by region", () => {
    const eu = resolversByRegion(["europe"]);
    expect(eu.length).toBeGreaterThan(0);
    expect(eu.every((r) => r.region === "europe")).toBe(true);
  });
  it("filters by multiple regions", () => {
    const both = resolversByRegion(["europe", "asia-pacific"]);
    expect(both.every((r) => r.region === "europe" || r.region === "asia-pacific")).toBe(true);
  });
});

describe("dns-propagation normalizeDomain", () => {
  it("trims and lowercases", () => {
    expect(normalizeDomain("  EXAMPLE.COM  ")).toBe("example.com");
  });
  it("strips protocol", () => {
    expect(normalizeDomain("https://example.com/path")).toBe("example.com");
  });
  it("strips port", () => {
    expect(normalizeDomain("example.com:8080")).toBe("example.com");
  });
  it("strips trailing dot", () => {
    expect(normalizeDomain("example.com.")).toBe("example.com");
  });
  it("returns empty for empty input", () => {
    expect(normalizeDomain("")).toBe("");
  });
});

describe("dns-propagation isValidDomain", () => {
  it("accepts example.com", () => {
    expect(isValidDomain("example.com")).toBe(true);
  });
  it("accepts sub.example.co.uk", () => {
    expect(isValidDomain("sub.example.co.uk")).toBe(true);
  });
  it("accepts with protocol prefix (normalized first)", () => {
    expect(isValidDomain("https://example.com/path")).toBe(true);
  });
  it("rejects single label", () => {
    expect(isValidDomain("localhost")).toBe(false);
  });
  it("rejects labels with leading hyphen", () => {
    expect(isValidDomain("-bad.example.com")).toBe(false);
  });
  it("rejects empty", () => {
    expect(isValidDomain("")).toBe(false);
  });
});

describe("dns-propagation command generation", () => {
  const opts: CommandOptions = {
    domain: "example.com",
    recordType: "A",
    tool: "dig",
    matchMode: "exact",
    expected: "",
  };
  it("generates a dig command with @server", () => {
    const c = generateCommand(getResolver("google")!, opts);
    expect(c.command).toBe("dig @8.8.8.8 A example.com");
    expect(c.explanation).toContain("Google");
  });
  it("generates a kdig DoH command", () => {
    const c = generateCommand(getResolver("cloudflare")!, { ...opts, tool: "kdig" });
    expect(c.command).toContain("+https=https://cloudflare-dns.com/dns-query");
    expect(c.command).toContain("A example.com");
  });
  it("generates a PowerShell Resolve-DnsName command", () => {
    const c = generateCommand(getResolver("google")!, { ...opts, tool: "resolve-dnsname" });
    expect(c.command).toContain("Resolve-DnsName");
    expect(c.command).toContain("-Type A");
    expect(c.command).toContain("-Server 8.8.8.8");
    expect(c.command).toContain("-DnsOnly");
  });
  it("falls back to plain kdig when no DoH endpoint", () => {
    const c = generateCommand(getResolver("comodo")!, { ...opts, tool: "kdig" });
    expect(c.command).toContain("kdig");
    expect(c.command).not.toContain("+https");
    expect(c.explanation).toContain("not available");
  });
  it("applies +short flag", () => {
    const c = generateCommand(getResolver("google")!, { ...opts, flags: [{ id: "short" }] });
    expect(c.command).toBe("dig @8.8.8.8 A example.com +short");
  });
  it("generates commands for every resolver", () => {
    const cmds = generateCommands(RESOLVERS, opts);
    expect(cmds).toHaveLength(RESOLVERS.length);
    expect(cmds.every((c) => c.command.length > 0)).toBe(true);
  });
  it("normalizes domain in command output", () => {
    const c = generateCommand(getResolver("google")!, { ...opts, domain: "  HTTPS://Example.COM/Path  " });
    expect(c.command).toContain("example.com");
  });
});

describe("dns-propagation compare command", () => {
  const baseOpts: CommandOptions = {
    domain: "example.com",
    recordType: "A",
    tool: "dig",
    matchMode: "exact",
    expected: "93.184.216.34",
  };
  it("builds an exact-match grep -Fx chain for dig", () => {
    const c = buildCompareCommand(getResolver("google")!, baseOpts, "");
    expect(c).toContain("grep -Fx '93.184.216.34'");
    expect(c).toContain("google: OK");
    expect(c).toContain("google: DIFFERS");
  });
  it("builds a contains-match grep -F chain", () => {
    const c = buildCompareCommand(getResolver("google")!, { ...baseOpts, matchMode: "contains" }, "");
    expect(c).toContain("grep -F '93.184.216.34'");
  });
  it("builds a regex-match grep -E chain", () => {
    const c = buildCompareCommand(getResolver("google")!, { ...baseOpts, matchMode: "regex", expected: "^93\\.184" }, "");
    expect(c).toContain("grep -E '^93\\.184'");
  });
  it("falls back to grep -F for invalid regex", () => {
    const c = buildCompareCommand(getResolver("google")!, { ...baseOpts, matchMode: "regex", expected: "(((" }, "");
    expect(c).toContain("grep -F");
    expect(c).not.toContain("grep -E");
  });
  it("returns empty when no expected value", () => {
    const c = buildCompareCommand(getResolver("google")!, { ...baseOpts, expected: "" }, "");
    expect(c).toBe("");
  });
  it("uses kdig base command for kdig tool", () => {
    const c = buildCompareCommand(getResolver("cloudflare")!, { ...baseOpts, tool: "kdig" }, "");
    expect(c).toContain("kdig");
    expect(c).toContain("+https");
  });
  it("builds a PowerShell Where-Object chain for resolve-dnsname", () => {
    const c = buildCompareCommand(getResolver("google")!, { ...baseOpts, tool: "resolve-dnsname" }, "");
    expect(c).toContain("Resolve-DnsName");
    expect(c).toContain("IPAddress");
    expect(c).toContain("Where-Object");
    expect(c).toContain("google: OK");
  });
  it("uses NameExchange for MX records in PowerShell", () => {
    const c = buildCompareCommand(getResolver("google")!, { ...baseOpts, recordType: "MX", tool: "resolve-dnsname" }, "");
    expect(c).toContain("NameExchange");
  });
  it("includes compareCommand when expected set", () => {
    const cmd = generateCommand(getResolver("google")!, baseOpts);
    expect(cmd.compareCommand).toContain("grep");
  });
  it("omits compareCommand when expected empty", () => {
    const cmd = generateCommand(getResolver("google")!, { ...baseOpts, expected: "" });
    expect(cmd.compareCommand).toBe("");
  });
});

describe("dns-propagation authoritative compare", () => {
  it("generates a 3-step authoritative vs recursive chain", () => {
    const cmds = generateAuthoritativeCompare("example.com", "A", getResolver("google")!);
    expect(cmds).toHaveLength(3);
    expect(cmds[0].command).toContain("NS example.com");
    expect(cmds[1].command).toContain("@<NS-FROM-STEP-1>");
    expect(cmds[2].command).toContain("A example.com");
  });
  it("uses resolver server in step 1 and 3", () => {
    const cmds = generateAuthoritativeCompare("example.com", "A", getResolver("cloudflare")!);
    expect(cmds[0].command).toContain("@1.1.1.1");
    expect(cmds[2].command).toContain("@1.1.1.1");
  });
});

describe("dns-propagation ETA", () => {
  it("computes p50 as half the TTL", () => {
    const e = computeEta(3600);
    expect(e.p50Seconds).toBe(1800);
  });
  it("computes p95 as 2x the TTL", () => {
    const e = computeEta(3600);
    expect(e.p95Seconds).toBe(7200);
  });
  it("computes worst case as 3x the TTL", () => {
    const e = computeEta(3600);
    expect(e.worstCaseSeconds).toBe(10800);
  });
  it("humanizes short durations as seconds", () => {
    expect(computeEta(30).p50Human).toBe("15s");
  });
  it("humanizes minutes", () => {
    expect(computeEta(120).p50Human).toBe("1m");
    expect(computeEta(3600).p50Human).toBe("30m");
  });
  it("humanizes hours", () => {
    expect(computeEta(3600).p95Human).toBe("2h");
  });
  it("humanizes days for very large TTLs", () => {
    expect(computeEta(86400).p95Human).toBe("2d");
  });
  it("handles zero TTL gracefully", () => {
    const e = computeEta(0);
    expect(e.ttlSeconds).toBe(0);
    expect(e.p50Seconds).toBe(0);
    expect(e.explanation.length).toBeGreaterThan(0);
  });
  it("explanation references TTL", () => {
    const e = computeEta(3600);
    expect(e.explanation).toContain("TTL 3600s");
  });
});

describe("dns-propagation bash script", () => {
  const opts: CommandOptions = {
    domain: "example.com",
    recordType: "A",
    tool: "dig",
    matchMode: "exact",
    expected: "93.184.216.34",
  };
  it("generates a bash script with header and footer", () => {
    const cmds = generateCommands([getResolver("google")!], opts);
    const script = generateBashScript(cmds, "example.com", "A");
    expect(script).toContain("#!/usr/bin/env bash");
    expect(script).toContain("=== Done ===");
    expect(script).toContain("# Domain: example.com");
    expect(script).toContain("# Record type: A");
  });
  it("includes the compare command when expected set", () => {
    const cmds = generateCommands([getResolver("google")!], opts);
    const script = generateBashScript(cmds, "example.com", "A");
    expect(script).toContain("grep -Fx");
    expect(script).toContain("google: OK");
  });
  it("falls back to base command when no expected", () => {
    const cmds = generateCommands([getResolver("google")!], { ...opts, expected: "" });
    const script = generateBashScript(cmds, "example.com", "A");
    expect(script).toContain("dig @8.8.8.8 A example.com");
    expect(script).not.toContain("grep");
  });
  it("handles empty command list", () => {
    const script = generateBashScript([], "example.com", "A");
    expect(script).toContain("Resolvers: 0");
    expect(script).toContain("=== Done ===");
  });
});

describe("dns-propagation PowerShell script", () => {
  const opts: CommandOptions = {
    domain: "example.com",
    recordType: "A",
    tool: "resolve-dnsname",
    matchMode: "exact",
    expected: "93.184.216.34",
  };
  it("generates a PowerShell script with Write-Host", () => {
    const cmds = generateCommands([getResolver("google")!], opts);
    const script = generatePowershellScript(cmds, "example.com", "A");
    expect(script).toContain("$Domain = 'example.com'");
    expect(script).toContain("Write-Host");
    expect(script).toContain("Resolve-DnsName");
  });
  it("uses the compare command for PowerShell tool", () => {
    const cmds = generateCommands([getResolver("google")!], opts);
    const script = generatePowershellScript(cmds, "example.com", "A");
    expect(script).toContain("Where-Object");
    expect(script).toContain("google: OK");
  });
});

describe("dns-propagation CSV / JSON export", () => {
  const opts: CommandOptions = {
    domain: "example.com",
    recordType: "A",
    tool: "dig",
    matchMode: "exact",
    expected: "",
  };
  it("renders CSV with header", () => {
    const cmds = generateCommands([getResolver("google")!], opts);
    const csv = renderCsv(cmds);
    expect(csv).toContain("resolver_id,resolver_label,region,tool,command,compare_command,explanation");
    expect(csv).toContain("google,Google Public DNS,global,dig");
  });
  it("escapes commas in CSV fields", () => {
    // Construct a synthetic GeneratedCommand whose explanation contains a comma
    const synthetic = [{
      tool: "dig" as const,
      resolverId: "synthetic",
      resolverLabel: "Synthetic, Inc.",
      region: "global" as const,
      command: "dig @1.2.3.4 A example.com",
      compareCommand: "",
      explanation: "Has, a comma, in it.",
    }];
    const csv = renderCsv(synthetic);
    // Fields with commas must be quoted
    expect(csv).toContain('"Synthetic, Inc."');
    expect(csv).toContain('"Has, a comma, in it."');
  });
  it("renders JSON with resolverId field", () => {
    const cmds = generateCommands([getResolver("google")!, getResolver("cloudflare")!], opts);
    const json = renderJson(cmds);
    const parsed = JSON.parse(json);
    expect(parsed).toHaveLength(2);
    expect(parsed[0].resolverId).toBe("google");
    expect(parsed[1].resolverId).toBe("cloudflare");
  });
  it("renders empty CSV/JSON for empty list", () => {
    expect(renderCsv([])).toContain("resolver_id");
    expect(JSON.parse(renderJson([]))).toEqual([]);
  });
});

describe("dns-propagation history (localStorage)", () => {
  it("loads empty initially", () => {
    expect(loadHistory()).toEqual([]);
  });
  it("saves and loads", () => {
    saveHistory({ ts: 1, action: "generate", recordType: "A", count: 22 });
    expect(loadHistory()).toHaveLength(1);
  });
  it("caps at HISTORY_MAX (20)", () => {
    for (let i = 0; i < 25; i++) {
      saveHistory({ ts: i, action: "generate", recordType: "A", count: 1 });
    }
    expect(loadHistory()).toHaveLength(20);
  });
  it("clears", () => {
    saveHistory({ ts: 1, action: "generate", recordType: "A", count: 1 });
    clearHistory();
    expect(loadHistory()).toEqual([]);
  });
});

describe("dns-propagation shareable URL", () => {
  it("builds share URL when window unavailable", () => {
    const origWindow = (globalThis as Record<string, unknown>).window;
    (globalThis as Record<string, unknown>).window = undefined;
    const url = buildShareUrl({
      domain: "example.com",
      recordType: "A",
      tool: "dig",
      matchMode: "exact",
      expected: "93.184.216.34",
      regions: ["global", "europe"],
      flags: ["short"],
    });
    expect(url).toContain("domain=example.com");
    expect(url).toContain("type=A");
    expect(url).toContain("tool=dig");
    expect(url).toContain("match=exact");
    expect(url).toContain("expected=93.184.216.34");
    expect(url).toContain("regions=global%2Ceurope");
    expect(url).toContain("flags=short");
    (globalThis as Record<string, unknown>).window = origWindow;
  });
  it("parses share URL back", () => {
    const p = parseShareUrl("domain=example.com&type=AAAA&tool=kdig&match=contains&expected=::1&regions=europe&flags=short,answer");
    expect(p.domain).toBe("example.com");
    expect(p.recordType).toBe("AAAA");
    expect(p.tool).toBe("kdig");
    expect(p.matchMode).toBe("contains");
    expect(p.expected).toBe("::1");
    expect(p.regions).toEqual(["europe"]);
    expect(p.flags).toEqual(["short", "answer"]);
  });
  it("handles empty hash", () => {
    expect(parseShareUrl("")).toEqual({});
  });
  it("filters unknown record types and tools", () => {
    const p = parseShareUrl("domain=example.com&type=BOGUS&tool=fake");
    expect(p.recordType).toBeUndefined();
    expect(p.tool).toBeUndefined();
  });
  it("filters unknown regions", () => {
    const p = parseShareUrl("regions=global,bogus,europe");
    expect(p.regions).toEqual(["global", "europe"]);
  });
});

// Suppress unused-import lint
export type _Unused = RecordType | CommandTool | MatchMode | Region | DigFlag;
