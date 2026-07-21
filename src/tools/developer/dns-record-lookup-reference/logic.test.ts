import { describe, it, expect, beforeEach } from "vitest";
import {
  RESOLVERS,
  RECORD_TYPES,
  getResolver,
  getRecordType,
  normalizeDomain,
  buildQueryName,
  generateCommands,
  digFlagArgs,
  ipv4ToPtrName,
  ipv6ToPtrName,
  parseTxtRecord,
  parseSoaRecord,
  parseMxRecord,
  parseSrvRecord,
  parseCaaRecord,
  parseDsRecord,
  parseRecord,
  loadHistory,
  saveHistory,
  clearHistory,
  buildShareUrl,
  parseShareUrl,
  type RecordType,
  type ResolverId,
  type CommandOptions,
  type DigFlag,
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

describe("dns-reference constants", () => {
  it("has 6 resolver presets", () => {
    expect(RESOLVERS).toHaveLength(6);
  });
  it("has 15+ record types", () => {
    expect(RECORD_TYPES.length).toBeGreaterThanOrEqual(15);
  });
  it("includes core types A, AAAA, MX, TXT, NS, SOA, CNAME, PTR, SRV, CAA", () => {
    const types = RECORD_TYPES.map((r) => r.type);
    for (const t of ["A", "AAAA", "MX", "TXT", "NS", "SOA", "CNAME", "PTR", "SRV", "CAA"]) {
      expect(types).toContain(t);
    }
  });
  it("includes DNSSEC types DS, DNSKEY, RRSIG", () => {
    const types = RECORD_TYPES.map((r) => r.type);
    for (const t of ["DS", "DNSKEY", "RRSIG"]) {
      expect(types).toContain(t);
    }
  });
  it("includes DKIM and DMARC pseudo-types", () => {
    const types = RECORD_TYPES.map((r) => r.type);
    expect(types).toContain("DKIM");
    expect(types).toContain("DMARC");
  });
  it("every record type has a non-empty format, example, and ≥1 use case", () => {
    for (const r of RECORD_TYPES) {
      expect(r.format.length).toBeGreaterThan(0);
      expect(r.example.length).toBeGreaterThan(0);
      expect(r.useCases.length).toBeGreaterThan(0);
    }
  });
  it("every resolver has a label and notes", () => {
    for (const r of RESOLVERS) {
      expect(r.label.length).toBeGreaterThan(0);
      expect(r.notes.length).toBeGreaterThan(0);
    }
  });
  it("getResolver returns the matching preset", () => {
    expect(getResolver("google").server).toBe("8.8.8.8");
    expect(getResolver("cloudflare").server).toBe("1.1.1.1");
  });
  it("getResolver falls back to first for unknown id", () => {
    expect(getResolver("unknown" as ResolverId).id).toBe(RESOLVERS[0].id);
  });
  it("getRecordType returns the matching reference", () => {
    const a = getRecordType("A");
    expect(a).not.toBeNull();
    expect(a!.type).toBe("A");
  });
  it("getRecordType returns null for unknown", () => {
    expect(getRecordType("NOSUCH" as RecordType)).toBeNull();
  });
});

describe("dns-reference normalizeDomain", () => {
  it("strips protocol, path, port, trailing dot", () => {
    expect(normalizeDomain("https://www.example.com:443/path?x=1")).toBe("www.example.com");
    expect(normalizeDomain("Example.COM.")).toBe("example.com");
  });
  it("handles empty", () => {
    expect(normalizeDomain("")).toBe("");
  });
});

describe("dns-reference buildQueryName", () => {
  it("returns plain domain for A/MX/TXT", () => {
    expect(buildQueryName("example.com", "A", "default")).toBe("example.com");
  });
  it("builds DKIM selector._domainkey subdomain", () => {
    expect(buildQueryName("example.com", "DKIM", "google")).toBe("google._domainkey.example.com");
  });
  it("defaults DKIM selector to 'default'", () => {
    expect(buildQueryName("example.com", "DKIM", "")).toBe("default._domainkey.example.com");
  });
  it("builds DMARC _dmarc subdomain", () => {
    expect(buildQueryName("example.com", "DMARC", "")).toBe("_dmarc.example.com");
  });
  it("returns empty for empty domain", () => {
    expect(buildQueryName("", "A", "")).toBe("");
  });
});

describe("dns-reference digFlagArgs", () => {
  it("returns +short for short", () => {
    expect(digFlagArgs("short")).toEqual(["+short"]);
  });
  it("returns +noall +answer for answer", () => {
    expect(digFlagArgs("answer")).toEqual(["+noall", "+answer"]);
  });
  it("returns +trace for trace", () => {
    expect(digFlagArgs("trace")).toEqual(["+trace"]);
  });
  it("returns +dnssec for dnssec", () => {
    expect(digFlagArgs("dnssec")).toEqual(["+dnssec"]);
  });
  it("returns +cdflag for cdflag", () => {
    expect(digFlagArgs("cdflag")).toEqual(["+cdflag"]);
  });
});

describe("dns-reference generateCommands", () => {
  const baseOpts: CommandOptions = {
    tool: "dig",
    domain: "example.com",
    type: "A",
    resolver: "google",
    customServer: "",
    dkimSelector: "default",
    flags: [],
  };
  it("generates a dig command via Google resolver", () => {
    const cmds = generateCommands(baseOpts);
    const dig = cmds.find((c) => c.tool === "dig");
    expect(dig).toBeDefined();
    expect(dig!.command).toContain("@8.8.8.8");
    expect(dig!.command).toContain("example.com");
    expect(dig!.command).toContain(" A");
  });
  it("includes nslookup and host commands", () => {
    const cmds = generateCommands(baseOpts);
    expect(cmds.some((c) => c.tool === "nslookup")).toBe(true);
    expect(cmds.some((c) => c.tool === "host")).toBe(true);
  });
  it("includes kdig (DoH) when resolver supports it", () => {
    const cmds = generateCommands(baseOpts);
    const kdig = cmds.find((c) => c.tool === "kdig");
    expect(kdig).toBeDefined();
    expect(kdig!.command).toContain("+https=");
  });
  it("respects custom resolver IP", () => {
    const cmds = generateCommands({ ...baseOpts, resolver: "custom", customServer: "9.9.9.9" });
    const dig = cmds.find((c) => c.tool === "dig");
    expect(dig!.command).toContain("@9.9.9.9");
  });
  it("uses no @server for authoritative resolver", () => {
    const cmds = generateCommands({ ...baseOpts, resolver: "authoritative" });
    const dig = cmds.find((c) => c.tool === "dig");
    expect(dig!.command).not.toContain("@");
  });
  it("appends dig flags (+short, +dnssec)", () => {
    const cmds = generateCommands({ ...baseOpts, flags: ["short", "dnssec"] });
    const dig = cmds.find((c) => c.tool === "dig");
    expect(dig!.command).toContain("+short");
    expect(dig!.command).toContain("+dnssec");
  });
  it("uses TXT for DKIM and prepends selector._domainkey", () => {
    const cmds = generateCommands({ ...baseOpts, type: "DKIM", dkimSelector: "google" });
    const dig = cmds.find((c) => c.tool === "dig");
    expect(dig!.command).toContain("google._domainkey.example.com");
    expect(dig!.command).toContain(" TXT");
  });
  it("uses TXT for DMARC and prepends _dmarc", () => {
    const cmds = generateCommands({ ...baseOpts, type: "DMARC" });
    const dig = cmds.find((c) => c.tool === "dig");
    expect(dig!.command).toContain("_dmarc.example.com");
    expect(dig!.command).toContain(" TXT");
  });
  it("includes delv when type is DS", () => {
    const cmds = generateCommands({ ...baseOpts, type: "DS" });
    expect(cmds.some((c) => c.tool === "delv")).toBe(true);
  });
  it("includes delv when +dnssec flag set", () => {
    const cmds = generateCommands({ ...baseOpts, flags: ["dnssec"] });
    expect(cmds.some((c) => c.tool === "delv")).toBe(true);
  });
  it("returns empty for empty domain", () => {
    expect(generateCommands({ ...baseOpts, domain: "" })).toEqual([]);
  });
});

describe("dns-reference PTR name builder", () => {
  it("builds IPv4 in-addr.arpa name", () => {
    expect(ipv4ToPtrName("93.184.216.34")).toBe("34.216.184.93.in-addr.arpa");
  });
  it("rejects invalid IPv4", () => {
    expect(ipv4ToPtrName("999.1.1.1")).toBeNull();
    expect(ipv4ToPtrName("1.2.3")).toBeNull();
  });
  it("builds IPv6 ip6.arpa name", () => {
    expect(ipv6ToPtrName("2001:db8::1")).toBe(
      "1.0.0.0.0.0.0.0.0.0.0.0.0.0.0.0.0.0.0.0.0.0.0.0.8.b.d.0.1.0.0.2.ip6.arpa",
    );
  });
  it("rejects invalid IPv6", () => {
    expect(ipv6ToPtrName("not-an-ip")).toBeNull();
    expect(ipv6ToPtrName("2001:db8::1::2")).toBeNull();
  });
});

describe("dns-reference parseTxtRecord", () => {
  it("reassembles multi-string TXT", () => {
    const r = parseTxtRecord('"v=spf1 " "include:_spf.google.com -all"');
    expect(r.reassembled).toBe("v=spf1 include:_spf.google.com -all");
    expect(r.parts).toHaveLength(2);
  });
  it("handles single quoted string", () => {
    const r = parseTxtRecord('"v=spf1 -all"');
    expect(r.reassembled).toBe("v=spf1 -all");
  });
  it("falls back to raw for unquoted tokens", () => {
    const r = parseTxtRecord("raw-token");
    expect(r.reassembled).toBe("raw-token");
  });
});

describe("dns-reference parseSoaRecord", () => {
  it("parses 7 SOA fields", () => {
    const r = parseSoaRecord("ns.icann.org. noc.dns.icann.org. 2025010101 7200 3600 1209600 3600");
    expect(r.fields).toHaveLength(7);
    expect(r.fields[0]).toEqual({ name: "mname", value: "ns.icann.org." });
    expect(r.fields[2]).toEqual({ name: "serial", value: "2025010101" });
  });
  it("notes YYYYMMDDNN serial convention", () => {
    const r = parseSoaRecord("ns. hostmaster. 2025010101 7200 3600 1209600 3600");
    expect(r.notes.some((n) => n.includes("YYYYMMDDNN"))).toBe(true);
  });
  it("notes refresh in hours", () => {
    const r = parseSoaRecord("ns. hostmaster. 1 7200 3600 1209600 3600");
    expect(r.notes.some((n) => n.includes("7200s") && n.includes("h"))).toBe(true);
  });
});

describe("dns-reference parseMxRecord", () => {
  it("parses priority + exchanger", () => {
    const r = parseMxRecord("10 mail.example.com.");
    expect(r.fields).toEqual([
      { name: "priority", value: "10" },
      { name: "exchanger", value: "mail.example.com." },
    ]);
    expect(r.notes.some((n) => n.includes("Priority 10"))).toBe(true);
  });
  it("flags insufficient tokens", () => {
    const r = parseMxRecord("10");
    expect(r.notes[0]).toBe("insufficient tokens");
  });
});

describe("dns-reference parseSrvRecord", () => {
  it("parses priority/weight/port/target", () => {
    const r = parseSrvRecord("10 60 5060 sipserver.example.com.");
    expect(r.fields).toHaveLength(4);
    expect(r.fields[3]).toEqual({ name: "target", value: "sipserver.example.com." });
  });
});

describe("dns-reference parseCaaRecord", () => {
  it("parses flags/tag/value", () => {
    const r = parseCaaRecord('0 issue "letsencrypt.org"');
    expect(r.fields[0]).toEqual({ name: "flags", value: "0" });
    expect(r.fields[1]).toEqual({ name: "tag", value: "issue" });
    expect(r.fields[2]).toEqual({ name: "value", value: "letsencrypt.org" });
  });
  it("flags the critical flag (128)", () => {
    const r = parseCaaRecord('128 issue "letsencrypt.org"');
    expect(r.notes.some((n) => n.includes("Issuer-critical"))).toBe(true);
  });
  it("flags block-all \";\" value", () => {
    const r = parseCaaRecord('0 issue ";"');
    expect(r.notes.some((n) => n.includes("blocks ALL"))).toBe(true);
  });
});

describe("dns-reference parseDsRecord", () => {
  it("parses keytag/algorithm/digesttype/digest", () => {
    const r = parseDsRecord("31560 13 2 E2D3C916F6DEEAC73294E8268FB5885044A833FC5459588F4A9184CFC41A5766");
    expect(r.fields).toHaveLength(4);
    expect(r.fields[0]).toEqual({ name: "keytag", value: "31560" });
  });
  it("notes algorithm name (13 = ECDSAP256SHA256)", () => {
    const r = parseDsRecord("31560 13 2 E2D3C916F6DEEAC73294E8268FB5885044A833FC5459588F4A9184CFC41A5766");
    expect(r.notes.some((n) => n.includes("ECDSAP256SHA256"))).toBe(true);
  });
});

describe("dns-reference parseRecord dispatch", () => {
  it("dispatches SOA", () => {
    const r = parseRecord("SOA", "ns. host. 1 7200 3600 1209600 3600");
    expect(r.type).toBe("SOA");
  });
  it("dispatches MX", () => {
    const r = parseRecord("MX", "10 mail.");
    expect(r.type).toBe("MX");
  });
  it("dispatches TXT with reassembly", () => {
    const r = parseRecord("TXT", '"v=spf1 -all"');
    expect(r.notes.some((n) => n.includes("Reassembled"))).toBe(true);
  });
  it("dispatches DKIM via TXT path", () => {
    const r = parseRecord("DKIM", '"v=DKIM1; k=rsa; p=xxx"');
    expect(r.type).toBe("TXT");
  });
  it("falls back to raw for unknown type", () => {
    const r = parseRecord("AAAA", "2606:2800:220:1:248:1893:25c8:1946");
    expect(r.fields).toEqual([{ name: "rdata", value: "2606:2800:220:1:248:1893:25c8:1946" }]);
  });
});

describe("dns-reference history (localStorage)", () => {
  it("loads empty initially", () => {
    expect(loadHistory()).toEqual([]);
  });
  it("saves and loads", () => {
    saveHistory({ ts: 1, action: "generate", resolver: "google", count: 1 });
    expect(loadHistory()).toHaveLength(1);
  });
  it("caps at 20", () => {
    for (let i = 0; i < 25; i++) {
      saveHistory({ ts: i, action: "generate", resolver: "google", count: 1 });
    }
    expect(loadHistory()).toHaveLength(20);
  });
  it("clears", () => {
    saveHistory({ ts: 1, action: "generate", resolver: "google", count: 1 });
    clearHistory();
    expect(loadHistory()).toEqual([]);
  });
});

describe("dns-reference shareable URL", () => {
  it("builds share URL when window unavailable", () => {
    const origWindow = (globalThis as Record<string, unknown>).window;
    (globalThis as Record<string, unknown>).window = undefined;
    const url = buildShareUrl({ domain: "example.com", type: "A", resolver: "google" });
    expect(url).toContain("domain=example.com");
    expect(url).toContain("type=A");
    expect(url).toContain("resolver=google");
    (globalThis as Record<string, unknown>).window = origWindow;
  });
  it("parses share URL back", () => {
    const p = parseShareUrl("domain=example.com&type=A&resolver=google");
    expect(p.domain).toBe("example.com");
    expect(p.type).toBe("A");
    expect(p.resolver).toBe("google");
  });
  it("returns empty object for empty hash", () => {
    expect(parseShareUrl("")).toEqual({});
  });
  it("handles leading # in hash", () => {
    const p = parseShareUrl("#domain=example.com");
    expect(p.domain).toBe("example.com");
  });
});

// Suppress unused-import lint for type-only imports used in casts.
export type _Unused =
  | RecordType | ResolverId | CommandOptions | DigFlag | HistoryEntry;
