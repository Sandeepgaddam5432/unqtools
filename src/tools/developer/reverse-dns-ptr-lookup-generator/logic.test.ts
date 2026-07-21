import { describe, it, expect, beforeEach } from "vitest";
import {
  CIDR_MAX_ADDRESSES,
  HISTORY_MAX,
  RESOLVERS,
  getResolver,
  isValidIpv4,
  isValidIpv6,
  expandIpv6,
  classifyIpv4,
  classifyIpv6,
  buildIpv4ReverseZone,
  buildIpv6ReverseZone,
  buildReverseZone,
  enumerateCidr,
  generateCommand,
  generateAllCommands,
  generateCidrCommands,
  buildFcrdnsChain,
  buildHostnameChain,
  parsePtrRecord,
  generateBashScript,
  loadHistory,
  saveHistory,
  clearHistory,
  buildShareUrl,
  parseShareUrl,
  type CommandTool,
  type ResolverId,
  type DigFlag,
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

describe("reverse-dns-ptr constants", () => {
  it("has 5 resolver presets", () => {
    expect(RESOLVERS).toHaveLength(5);
  });
  it("has google, cloudflare, quad9, opendns, custom resolver ids", () => {
    const ids = RESOLVERS.map((r) => r.id);
    expect(ids).toEqual(["google", "cloudflare", "quad9", "opendns", "custom"]);
  });
  it("enforces a 256-address CIDR cap", () => {
    expect(CIDR_MAX_ADDRESSES).toBe(256);
  });
  it("enforces a 20-entry history cap", () => {
    expect(HISTORY_MAX).toBe(20);
  });
  it("returns google as default resolver", () => {
    expect(getResolver("google").server).toBe("8.8.8.8");
  });
  it("returns google for unknown resolver id", () => {
    expect(getResolver("nonexistent" as ResolverId).id).toBe("google");
  });
});

describe("reverse-dns-ptr IP validation", () => {
  it("accepts valid IPv4 addresses", () => {
    expect(isValidIpv4("192.0.2.1")).toBe(true);
    expect(isValidIpv4("8.8.8.8")).toBe(true);
    expect(isValidIpv4("255.255.255.255")).toBe(true);
    expect(isValidIpv4("0.0.0.0")).toBe(true);
  });
  it("rejects invalid IPv4 addresses", () => {
    expect(isValidIpv4("256.0.0.1")).toBe(false);
    expect(isValidIpv4("1.2.3")).toBe(false);
    expect(isValidIpv4("abc.def.ghi.jkl")).toBe(false);
    expect(isValidIpv4("")).toBe(false);
  });
  it("accepts valid IPv6 addresses", () => {
    expect(isValidIpv6("::1")).toBe(true);
    expect(isValidIpv6("2001:db8::1")).toBe(true);
    expect(isValidIpv6("2001:0db8:0000:0000:0000:0000:0000:0001")).toBe(true);
    expect(isValidIpv6("fe80::1")).toBe(true);
  });
  it("rejects invalid IPv6 addresses", () => {
    expect(isValidIpv6("::g")).toBe(false);
    expect(isValidIpv6("1:2:3:4:5:6:7:8:9")).toBe(false);
    expect(isValidIpv6("2001::db8::1")).toBe(false);
    expect(isValidIpv6("")).toBe(false);
  });
});

describe("reverse-dns-ptr expandIpv6", () => {
  it("expands ::1", () => {
    expect(expandIpv6("::1")).toBe("0000:0000:0000:0000:0000:0000:0000:0001");
  });
  it("expands 2001:db8::1", () => {
    expect(expandIpv6("2001:db8::1")).toBe("2001:0db8:0000:0000:0000:0000:0000:0001");
  });
  it("expands full addresses unchanged (with padding)", () => {
    expect(expandIpv6("2001:0db8:0000:0000:0000:0000:0000:0001")).toBe("2001:0db8:0000:0000:0000:0000:0000:0001");
  });
  it("returns null for garbage", () => {
    expect(expandIpv6("nope")).toBeNull();
  });
  it("returns null for address with too many groups", () => {
    expect(expandIpv6("1:2:3:4:5:6:7:8:9")).toBeNull();
  });
});

describe("reverse-dns-ptr IP classification", () => {
  it("flags 10.x as private RFC 1918", () => {
    expect(classifyIpv4("10.0.0.1").isPrivate).toBe(true);
    expect(classifyIpv4("10.0.0.1").label).toContain("Private");
  });
  it("flags 127.x as loopback", () => {
    expect(classifyIpv4("127.0.0.1").isPrivate).toBe(true);
    expect(classifyIpv4("127.0.0.1").label).toBe("Loopback");
  });
  it("flags 169.254 as link-local", () => {
    expect(classifyIpv4("169.254.1.1").label).toBe("Link-local");
  });
  it("flags 192.0.2.x as documentation (TEST-NET-1)", () => {
    expect(classifyIpv4("192.0.2.1").label).toContain("Documentation");
  });
  it("does not flag 8.8.8.8 as private", () => {
    expect(classifyIpv4("8.8.8.8").isPrivate).toBe(false);
    expect(classifyIpv4("8.8.8.8").label).toBe("Public");
  });
  it("flags ::1 as loopback", () => {
    expect(classifyIpv6("::1").label).toBe("Loopback");
  });
  it("flags fe80:: as link-local", () => {
    expect(classifyIpv6("fe80::1").label).toBe("Link-local");
  });
  it("flags 2001:db8:: as documentation", () => {
    expect(classifyIpv6("2001:db8::1").label).toContain("Documentation");
  });
  it("does not flag 2606:2800:220:1:248:1893:25c8:1946 as private", () => {
    expect(classifyIpv6("2606:2800:220:1:248:1893:25c8:1946").isPrivate).toBe(false);
  });
});

describe("reverse-dns-ptr reverse-zone construction", () => {
  it("builds in-addr.arpa for IPv4", () => {
    expect(buildIpv4ReverseZone("192.0.2.1")).toBe("1.2.0.192.in-addr.arpa");
  });
  it("builds ip6.arpa for IPv6 with full nibble reversal", () => {
    expect(buildIpv6ReverseZone("2001:db8::1"))
      .toBe("1.0.0.0.0.0.0.0.0.0.0.0.0.0.0.0.0.0.0.0.0.0.0.0.8.b.d.0.1.0.0.2.ip6.arpa");
  });
  it("builds zone for ::1", () => {
    expect(buildIpv6ReverseZone("::1"))
      .toBe("1.0.0.0.0.0.0.0.0.0.0.0.0.0.0.0.0.0.0.0.0.0.0.0.0.0.0.0.0.0.0.0.ip6.arpa");
  });
  it("buildReverseZone returns IPv4 result", () => {
    const r = buildReverseZone("192.0.2.1");
    expect(r.ok).toBe(true);
    if (r.ok) {
      expect(r.version).toBe("IPv4");
      expect(r.zone).toBe("1.2.0.192.in-addr.arpa");
    }
  });
  it("buildReverseZone returns IPv6 result", () => {
    const r = buildReverseZone("2001:db8::1");
    expect(r.ok).toBe(true);
    if (r.ok) {
      expect(r.version).toBe("IPv6");
      expect(r.zone).toContain("ip6.arpa");
    }
  });
  it("buildReverseZone errors on invalid input", () => {
    const r = buildReverseZone("not-an-ip");
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.error).toContain("Not a valid");
  });
  it("buildReverseZone errors on empty input", () => {
    const r = buildReverseZone("");
    expect(r.ok).toBe(false);
  });
  it("flags private IPv4 in buildReverseZone result", () => {
    const r = buildReverseZone("10.0.0.1");
    expect(r.ok).toBe(true);
    if (r.ok) expect(r.isPrivate).toBe(true);
  });
});

