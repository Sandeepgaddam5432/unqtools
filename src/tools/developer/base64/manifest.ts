/**
 * Base64 Encoder/Decoder — Tool Manifest.
 */
import type { ToolManifest } from "../../../lib/tool";

export const manifest: ToolManifest = {
  id: "base64",
  name: "Base64 Encoder / Decoder",
  description:
    "Encode text or files to Base64, or decode Base64 back to text — UTF-8 safe, with URL-safe variant and live byte counter. 100% private.",
  category: "developer",
  keywords: ["base64", "encode", "decode", "url-safe", "atob", "btoa", "data url"],
  icon: "binary",
  requiresNetwork: false,
  component: () => import("./ui"),
  seo: {
    title: "Base64 Encoder / Decoder — UTF-8 Safe, URL-Safe | UnQTools",
    faq: [
      {
        q: "Why does this tool handle UTF-8 correctly when many don't?",
        a: "JavaScript's built-in btoa() only accepts Latin1 characters. This tool uses TextEncoder/TextDecoder to convert UTF-8 bytes to Base64, so emoji, CJK, and other non-ASCII characters encode and decode correctly.",
      },
      {
        q: "What is the URL-safe variant?",
        a: "Standard Base64 uses '+' and '/' which break in URLs. The URL-safe variant (RFC 4648 §5) replaces them with '-' and '_', and optionally drops the trailing '=' padding. Useful for JWTs, data URLs, and query parameters.",
      },
    ],
  },
  status: "done",
};
