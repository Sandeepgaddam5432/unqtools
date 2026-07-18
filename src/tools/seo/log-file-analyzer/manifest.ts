import type { ToolManifest } from "../../../lib/tool";

export const manifest: ToolManifest = {
  id: "log-file-analyzer",
  name: "Server Log File Analyzer (SEO)",
  description:
    "Parse Apache/Nginx server logs (common + combined format) for SEO insights: Googlebot activity, status-code distribution, crawl frequency, 404 broken URLs, multi-bot detection (Bing/Yandex/Baidu/DuckDuckGo/Ahrefs/Semrush/Apple), response-time stats, CSV export, history, shareable URL. 100% client-side — paste logs, get instant crawl insights.",
  category: "seo",
  keywords: [
    "log analyzer", "server logs", "apache logs", "nginx logs",
    "googlebot", "crawl logs", "bot detection", "seo logs",
    "log file analysis", "crawl budget", "404 logs",
  ],
  icon: "file-text",
  requiresNetwork: false,
  seo: {
    title: "Server Log File Analyzer (SEO) — Googlebot Activity & Status Codes | UnQTools",
    faq: [
      {
        q: "What log formats does this tool parse?",
        a: "Apache/Nginx common log format (CLF) and combined format: IP - - [timestamp] \"METHOD path HTTP/x.x\" status bytes \"referer\" \"user-agent\". Optional extra fields like response time (%D microseconds) appended at end are also parsed. Every line is parsed independently — malformed lines are reported as parse errors.",
      },
      {
        q: "Which bots are detected?",
        a: "Googlebot (with sub-types: Googlebot-News, Googlebot-Image, Googlebot-Video, Googlebot-Mobile, AdsBot-Google), Bingbot, YandexBot, Baiduspider, DuckDuckBot, AhrefsBot, SemrushBot, and Applebot — eight bot families with hit counters.",
      },
      {
        q: "How does crawl frequency work?",
        a: "For each unique URL path, we count how many times Googlebot requested it during the log window. Top crawled URLs are sorted by hit count so you can see which pages consume the most crawl budget. We also list 404 URLs Googlebot discovered (broken links Google found).",
      },
      {
        q: "What extra features does this tool have compared to others?",
        a: "(1) Apache/Nginx common+combined log parser. (2) Googlebot detection (with sub-types). (3) Multi-bot detection (8 bot families). (4) Status-code distribution (2xx/3xx/4xx/5xx). (5) Top crawled URLs (Googlebot only). (6) Per-URL crawl frequency. (7) Response-time stats (parses %D microseconds when present). (8) Bot hit counter. (9) Text report rendering. (10) CSV export (url, hits, status, bot). (11) Copy + Download .txt + Download CSV. (12) History (localStorage, last 20). (13) Shareable URL (encodes summary stats). (14) Bot filter (Googlebot only / all bots / specific bot). (15) Summary stats (% bot traffic). (16) 404 URL list (Googlebot-discovered broken URLs).",
      },
      {
        q: "Is my data sent anywhere?",
        a: "No. Log parsing happens entirely in your browser. History is stored in localStorage on this device only. No log lines ever leave the page — important because server logs can contain sensitive IPs.",
      },
    ],
  },
  status: "done",
};