describe("reverse-dns-ptr CIDR enumeration", () => {
  it("enumerates a /30 IPv4 CIDR (4 addresses)", () => {
    const r = enumerateCidr("192.0.2.0/30");
    expect(r.ok).toBe(true);
    if (r.ok) {
      expect(r.count).toBe(4);
      expect(r.ips).toEqual(["192.0.2.0", "192.0.2.1", "192.0.2.2", "192.0.2.3"]);
    }
  });
  it("rejects a /16 IPv4 CIDR (too many addresses)", () => {
    const r = enumerateCidr("10.0.0.0/16");
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.error).toContain("cap is");
  });
  it("rejects invalid prefix length", () => {
    const r = enumerateCidr("192.0.2.0/33");
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.error).toContain("> 32");
  });
  it("rejects CIDR without slash", () => {
    const r = enumerateCidr("192.0.2.1");
    expect(r.ok).toBe(false);
  });
  it("enumerates a /126 IPv6 CIDR (4 addresses)", () => {
    const r = enumerateCidr("2001:db8::/126");
    expect(r.ok).toBe(true);
    if (r.ok) {
      expect(r.count).toBe(4);
      expect(r.ips).toHaveLength(4);
    }
  });
  it("network-masks the base IP (192.0.2.5/30 → 192.0.2.4)", () => {
    const r = enumerateCidr("192.0.2.5/30");
    expect(r.ok).toBe(true);
    if (r.ok) expect(r.ips[0]).toBe("192.0.2.4");
  });
});

