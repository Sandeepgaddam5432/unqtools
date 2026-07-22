import { describe, it, expect, beforeEach } from "vitest";
import {
  TLD_WHOIS_SERVERS,
  RIR_PRESETS,
  EPP_STATUS_CODES,
  getWhoisServer,
  getRir,
  getEppStatus,
  explainStatus,
  normalizeDomain,
  toPunycode,
  detectTargetType,
  extractTld,
  detectRir,
  buildRdapUrl,
  generateWhoisCommands,
  generateAvailabilityCheck,
  parseWhoisResponse,
  computeExpiryCountdown,
  parseBulk,
  loadHistory,
  saveHistory,
  clearHistory,
  buildShareUrl,
  parseShareUrl,
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

describe("whois constants", () => {
  it("has 40+ TLD whois server entries", () => {
    expect(TLD_WHOIS_SERVERS.length).toBeGreaterThanOrEqual(40);
  });
  it("includes common TLDs (com, net, org, io, dev, app, ai)", () => {
    const tlds = TLD_WHOIS_SERVERS.map((e) => e.tld);
    for (const t of ["com", "net", "org", "io", "dev", "app", "ai"]) {
      expect(tlds).toContain(t);
    }
  });
  it("has 5 RIR presets", () => {
    expect(RIR_PRESETS).toHaveLength(5);
  });
  it("every RIR has server, rdapUrl, region", () => {
    for (const r of RIR_PRESETS) {
      expect(r.whoisServer.length).toBeGreaterThan(0);
      expect(r.rdapUrl.length).toBeGreaterThan(0);
      expect(r.region.length).toBeGreaterThan(0);
    }
  });
  it("has 20+ EPP status codes", () => {
    expect(EPP_STATUS_CODES.length).toBeGreaterThanOrEqual(20);
  });
  it("includes common EPP codes", () => {
    const codes = EPP_STATUS_CODES.map((e) => e.code);
    for (const c of ["clientTransferProhibited", "serverDeleteProhibited", "pendingDelete", "redemptionPeriod", "ok"]) {
      expect(codes).toContain(c);
    }
  });
});

describe("whois getWhoisServer / getRir / getEppStatus", () => {
  it("looks up com whois server", () => {
    const e = getWhoisServer("com");
    expect(e?.server).toBe("whois.verisign-grs.com");
  });
  it("is case-insensitive on TLD", () => {
    expect(getWhoisServer("COM")?.server).toBe("whois.verisign-grs.com");
  });
  it("strips leading dot from TLD", () => {
    expect(getWhoisServer(".io")?.server).toBe("whois.nic.io");
  });
  it("returns undefined for unknown TLD", () => {
    expect(getWhoisServer("nonexistenttld")).toBeUndefined();
  });
  it("getRir returns ARIN preset", () => {
    expect(getRir("ARIN")?.whoisServer).toBe("whois.arin.net");
  });
  it("getEppStatus is case-insensitive", () => {
    expect(getEppStatus("CLIENTTRANSFERPROHIBITED")?.short).toContain("transfer");
  });
  it("explainStatus returns explanation for known code", () => {
    const e = explainStatus("clientTransferProhibited");
    expect(e).toContain("transfer");
    expect(e).toContain("registrar");
  });
  it("explainStatus returns message for unknown code", () => {
    const e = explainStatus("totallyFakeCode");
    expect(e).toContain("Unknown");
  });
});

describe("whois normalizeDomain", () => {
  it("strips protocol and path", () => {
    expect(normalizeDomain("https://www.example.com/path")).toBe("www.example.com");
  });
  it("strips port", () => {
    expect(normalizeDomain("example.com:8080")).toBe("example.com");
  });
  it("lowercases", () => {
    expect(normalizeDomain("EXAMPLE.COM")).toBe("example.com");
  });
  it("strips trailing dot", () => {
    expect(normalizeDomain("example.com.")).toBe("example.com");
  });
  it("returns empty for empty input", () => {
    expect(normalizeDomain("")).toBe("");
  });
});

describe("whois toPunycode", () => {
  it("passes through ASCII domains", () => {
    expect(toPunycode("example.com")).toBe("example.com");
  });
  it("converts IDN to punycode", () => {
    // Bücher.de → xn--bcher-kva.de
    const p = toPunycode("Bücher.de");
    expect(p.startsWith("xn--")).toBe(true);
  });
  it("returns empty for empty input", () => {
    expect(toPunycode("")).toBe("");
  });
});

describe("whois detectTargetType", () => {
  it("detects IPv4", () => {
    expect(detectTargetType("8.8.8.8")).toBe("ipv4");
  });
  it("detects IPv6", () => {
    expect(detectTargetType("2606:4700:4700::1111")).toBe("ipv6");
  });
  it("detects domain", () => {
    expect(detectTargetType("example.com")).toBe("domain");
  });
  it("rejects invalid", () => {
    expect(detectTargetType("")).toBe("invalid");
    expect(detectTargetType("not a real thing")).toBe("invalid");
  });
  it("rejects out-of-range IPv4 octets", () => {
    expect(detectTargetType("999.999.999.999")).toBe("invalid");
  });
});

describe("whois extractTld", () => {
  it("extracts TLD from simple domain", () => {
    expect(extractTld("example.com")).toBe("com");
  });
  it("extracts TLD from subdomain", () => {
    expect(extractTld("www.example.co.uk")).toBe("uk");
  });
  it("returns empty for no TLD", () => {
    expect(extractTld("localhost")).toBe("");
  });
});

describe("whois detectRir", () => {
  it("detects ARIN for 8.8.8.8", () => {
    expect(detectRir("8.8.8.8")).toBe("ARIN");
  });
  it("detects RIPE for 1.1.1.1... wait, that's APNIC", () => {
    // 1.x is APNIC
    expect(detectRir("1.1.1.1")).toBe("APNIC");
  });
  it("detects AFRINIC for 41.x", () => {
    expect(detectRir("41.0.0.1")).toBe("AFRINIC");
  });
  it("detects LACNIC for 177.x", () => {
    expect(detectRir("177.0.0.1")).toBe("LACNIC");
  });
  it("detects RIPE for 212.x", () => {
    expect(detectRir("212.0.0.1")).toBe("RIPE");
  });
  it("returns UNKNOWN for invalid", () => {
    expect(detectRir("not-an-ip")).toBe("UNKNOWN");
  });
});

describe("whois buildRdapUrl", () => {
  it("builds domain RDAP URL", () => {
    expect(buildRdapUrl("example.com")).toBe("https://rdap.org/domain/example.com");
  });
  it("builds IPv4 RDAP URL", () => {
    expect(buildRdapUrl("8.8.8.8")).toBe("https://rdap.org/ip/8.8.8.8");
  });
  it("returns empty for invalid", () => {
    expect(buildRdapUrl("invalid thing")).toBe("");
  });
});

describe("whois generateWhoisCommands", () => {
  it("generates commands for a domain", () => {
    const cmds = generateWhoisCommands("example.com");
    expect(cmds.length).toBeGreaterThanOrEqual(4);
    expect(cmds.some((c) => c.tool === "whois" && c.command.includes("example.com"))).toBe(true);
    expect(cmds.some((c) => c.tool === "rdap-url")).toBe(true);
    expect(cmds.some((c) => c.tool === "curl" && c.command.includes("rdap+json"))).toBe(true);
  });
  it("includes explicit -h server for known TLD", () => {
    const cmds = generateWhoisCommands("example.com");
    expect(cmds.some((c) => c.command.includes("-h whois.verisign-grs.com"))).toBe(true);
  });
  it("applies -H flag when hideLegal is set", () => {
    const cmds = generateWhoisCommands("example.com", { hideLegal: true });
    expect(cmds.some((c) => c.command.includes("-H"))).toBe(true);
  });
  it("generates commands for an IPv4 address", () => {
    const cmds = generateWhoisCommands("8.8.8.8");
    expect(cmds.length).toBeGreaterThanOrEqual(3);
    expect(cmds.some((c) => c.command.includes("8.8.8.8"))).toBe(true);
    expect(cmds.some((c) => c.command.includes("rdap.org/ip/"))).toBe(true);
  });
  it("generates commands for an IPv6 address", () => {
    const cmds = generateWhoisCommands("2606:4700:4700::1111");
    expect(cmds.length).toBeGreaterThanOrEqual(3);
  });
  it("returns empty for invalid target", () => {
    expect(generateWhoisCommands("invalid thing")).toEqual([]);
  });
});

describe("whois generateAvailabilityCheck", () => {
  it("generates commands for a valid domain", () => {
    const r = generateAvailabilityCheck("example.com");
    expect(r.domain).toBe("example.com");
    expect(r.commands.length).toBeGreaterThanOrEqual(4);
    expect(r.commands.some((c) => c.command.includes("grep -iE"))).toBe(true);
    expect(r.commands.some((c) => c.command.includes("rdap+json"))).toBe(true);
    expect(r.commands.some((c) => c.command.includes("dig"))).toBe(true);
  });
  it("normalizes the domain (strips protocol)", () => {
    const r = generateAvailabilityCheck("https://example.com/path");
    expect(r.domain).toBe("example.com");
  });
  it("returns empty commands for invalid input", () => {
    const r = generateAvailabilityCheck("not a domain");
    expect(r.commands).toEqual([]);
    expect(r.notes.length).toBeGreaterThan(0);
  });
  it("includes helpful notes", () => {
    const r = generateAvailabilityCheck("example.com");
    expect(r.notes.length).toBeGreaterThan(0);
    expect(r.notes.some((n) => n.toLowerCase().includes("rdap"))).toBe(true);
  });
});

describe("whois parseWhoisResponse", () => {
  const SAMPLE_DOMAIN_WHOIS = `
Domain Name: EXAMPLE.COM
Registry Domain ID: 2336799_DOMAIN_COM-VRSN
Registrar WHOIS Server: whois.iana.org
Registrar URL: http://res-dom.iana.org
Updated Date: 2024-08-14T07:01:34Z
Creation Date: 1995-08-14T04:00:00Z
Registry Expiry Date: 2025-08-13T04:00:00Z
Registrar: RESERVED-Internet Assigned Numbers Authority
Registrar IANA ID: 376
Registrar Abuse Contact Email: abuse@example.com
Registrar Abuse Contact Phone: +1.5555555555
Domain Status: clientTransferProhibited
Domain Status: serverDeleteProhibited
Name Server: A.IANA-SERVERS.NET
Name Server: B.IANA-SERVERS.NET
DNSSEC: signedDelegation
URL of the ICANN WHOIS Data Problem Reporting System: http://wdprs.internic.net/
`.trim();

  it("parses registrar", () => {
    const p = parseWhoisResponse(SAMPLE_DOMAIN_WHOIS, "domain");
    expect(p.registrar).toContain("RESERVED");
  });
  it("parses created/updated/expiry dates", () => {
    const p = parseWhoisResponse(SAMPLE_DOMAIN_WHOIS, "domain");
    expect(p.createdDate).toContain("1995-08-14");
    expect(p.updatedDate).toContain("2024-08-14");
    expect(p.expiryDate).toContain("2025-08-13");
  });
  it("parses nameservers", () => {
    const p = parseWhoisResponse(SAMPLE_DOMAIN_WHOIS, "domain");
    expect(p.nameServers).toHaveLength(2);
    expect(p.nameServers).toContain("a.iana-servers.net");
    expect(p.nameServers).toContain("b.iana-servers.net");
  });
  it("parses status codes", () => {
    const p = parseWhoisResponse(SAMPLE_DOMAIN_WHOIS, "domain");
    expect(p.statuses).toContain("clientTransferProhibited");
    expect(p.statuses).toContain("serverDeleteProhibited");
  });
  it("parses DNSSEC flag", () => {
    const p = parseWhoisResponse(SAMPLE_DOMAIN_WHOIS, "domain");
    expect(p.dnssec).toBe("signedDelegation");
  });
  it("records raw fields", () => {
    const p = parseWhoisResponse(SAMPLE_DOMAIN_WHOIS, "domain");
    expect(p.rawFields.length).toBeGreaterThanOrEqual(8);
  });
  it("detects no-match responses", () => {
    const p = parseWhoisResponse("No match for \"NOTAREGISTERED.COM\".", "domain");
    expect(p.notes.some((n) => n.includes("no match"))).toBe(true);
  });
  it("detects GDPR redaction", () => {
    const p = parseWhoisResponse("Registrant Email: REDACTED FOR PRIVACY\nDomain Status: ok", "domain");
    expect(p.notes.some((n) => n.toLowerCase().includes("redact") || n.toLowerCase().includes("gdpr"))).toBe(true);
  });
  it("notes empty response", () => {
    const p = parseWhoisResponse("", "domain");
    expect(p.notes.some((n) => n.toLowerCase().includes("empty"))).toBe(true);
  });
  it("parses IP WHOIS (ARIN-style)", () => {
    const ipWhois = `
OrgName: Google LLC
OrgId: GOGL
NetRange: 8.8.8.0 - 8.8.8.255
CIDR: 8.8.8.0/24
OriginAS: AS15169
RegDate: 2014-03-14
Updated: 2014-03-14
AbuseHandle: ABUSE5250-ARIN
AbuseContact: network-abuse@google.com
NetType: Reallocated
`.trim();
    const p = parseWhoisResponse(ipWhois, "ipv4");
    expect(p.organization).toBe("Google LLC");
    expect(p.cidrRange).toBe("8.8.8.0/24");
    expect(p.originAs).toBe("AS15169");
    expect(p.abuseContact).toBe("network-abuse@google.com");
  });
  it("parses IP WHOIS (RIPE-style inetnum)", () => {
    const ripeWhois = `
inetnum: 192.0.2.0 - 192.0.2.255
netname: EXAMPLE-NET
descr: Example Org
abuse-mailbox: abuse@example.net
`.trim();
    const p = parseWhoisResponse(ripeWhois, "ipv4");
    expect(p.cidrRange).toBe("192.0.2.0 - 192.0.2.255");
    expect(p.abuseContact).toBe("abuse@example.net");
  });
});

describe("whois computeExpiryCountdown", () => {
  it("returns null for empty input", () => {
    expect(computeExpiryCountdown("")).toBeNull();
  });
  it("returns days until expiry", () => {
    const now = new Date("2025-01-01T00:00:00Z");
    const result = computeExpiryCountdown("2025-02-01T00:00:00Z", now);
    expect(result).toBe(31);
  });
  it("returns negative for past dates", () => {
    const now = new Date("2025-02-01T00:00:00Z");
    const result = computeExpiryCountdown("2025-01-01T00:00:00Z", now);
    expect(result).toBeLessThan(0);
  });
  it("parses dd-mmm-yyyy format", () => {
    const now = new Date("2025-01-01T00:00:00Z");
    const result = computeExpiryCountdown("10-jan-2025", now);
    expect(result).toBe(9);
  });
});

describe("whois parseBulk", () => {
  it("parses newline-separated", () => {
    expect(parseBulk("example.com\ngoogle.com\ncloudflare.com")).toEqual([
      "example.com", "google.com", "cloudflare.com",
    ]);
  });
  it("parses comma-separated", () => {
    expect(parseBulk("example.com, google.com, cloudflare.com")).toEqual([
      "example.com", "google.com", "cloudflare.com",
    ]);
  });
  it("skips blank lines", () => {
    expect(parseBulk("a.com\n\nb.com")).toEqual(["a.com", "b.com"]);
  });
  it("returns empty for empty input", () => {
    expect(parseBulk("")).toEqual([]);
  });
});

describe("whois history (localStorage)", () => {
  it("loads empty initially", () => {
    expect(loadHistory()).toEqual([]);
  });
  it("saves and loads", () => {
    saveHistory({ ts: 1, target: "example.com", type: "domain", action: "generate" });
    expect(loadHistory()).toHaveLength(1);
    expect(loadHistory()[0].target).toBe("example.com");
  });
  it("caps at 20", () => {
    for (let i = 0; i < 25; i++) {
      saveHistory({ ts: i, target: `d${i}.com`, type: "domain", action: "generate" });
    }
    expect(loadHistory()).toHaveLength(20);
  });
  it("clears", () => {
    saveHistory({ ts: 1, target: "x.com", type: "domain", action: "generate" });
    clearHistory();
    expect(loadHistory()).toEqual([]);
  });
  it("does not store WHOIS text or contact data (privacy)", () => {
    const entry: HistoryEntry = { ts: 1, target: "example.com", type: "domain", action: "parse" };
    saveHistory(entry);
    const loaded = loadHistory();
    expect(loaded[0]).toEqual(entry);
    // Confirm no contact/text fields exist on the entry
    const keys = Object.keys(loaded[0]);
    expect(keys).toEqual(["ts", "target", "type", "action"]);
  });
});

describe("whois shareable URL", () => {
  it("builds share URL when window unavailable", () => {
    const origWindow = (globalThis as Record<string, unknown>).window;
    (globalThis as Record<string, unknown>).window = undefined;
    const url = buildShareUrl({ target: "example.com", tab: "commands" });
    expect(url).toContain("t=example.com");
    expect(url).toContain("tab=commands");
    (globalThis as Record<string, unknown>).window = origWindow;
  });
  it("parses share URL back", () => {
    const p = parseShareUrl("t=example.com&tab=parse");
    expect(p.target).toBe("example.com");
    expect(p.tab).toBe("parse");
  });
  it("handles empty hash", () => {
    expect(parseShareUrl("")).toEqual({ target: "" });
  });
  it("ignores unknown tab values", () => {
    const p = parseShareUrl("t=example.com&tab=unknown");
    expect(p.tab).toBeUndefined();
  });
});
