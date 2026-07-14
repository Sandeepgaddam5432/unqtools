import type { ToolManifest } from "../../../lib/tool";

export const manifest: ToolManifest = {
  id: "url-parser",
  name: "URL Parser",
  description:
    "Decode, normalize, build, compare, and lint URLs — supports HTTP/HTTPS/FTP/file/mailto/tel/ws/wss/data/blob. Phishing detection, redirect hints, Punycode IDN, encoded-char highlight, and URL diff. 100% client-side.",
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
    "normalize",
    "punycode",
    "phishing",
    "url safety",
  ],
  icon: "link",
  requiresNetwork: false,
  seo: {
    title: "URL Parser — Decode, Normalize, Lint, Compare URLs | UnQTools",
    faq: [
      {
        q: "What URL components does this tool show?",
        a: "Protocol (scheme), username, password, host, port, pathname, search (query string), and hash (fragment). Query parameters are parsed into a key-value table. Supports all WHATWG URL schemes: http, https, ftp, file, mailto, tel, ws, wss, data, blob.",
      },
      {
        q: "What is URL normalization and why does it matter?",
        a: "Normalization produces a canonical form of a URL by lowercasing the host, stripping default ports (:80 for HTTP, :443 for HTTPS), removing duplicate slashes, sorting query parameters, and optionally removing fragments/trailing slashes. Normalized URLs are useful for deduplication, caching, and comparing two URLs for equality.",
      },
      {
        q: "How does the phishing/safety check work?",
        a: "We check for common phishing red flags: IP-address hostnames (rarely used by legit sites), excessive subdomains (login.account.com.evil.com), hyphen-heavy domains, non-ASCII characters in hostname (homograph attacks like Cyrillic 'а' in apple.com), Punycode (xn--) which could be legit IDN or homograph, HTTP instead of HTTPS, URL shorteners (bit.ly etc.), '@' signs that obscure hostnames, and excessive URL length. Each finding has a severity (high/medium/low/info).",
      },
      {
        q: "What extra features does this tool have compared to others?",
        a: "Beyond standard parse/normalize, we ship: (1) URL history (localStorage, last 20, with clear button). (2) Phishing/safety check with 9 red-flag patterns. (3) Redirect chain detection (shorteners, redirect params like ?url=, ?next=). (4) Encoded characters highlight — find all %XX sequences and decode them. (5) URL scheme reference — info on http/https/ftp/file/mailto/tel/ws/wss/data/blob. (6) mailto: parser — extract To/Cc/Bcc/Subject/Body. (7) tel: parser — extract phone number and comment. (8) URL builder/editor — construct a URL from parts. (9) Shareable URL — encode input in fragment (never sent to server). (10) URL diff — compare two URLs field-by-field.",
      },
      {
        q: "Does this tool follow RFC 3986 or the WHATWG URL standard?",
        a: "We use the browser's native URL() constructor, which follows the WHATWG URL Living Standard — the same spec browsers use to parse URLs. This is more permissive than strict RFC 3918 and matches real-world browser behavior. For normalization, we follow RFC 3986 §6 (Syntax-Based Normalization) where applicable.",
      },
      {
        q: "Is the URL I paste sent anywhere?",
        a: "No. URL parsing is done entirely in your browser using the native URL API. Nothing is logged, transmitted, or stored server-side. History is stored in localStorage on your device only. Shareable URLs encode the input in the URL fragment (#) which browsers do NOT send to servers in HTTP requests.",
      },
    ],
  },
  status: "done",
};