describe("reverse-dns-ptr command generation", () => {
  it("generates a dig -x command for IPv4", () => {
    const cmd = generateCommand({ tool: "dig", ip: "192.0.2.1", resolver: "google" });
    expect(cmd).not.toBeNull();
    expect(cmd!.command).toBe("dig @8.8.8.8 -x 192.0.2.1");
    expect(cmd!.explanation).toContain("in-addr.arpa");
  });
  it("generates an nslookup command with explicit zone name", () => {
    const cmd = generateCommand({ tool: "nslookup", ip: "192.0.2.1", resolver: "cloudflare" });
    expect(cmd!.command).toBe("nslookup -type=PTR 1.2.0.192.in-addr.arpa 1.1.1.1");
  });
  it("generates a host command", () => {
    const cmd = generateCommand({ tool: "host", ip: "192.0.2.1", resolver: "quad9" });
    expect(cmd!.command).toBe("host -t PTR 1.2.0.192.in-addr.arpa 9.9.9.9");
  });
  it("generates a kdig DoH command for cloudflare", () => {
    const cmd = generateCommand({ tool: "kdig", ip: "192.0.2.1", resolver: "cloudflare" });
    expect(cmd!.command).toContain("+https=https://cloudflare-dns.com/dns-query");
    expect(cmd!.command).toContain("-x 192.0.2.1");
  });
  it("respects +short flag", () => {
    const cmd = generateCommand({ tool: "dig", ip: "192.0.2.1", resolver: "google", flags: ["short"] });
    expect(cmd!.command).toBe("dig @8.8.8.8 -x 192.0.2.1 +short");
  });
  it("supports custom resolver", () => {
    const cmd = generateCommand({ tool: "dig", ip: "192.0.2.1", resolver: "custom", customServer: "1.2.3.4" });
    expect(cmd!.command).toBe("dig @1.2.3.4 -x 192.0.2.1");
  });
  it("generates all 4 commands for an IP", () => {
    const cmds = generateAllCommands("192.0.2.1", "google");
    expect(cmds).toHaveLength(4);
    expect(cmds.map((c) => c.tool)).toEqual(["dig", "nslookup", "kdig", "host"]);
  });
  it("returns null for invalid IP", () => {
    expect(generateCommand({ tool: "dig", ip: "nope", resolver: "google" })).toBeNull();
  });
  it("generates per-IP commands for a CIDR", () => {
    const r = generateCidrCommands("192.0.2.0/30", "dig", "google");
    expect(r.ok).toBe(true);
    if (r.ok) expect(r.count).toBe(4);
  });
});

describe("reverse-dns-ptr FCrDNS chain", () => {
  it("builds a 3-step chain for IPv4", () => {
    const r = buildFcrdnsChain("192.0.2.1", "google");
    expect(r.ok).toBe(true);
    if (r.ok) {
      expect(r.steps).toHaveLength(3);
      expect(r.steps[0].command).toContain("dig @8.8.8.8 -x 192.0.2.1");
      expect(r.steps[1].command).toContain("A HOSTNAME");
      expect(r.explanation).toContain("deliverability");
    }
  });
  it("uses AAAA for IPv6 in the forward step", () => {
    const r = buildFcrdnsChain("2001:db8::1", "cloudflare");
    expect(r.ok).toBe(true);
    if (r.ok) {
      expect(r.steps[1].command).toContain("AAAA");
      expect(r.steps[1].command).toContain("@1.1.1.1");
    }
  });
  it("errors on invalid IP", () => {
    const r = buildFcrdnsChain("not-an-ip", "google");
    expect(r.ok).toBe(false);
  });
});

describe("reverse-dns-ptr hostname chain", () => {
  it("builds a 3-command chain for hostname → IP → PTR", () => {
    const cmds = buildHostnameChain("example.com", "google");
    expect(cmds).toHaveLength(3);
    expect(cmds[0].command).toContain("A example.com");
    expect(cmds[1].command).toContain("AAAA example.com");
    expect(cmds[2].command).toContain("-x <IP-FROM-STEP-1>");
  });
  it("returns empty for empty hostname", () => {
    expect(buildHostnameChain("", "google")).toEqual([]);
  });
});

