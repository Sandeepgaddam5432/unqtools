import type { ToolManifest } from "../../../lib/tool";

export const manifest: ToolManifest = {
  id: "ai-typescript-interface-generator",
  name: "AI TypeScript Interface Generator",
  description:
    "Generate TypeScript interfaces from JSON samples. Pure-JS recursive type inference — nested objects extracted into separate interfaces, optional & nullable handling, union types, enum (string-literal) detection, multi-sample merging for accurate optional fields, runtime type guards, and JSDoc from keys. Configurable root name, interface vs type, export, readonly, optional style, and array style. Optional BYO-key LLM. 100% client-side, nothing uploaded.",
  category: "ai",
  keywords: [
    "typescript interface", "json to typescript", "json to ts",
    "interface generator", "type generator", "quicktype alternative",
    "json to interface", "ts interface from json", "type guard generator",
    "runtime validator", "no login typescript",
  ],
  icon: "braces",
  requiresNetwork: false,
  seo: {
    title: "AI TypeScript Interface Generator — JSON to TS, Private | UnQTools",
    faq: [
      {
        q: "How does the interface generator work?",
        a: "Paste a JSON sample (a single object, an array, or an array of multiple samples) and the engine recursively infers the type of each value, extracts nested objects into their own interfaces, and emits clean TypeScript declarations. Strings, numbers, booleans, null, arrays, and nested objects are all handled. Optional fields are detected when you provide multiple samples and a key is missing in some of them.",
      },
      {
        q: "How are optional, nullable, and union types handled?",
        a: "Nullable fields (where 'null' appears alongside another type) become optional with the '?' modifier (or '| undefined' if you prefer). When a field has different types across samples — say string in one and number in another — the engine emits a union type like 'string | number'. Mixed-type arrays also produce union element types, with a warning suggesting you add more samples for accurate optionals.",
      },
      {
        q: "Can I generate runtime validators and enums?",
        a: "Yes. Toggle 'validators' to emit a TypeScript type-guard function (is<Name>) for each interface — these check the shape at runtime and narrow the type via 'v is <Name>'. Toggle 'enum inference' to detect small string-or-number literal sets in arrays and emit string-literal unions (e.g. \"open\" | \"closed\" | \"pending\") instead of plain string types.",
      },
      {
        q: "What extra features does this tool have compared to others?",
        a: "(1) Recursive nested-object extraction into separate interfaces. (2) Multi-sample merging for accurate optional-field detection. (3) Optional + nullable handling with two styles (? vs | undefined). (4) Union types for mixed-type fields. (5) String-literal and number-literal enum inference. (6) Runtime type-guard (validator) generation. (7) JSDoc comments from key names. (8) Interface vs type toggle. (9) Readonly toggle. (10) Export toggle. (11) Bracket vs generic array style (T[] vs Array<T>). (12) Empty-array handling with 'unknown[]' + warning. (13) Mixed top-level warning. (14) Root-name + key-path-based interface naming with singularization. (15) Reserved-word and invalid-identifier handling (quotes and suffixes). (16) Copy + Download .ts. (17) History (localStorage, last 20). (18) Shareable URL. (19) Sample presets. (20) Optional BYO-key LLM enhancement.",
      },
      {
        q: "Is my JSON sent anywhere?",
        a: "No. All JSON parsing, type inference, and TypeScript generation runs locally in your browser. Your data never leaves this device. The only network call is if you paste your own LLM API key and click 'Enhance' — that request goes directly from your browser to the LLM provider you choose. Types reflect only the sample(s) you paste; add multiple responses for accurate optionals. Nothing uploaded or logged by us.",
      },
    ],
  },
  status: "done",
};
