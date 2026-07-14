import type { ToolManifest } from "../../../lib/tool";

export const manifest: ToolManifest = {
  id: "http-status-code-reference",
  name: "HTTP Status Code Reference",
  description:
    "Searchable reference for all HTTP status codes — 1xx informational, 2xx success, 3xx redirect, 4xx client error, 5xx server error. Includes official name, meaning, and use cases.",
  category: "network-security",
  keywords: [
    "http",
    "status code",
    "response",
    "404",
    "500",
    "301",
    "redirect",
    "error",
    "reference",
  ],
  icon: "list",
  requiresNetwork: false,
  seo: {
    title: "HTTP Status Code Reference — All Codes Explained | UnQTools",
    faq: [
      {
        q: "What are the HTTP status code categories?",
        a: "1xx = Informational (request received, continuing process). 2xx = Success (action received, understood, accepted). 3xx = Redirection (further action needed). 4xx = Client Error (bad request). 5xx = Server Error (server failed).",
      },
      {
        q: "What's the difference between 301 and 302?",
        a: "301 Moved Permanently means the resource has permanently moved — search engines update their index. 302 Found means a temporary redirect — search engines keep the original URL. Use 301 for permanent moves, 307/308 for preserving HTTP method.",
      },
      {
        q: "When should I use 418 I'm a teapot?",
        a: "RFC 2324 (HTCPCP) defined 418 as a joke status for teapots asked to brew coffee. It's not a real HTTP status code, but some APIs use it for fun error responses. Don't use it in production code unless you have a really good reason.",
      },
      {
        q: "Is this reference complete?",
        a: "Yes — we cover all standard HTTP status codes from RFC 9110 (HTTP Semantics), plus unofficial but widely-used codes (e.g. 429 Too Many Requests from RFC 6585, 451 Unavailable For Legal Reasons from RFC 7725, and Cloudflare's 5xx extensions).",
      },
    ],
  },
  status: "done",
};