describe("reverse-dns-ptr PTR record parser", () => {
  it("parses a full zone record (name TTL IN PTR target)", () => {
    const p = parsePtrRecord("1.2.0.192.in-addr.arpa. 3600 IN PTR host.example.com.");
    expect(p.ok).toBe(true);
    expect(p.name).toBe("1.2.0.192.in-addr.arpa.");
    expect(p.ttl).toBe("3600");
    expect(p.class).toBe("IN");
    expect(p.type).toBe("PTR");
    expect(p.target).toBe("host.example.com.");
  });
  it("parses a record without TTL", () => {
    const p = parsePtrRecord("1.2.0.192.in-addr.arpa. IN PTR host.example.com.");
    expect(p.ok).toBe(true);
    expect(p.ttl).toBe("");
    expect(p.target).toBe("host.example.com.");
  });
  it("parses a record with @ origin", () => {
    const p = parsePtrRecord("@ IN PTR host.example.com.");
    expect(p.name).toBe("@");
    expect(p.target).toBe("host.example.com.");
  });
  it("notes a relative target (no trailing dot)", () => {
    const p = parsePtrRecord("1.2.0.192.in-addr.arpa. 3600 IN PTR host");
    expect(p.notes.length).toBeGreaterThan(0);
    expect(p.notes[0]).toContain("relative");
  });
  it("notes a very low TTL", () => {
    const p = parsePtrRecord("1.2.0.192.in-addr.arpa. 30 IN PTR host.example.com.");
    expect(p.notes.some((n) => n.includes("unusually short"))).toBe(true);
  });
  it("fails on missing PTR token", () => {
    const p = parsePtrRecord("just some random text");
    expect(p.ok).toBe(false);
  });
  it("fails on empty input", () => {
    const p = parsePtrRecord("");
    expect(p.ok).toBe(false);
  });
  it("notes unusual class", () => {
    const p = parsePtrRecord("name 3600 CH PTR target.");
    expect(p.notes.some((n) => n.includes("Unexpected class"))).toBe(true);
  });
});

describe("reverse-dns-ptr bash script generator", () => {
  it("generates a script with one block per IP", () => {
    const script = generateBashScript(["192.0.2.1", "192.0.2.2"], "dig", "google");
    expect(script).toContain("#!/usr/bin/env bash");
    expect(script).toContain("dig @8.8.8.8 -x 192.0.2.1");
    expect(script).toContain("dig @8.8.8.8 -x 192.0.2.2");
    expect(script).toContain("--- 192.0.2.1 ---");
    expect(script).toContain("--- 192.0.2.2 ---");
  });
  it("handles an empty list", () => {
    const script = generateBashScript([], "dig", "google");
    expect(script).toContain("=== Done ===");
    expect(script).toContain("Addresses: 0");
  });
  it("uses host tool when requested", () => {
    const script = generateBashScript(["8.8.4.4"], "host", "cloudflare");
    expect(script).toContain("host -t PTR 4.4.8.8.in-addr.arpa 1.1.1.1");
  });
});

describe("reverse-dns-ptr history (localStorage)", () => {
  it("loads empty initially", () => {
    expect(loadHistory()).toEqual([]);
  });
  it("saves and loads", () => {
    saveHistory({ ts: 1, action: "reverse", resolver: "google", count: 4 });
    expect(loadHistory()).toHaveLength(1);
  });
  it("caps at HISTORY_MAX (20)", () => {
    for (let i = 0; i < 25; i++) {
      saveHistory({ ts: i, action: "reverse", resolver: "google", count: 1 });
    }
    expect(loadHistory()).toHaveLength(20);
  });
  it("clears", () => {
    saveHistory({ ts: 1, action: "reverse", resolver: "google", count: 1 });
    clearHistory();
    expect(loadHistory()).toEqual([]);
  });
});

describe("reverse-dns-ptr shareable URL", () => {
  it("builds share URL when window unavailable", () => {
    const origWindow = (globalThis as Record<string, unknown>).window;
    (globalThis as Record<string, unknown>).window = undefined;
    const url = buildShareUrl({ ip: "192.0.2.1", tool: "dig", resolver: "google", flags: ["short"] });
    expect(url).toContain("ip=192.0.2.1");
    expect(url).toContain("tool=dig");
    expect(url).toContain("resolver=google");
    expect(url).toContain("flags=short");
    (globalThis as Record<string, unknown>).window = origWindow;
  });
  it("parses share URL back", () => {
    const p = parseShareUrl("ip=192.0.2.1&tool=dig&resolver=google&flags=short,answer");
    expect(p.ip).toBe("192.0.2.1");
    expect(p.tool).toBe("dig");
    expect(p.resolver).toBe("google");
    expect(p.flags).toEqual(["short", "answer"]);
  });
  it("handles empty hash", () => {
    expect(parseShareUrl("")).toEqual({});
  });
  it("filters unknown tools and resolvers", () => {
    const p = parseShareUrl("ip=192.0.2.1&tool=bogus&resolver=unknown");
    expect(p.tool).toBeUndefined();
    expect(p.resolver).toBeUndefined();
  });
});

// Suppress unused-import lint
export type _Unused = CommandTool | ResolverId | DigFlag;
