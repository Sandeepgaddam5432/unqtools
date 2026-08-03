/**
 * AI Chat with PDF — Tool Manifest
 */
import type { ToolManifest } from "../../../lib/tool";

export const manifest: ToolManifest = {
  id: "pdf-ai-chat",
  name: "AI Chat with PDF (Q&A)",
  description: "Load a PDF and ask questions about its content. Text extraction, document analysis, keyword search, and interactive chat — all in your browser.",
  category: "pdf",
  keywords: ["pdf chat", "ask pdf", "pdf question answer", "pdf ai", "pdf search", "pdf analyze", "document chat", "pdf qa"],
  icon: "FileText",
  requiresNetwork: false,
  seo: {
    title: "AI Chat with PDF (Q&A) — 100% Private, Offline | UnQTools",
    faq: [
      { q: "What does this tool do?", a: "Load any PDF file and ask questions about its content. The tool extracts text and uses intelligent keyword matching to find relevant passages." },
      { q: "Is my data sent to a server?", a: "No. All processing happens in your browser using pdf-lib. Your PDF never leaves your device." },
      { q: "How does the Q&A work?", a: "The tool extracts text from the PDF, then uses keyword matching and relevance scoring to find the most relevant passages for your questions." },
      { q: "What PDF features are analyzed?", a: "Word count, sentence count, paragraph count, top keywords, average words per sentence, and more." },
      { q: "Does this work offline?", a: "Yes — install as a PWA and use it without network." },
    ],
  },
  status: "done",
};
