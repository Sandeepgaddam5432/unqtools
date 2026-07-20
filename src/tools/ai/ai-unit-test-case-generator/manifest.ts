import type { ToolManifest } from "../../../lib/tool";

export const manifest: ToolManifest = {
  id: "ai-unit-test-case-generator",
  name: "AI Unit Test Case Generator",
  description:
    "Generate unit test suites from pasted code. Parses function signatures and writes happy-path, edge-case, error-case, parameterized, snapshot, and mock-scaffolded tests using Arrange-Act-Assert. Supports Jest, Vitest, PyTest, and JUnit for JavaScript, TypeScript, Python, and Java. Coverage-gap hints, setup/teardown scaffolding, copy/download, history (localStorage, last 20), and shareable URL. 100% client-side. Optional BYO-key LLM enhancement — your code never leaves the browser unless you choose to call your own provider.",
  category: "ai",
  keywords: [
    "unit test generator", "jest generator", "pytest generator",
    "junit generator", "vitest generator", "test case generator",
    "ai test generator", "generate unit tests", "test scaffolding",
    "private test generator", "no login test generator", "diffblue alternative",
    "happy path", "edge case", "parameterized tests",
  ],
  icon: "flask-conical",
  requiresNetwork: false,
  seo: {
    title: "AI Unit Test Case Generator — Jest, PyTest, JUnit, Vitest | UnQTools",
    faq: [
      {
        q: "How does the AI unit test case generator work?",
        a: "Paste a function (or a whole module) and pick a framework — Jest, Vitest, PyTest, or JUnit. The tool parses function signatures on-device, infers parameter kinds (number, string, array, object, boolean), and generates happy-path, edge-case, error-case, and parameterized/table-driven tests using Arrange-Act-Assert structure. It also scaffolds mocks for fetch and module imports, generates setup/teardown, and lists coverage-gap hints. Every test is labeled deterministic (signature-driven, reliable) or heuristic (best-effort — review the expected value).",
      },
      {
        q: "Which languages and frameworks are supported?",
        a: "JavaScript and TypeScript with Jest or Vitest, Python with PyTest, and Java with JUnit 5. Each framework gets idiomatic assertions (expect().toBe(), assert ==, assertEquals()), parameterized syntax (it.each / @pytest.mark.parametrize / @ParameterizedTest), mock scaffolding (vi.mock, unittest.mock.patch, Mockito), and setup/teardown (beforeEach/afterEach, @pytest.fixture, @BeforeEach/@AfterEach). React components detected by capitalized names and JSX returns get snapshot tests.",
      },
      {
        q: "Are the generated tests always correct?",
        a: "No — and the tool is honest about it. Each generated test is labeled 'deterministic' (signature-driven — e.g., a throw assertion that the function actually throws) or 'heuristic' (best-effort — e.g., an edge-case assertion that uses a placeholder like toBeDefined()). Happy-path expected values are inferred from the return type or function name; you must replace placeholders with the real expected value. Always run the suite and adjust expected values to match the actual behavior of your code.",
      },
      {
        q: "What extra features does this tool have?",
        a: "(1) 4 languages (JS/TS/Python/Java). (2) 4 frameworks (Jest/Vitest/PyTest/JUnit). (3) Auto-detect source language. (4) Function-signature parser (params, types, async, exports, arrow, generators, throws). (5) Happy-path test per function. (6) Per-parameter edge-case tests. (7) Error-case tests (throw assertions + async rejection). (8) Parameterized/table-driven tests (it.each / parametrize / @ParameterizedTest). (9) Snapshot tests for React components. (10) Mock scaffolding for fetch and module imports. (11) Setup/teardown scaffolding per framework. (12) Coverage-gap hints per function. (13) Per-test 'explain what this covers' panel. (14) Sample snippets per language. (15) Stats (totals by category). (16) Local history (localStorage, last 20). (17) Shareable URL with code + framework + language. (18) Copy/download as .test file. (19) Optional BYO-key LLM explanation (OpenAI/Anthropic). (20) Honesty disclaimer about heuristic tests.",
      },
      {
        q: "Is my code sent anywhere?",
        a: "No. All parsing, generation, mock scaffolding, and history run locally in your browser — your code never leaves this device. The only network path is if you explicitly paste your own LLM API key and click 'Explain with LLM' — that request goes directly to your chosen LLM provider (OpenAI or Anthropic) and never touches UnQTools servers. Skip the LLM step for 100% offline use.",
      },
    ],
  },
  status: "done",
};
