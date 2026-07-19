import type { ToolManifest } from "../../../lib/tool";

export const manifest: ToolManifest = {
  id: "ai-api-payload-mocking-tool",
  name: "AI API Payload Mocking Tool",
  description:
    "Generate realistic mock API responses from OpenAPI spec, JSON sample, or described endpoint. Pure-JS faker-style data (names, emails, phones, UUIDs, dates, addresses), CRUD route config, latency/error/status simulation, scenario presets (empty/error/large/paginated), Mockoon-style export, optional BYO-key LLM enhancement. 100% client-side — nothing uploaded.",
  category: "ai",
  keywords: [
    "api mocking", "mock server", "mock api", "openapi mock",
    "swagger mock", "faker", "mock json", "mock response",
    "api simulator", "beeceptor alternative", "mockoon alternative",
  ],
  icon: "server",
  requiresNetwork: false,
  seo: {
    title: "AI API Payload Mocking Tool — OpenAPI Mock Server, No Login | UnQTools",
    faq: [
      {
        q: "How does the API payload mocking tool work?",
        a: "Paste an OpenAPI/Swagger spec, a JSON sample, or describe an endpoint in plain English. The tool parses the schema, infers realistic mock values using a built-in faker (names, emails, phones, UUIDs, dates, addresses, URLs), and produces a mock-response config + CRUD routes you can copy/export. You can also generate a fetch-able mock handler to serve mocks in-browser.",
      },
      {
        q: "What types of mock data can it generate?",
        a: "Person names, first/last names, usernames, emails, phone numbers (US/UK/intl formats), street addresses, cities, states, zip codes, countries, UUIDs (v4), ISO-8601 dates, timestamps, booleans, integers in range, floats, currency amounts, URLs, slugs, hex colors, IP addresses (v4/v6), user-agents, lorem-ipsum sentences/paragraphs, payment-card numbers (Luhn-valid), and JSON nested from any schema.",
      },
      {
        q: "Can I simulate latency, errors, and pagination?",
        a: "Yes. Configure per-route latency (ms), status code (200/201/400/404/500/etc.), and pick from scenario presets: empty result, error response, large list (1k items), paginated response, or single resource. The exportable config includes these so your mock server behaves realistically.",
      },
      {
        q: "Can I use my own LLM API key for smarter mocks?",
        a: "Yes. The tool builds an optimal prompt from your spec/sample and optionally calls OpenAI/Anthropic (with a key you paste — stored only in localStorage on this device). If no key is provided, the pure-JS template/faker engine produces deterministic, realistic mock data offline.",
      },
      {
        q: "What extra features does this tool have compared to others?",
        a: "(1) OpenAPI/Swagger JSON parser. (2) JSON-sample schema inference. (3) Plain-English endpoint describer. (4) Pure-JS faker (20+ data types). (5) CRUD route generator (list/get/create/update/delete). (6) Latency + status-code + scenario presets. (7) Mockoon/OpenAPI-compatible config export. (8) In-browser fetch-mock handler. (9) Request inspector. (10) Optional BYO-key LLM enhancement. (11) History (localStorage, last 20). (12) Shareable URL. (13) Paginated response builder. (14) Luhn-valid card generator. (15) Locale-aware names/phones.",
      },
      {
        q: "Is my data sent anywhere?",
        a: "No. All parsing, mocking, and faker generation run locally in your browser. The only network call is if you paste your own LLM API key and click 'Enhance with LLM' — that request goes directly from your browser to the LLM provider you choose. Specs, samples, and history never leave this device.",
      },
    ],
  },
  status: "done",
};
