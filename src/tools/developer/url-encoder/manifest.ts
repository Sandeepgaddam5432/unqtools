import type { ToolManifest } from "../../../lib/tool";

export const manifest: ToolManifest = {
  id: "url-encoder",
  name: "URL Encoder / Decoder",
  description:
    "Encode URLs or components for safe transmission, or decode percent-encoded URLs back to plain text. UTF-8 safe.",
  category: "developer",
  keywords: [
    "url encode",
    "url decode",
    "percent encoding",
    "uri",
    "query string",
    "encodeURIComponent",
  ],
  icon: "link",
  requiresNetwork: false,
  component: () => import("./ui"),
  seo: {
    title: "URL Encoder / Decoder — Percent-Encoding | UnQTools",
    faq: [
      {
        q: "What's the difference between encodeURI and encodeURIComponent?",
        a: "encodeURI keeps URL-structural characters like :, /, ?, &, =, # intact — use it on a full URL. encodeURIComponent escapes everything except A–Z, 0–9, -, _, ., ~ — use it on individual query parameter values so they don't break the URL structure.",
      },
      {
        q: "Does this handle UTF-8?",
        a: "Yes. JavaScript's encodeURIComponent uses UTF-8 by default, so emoji, CJK, and other non-ASCII characters are encoded as multi-byte percent-escaped sequences (e.g. %F0%9F%91%8D for 👍).",
      },
    ],
  },
  status: "done",
};
