/**
 * API Authentication Header Builder — Tool Manifest
 */
import type { ToolManifest } from "../../../lib/tool";

export const manifest: ToolManifest = {
  id: "api-auth-header-builder",
  name: "API Authentication Header Builder",
  description: "Generate auth headers for Bearer, Basic, API Key, OAuth2, Digest, HMAC, AWS4, and NTLM. Includes cURL and Fetch examples. 100% client-side.",
  category: "developer",
  keywords: ["api auth", "authentication header", "bearer token", "basic auth", "oauth2", "hmac", "aws4", "ntlm", "digest", "api key", "auth header builder"],
  icon: "Shield",
  requiresNetwork: false,
  seo: {
    title: "API Authentication Header Builder — 100% Private, Offline | UnQTools",
    faq: [
      { q: "What does this tool do?", a: "Generates HTTP authentication headers for various schemes including Bearer, Basic, API Key, OAuth2, Digest, HMAC, AWS4, and NTLM." },
      { q: "Are my credentials sent to a server?", a: "No. All header generation happens 100% in your browser. Credentials never leave your device." },
      { q: "What auth schemes are supported?", a: "Bearer Token, Basic Auth, API Key, OAuth 2.0, Digest Auth, HMAC Signature, AWS Signature v4, and NTLM." },
      { q: "Does it generate code examples?", a: "Yes — generates cURL commands and Fetch API code for each header." },
    ],
  },
  status: "done",
};
