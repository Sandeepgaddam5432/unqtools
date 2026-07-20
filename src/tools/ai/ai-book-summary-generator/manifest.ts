import type { ToolManifest } from "../../../lib/tool";

export const manifest: ToolManifest = {
  id: "ai-book-summary-generator",
  name: "AI Book Summary Generator",
  description:
    "Generate chapter + key-idea summaries from book-length text using extractive summarization. Pure-JS engine: sentence scoring (TF + position + keyword + cue), chapter detection, premise + key ideas + chapter breakdown + takeaways + Q&A + outline. 3 depth levels. 100% client-side — optional BYO-key LLM enhancement. Nothing uploaded.",
  category: "ai",
  keywords: [
    "book summary", "book summarizer", "chapter summary",
    "key ideas", "book notes", "summarize book",
    "extractive summary", "book outline", "takeaways",
    "reading notes",
  ],
  icon: "book-open",
  requiresNetwork: false,
  seo: {
    title: "AI Book Summary Generator — Chapter + Key-Idea Summaries, Private | UnQTools",
    faq: [
      {
        q: "How does the book summary generator work?",
        a: "Paste your book text (or chapter-by-chapter). The tool uses extractive summarization — it scores sentences by word frequency (TF), position in the chapter, keyword presence, and cue words ('importantly', 'in conclusion', etc.) — then selects the top sentences for each chapter. It also extracts a premise, key ideas, takeaways, and generates Q&A. Everything runs locally in your browser.",
      },
      {
        q: "Can I summarize a full book at once?",
        a: "Yes. The tool handles long text via hierarchical chunk-and-merge: it splits the text into 5000-character chunks at sentence boundaries, summarizes each chunk, then merges the chunk summaries into a final result. Chapter detection works via patterns like 'Chapter 1', 'Part I', 'Introduction', 'Preface', etc.",
      },
      {
        q: "What depth levels are available?",
        a: "Three: brief (1-2 sentences per chapter), standard (3-5 sentences), and detailed (5-8 sentences with key ideas and Q&A). The brief level is great for quick scanning; detailed is for deep study notes.",
      },
      {
        q: "What extra features does this tool have compared to others?",
        a: "(1) Extractive summarization with TF + position + keyword + cue scoring. (2) Chapter detection (Chapter/Part/Book/Section/Prologue/Epilogue/Preface/Introduction/Foreword/Appendix + all-caps headings). (3) Hierarchical chunk-and-merge for long text (5000-char chunks). (4) Premise extraction. (5) Key ideas extraction. (6) Chapter breakdown. (7) Takeaways. (8) Q&A generation. (9) Outline mode. (10) 3 depth levels. (11) History (localStorage, last 20). (12) Shareable URL. (13) Optional BYO-key LLM enhancement. (14) Markdown/JSON/text export. (15) Reading time estimate.",
      },
      {
        q: "Is my data sent anywhere?",
        a: "No. All summarization runs locally. The only network call is if you paste your own LLM API key and click 'Enhance with LLM' — that request goes directly from your browser to the LLM provider you choose (OpenAI or Anthropic).",
      },
    ],
  },
  status: "done",
};
