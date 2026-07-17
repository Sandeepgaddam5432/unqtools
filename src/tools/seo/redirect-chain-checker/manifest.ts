import type { ToolManifest } from "../../../lib/tool";

export const manifest: ToolManifest = {
  id: "redirect-chain-checker",
  name: "Redirect Chain Checker",
  description:
    "Analyze URL redirect chains. Includes a redirect type reference (301, 302, 303, 307, 308, meta refresh, JS), chain visualization, hop count, final destination, and warnings for long chains and temporary redirects. 100% client-side — manual entry / live-check disclosure.",
  category: "seo",
  keywords: [
    "redirect chain", "301 redirect", "302 redirect", "307", "308",
    "meta refresh", "javascript redirect", "seo audit", "url redirect",
  ],
  icon: "git-fork",
  requiresNetwork: false,
  seo: {
    title: "Redirect Chain Checker — 301/302/307/308 Reference + Analyzer | UnQTools",
    faq: [
      {
        q: "Can this tool check live redirects on a URL?",
        a: "No — and we're upfront about it. Live HTTP redirect checking requires network access, and most websites block cross-origin requests from the browser (CORS). This tool instead provides: (1) a complete redirect type reference, (2) a chain analyzer where you enter the hops manually (from browser DevTools or curl), and (3) stats and warnings. Use DevTools (Network tab → Preserve log) or `curl -I <URL>` to capture the redirect chain, then paste it here.",
      },
      {
        q: "How do I check redirects with curl?",
        a: "Run `curl -I -L https://example.com` in a terminal. The -I flag fetches headers only, -L follows redirects. You'll see each 3xx response with its Location header. Or use `curl -sIL -o /dev/null -w '%{url_effective}' https://example.com` to print just the final URL.",
      },
      {
        q: "How do I check redirects with browser DevTools?",
        a: "Open DevTools (F12), go to the Network tab, check 'Preserve log', then navigate to the URL. Each 3xx response will appear in the network list with its status code and Location header. Right-click the column header → add 'Status' if not visible.",
      },
      {
        q: "What is the difference between 301, 302, 307, and 308?",
        a: "301 = Moved Permanently (passes link equity, may downgrade POST to GET). 302 = Found (temporary, doesn't reliably pass equity, may downgrade POST). 307 = Temporary Redirect (HTTP/1.1, preserves method). 308 = Permanent Redirect (HTTP/1.1, preserves method). For SEO permanent URL changes, use 301 (or 308 if you need method preservation).",
      },
      {
        q: "Why are long redirect chains bad?",
        a: "Each hop adds latency (extra round-trip), wastes crawl budget, and may dilute link equity slightly. Google has stated they follow up to ~5 hops in a chain; beyond that, they may stop. Best practice: redirect old URL → final URL in a single hop, not A → B → C → D.",
      },
      {
        q: "What extra features does this tool have compared to others?",
        a: "(1) URL input + parser. (2) Complete redirect type reference (7 types with SEO impact notes). (3) Manual chain builder — add/remove/reorder hops. (4) Bulk paste (from | type | to per line). (5) Chain visualization with arrows. (6) Hop count + final destination. (7) Warnings for long chains (>5 hops), 302s, meta refresh, and JS redirects. (8) Loop detection. (9) Markdown report export. (10) History (localStorage, last 20) + shareable URL.",
      },
      {
        q: "Is my data sent anywhere?",
        a: "No. All parsing and analysis runs locally. We never make HTTP requests. History is stored in localStorage on this device only.",
      },
    ],
  },
  status: "done",
};
