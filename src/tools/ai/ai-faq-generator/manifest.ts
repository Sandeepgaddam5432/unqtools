import type { ToolManifest } from "../../../lib/tool";

export const manifest: ToolManifest = {
  id: "ai-faq-generator",
  name: "AI FAQ Generator",
  description:
    "Generate structured FAQs from a topic or pasted content. Eight question types (What, How, Why, When, Where, Who, Which, Can) × topic keywords → 10+ grounded Q&A pairs grouped by type. Outputs Markdown, HTML accordion, and ready-to-paste JSON-LD FAQPage schema for SEO rich results. Pure-JS template engine — optional BYO-key LLM. 100% client-side, nothing uploaded.",
  category: "ai",
  keywords: [
    "faq generator", "faq schema generator", "faqpage json-ld",
    "ai faq maker", "faq from content", "faq rich results",
    "structured faq", "no login faq generator",
  ],
  icon: "help-circle",
  requiresNetwork: false,
  seo: {
    title: "AI FAQ Generator — JSON-LD Schema, Markdown, HTML Accordion | UnQTools",
    faq: [
      {
        q: "How does the AI FAQ generator work?",
        a: "Enter a topic or paste a description, product page, or article. The tool extracts keywords and sentences from your content, then expands a library of question templates across eight types (What, How, Why, When, Where, Who, Which, Can) to produce 10+ realistic Q&A pairs. Each answer is grounded in your source — when the source doesn't support an answer, we mark it 'not grounded' rather than inventing facts. Output is grouped by question type and exportable as Markdown, an HTML accordion, or ready-to-paste JSON-LD FAQPage schema for SEO rich results.",
      },
      {
        q: "What is JSON-LD FAQPage schema and why does it matter?",
        a: "JSON-LD FAQPage is a structured-data format defined by schema.org that tells search engines like Google your page contains a FAQ section. When Google validates it, your questions and answers can appear directly in search results as 'rich results,' increasing click-through and surface area. The tool produces valid @type=FAQPage JSON-LD with name, mainEntity (Question + acceptedAnswer), ready to paste into a <script type=\"application/ld+json\"> tag.",
      },
      {
        q: "How are answers grounded in my content?",
        a: "When you paste source content, the tool extracts sentences and finds the most relevant snippet for each question by keyword overlap. That snippet becomes the seed of the answer. If no relevant snippet is found, the answer is flagged with a '⚠ not grounded' badge and uses an honest generic template that references the topic — never fabricated facts, statistics, or quotes.",
      },
      {
        q: "What extra features does this tool have compared to others?",
        a: "(1) Eight question-type templates (What/How/Why/When/Where/Who/Which/Can). (2) Topic + optional content input. (3) Keyword + sentence extraction for grounding. (4) 10+ Q&A pairs per generation. (5) Grouped output by question type. (6) Tone control (neutral/friendly/formal/concise). (7) Length control (short/standard/detailed). (8) Voice-search phrasing option. (9) Markdown export. (10) HTML accordion export. (11) JSON-LD FAQPage schema export. (12) Per-question regenerate button. (13) Question count selector. (14) History (localStorage, last 20). (15) Shareable URL. (16) Sample topic presets. (17) Optional BYO-key LLM enhancement.",
      },
      {
        q: "Is my data sent anywhere?",
        a: "No. All keyword extraction, sentence matching, template expansion, and JSON-LD building runs locally in your browser. Topics and pasted content never leave this device. The only network call is if you paste your own LLM API key and click 'Enhance with LLM' — that request goes directly from your browser to the LLM provider you choose.",
      },
    ],
  },
  status: "done",
};
