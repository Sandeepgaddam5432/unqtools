/**
 * AI Chat with PDF (Q&A) — Tool Manifest
 */
import type { ToolManifest } from "../../../lib/tool";

export const manifest: ToolManifest = {
  id: "pdf-ai-chat-qa",
  name: "AI Chat with PDF (Q&A)",
  description: "Advanced PDF Q&A: auto-summary generation, keyword search, passage relevance scoring, and document analysis — all client-side.",
  category: "pdf",
  keywords: ["pdf qa", "pdf summary", "pdf search", "pdf analysis", "document qa", "keyword search pdf"],
  icon: "Sparkles",
  requiresNetwork: false,
  seo: {
    title: "AI Chat with PDF (Q&A) — Summarize & Search | UnQTools",
    faq: [
      { q: "What does this tool do?", a: "Analyzes PDF content, generates auto-summaries, searches for relevant passages, and scores relevance — all in your browser." },
      { q: "Is my data sent to a server?", a: "No. All processing is 100% client-side using pdf-lib and custom algorithms." },
      { q: "How does auto-summary work?", a: "It scores sentences by position and keyword density, then selects the most important ones to form a concise summary." },
      { q: "Does this work offline?", a: "Yes — install as a PWA and use it without network." },
    ],
  },
  status: "done",
};
