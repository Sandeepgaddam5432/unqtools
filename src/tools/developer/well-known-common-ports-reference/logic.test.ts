import { describe, it, expect, beforeEach } from "vitest";
import {
  PORTS,
  PORT_COUNT,
  DATASET_VERSION,
  DATASET_DATE,
  DATASET_SOURCE,
  CATEGORIES,
  PROTOCOLS,
  RANGE_BOUNDS,
  classifyRange,
  rangeLabel,
  findByPort,
  findByService,
  normalizeQuery,
  isNumericQuery,
  searchPorts,
  groupByRange,
  groupByCategory,
  sortPorts,
  computeStats,
  securitySummary,
  explainCategory,
  explainProtocol,
  explainEncrypted,
  formatAsText,
  formatAsMarkdown,
  formatAsCsv,
  loadHistory,
  saveHistory,
  clearHistory,
  buildShareUrl,
  parseShareUrl,
  type PortEntry,
  type PortCategory,
  type Protocol,
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
describe("ports dataset integrity", () => {
  it("PORTS has at least 100 entries (blueprint requirement)", () => {
    expect(PORTS.length).toBeGreaterThanOrEqual(100);
  });
  it("PORT_COUNT matches PORTS.length", () => {
    expect(PORT_COUNT).toBe(PORTS.length);
  });
  it("every entry has required fields", () => {
    for (const p of PORTS) {
      expect(typeof p.port).toBe("number");
      expect(p.port).toBeGreaterThanOrEqual(0);
      expect(p.port).toBeLessThanOrEqual(65535);
      expect(["tcp", "udp", "tcp/udp"]).toContain(p.protocol);
      expect(p.service.length).toBeGreaterThan(0);
      expect(p.description.length).toBeGreaterThan(0);
      expect(typeof p.encrypted).toBe("boolean");
    }
  });
  it("has no duplicate (port, protocol) pairs", () => {
    const seen = new Set<string>();
    let dups = 0;
    for (const p of PORTS) {
      const key = `${p.port}/${p.protocol}`;
      if (seen.has(key)) dups++;
      seen.add(key);
    }
    expect(dups).toBe(0);
  });
  it("DATASET_VERSION and DATASET_DATE are non-empty", () => {
    expect(DATASET_VERSION.length).toBeGreaterThan(0);
    expect(DATASET_DATE).toMatch(/^\d{4}-\d{2}-\d{2}$/);
  });
  it("DATASET_SOURCE is documented", () => {
    expect(DATASET_SOURCE.toLowerCase()).toContain("iana");
    expect(DATASET_SOURCE.toLowerCase()).toContain("wikipedia");
  });
  it("CATEGORIES has 13 categories", () => {
    expect(CATEGORIES).toHaveLength(13);
    expect(CATEGORIES).toContain("web");
    expect(CATEGORIES).toContain("database");
    expect(CATEGORIES).toContain("remote");
  });
  it("PROTOCOLS has 4 entries", () => {
    expect(PROTOCOLS).toHaveLength(4);
    expect(PROTOCOLS).toContain("any");
    expect(PROTOCOLS).toContain("tcp");
    expect(PROTOCOLS).toContain("udp");
    expect(PROTOCOLS).toContain("tcp/udp");
  });
  it("RANGE_BOUNDS has well-known, registered, dynamic", () => {
    expect(RANGE_BOUNDS["well-known"]).toEqual([0, 1023]);
    expect(RANGE_BOUNDS["registered"]).toEqual([1024, 49151]);
    expect(RANGE_BOUNDS["dynamic"]).toEqual([49152, 65535]);
  });
});

// ---------------------------------------------------------------------------
describe("ports classifyRange / rangeLabel", () => {
  it("classifies 80 as well-known", () => {
    expect(classifyRange(80)).toBe("well-known");
  });
  it("classifies 443 as well-known", () => {
    expect(classifyRange(443)).toBe("well-known");
  });
  it("classifies 3306 as registered", () => {
    expect(classifyRange(3306)).toBe("registered");
  });
  it("classifies 50000 as dynamic", () => {
    expect(classifyRange(50000)).toBe("dynamic");
  });
  it("classifies boundary 1023 / 1024 / 49151 / 49152", () => {
    expect(classifyRange(1023)).toBe("well-known");
    expect(classifyRange(1024)).toBe("registered");
    expect(classifyRange(49151)).toBe("registered");
    expect(classifyRange(49152)).toBe("dynamic");
  });
  it("rangeLabel includes the range name and bounds", () => {
    expect(rangeLabel("well-known")).toContain("0–1023");
    expect(rangeLabel("registered")).toContain("1024–49151");
    expect(rangeLabel("dynamic")).toContain("49152–65535");
  });
});

// ---------------------------------------------------------------------------
describe("ports findByPort / findByService", () => {
  it("findByPort(443) returns https", () => {
    const r = findByPort(443);
    expect(r.length).toBeGreaterThanOrEqual(1);
    expect(r[0].service).toBe("https");
  });
  it("findByPort(53) returns dns (tcp/udp)", () => {
    const r = findByPort(53);
    expect(r.length).toBeGreaterThanOrEqual(1);
    expect(r[0].service).toBe("domain");
  });
  it("findByPort with protocol filter narrows the result", () => {
    // Port 53 is tcp/udp — should still match tcp and udp filters
    expect(findByPort(53, "tcp").length).toBeGreaterThanOrEqual(1);
    expect(findByPort(53, "udp").length).toBeGreaterThanOrEqual(1);
  });
  it("findByPort for an unknown port returns []", () => {
    expect(findByPort(12345)).toEqual([]);
  });
  it("findByService('https') returns 443", () => {
    const r = findByService("https");
    expect(r.some((p) => p.port === 443)).toBe(true);
  });
  it("findByService matches aliases (dns)", () => {
    const r = findByService("dns");
    expect(r.some((p) => p.port === 53)).toBe(true);
  });
  it("findByService is case-insensitive", () => {
    const r = findByService("HTTPS");
    expect(r.some((p) => p.port === 443)).toBe(true);
  });
  it("findByService returns [] for empty query", () => {
    expect(findByService("")).toEqual([]);
  });
});

// ---------------------------------------------------------------------------
describe("ports normalizeQuery / isNumericQuery", () => {
  it("normalizeQuery trims + lowercases", () => {
    expect(normalizeQuery("  HTTPS ")).toBe("https");
  });
  it("isNumericQuery detects pure numbers", () => {
    expect(isNumericQuery("443")).toBe(true);
    expect(isNumericQuery("  443 ")).toBe(true);
  });
  it("isNumericQuery rejects non-numbers", () => {
    expect(isNumericQuery("https")).toBe(false);
    expect(isNumericQuery("443abc")).toBe(false);
    expect(isNumericQuery("")).toBe(false);
  });
});

// ---------------------------------------------------------------------------
describe("ports searchPorts", () => {
  it("empty query returns all entries", () => {
    expect(searchPorts({}).length).toBe(PORTS.length);
  });
  it("numeric query matches by port", () => {
    const r = searchPorts({ query: "443" });
    expect(r.length).toBeGreaterThanOrEqual(1);
    expect(r.every((p) => p.port === 443)).toBe(true);
  });
  it("service-name query matches", () => {
    const r = searchPorts({ query: "https" });
    expect(r.some((p) => p.port === 443)).toBe(true);
    expect(r.some((p) => p.service === "https-alt")).toBe(true);
  });
  it("protocol filter narrows by tcp", () => {
    const r = searchPorts({ protocol: "tcp" });
    expect(r.every((p) => p.protocol === "tcp" || p.protocol === "tcp/udp")).toBe(true);
  });
  it("protocol filter narrows by udp", () => {
    const r = searchPorts({ protocol: "udp" });
    expect(r.every((p) => p.protocol === "udp" || p.protocol === "tcp/udp")).toBe(true);
  });
  it("category filter narrows by web", () => {
    const r = searchPorts({ category: "web" });
    expect(r.every((p) => p.category === "web")).toBe(true);
    expect(r.length).toBeGreaterThan(5);
  });
  it("encryptedOnly returns only encrypted ports", () => {
    const r = searchPorts({ encryptedOnly: true });
    expect(r.every((p) => p.encrypted)).toBe(true);
  });
  it("commonlyExploitedOnly returns risky ports", () => {
    const r = searchPorts({ commonlyExploitedOnly: true });
    expect(r.every((p) => p.commonlyExploited)).toBe(true);
    expect(r.some((p) => p.port === 23)).toBe(true); // telnet
    expect(r.some((p) => p.port === 445)).toBe(true); // smb
  });
  it("rangeStart/rangeEnd filter ports in range", () => {
    const r = searchPorts({ rangeStart: 8000, rangeEnd: 9000 });
    expect(r.every((p) => p.port >= 8000 && p.port <= 9000)).toBe(true);
    expect(r.length).toBeGreaterThan(3);
  });
  it("combined filters narrow correctly", () => {
    const r = searchPorts({ category: "database", encryptedOnly: true });
    expect(r.every((p) => p.category === "database" && p.encrypted)).toBe(true);
  });
  it("query with no matches returns []", () => {
    expect(searchPorts({ query: "zzznonexistent" })).toEqual([]);
  });
});

// ---------------------------------------------------------------------------
describe("ports groupByRange / groupByCategory / sortPorts", () => {
  it("groupByRange partitions all ports", () => {
    const g = groupByRange(PORTS as PortEntry[]);
    const total = g["well-known"].length + g.registered.length + g.dynamic.length;
    expect(total).toBe(PORTS.length);
    expect(g["well-known"].every((p) => p.port <= 1023)).toBe(true);
    expect(g.registered.every((p) => p.port >= 1024 && p.port <= 49151)).toBe(true);
    expect(g.dynamic.every((p) => p.port >= 49152)).toBe(true);
  });
  it("groupByCategory groups by category", () => {
    const g = groupByCategory(PORTS as PortEntry[]);
    expect(g.length).toBeGreaterThan(0);
    for (const group of g) {
      expect(group.ports.every((p) => p.category === group.category)).toBe(true);
    }
  });
  it("sortPorts sorts by port ascending then protocol", () => {
    const sorted = sortPorts([{ port: 443, protocol: "tcp/udp" } as PortEntry, { port: 443, protocol: "tcp" } as PortEntry, { port: 80, protocol: "tcp" } as PortEntry]);
    expect(sorted[0].port).toBe(80);
    expect(sorted[1].port).toBe(443);
    expect(sorted[1].protocol).toBe("tcp");
    expect(sorted[2].protocol).toBe("tcp/udp");
  });
});

// ---------------------------------------------------------------------------
describe("ports computeStats", () => {
  it("stats.total equals PORTS.length", () => {
    expect(computeStats().total).toBe(PORTS.length);
  });
  it("stats.byProtocol sums to total", () => {
    const s = computeStats();
    expect(s.byProtocol.tcp + s.byProtocol.udp + s.byProtocol["tcp/udp"]).toBe(s.total);
  });
  it("stats.byRange sums to total", () => {
    const s = computeStats();
    expect(s.byRange["well-known"] + s.byRange.registered + s.byRange.dynamic).toBe(s.total);
  });
  it("stats.encryptedCount > 0 and <= total", () => {
    const s = computeStats();
    expect(s.encryptedCount).toBeGreaterThan(0);
    expect(s.encryptedCount).toBeLessThanOrEqual(s.total);
  });
  it("stats.commonlyExploitedCount > 0", () => {
    const s = computeStats();
    expect(s.commonlyExploitedCount).toBeGreaterThan(10); // many risky ports flagged
  });
});

// ---------------------------------------------------------------------------
describe("ports explainCategory / explainProtocol / explainEncrypted / securitySummary", () => {
  it("explainCategory returns non-empty text", () => {
    for (const c of CATEGORIES) {
      expect(explainCategory(c).length).toBeGreaterThan(10);
    }
  });
  it("explainProtocol returns non-empty text", () => {
    expect(explainProtocol("tcp").length).toBeGreaterThan(10);
    expect(explainProtocol("udp").length).toBeGreaterThan(10);
    expect(explainProtocol("tcp/udp").length).toBeGreaterThan(10);
  });
  it("explainEncrypted flags unencrypted ports with an alternative", () => {
    const telnet = findByPort(23)[0];
    const e = explainEncrypted(telnet);
    expect(e).toContain("UNENCRYPTED");
    expect(e).toContain("ssh");
  });
  it("explainEncrypted praises encrypted ports", () => {
    const https = findByPort(443)[0];
    const e = explainEncrypted(https);
    expect(e).toContain("encrypted");
  });
  it("securitySummary includes port, service, and range", () => {
    const https = findByPort(443)[0];
    const s = securitySummary(https);
    expect(s).toContain("443");
    expect(s).toContain("https");
    expect(s).toContain("Well-known");
  });
  it("securitySummary includes advisory for exploited ports", () => {
    const smb = findByPort(445)[0];
    const s = securitySummary(smb);
    expect(s).toContain("Commonly targeted");
    expect(s.length).toBeGreaterThan(50);
  });
});

// ---------------------------------------------------------------------------
describe("ports formatAsText / formatAsMarkdown / formatAsCsv", () => {
  const sample = [
    findByPort(80)[0],
    findByPort(443)[0],
  ] as PortEntry[];

  it("formatAsText includes header + entries", () => {
    const t = formatAsText(sample);
    expect(t).toContain("Cheat Sheet");
    expect(t).toContain("80");
    expect(t).toContain("http");
    expect(t).toContain("443");
    expect(t).toContain("https");
  });
  it("formatAsMarkdown produces a markdown table", () => {
    const m = formatAsMarkdown(sample);
    expect(m).toContain("| Port | Proto |");
    expect(m).toContain("| ---: |");
    expect(m).toContain("| 80 |");
    expect(m).toContain("| 443 |");
  });
  it("formatAsCsv produces a CSV with header row", () => {
    const c = formatAsCsv(sample);
    const lines = c.split("\n");
    expect(lines[0]).toContain("port,protocol,service,");
    expect(c).toContain("80,tcp,http");
    expect(c).toContain("443,tcp,https");
  });
  it("formatAsCsv escapes commas in fields", () => {
    const entry: PortEntry = {
      port: 9999, protocol: "tcp", service: "test",
      description: "Has, comma", category: "other", encrypted: false,
      securityNote: "Note, with, commas",
    };
    const c = formatAsCsv([entry]);
    expect(c).toContain('"Has, comma"');
    expect(c).toContain('"Note, with, commas"');
  });
});

// ---------------------------------------------------------------------------
describe("ports history (max 20)", () => {
  it("loadHistory returns empty by default", () => {
    expect(loadHistory()).toEqual([]);
  });
  it("saveHistory persists an entry", () => {
    saveHistory({ ts: 1, query: "https", protocol: "any", category: "any" });
    const h = loadHistory();
    expect(h).toHaveLength(1);
    expect(h[0].query).toBe("https");
  });
  it("caps at 20 entries", () => {
    for (let i = 0; i < 25; i++) {
      saveHistory({ ts: i, query: `q${i}`, protocol: "any", category: "any" });
    }
    const h = loadHistory();
    expect(h).toHaveLength(20);
    expect(h[0].query).toBe("q24"); // newest first
  });
  it("clearHistory empties the store", () => {
    saveHistory({ ts: 1, query: "x", protocol: "any", category: "any" });
    clearHistory();
    expect(loadHistory()).toEqual([]);
  });
});

// ---------------------------------------------------------------------------
describe("ports buildShareUrl / parseShareUrl", () => {
  it("buildShareUrl encodes query + protocol + category", () => {
    const url = buildShareUrl({ query: "https", protocol: "tcp", category: "web" });
    expect(url).toContain("q=https");
    expect(url).toContain("proto=tcp");
    expect(url).toContain("cat=web");
  });
  it("buildShareUrl omits 'any' protocol and category", () => {
    const url = buildShareUrl({ protocol: "any", category: "any" });
    expect(url).not.toContain("proto=");
    expect(url).not.toContain("cat=");
  });
  it("parseShareUrl round-trips", () => {
    const state = parseShareUrl("#q=https&proto=tcp&cat=web");
    expect(state).toEqual({ query: "https", protocol: "tcp", category: "web" });
  });
  it("parseShareUrl handles missing hash", () => {
    expect(parseShareUrl("")).toEqual({});
  });
});
