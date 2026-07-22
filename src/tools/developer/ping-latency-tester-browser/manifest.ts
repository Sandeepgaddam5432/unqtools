/**
 * Ping & Latency Tester (Browser) — Tool Manifest.
 * Tool #396 — Category 4 (Developer & Code).
 *
 * Pure-JS ping/latency toolkit. Generates ready-to-paste ICMP `ping`
 * commands for Windows (`ping -n`), Linux/macOS (`ping -c`) with count,
 * interval, timeout, payload-size and flood/no-resolve flags. Generates
 * the equivalent browser HTTP fetch-timing plan (URL + cache-bust +
 * no-caching fetch options) that uses the Performance API to time
 * round-trips — because browsers cannot send real ICMP packets. A pure
 * statistics calculator then derives min / max / avg / stddev / jitter
 * and packet-loss approximation from a list of RTT samples, plus a
 * histogram and CSV export. 100% client-side — actual HTTP timing
 * requires the network, but the command generator and stats engine
 * never touch the network themselves.
 */
import type { ToolManifest } from "../../../lib/tool";

export const manifest: ToolManifest = {
  id: "ping-latency-tester-browser",
  name: "Ping & Latency Tester (Browser)",
  description:
    "Generate ready-to-paste ping commands for Windows, Linux and macOS (count, interval, timeout, payload size, flood/no-resolve flags). Build a browser HTTP fetch-timing plan that uses the Performance API to measure round-trip latency — because browsers can't send ICMP. Pure latency statistics calculator: min / max / avg / stddev / jitter / packet-loss, plus a histogram and CSV export. 100% client-side — actual fetch timing needs the network; command generation and stats never do.",
  category: "developer",
  keywords: [
    "ping test", "latency test", "browser ping", "rtt", "jitter",
    "round trip time", "ping command", "tracert", "network latency",
    "fetch timing", "performance api", "ping windows", "ping linux",
    "ping macos", "packet loss", "stddev", "histogram latency",
  ],
  icon: "activity",
  requiresNetwork: false,
  seo: {
    title: "Ping & Latency Tester (Browser) — ping command generator + RTT stats | UnQTools",
    faq: [
      {
        q: "Can this tool send real ICMP ping packets from my browser?",
        a: "No. Browsers cannot send raw ICMP echo requests — that requires the OS CLI. This tool is honest about that. It generates ready-to-paste `ping` commands for Windows (`ping -n <count>`), Linux/macOS (`ping -c <count>`) with interval, timeout, payload-size, flood and no-resolve flags, and it generates the equivalent browser HTTP fetch-timing plan that uses `performance.now()` and the PerformanceResourceTiming API to time HTTPS round-trips. Run the CLI command in your terminal for real ICMP; paste the resulting RTTs (or use the in-browser fetch timing) into the stats calculator.",
      },
      {
        q: "What statistics does the calculator compute?",
        a: "From a list of RTT samples (in milliseconds) it computes: count, success/failed, packet-loss percentage (failed / total × 100), min, max, average (arithmetic mean), standard deviation (population, sqrt of mean squared deviation from mean), and jitter (mean of absolute differences between consecutive samples: mean(|rtt[i+1] − rtt[i]|)). It also bins the RTTs into a configurable histogram and exports samples and stats as CSV.",
      },
      {
        q: "Why does the browser HTTP timing sometimes show inflated numbers?",
        a: "Three honest reasons. (1) First request pays the DNS + TLS + TCP handshake cost — use the warm-up option to discard the first sample. (2) HTTP caching skews subsequent requests toward zero — the tool always appends a cache-busting `_=<timestamp>` query param and sends `cache: 'no-store'` + `mode: 'no-cors'`. (3) CORS-blocked hosts still resolve and connect but throw on the response — the tool catches the error and keeps the timing, marking the sample as ok=false but recording the RTT. This is not ICMP and never will be; it's an HTTP round-trip measure.",
      },
      {
        q: "What ping flags are supported in the generated commands?",
        a: "Windows `tracert`-style `ping`: `-n <count>` (count), `-w <ms>` (timeout), `-l <bytes>` (payload size), `-t` (ping forever until Ctrl-C), `-4`/`-6` (force IPv4/IPv6), `-a` (resolve addresses to hostnames), `-f` (don't fragment). Linux/macOS `ping`: `-c <count>`, `-i <sec>` (interval), `-W <ms>` Linux / `-W <sec>` macOS (timeout), `-s <bytes>` (payload size), `-f` (flood, root only), `-n` (no DNS resolve), `-4`/`-6`, `-q` (quiet summary), `-D` (timestamps).",
      },
      {
        q: "What extra features does this tool have versus other ping sites?",
        a: "(1) Honest ICMP-vs-HTTP disclosure. (2) ping command generator for Windows / Linux / macOS with 10+ flags. (3) Browser fetch-timing plan generator using PerformanceResourceTiming (cache-bust + no-store + no-cors + warm-up). (4) Pure stats engine: count, loss%, min, max, avg, population stddev, jitter (RFC 3550 mean packet-delay variation). (5) Configurable histogram with auto-bucketing. (6) CSV export of samples + stats. (7) Latency classification (fast/good/moderate/slow). (8) Multi-target presets (Google DNS, Cloudflare, AWS, your own). (9) localStorage history (max 20). (10) Shareable URL with full config round-trip. (11) Live fetch runner in the UI with a sparkline chart. 100% client-side logic — the stats and command generators never send a packet.",
      },
    ],
  },
  status: "done",
};
