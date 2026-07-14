import type { ToolManifest } from "../../../lib/tool";

export const manifest: ToolManifest = {
  id: "http-status-code-reference",
  name: "HTTP Status Code Reference",
  description:
    "Searchable reference for all HTTP status codes with common causes, how-to-fix guides, IANA links, server-software mapping (nginx/Cloudflare/Apache), HTTP/2 vs HTTP/1.1 differences, quiz mode, and CSV/Markdown export. 100% offline.",
  category: "network-security",
  keywords: [
    "http", "status code", "response", "404", "500", "301", "redirect",
    "error", "reference", "iana", "nginx", "cloudflare", "http2",
  ],
  icon: "list",
  requiresNetwork: false,
  seo: {
    title: "HTTP Status Code Reference — Causes, Fixes, Server Mapping | UnQTools",
    faq: [
      {
        q: "What are the HTTP status code categories?",
        a: "1xx = Informational (request received, continuing process). 2xx = Success (action received, understood, accepted). 3xx = Redirection (further action needed). 4xx = Client Error (bad request). 5xx = Server Error (server failed).",
      },
      {
        q: "What does each code's 'common causes' section show?",
        a: "For each code, we list the most common real-world causes (e.g. 502 = backend crashed, 429 = rate limit hit, 401 = missing auth token). Plus a 'how to fix' section with actionable steps. This goes beyond just the RFC definition — it's practical debugging guidance.",
      },
      {
        q: "What server-software mapping is included?",
        a: "For codes that are commonly emitted by specific servers/proxies (502, 503, 504 from nginx/Cloudflare/Apache/HAProxy; 413 from nginx/Apache), we list which servers emit them and the specific config setting to adjust (e.g. nginx client_max_body_size for 413).",
      },
      {
        q: "What extra features does this tool have compared to others?",
        a: "Beyond a static reference, we ship: (1) View history (localStorage, last 30). (2) Favorites — star codes you reference often. (3) Filter by server software (show only Cloudflare-specific codes). (4) Export as CSV or Markdown reference sheet. (5) HTTP/2 vs HTTP/1.1 vs HTTP/3 differences (where applicable, e.g. 421 Misdirected Request). (6) Quiz mode — test your knowledge with random questions. (7) Related codes — see other codes in the same category. (8) Copy as JSON — get full code details as JSON. (9) Cheat sheet — quick view of the 16 most common codes. (10) Copy-as-curl — generate a curl command that triggers the code (via httpbin.org).",
      },
      {
        q: "Is this reference complete?",
        a: "Yes — we cover all standard HTTP status codes from RFC 9110 (HTTP Semantics), plus unofficial but widely-used codes (429 Too Many Requests from RFC 6585, 451 Unavailable For Legal Reasons from RFC 7725, and Cloudflare's 5xx extensions 520-530). Detailed causes/fixes are provided for the 20 most common codes; the rest have descriptions and use cases.",
      },
      {
        q: "What's the difference between 301 and 302?",
        a: "301 Moved Permanently means the resource has permanently moved — search engines update their index. 302 Found means a temporary redirect — search engines keep the original URL. Use 301 for permanent moves, 307/308 for preserving HTTP method. See the 'how to fix' section on each code's page for more details.",
      },
    ],
  },
  status: "done",
};
