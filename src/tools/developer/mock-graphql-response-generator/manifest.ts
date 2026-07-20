/**
 * Mock GraphQL Response Generator — Tool Manifest.
 * Tool #298 — Category 4 (Developer & Code).
 *
 * Paste a GraphQL SDL schema (and optionally a query) and instantly get
 * realistic mock responses shaped exactly to the query/selection set — with
 * type-aware Faker mapping, list sizing, custom overrides, error injection,
 * and MSW/Apollo snippet export. 100% client-side, no schema upload.
 */
import type { ToolManifest } from "../../../lib/tool";

export const manifest: ToolManifest = {
  id: "mock-graphql-response-generator",
  name: "Mock GraphQL Response Generator",
  description:
    "Generate realistic mock GraphQL responses from a pasted SDL schema and optional query. Type-aware mock generation with Faker-mapped scalars (String/Int/Float/Boolean/ID/Date/Email/URL/UUID/JSON), list sizing, enums, unions/interfaces with __typename resolution, fragments & aliases, per-field overrides, nullable/error-state injection, MSW/Apollo resolver snippet export. 100% client-side, no schema upload.",
  category: "developer",
  keywords: [
    "graphql mock generator", "graphql mock response online", "mock graphql schema",
    "graphql fake data", "graphql sdl to mock", "apollo mock",
    "msw graphql", "graphql fixtures", "graphql test data",
  ],
  icon: "braces",
  requiresNetwork: false,
  seo: {
    title: "Mock GraphQL Response Generator — SDL → JSON, Type-aware, MSW Export | UnQTools",
    faq: [
      {
        q: "How does the Mock GraphQL Response Generator work?",
        a: "Paste a GraphQL SDL schema (type User { id: ID! name: String! ... }, unions, interfaces, enums, custom scalars) and optionally a query (mutation/subscription). The tool parses the SDL into an in-memory type map, walks the query selection set, and produces a realistic mock JSON response shaped exactly to the query — with type-aware Faker values (emails, URLs, UUIDs, dates, numbers, etc.), configurable list sizes, custom per-field overrides, and __typename resolution for unions and interfaces.",
      },
      {
        q: "Which GraphQL features are supported?",
        a: "SDL: type, interface, union, enum, input, scalar, custom scalars, field arguments, list types ([Type!]!), non-null modifiers (!). Query: Query/Mutation/Subscription operations, field selections, nested objects, fragments (inline + named), aliases, list fields with custom sizes, __typename. Recursion is capped at a configurable depth (default 3) to prevent infinite loops on self-referential types like User.friends: [User!]!.",
      },
      {
        q: "Can I override the mock value for specific fields?",
        a: "Yes. The per-field overrides panel lets you set a literal value or a Faker-style template ({{name.firstName}}, {{internet.email}}, {{datatype.uuid}}, etc.) for any field path. Overrides take precedence over the type-aware default. Common custom scalars (Date, Email, URL, UUID, DateTime, JSON, BigInt, Decimal) are auto-mapped to realistic Faker values.",
      },
      {
        q: "Are my schemas or queries uploaded anywhere?",
        a: "No. SDL parsing and mock generation run entirely in your browser. Nothing is sent to a server. History (last 20 generations) is stored in localStorage on this device only — metadata only, never the schema or query text — and the shareable URL encodes options in the fragment (after #) which browsers never transmit.",
      },
      {
        q: "What extras does this tool offer versus @graphql-tools/mock and Apollo mocking?",
        a: "(1) Pure browser tool — no code or server required. (2) SDL parser supporting type/interface/union/enum/input/scalar/custom-scalar with non-null & list modifiers. (3) Query parser supporting selection sets, nested fields, fragments (inline + named), aliases, and __typename. (4) Type-aware Faker mapping for 12+ built-in + custom scalars. (5) Configurable list sizes (default, per-field override). (6) Recursion depth cap (default 3) with smart cycle-break. (7) Per-field overrides (literal or Faker template). (8) Nullable/error-state injection (random nulls, partial errors, full errors). (9) Seedable mulberry32 PRNG for reproducibility. (10) Union/interface __typename resolution. (11) MSW handler snippet export. (12) Apollo mock resolver snippet export. (13) Multiple operation detection (queries, mutations, subscriptions). (14) JSON / GraphQL-response / MSW / Apollo export formats. (15) localStorage history (max 20). (16) Shareable-URL config. (17) Copy / download. (18) Live preview with syntax highlighting.",
      },
    ],
  },
  status: "done",
};
