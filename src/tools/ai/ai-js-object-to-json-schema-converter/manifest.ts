import type { ToolManifest } from "../../../lib/tool";

export const manifest: ToolManifest = {
  id: "ai-js-object-to-json-schema-converter",
  name: "AI JS Object to JSON Schema Converter",
  description:
    "Convert a JS object or JSON sample into an inferred JSON Schema (Draft 7 or 2020-12). Recursive type inference for string, number, boolean, null, array, object; nested objects and arrays; format detection (email, date-time, uri, uuid); enum inference; multi-sample merging with anyOf; optional-fields handling; constraint inference (minLength/maxLength/minimum/maximum); validate JSON against the inferred schema; Markdown/JSON export; history (localStorage); shareable URL; optional BYO-key LLM descriptions. 100% client-side — your data never leaves the browser.",
  category: "ai",
  keywords: [
    "json schema", "json schema generator", "json schema from json",
    "object to schema", "schema inference", "draft 7", "draft 2020-12",
    "json schema draft 7", "quicktype alternative", "json schema validator",
    "infer schema", "json to schema",
  ],
  icon: "braces",
  requiresNetwork: false,
  seo: {
    title: "AI JS Object to JSON Schema Converter — Draft 7 + 2020-12 Inference | UnQTools",
    faq: [
      {
        q: "How does the JS object to JSON schema converter work?",
        a: "Paste one or more JS objects / JSON samples and the tool recursively infers a JSON Schema: it walks each value, records its type (string, number, integer, boolean, null, array, object), detects common formats (email, date-time, date, uri, uuid), infers enum values for short string sets, and merges multiple samples into a single schema with anyOf for mixed types. You can switch between Draft 7 and Draft 2020-12 output, toggle enum/format/required detection, and validate other JSON against the result.",
      },
      {
        q: "What JSON Schema drafts are supported?",
        a: "Two: Draft 7 (default — uses '$schema': 'http://json-schema.org/draft-07/schema#') and Draft 2020-12 (uses '$schema': 'https://json-schema.org/draft/2020-12/schema'). The same inferred schema tree is rendered with the appropriate $schema header and minor keyword differences (e.g., Draft 7 'items' vs Draft 2020-12 'items' on arrays).",
      },
      {
        q: "How are optional vs required fields handled when I paste multiple samples?",
        a: "When you provide multiple samples, the tool unions the keys seen across all of them. A key is added to the 'required' array only if it appears in every sample (configurable). Keys present in some samples but not others become optional — they appear in 'properties' but are not in 'required'. Empty arrays are flagged with a note because their item schema cannot be inferred from zero elements.",
      },
      {
        q: "What extra features does this tool have compared to others?",
        a: "(1) Recursive type inference (7 JSON types). (2) Format detection (email, date-time, date, uri, uuid). (3) Enum inference for small string sets. (4) Multi-sample merging with anyOf for mixed types. (5) Required-field toggle (every-sample vs none). (6) Draft selector (Draft 7 vs 2020-12). (7) Constraint inference (minLength, maxLength, minimum, maximum, minItems, maxItems). (8) Validate-other-JSON tab. (9) Copy/download as .json. (10) Markdown documentation export. (11) History (localStorage, last 20). (12) Shareable URL with samples + options encoded. (13) Sample presets. (14) Optional BYO-key LLM to suggest field descriptions.",
      },
      {
        q: "Is my data sent anywhere?",
        a: "No. All type inference, format/enum detection, merging, validation, and export run locally in your browser. Your sample objects never leave this device. The only network call is if you paste your own LLM API key and click 'Suggest descriptions with LLM' — that request goes directly from your browser to the LLM provider you choose (OpenAI or Anthropic).",
      },
    ],
  },
  status: "done",
};
