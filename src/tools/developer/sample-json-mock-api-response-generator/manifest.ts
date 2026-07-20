/**
 * Sample JSON / Mock API Response Generator — Tool Manifest.
 * Tool #286 — Category 4 (Developer & Code).
 */
import type { ToolManifest } from "../../../lib/tool";

export const manifest: ToolManifest = {
  id: "sample-json-mock-api-response-generator",
  name: "Sample JSON / Mock API Response Generator",
  description:
    "Generate realistic mock API responses from a JSON Schema or example. REST single/array, paginated envelopes, JSON:API, GraphQL, error templates, and webhook payloads. Status codes, headers, MSW snippet. 100% client-side.",
  category: "developer",
  keywords: [
    "mock api", "json mock", "sample json", "mock response",
    "json schema faker", "fake api", "mock server", "msw",
    "webhook mock", "json:api",
  ],
  icon: "braces",
  requiresNetwork: false,
  seo: {
    title: "Sample JSON / Mock API Response Generator — Schema, REST, GraphQL, Webhooks | UnQTools",
    faq: [
      {
        q: "How does the mock API response generator work?",
        a: "Paste a JSON Schema (or an example JSON we infer a schema from), pick an endpoint type (REST, paginated, JSON:API, GraphQL, error, or webhook), set a count and seed, and we generate a realistic mock response that honors type, format, enum, minimum/maximum, and required-field constraints. You also get a matching HTTP status line, sensible headers, and a ready-to-paste MSW handler snippet.",
      },
      {
        q: "Which JSON Schema keywords are supported?",
        a: "type, format (email, uuid, date, date-time, time, uri, ipv4, ipv6, phone, color, password, semver, slug), enum, const, minimum, maximum, exclusiveMinimum, exclusiveMaximum, minLength, maxLength, minItems, maxItems, items, properties, required, and an x-faker override for any field. Arrays generate N items; nested objects recurse; circular $refs are detected.",
      },
      {
        q: "What envelope presets are built in?",
        a: "Five: (1) None — raw object/array. (2) REST Pagination — { data, page, limit, total, pages }. (3) JSON:API — { data: [{ type, id, attributes }], meta }. (4) GraphQL — { data, errors }. (5) OData — { value, '@odata.context' }. You can also pick the HTTP status code and we add Content-Type, X-Request-Id, RateLimit-* headers as appropriate.",
      },
      {
        q: "Are my schemas or example data uploaded anywhere?",
        a: "No. Schemas are processed entirely in your browser. Nothing is sent to a server. History (last 20 generations) is stored in localStorage on this device only, and the shareable URL encodes options in the fragment (after #) which browsers never transmit.",
      },
      {
        q: "What extra features does this tool have versus others?",
        a: "(1) JSON Schema input with 12+ format generators. (2) Example → schema inference. (3) 5 envelope presets (REST, paginated, JSON:API, GraphQL, OData). (4) 12+ status codes with matching headers + error bodies. (5) 6 webhook templates (Stripe, GitHub, Slack, Shopify, Twilio, Typeform). (6) x-faker field override. (7) Seedable reproducibility. (8) Array counts up to 10,000. (9) Circular $ref guard. (10) Auto-generated MSW handler snippet. (11) localStorage history (max 20). (12) Shareable-URL config. (13) Copy / download .json / .http.",
      },
    ],
  },
  status: "done",
};
