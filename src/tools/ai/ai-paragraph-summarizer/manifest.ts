import type { ToolManifest } from "../../../lib/tool";

export const manifest: ToolManifest = {
  id: "ai-paragraph-summarizer",
  name: "AI Paragraph Summarizer",
  description:
    "Summarize long articles, reports, notes, and transcripts into a short, faithful summary. Extractive summarization scores sentences by TF-IDF, position, and keyword presence. Adjustable length (short/medium/long), paragraph or bullet output, multi-paragraph support, map-reduce chunking for very long docs, key-points extraction, compression-ratio readout. 100% client-side — nothing uploaded. Optional BYO-key LLM hook for GPT-class quality.",
  category: "ai",
  keywords: [
    "paragraph summarizer", "text summarizer", "summarize text",
    "extractive summarization", "tf-idf summarizer", "ai summarizer",
    "free summarizer", "no sign up summarizer", "private summarizer",
    "key points extractor", "article summarizer", "online summarizer",
  ],
  icon: "file-text",
  requiresNetwork: false,
  seo: {
    title: "AI Paragraph Summarizer — On-Device, No Upload, No Limits | UnQTools",
    faq: [
      {
        q: "How does the paragraph summarizer work?",
        a: "Paste your text (article, report, notes, or transcript) and the tool splits it into paragraphs and sentences, then scores every sentence using three signals: TF-IDF (rare, salient words score higher), position (first and last sentences of each paragraph get a bonus), and keyword presence (sentences containing the document's top keywords score higher). The top-scoring sentences are reassembled in original order to form the summary. This is extractive summarization — no model download, no network, no upload.",
      },
      {
        q: "What length options are available?",
        a: "Three presets: Short (~15% of sentences), Medium (~30%), and Long (~50%). You can also switch between paragraph output (a single flowing summary) and bullet output (one bullet per selected sentence). For very long inputs (over ~4,000 words) the tool automatically runs map-reduce chunking: each chunk is summarized, then the chunk summaries are combined into a final summary.",
      },
      {
        q: "Can I see key points and the compression ratio?",
        a: "Yes. The tool extracts the top 5–10 key points (highest-scoring sentences across the whole document), shows a compression-ratio readout (summary word count ÷ original word count), and reports sentence + word counts before and after. You can copy the summary, download it as .txt or .md, and share a URL with the input + settings encoded (the input is stored in the URL hash, not on any server).",
      },
      {
        q: "What extra features does this tool have compared to others?",
        a: "(1) Extractive TF-IDF + position + keyword scoring. (2) Three length presets (short/medium/long). (3) Paragraph or bullet output. (4) Multi-paragraph support with per-paragraph scoring. (5) Map-reduce chunking for long docs. (6) Top key-points extraction. (7) Compression-ratio + word/sentence counts. (8) Copy + .txt + .md download. (9) Shareable URL with input + settings encoded. (10) Local history (max 20). (11) Side-by-side original vs summary. (12) Sample text button. (13) Honesty disclaimer (extractive ≠ abstractive — verify before quoting). (14) Optional BYO-key LLM hook for GPT-class abstractive quality.",
      },
      {
        q: "Is my text sent anywhere?",
        a: "No. All paragraph splitting, sentence tokenization, TF-IDF computation, scoring, and rendering run locally in your browser. Your text never leaves this device. History is stored in localStorage on this device only. The optional BYO-key LLM path (if you supply an API key) sends text directly from your browser to the provider you choose — UnQTools never proxies or stores it.",
      },
    ],
  },
  status: "done",
};
