import type { ToolManifest } from "../../../lib/tool";

export const manifest: ToolManifest = {
  id: "ai-chatbot-emulator",
  name: "AI Chatbot Emulator",
  description:
    "Build and test a knowledge-base chatbot right in the browser. Paste or upload your FAQ / docs as Q&A pairs, define a persona + system prompt, set tone and guardrails, then chat with the bot using a pure-JS retrieval engine (TF-IDF + Jaccard + Levenshtein fuzzy matching) that cites which KB chunk was used. Intent detection (greeting, farewell, thanks, question), configurable fallback rules, confidence scoring, KB chunking, KB validation with warnings, multiple saved bots (localStorage), transcript export (text / Markdown / JSON), shareable URL with full bot config, JSON config import / export, optional BYO-key LLM enhancement (OpenAI / Anthropic). 100% client-side — your KB never leaves the browser unless you explicitly enable LLM polish.",
  category: "ai",
  keywords: [
    "chatbot builder", "chatbot emulator", "test chatbot", "faq chatbot",
    "rag chatbot", "knowledge base chatbot", "rule based chatbot",
    "chatbot prototype", "private chatbot", "no login chatbot",
    "botpress alternative", "dialogflow alternative", "intent matching",
    "chatbot tester",
  ],
  icon: "bot",
  requiresNetwork: false,
  seo: {
    title: "AI Chatbot Emulator — Build & Test a KB Chatbot, Private | UnQTools",
    faq: [
      {
        q: "How does the chatbot emulator work?",
        a: "Paste your FAQ or docs as Q&A pairs (one per line, e.g., 'Q: How do I reset? | A: Click the reset button on the settings page.'). Define a persona/system prompt and pick a tone. When you chat with the bot, the engine tokenizes your query, scores it against every KB entry using three signals — TF-IDF overlap, Jaccard similarity, and Levenshtein fuzzy matching — then returns the best-matching answer with a confidence score and a citation showing which KB chunk was used. No training, no model download, no account.",
      },
      {
        q: "Can I use this for production customer support?",
        a: "This tool is a prototyping and testing harness. The on-device rule-based engine is great for testing intent coverage, fallback behavior, and persona tone before you ship — but for production customer support you'll want a real LLM-backed bot. That's why we include an optional 'Polish with LLM' button (BYO OpenAI / Anthropic key) and a JSON config export so you can deploy your persona + KB + settings to any backend (Botpress, Rasa, your own server) without lock-in.",
      },
      {
        q: "How is the matching done without an LLM?",
        a: "Three transparent signals, all pure-JS and deterministic: (1) TF-IDF — how rare and overlapping the query and KB terms are; (2) Jaccard similarity — shared-terms ratio; (3) Levenshtein edit distance — fuzzy spelling / typo tolerance. The final score is a weighted blend (configurable). If the top score is below your confidence threshold, the bot uses your fallback message. Every signal is shown in the UI so you understand why a match was chosen.",
      },
      {
        q: "What extra features does this tool have compared to other chatbot builders?",
        a: "(1) Paste-or-upload Q&A KB with flexible delimiters. (2) Persona / system prompt editor. (3) Tone presets (formal, casual, friendly, technical). (4) Guardrail settings (max response length, banned words). (5) TF-IDF retrieval. (6) Jaccard similarity scoring. (7) Levenshtein fuzzy matching for typos. (8) Configurable score weights. (9) Confidence threshold + configurable fallback message. (10) Intent detection (greeting, farewell, thanks, question, help). (11) KB chunking for long entries. (12) KB validation with warnings. (13) KB stats (entries, words, avg length, intent coverage). (14) Citation per response (which KB chunk was used). (15) Test mode (run predefined test queries in bulk). (16) Multiple saved bots (localStorage). (17) Transcript export (text / Markdown / JSON). (18) Shareable URL with full bot config. (19) JSON config import / export. (20) Optional BYO-key LLM polish (OpenAI / Anthropic). (21) Honesty disclaimer about hallucination.",
      },
      {
        q: "Is my data sent anywhere?",
        a: "No. All KB parsing, matching, scoring, chat, favorites, history, and JSON export run locally in your browser. Your FAQ / docs never leave this device. The only network path is if you explicitly paste your own LLM API key and click 'Polish with LLM' — that request goes directly to the LLM provider you choose and never touches UnQTools servers. Even then, only the current query and the top KB chunk are sent (not your entire KB).",
      },
    ],
  },
  status: "done",
};
