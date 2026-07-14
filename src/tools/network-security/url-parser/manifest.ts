import type { ToolManifest } from "../../../lib/tool";

export const manifest: ToolManifest = {
  id: "url-parser",
  name: "URL Parser",
  description:
    "Break down any URL into its components — protocol, host, port, path, query params, hash. Edit and rebuild. 100% client-side.",
  category: "network-security",
  keywords: [
    "url",
    "parser",
    "uri",
    "components",
    "query string",
    "params",
    "hash",
    "fragment",
    "url parser",
  ],
  icon: "link",
  requiresNetwork: false,
  seo: {
    title: "URL Parser — Decompose URLs into Components | UnQTools",
    faq: [
      {
        q: "What URL components does this tool show?",
        a: "Protocol (scheme), username, password, host, port, pathname, search (query string), and hash (fragment). Query parameters are also parsed into a key-value table for easy inspection.",
      },
      {
        q: "Does this follow RFC 3986 or the WHATWG URL standard?",
        a: "We use the browser's native URL() constructor, which follows the WHATWG URL Living Standard — the same spec browsers use to parse URLs. This is more permissive than strict RFC 3986 and matches real-world browser behavior.",
      },
      {
        q: "Can I decode query parameters that are URL-encoded?",
        a: "Yes. Query parameters are automatically decoded using decodeURIComponent. So %20 becomes a space, %2F becomes a slash, and so on. You can copy either the raw encoded or decoded value.",
      },
      {
        q: "Is the URL I paste sent anywhere?",
        a: "No. URL parsing is done entirely in your browser using the native URL API. Nothing is logged, transmitted, or stored. You can verify this by disconnecting your internet — the tool still works.",
      },
    ],
  },
  status: "done",
};
