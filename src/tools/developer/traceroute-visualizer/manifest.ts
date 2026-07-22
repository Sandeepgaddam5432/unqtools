/**
 * Traceroute Visualizer — Tool Manifest.
 * Tool #397 — Category 4 (Developer & Code).
 *
 * Pure-JS traceroute / MTR command generator + output parser. Generates
 * ready-to-paste `tracert` (Windows) / `traceroute` (Linux/macOS) / `mtr`
 * commands with hop-limit, timeout, probe-count and no-resolve flags.
 * Parses pasted traceroute / tracert / mtr output from any major OS into a
 * structured hop list (hop number, IP, hostname, RTT × N), then visualizes
 * the path as a table, an ASCII latency graph, and CSV/JSON exports.
 * Highlights the slowest hop, the biggest inter-hop latency jump, timeouts
 * (`*`), private RFC1918 hops and IPv6 hops. 100% client-side — actual
 * traceroute requires the OS CLI, so this tool generates commands and
 * parses pasted output; it never sends packets itself.
 */
import type { ToolManifest } from "../../../lib/tool";

export const manifest: ToolManifest = {
  id: "traceroute-visualizer",
  name: "Traceroute Visualizer",
  description:
    "Generate ready-to-paste tracert (Windows), traceroute (Linux/macOS) and mtr commands with hop-limit, timeout, probe-count and no-resolve flags. Paste any traceroute / tracert / mtr output and parse it into a structured hop list (hop number, IP, hostname, RTT × N) — visualized as a table, an ASCII latency graph, and CSV/JSON exports. Highlights the slowest hop, the biggest inter-hop latency jump, timeouts (*), private RFC1918 hops and IPv6 hops. 100% client-side — actual traceroute requires the OS CLI; this tool generates commands and parses pasted output.",
  category: "developer",
  keywords: [
    "traceroute", "tracert", "mtr", "trace route", "network path",
    "hop visualization", "traceroute parser", "traceroute map",
    "rtt per hop", "network diagnostics", "visual traceroute",
    "traceroute output", "trace route geolocation", "ipv6 traceroute",
    "rfc1918 private hop", "traceroute command generator",
  ],
  icon: "route",
  requiresNetwork: false,
  seo: {
    title: "Traceroute Visualizer — parse + visualize tracert / traceroute / mtr output | UnQTools",
    faq: [
      {
        q: "Does this tool run live traceroute from my browser?",
        a: "No. Browsers cannot send raw ICMP/UDP traceroute probes — that requires the OS CLI. This tool is honest about that. It generates ready-to-paste `tracert` (Windows), `traceroute` (Linux/macOS) and `mtr` commands with `-d`/`-n` (no-resolve), `-h <max-hops>`, `-w <timeout>`, `-q <queries>` and `-4`/`-6` flags. Run the command in your terminal, paste the output back into the tool, and it parses + visualizes the path — 100% client-side, no packets sent.",
      },
      {
        q: "What output formats can the parser handle?",
        a: "Three families, all auto-detected: (1) Windows `tracert` — `1    <1 ms    <1 ms    <1 ms  router [10.0.0.1]` (with optional `[IP]` suffix and `<1 ms` floor values). (2) Linux/macOS `traceroute` — `1  10.0.0.1 (10.0.0.1)  0.521 ms  0.489 ms  0.503 ms`, including the `*` timeout form, the multi-path form `hop  ip1 rtt  ip2 rtt`, and the AS-info form `hop  hostname (ip) [AS####] rtt`. (3) `mtr` text-table output with `--report` columns (Hop, Hostname, Loss%, Snt, Last, Avg, Best, Wrst, StDev). IPv6 lines and MPLS tunnel annotations are also handled.",
      },
      {
        q: "How are timeouts and private hops handled?",
        a: "Timeout hops (`* * *` in traceroute, `???` in tracert, or `Loss% 100` in mtr) are preserved with `timeout: true` and an empty IP — they render as `* * *` in the table and as gaps in the graph. Private RFC1918 IPs (10/8, 172.16/12, 192.168/16), link-local 169.254/16, loopback 127/8, and IPv6 ULA fc00::/7 + link-local fe80::/10 are flagged with `isPrivate: true` so the UI can show a badge — these hops have no public geolocation and are typically your LAN / carrier-grade NAT.",
      },
      {
        q: "What does the path analysis show?",
        a: "From the parsed hops it computes: total hop count, the slowest hop (max avg RTT), the biggest inter-hop latency jump (largest `avg[i] − avg[i−1]`), the count and percentage of timeout hops, and the total end-to-end latency (final-hop avg RTT). These pinpoint where packets are delayed or dropped along the path — useful for diagnosing whether a problem is local (first 3 hops), in your ISP (next few), or at the destination's edge.",
      },
      {
        q: "What extra features does this tool have versus other traceroute sites?",
        a: "(1) tracert / traceroute / mtr command generator with 6+ flags. (2) Auto-format-detect parser for Windows, Linux, macOS and mtr text output. (3) Hop model: hop number, IP, hostname, RTT × N, timeout flag. (4) Per-hop stats: min / max / avg / stddev / loss%. (5) Path analysis: slowest hop, biggest latency jump, timeout count, end-to-end RTT. (6) RFC1918 / loopback / link-local / IPv6 ULA private-hop detection. (7) IPv6 hop classification. (8) MPLS tunnel annotation pass-through. (9) Render as text table, ASCII latency graph, CSV, JSON. (10) Copy / download exports. (11) localStorage history (max 20). (12) Shareable URL with full pasted output round-trip. 100% client-side — never sends a packet.",
      },
    ],
  },
  status: "done",
};
