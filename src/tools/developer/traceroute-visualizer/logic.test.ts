import { describe, it, expect, beforeEach } from "vitest";
import {
  DEFAULT_OPTIONS,
  OS_LABELS,
  generateTracerouteCommand,
  generateTracerouteCommands,
  generateMtrCommand,
  detectFormat,
  parseWindowsTracert,
  parseLinuxTraceroute,
  parseMtr,
  parseAuto,
  computeHopStats,
  analyzePath,
  classifyIp,
  isPrivateIp,
  isIpv6,
  isTimeoutHop,
  validateHost,
  normalizeHost,
  formatRtt,
  renderTable,
  renderGraph,
  renderCsv,
  renderJson,
  loadHistory,
  saveHistory,
  clearHistory,
  buildShareUrl,
  parseShareUrl,
  makeId,
  type OS,
  type TracerouteOptions,
  type Hop,
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

// ---- Sample outputs ----

const WINDOWS_TRACE = `Tracing route to example.com [93.184.216.34] over a maximum of 30 hops:

  1     1 ms     1 ms     1 ms  192.168.1.1
  2     5 ms     4 ms     5 ms  10.0.0.1
  3    12 ms    11 ms    12 ms  isp-gw.example.net [203.0.113.1]
  4     *        *        *     Request timed out.
  5    25 ms    24 ms    26 ms  example.com [93.184.216.34]

Trace complete.`;

const LINUX_TRACE = `traceroute to example.com (93.184.216.34), 30 hops max, 60 byte packets
 1  192.168.1.1 (192.168.1.1)  0.521 ms  0.489 ms  0.503 ms
 2  10.0.0.1 (10.0.0.1)  4.221 ms  4.189 ms  4.203 ms
 3  isp-gw.example.net (203.0.113.1) [AS64500]  11.521 ms  11.489 ms  11.503 ms
 4  * * *
 5  example.com (93.184.216.34)  24.521 ms  24.489 ms  24.503 ms`;

const LINUX_TRACE_NO_RESOLVE = `traceroute to example.com (93.184.216.34), 30 hops max, 60 byte packets
 1  192.168.1.1  0.521 ms  0.489 ms  0.503 ms
 2  10.0.0.1  4.221 ms  4.189 ms  4.203 ms`;

const MTR_TRACE = `Start: 2026-01-01T00:00:00+0000
HOST: my-host                     Loss%   Snt   Last   Avg   Best  Wrst   StDev
  1. router.local                  0.0%    10    0.5   0.6   0.4   0.9   0.1
  2. isp-gw.net (203.0.113.1)      0.0%    10   11.5  11.6  11.4  12.0   0.2
  3. ???                          100.0    10    0.0   0.0   0.0   0.0   0.0
  4. example.com (93.184.216.34)   0.0%    10   24.5  24.6  24.4  25.0   0.2`;

// ---- Constants ----

describe("traceroute-visualizer constants", () => {
  it("has 3 OS labels", () => {
    expect(Object.keys(OS_LABELS)).toHaveLength(3);
    expect(OS_LABELS.windows).toContain("tracert");
    expect(OS_LABELS.linux).toContain("traceroute");
    expect(OS_LABELS.macos).toContain("traceroute");
  });
  it("has default options with sensible values", () => {
    expect(DEFAULT_OPTIONS.maxHops).toBe(30);
    expect(DEFAULT_OPTIONS.timeoutMs).toBe(3000);
    expect(DEFAULT_OPTIONS.queriesPerHop).toBe(3);
    expect(DEFAULT_OPTIONS.resolveHostnames).toBe(true);
  });
});

// ---- Command generator ----

describe("traceroute-visualizer generateTracerouteCommand", () => {
  it("generates a Windows tracert command", () => {
    const cmd = generateTracerouteCommand("example.com", "windows");
    expect(cmd.startsWith("tracert ")).toBe(true);
    expect(cmd).toContain("-h 30");
    expect(cmd).toContain("-w 3000");
    expect(cmd).toContain("example.com");
    // resolveHostnames defaults to true → no -d
    expect(cmd).not.toContain("-d");
  });
  it("adds -d when resolveHostnames is false on Windows", () => {
    const cmd = generateTracerouteCommand("example.com", "windows", { ...DEFAULT_OPTIONS, resolveHostnames: false });
    expect(cmd).toContain("-d");
  });
  it("generates a Linux traceroute command with -m -w -q", () => {
    const cmd = generateTracerouteCommand("example.com", "linux");
    expect(cmd.startsWith("traceroute ")).toBe(true);
    expect(cmd).toContain("-m 30");
    expect(cmd).toContain("-w 3"); // 3000ms → 3s (ceil)
    expect(cmd).toContain("-q 3");
  });
  it("adds -n on Linux when resolveHostnames is false", () => {
    const cmd = generateTracerouteCommand("example.com", "linux", { ...DEFAULT_OPTIONS, resolveHostnames: false });
    expect(cmd).toContain("-n");
  });
  it("adds -4 / -6 flags", () => {
    const cmd4 = generateTracerouteCommand("example.com", "linux", { ...DEFAULT_OPTIONS, ipv4: true });
    const cmd6 = generateTracerouteCommand("example.com", "linux", { ...DEFAULT_OPTIONS, ipv6: true });
    expect(cmd4).toContain("-4");
    expect(cmd6).toContain("-6");
  });
  it("returns empty for empty host", () => {
    expect(generateTracerouteCommand("", "linux")).toBe("");
  });
});

describe("traceroute-visualizer generateTracerouteCommands", () => {
  it("generates commands for all three OSes", () => {
    const cmds = generateTracerouteCommands("example.com");
    expect(Object.keys(cmds).sort()).toEqual(["linux", "macos", "windows"]);
    expect(cmds.windows).toContain("tracert");
    expect(cmds.linux).toContain("traceroute");
    expect(cmds.macos).toContain("traceroute");
  });
});

describe("traceroute-visualizer generateMtrCommand", () => {
  it("generates an mtr report command", () => {
    const cmd = generateMtrCommand("example.com");
    expect(cmd.startsWith("mtr ")).toBe(true);
    expect(cmd).toContain("--report");
    expect(cmd).toContain("--report-cycles 10");
    expect(cmd).toContain("--wide");
    expect(cmd).toContain("example.com");
  });
  it("adds --no-dns when resolveHostnames is false", () => {
    const cmd = generateMtrCommand("example.com", { resolveHostnames: false });
    expect(cmd).toContain("--no-dns");
  });
  it("returns empty for empty host", () => {
    expect(generateMtrCommand("")).toBe("");
  });
});

// ---- Format detection ----

describe("traceroute-visualizer detectFormat", () => {
  it("detects Windows tracert format", () => {
    expect(detectFormat(WINDOWS_TRACE)).toBe("windows");
  });
  it("detects Linux traceroute format", () => {
    expect(detectFormat(LINUX_TRACE)).toBe("linux");
  });
  it("detects mtr format", () => {
    expect(detectFormat(MTR_TRACE)).toBe("mtr");
  });
  it("returns unknown for empty input", () => {
    expect(detectFormat("")).toBe("unknown");
  });
  it("returns unknown for non-trace text", () => {
    expect(detectFormat("hello world\nthis is not a trace")).toBe("unknown");
  });
});

// ---- Parsers ----

describe("traceroute-visualizer parseWindowsTracert", () => {
  it("parses 5 hops including a timeout", () => {
    const r = parseWindowsTracert(WINDOWS_TRACE);
    expect(r.format).toBe("windows");
    expect(r.hops).toHaveLength(5);
    expect(r.hops[0].hop).toBe(1);
    expect(r.hops[0].ip).toBe("192.168.1.1");
    expect(r.hops[0].rtts).toHaveLength(3);
    expect(r.hops[0].timeout).toBe(false);
  });
  it("extracts IP from [ip] suffix", () => {
    const r = parseWindowsTracert(WINDOWS_TRACE);
    expect(r.hops[2].ip).toBe("203.0.113.1");
    expect(r.hops[2].hostname).toBe("isp-gw.example.net");
  });
  it("marks timeout hop", () => {
    const r = parseWindowsTracert(WINDOWS_TRACE);
    expect(r.hops[3].timeout).toBe(true);
    expect(r.hops[3].rtts.every((v) => v === null)).toBe(true);
  });
  it("parses <1 ms as 0", () => {
    const text = `Tracing route to host over a maximum of 30 hops:

  1    <1 ms    <1 ms    <1 ms  192.168.1.1
`;
    const r = parseWindowsTracert(text);
    expect(r.hops[0].rtts).toEqual([0, 0, 0]);
  });
  it("extracts target host from header", () => {
    const r = parseWindowsTracert(WINDOWS_TRACE);
    expect(r.host).toBe("example.com");
  });
});

describe("traceroute-visualizer parseLinuxTraceroute", () => {
  it("parses 5 hops including a timeout", () => {
    const r = parseLinuxTraceroute(LINUX_TRACE);
    expect(r.format).toBe("linux");
    expect(r.hops).toHaveLength(5);
    expect(r.hops[0].hop).toBe(1);
    expect(r.hops[0].ip).toBe("192.168.1.1");
    expect(r.hops[0].rtts).toHaveLength(3);
    expect(r.hops[0].rtts[0]).toBeCloseTo(0.521, 3);
  });
  it("parses AS info from [AS#####] annotation", () => {
    const r = parseLinuxTraceroute(LINUX_TRACE);
    expect(r.hops[2].asInfo).toBe("AS64500");
    expect(r.hops[2].ip).toBe("203.0.113.1");
    expect(r.hops[2].hostname).toBe("isp-gw.example.net");
  });
  it("marks * * * timeout hop", () => {
    const r = parseLinuxTraceroute(LINUX_TRACE);
    expect(r.hops[3].timeout).toBe(true);
    expect(r.hops[3].rtts).toEqual([null, null, null]);
  });
  it("parses -n form (IP only, no parens)", () => {
    const r = parseLinuxTraceroute(LINUX_TRACE_NO_RESOLVE);
    expect(r.hops[0].ip).toBe("192.168.1.1");
    expect(r.hops[0].rtts[0]).toBeCloseTo(0.521, 3);
  });
  it("extracts target host from header", () => {
    const r = parseLinuxTraceroute(LINUX_TRACE);
    expect(r.host).toBe("example.com");
  });
});

describe("traceroute-visualizer parseMtr", () => {
  it("parses 4 hops including a 100% loss timeout", () => {
    const r = parseMtr(MTR_TRACE);
    expect(r.format).toBe("mtr");
    expect(r.hops).toHaveLength(4);
    expect(r.hops[0].hop).toBe(1);
    expect(r.hops[0].hostname).toBe("router.local");
    expect(r.hops[0].rtts[0]).toBeCloseTo(0.6, 1);
  });
  it("extracts IP from (ip) suffix", () => {
    const r = parseMtr(MTR_TRACE);
    expect(r.hops[1].ip).toBe("203.0.113.1");
    expect(r.hops[1].hostname).toBe("isp-gw.net");
  });
  it("marks 100% loss hop as timeout", () => {
    const r = parseMtr(MTR_TRACE);
    expect(r.hops[2].timeout).toBe(true);
  });
});

describe("traceroute-visualizer parseAuto", () => {
  it("auto-detects and parses Windows format", () => {
    const r = parseAuto(WINDOWS_TRACE);
    expect(r.format).toBe("windows");
    expect(r.hops.length).toBeGreaterThan(0);
  });
  it("auto-detects and parses Linux format", () => {
    const r = parseAuto(LINUX_TRACE);
    expect(r.format).toBe("linux");
    expect(r.hops.length).toBeGreaterThan(0);
  });
  it("auto-detects and parses mtr format", () => {
    const r = parseAuto(MTR_TRACE);
    expect(r.format).toBe("mtr");
    expect(r.hops.length).toBeGreaterThan(0);
  });
  it("returns unknown format for non-trace text", () => {
    const r = parseAuto("not a trace");
    expect(r.format).toBe("unknown");
    expect(r.hops).toEqual([]);
  });
});

// ---- Hop stats ----

describe("traceroute-visualizer computeHopStats", () => {
  it("computes stats for a successful hop", () => {
    const hop: Hop = { hop: 1, ip: "1.2.3.4", hostname: "test", rtts: [10, 20, 30], timeout: false };
    const s = computeHopStats(hop);
    expect(s.sent).toBe(3);
    expect(s.recv).toBe(3);
    expect(s.lossPct).toBe(0);
    expect(s.minMs).toBe(10);
    expect(s.maxMs).toBe(30);
    expect(s.avgMs).toBeCloseTo(20, 5);
    expect(s.stddevMs).toBeCloseTo(Math.sqrt(200 / 3), 4);
    expect(s.timeout).toBe(false);
  });
  it("handles partial-loss hop", () => {
    const hop: Hop = { hop: 2, ip: "1.2.3.4", hostname: "", rtts: [10, null, 30], timeout: false };
    const s = computeHopStats(hop);
    expect(s.sent).toBe(3);
    expect(s.recv).toBe(2);
    expect(s.lossPct).toBeCloseTo(33.33, 1);
    expect(s.avgMs).toBe(20);
  });
  it("handles all-timeout hop", () => {
    const hop: Hop = { hop: 3, ip: "", hostname: "", rtts: [null, null, null], timeout: true };
    const s = computeHopStats(hop);
    expect(s.recv).toBe(0);
    expect(s.lossPct).toBe(100);
    expect(s.avgMs).toBeNull();
    expect(s.timeout).toBe(true);
  });
  it("flags private IPs", () => {
    const hop: Hop = { hop: 1, ip: "192.168.1.1", hostname: "", rtts: [1, 1, 1], timeout: false };
    expect(computeHopStats(hop).isPrivate).toBe(true);
  });
  it("flags IPv6 IPs", () => {
    const hop: Hop = { hop: 5, ip: "2606:4700::1", hostname: "", rtts: [5, 5, 5], timeout: false };
    expect(computeHopStats(hop).isIpv6).toBe(true);
    expect(computeHopStats(hop).isPrivate).toBe(false);
  });
});

// ---- Path analysis ----

describe("traceroute-visualizer analyzePath", () => {
  it("analyzes a basic path", () => {
    const hops: Hop[] = [
      { hop: 1, ip: "192.168.1.1", hostname: "r1", rtts: [1, 1, 1], timeout: false },
      { hop: 2, ip: "10.0.0.1", hostname: "r2", rtts: [5, 5, 5], timeout: false },
      { hop: 3, ip: "8.8.8.8", hostname: "dns", rtts: [20, 20, 20], timeout: false },
    ];
    const a = analyzePath(hops);
    expect(a.hopCount).toBe(3);
    expect(a.slowestHop).toBe(3);
    expect(a.slowestRtt).toBe(20);
    expect(a.biggestJumpHop).toBe(3); // jumps: 5-1=4 (hop 2), 20-5=15 (hop 3) → biggest at hop 3.
    expect(a.biggestJumpMs).toBe(15);
    expect(a.timeouts).toBe(0);
    expect(a.timeoutPct).toBe(0);
    expect(a.endToEndMs).toBe(20);
  });
  it("handles timeouts in the path", () => {
    const hops: Hop[] = [
      { hop: 1, ip: "1.1.1.1", hostname: "", rtts: [1, 1, 1], timeout: false },
      { hop: 2, ip: "", hostname: "", rtts: [null, null, null], timeout: true },
      { hop: 3, ip: "8.8.8.8", hostname: "", rtts: [10, 10, 10], timeout: false },
    ];
    const a = analyzePath(hops);
    expect(a.timeouts).toBe(1);
    expect(a.timeoutPct).toBeCloseTo(33.33, 1);
    expect(a.endToEndMs).toBe(10);
  });
  it("returns nulls for empty path", () => {
    const a = analyzePath([]);
    expect(a.hopCount).toBe(0);
    expect(a.slowestHop).toBeNull();
    expect(a.endToEndMs).toBeNull();
  });
  it("handles all-timeout path", () => {
    const hops: Hop[] = [
      { hop: 1, ip: "", hostname: "", rtts: [null, null, null], timeout: true },
      { hop: 2, ip: "", hostname: "", rtts: [null, null, null], timeout: true },
    ];
    const a = analyzePath(hops);
    expect(a.timeouts).toBe(2);
    expect(a.timeoutPct).toBe(100);
    expect(a.slowestHop).toBeNull();
    expect(a.endToEndMs).toBeNull();
  });
});

// ---- IP classification ----

describe("traceroute-visualizer classifyIp", () => {
  it("classifies 10.x as private", () => {
    expect(classifyIp("10.0.0.1")).toBe("private");
  });
  it("classifies 172.16-31.x as private", () => {
    expect(classifyIp("172.16.0.1")).toBe("private");
    expect(classifyIp("172.31.255.255")).toBe("private");
    expect(classifyIp("172.32.0.1")).toBe("public");
  });
  it("classifies 192.168.x as private", () => {
    expect(classifyIp("192.168.1.1")).toBe("private");
  });
  it("classifies 127.x as loopback", () => {
    expect(classifyIp("127.0.0.1")).toBe("loopback");
  });
  it("classifies 169.254.x as link-local", () => {
    expect(classifyIp("169.254.1.1")).toBe("link-local");
  });
  it("classifies 224-239.x as multicast", () => {
    expect(classifyIp("224.0.0.1")).toBe("multicast");
  });
  it("classifies public IPv4 as public", () => {
    expect(classifyIp("8.8.8.8")).toBe("public");
    expect(classifyIp("93.184.216.34")).toBe("public");
  });
  it("classifies IPv6 ::1 as loopback", () => {
    expect(classifyIp("::1")).toBe("ipv6-loopback");
  });
  it("classifies IPv6 fe80:: as link-local", () => {
    expect(classifyIp("fe80::1")).toBe("ipv6-link-local");
  });
  it("classifies IPv6 fc00::/7 as ULA (private)", () => {
    expect(classifyIp("fd00::1")).toBe("ipv6-ula");
  });
  it("classifies public IPv6 as ipv6-public", () => {
    expect(classifyIp("2606:4700::1111")).toBe("ipv6-public");
  });
  it("classifies empty as empty", () => {
    expect(classifyIp("")).toBe("empty");
  });
  it("classifies invalid as invalid", () => {
    expect(classifyIp("999.999.999.999")).toBe("invalid");
    expect(classifyIp("not-an-ip")).toBe("invalid");
  });
});

describe("traceroute-visualizer isPrivateIp", () => {
  it("returns true for RFC1918 / loopback / link-local / ULA", () => {
    expect(isPrivateIp("10.1.1.1")).toBe(true);
    expect(isPrivateIp("172.16.5.5")).toBe(true);
    expect(isPrivateIp("192.168.0.1")).toBe(true);
    expect(isPrivateIp("127.0.0.1")).toBe(true);
    expect(isPrivateIp("169.254.0.1")).toBe(true);
    expect(isPrivateIp("fd00::1")).toBe(true);
  });
  it("returns false for public IPs", () => {
    expect(isPrivateIp("8.8.8.8")).toBe(false);
    expect(isPrivateIp("2606:4700::1111")).toBe(false);
  });
  it("returns false for empty", () => {
    expect(isPrivateIp("")).toBe(false);
  });
});

describe("traceroute-visualizer isIpv6", () => {
  it("detects IPv6 addresses", () => {
    expect(isIpv6("2606:4700::1111")).toBe(true);
    expect(isIpv6("fe80::1")).toBe(true);
    expect(isIpv6("::1")).toBe(true);
  });
  it("returns false for IPv4", () => {
    expect(isIpv6("8.8.8.8")).toBe(false);
  });
  it("returns false for empty / invalid", () => {
    expect(isIpv6("")).toBe(false);
    expect(isIpv6("not-an-ip")).toBe(false);
  });
});

describe("traceroute-visualizer isTimeoutHop", () => {
  it("returns true for all-null rtts", () => {
    const hop: Hop = { hop: 1, ip: "", hostname: "", rtts: [null, null], timeout: true };
    expect(isTimeoutHop(hop)).toBe(true);
  });
  it("returns false for successful hop", () => {
    const hop: Hop = { hop: 1, ip: "1.1.1.1", hostname: "", rtts: [5, 5, 5], timeout: false };
    expect(isTimeoutHop(hop)).toBe(false);
  });
});

// ---- Host validation ----

describe("traceroute-visualizer validateHost + normalizeHost", () => {
  it("validates a hostname", () => {
    expect(validateHost("example.com").ok).toBe(true);
    expect(validateHost("sub.example.com").ok).toBe(true);
  });
  it("validates an IPv4", () => {
    expect(validateHost("8.8.8.8").ok).toBe(true);
  });
  it("validates an IPv6", () => {
    expect(validateHost("2606:4700::1111").ok).toBe(true);
  });
  it("rejects empty", () => {
    expect(validateHost("").ok).toBe(false);
  });
  it("rejects spaces", () => {
    expect(validateHost("example com").ok).toBe(false);
  });
  it("rejects invalid IPv4 octet", () => {
    expect(validateHost("999.1.1.1").ok).toBe(false);
  });
  it("normalizes host to lowercase + trim", () => {
    expect(normalizeHost("  Example.COM  ")).toBe("example.com");
  });
});

// ---- Rendering ----

describe("traceroute-visualizer formatRtt", () => {
  it("formats null as *", () => {
    expect(formatRtt(null)).toBe("*");
  });
  it("formats sub-1ms with 3 decimals", () => {
    expect(formatRtt(0.521)).toBe("0.521ms");
  });
  it("formats 100+ ms as integer", () => {
    expect(formatRtt(123.7)).toBe("124ms");
  });
});

describe("traceroute-visualizer renderTable", () => {
  it("renders a header + rows", () => {
    const hops: Hop[] = [
      { hop: 1, ip: "1.1.1.1", hostname: "r1", rtts: [1, 1, 1], timeout: false },
      { hop: 2, ip: "", hostname: "", rtts: [null, null, null], timeout: true },
    ];
    const txt = renderTable(hops);
    expect(txt).toContain("HOP");
    expect(txt).toContain("1.1.1.1");
    expect(txt).toContain("r1");
    expect(txt.split("\n").length).toBe(2 + 2); // header + sep + 2 rows
  });
  it("returns empty for empty input", () => {
    expect(renderTable([])).toBe("");
  });
});

describe("traceroute-visualizer renderGraph", () => {
  it("renders a graph with bars", () => {
    const hops: Hop[] = [
      { hop: 1, ip: "1.1.1.1", hostname: "", rtts: [1, 1, 1], timeout: false },
      { hop: 2, ip: "8.8.8.8", hostname: "", rtts: [10, 10, 10], timeout: false },
    ];
    const txt = renderGraph(hops);
    expect(txt).toContain("█");
    expect(txt).toContain("Hop");
  });
  it("flags private hops in the graph", () => {
    const hops: Hop[] = [
      { hop: 1, ip: "192.168.1.1", hostname: "", rtts: [1, 1, 1], timeout: false },
    ];
    expect(renderGraph(hops)).toContain("[private]");
  });
  it("returns empty for empty input", () => {
    expect(renderGraph([])).toBe("");
  });
});

describe("traceroute-visualizer renderCsv", () => {
  it("renders a CSV header + rows", () => {
    const hops: Hop[] = [
      { hop: 1, ip: "1.1.1.1", hostname: "r1", rtts: [1, 1, 1], timeout: false },
    ];
    const csv = renderCsv(hops);
    const lines = csv.split("\n");
    expect(lines[0]).toContain("hop,ip,hostname,timeout");
    expect(lines).toHaveLength(2);
    expect(lines[1].startsWith("1,1.1.1.1,")).toBe(true);
  });
  it("escapes commas in hostname", () => {
    const hops: Hop[] = [
      { hop: 1, ip: "1.1.1.1", hostname: "host, with comma", rtts: [1], timeout: false },
    ];
    const csv = renderCsv(hops);
    expect(csv).toContain('"host, with comma"');
  });
});

describe("traceroute-visualizer renderJson", () => {
  it("renders valid JSON", () => {
    const hops: Hop[] = [
      { hop: 1, ip: "1.1.1.1", hostname: "r1", rtts: [1, 2, 3], timeout: false },
    ];
    const json = renderJson(hops);
    const parsed = JSON.parse(json) as Array<{ hop: number; ip: string; stats: { avgMs: number } }>;
    expect(parsed).toHaveLength(1);
    expect(parsed[0].hop).toBe(1);
    expect(parsed[0].ip).toBe("1.1.1.1");
    expect(parsed[0].stats.avgMs).toBe(2);
  });
  it("renders empty array for empty input", () => {
    expect(renderJson([])).toBe("[]");
  });
});

// ---- History (localStorage) ----

describe("traceroute-visualizer history (localStorage)", () => {
  it("loads empty initially", () => {
    expect(loadHistory()).toEqual([]);
  });
  it("saves and loads", () => {
    saveHistory({ ts: 1, host: "example.com", format: "linux", hopCount: 5, slowestRtt: 24.5, endToEndMs: 24.5 });
    expect(loadHistory()).toHaveLength(1);
  });
  it("caps at 20", () => {
    for (let i = 0; i < 25; i++) {
      saveHistory({ ts: i, host: `h${i}.com`, format: "linux", hopCount: 5, slowestRtt: i, endToEndMs: i });
    }
    expect(loadHistory()).toHaveLength(20);
  });
  it("clears", () => {
    saveHistory({ ts: 1, host: "x", format: "linux", hopCount: 1, slowestRtt: 1, endToEndMs: 1 });
    clearHistory();
    expect(loadHistory()).toEqual([]);
  });
});

// ---- Shareable URL ----

describe("traceroute-visualizer shareable URL", () => {
  it("builds share URL when window unavailable", () => {
    const origWindow = (globalThis as Record<string, unknown>).window;
    (globalThis as Record<string, unknown>).window = undefined;
    const url = buildShareUrl({ host: "example.com", output: LINUX_TRACE });
    expect(url).toContain("host=example.com");
    expect(url).toContain("output=");
    (globalThis as Record<string, unknown>).window = origWindow;
  });
  it("parses share URL back", () => {
    const params = new URLSearchParams();
    params.set("host", "example.com");
    params.set("output", LINUX_TRACE);
    const p = parseShareUrl(params.toString());
    expect(p.host).toBe("example.com");
    expect(p.output).toContain("traceroute to example.com");
  });
  it("handles empty hash", () => {
    expect(parseShareUrl("")).toEqual({ host: "", output: "" });
  });
  it("round-trips share URL", () => {
    const cfg = { host: "example.com", output: "1  1.1.1.1  1ms  1ms  1ms" };
    const url = buildShareUrl(cfg);
    const parsed = parseShareUrl(url.split("#")[1] ?? url);
    expect(parsed.host).toBe(cfg.host);
    expect(parsed.output).toBe(cfg.output);
  });
});

describe("traceroute-visualizer makeId", () => {
  it("produces unique ids", () => {
    const a = makeId();
    const b = makeId();
    expect(a).not.toBe(b);
    expect(a.startsWith("tr-")).toBe(true);
  });
});

// Suppress unused-import lint
export type _Unused = OS | TracerouteOptions | Hop;
