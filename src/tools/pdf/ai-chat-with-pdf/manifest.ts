/**
 * AI Chat with PDF — Tool Manifest
 */
import type { ToolManifest } from "../../../lib/tool";

export const manifest: ToolManifest = {
  id: "ai-chat-with-pdf",
  name: "AI Chat with PDF",
  description:
    "Ask questions about your PDF and get answers grounded in its content with page-cited quotes — 100% private, in-browser text extraction and keyword retrieval. No uploads, no API keys needed.",
  category: "pdf",
  keywords: [
    "chat with pdf",
    "ask questions pdf",
    "pdf q&a ai",
    "chat with pdf offline",
    "private chatpdf",
    "pdf search",
    "pdf assistant",
  ],
  icon: "MessageSquareText",
  requiresNetwork: false,
  seo: {
    title: "AI Chat with PDF – Private, Page-Cited Answers | UnQTools",
    faq: [
      { q: "What does this tool do?", a: "Ask questions about your PDF and get answers grounded in its content with page-cited quotes. Uses in-browser text extraction and keyword-based retrieval — 100% private, no uploads." },
      { q: "Is my data sent to a server?", a: "No. This tool runs 100% in your browser. Your PDF is never uploaded, tracked, or stored remotely. All text extraction and question answering happens locally." },
      { q: "What extra features does this tool have?", a: "Extras: (1) Multi-PDF support — index multiple documents at once; (2) Page-cited quotes — every answer includes clickable page references; (3) Keyword-based retrieval — TF-IDF scoring for relevant passages; (4) Conversation memory — remembers previous Q&A; (5) Suggested questions — auto-generated from document content; (6) Out-of-scope detection — honestly says 'not found' instead of inventing; (7) Document management — add/remove documents; (8) Export conversation as JSON/Markdown; (9) Dark mode support; (10) PWA offline; (11) Progress indicator for indexing; (12) Copy individual answers." },
      { q: "Does this work offline?", a: "Yes — install as a PWA and use it without network. All processing happens client-side." },
    ],
  },
  status: "done",
};
