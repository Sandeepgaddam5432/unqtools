import type { ToolManifest } from "../../../lib/tool";

export const manifest: ToolManifest = {
  id: "ai-keyword-extractor",
  name: "AI Keyword Extractor",
  description:
    "Extract keywords and keyphrases from text using TF-IDF, RAKE, and YAKE algorithms. Multi-word keyword detection, scoring by frequency, position, capitalization, and co-occurrence. Top-N output with density bars, n-gram control (1–4), topic clustering, multi-language stopword packs, tag-cloud view, CSV/JSON export. Pure-JS engine — optional BYO-key LLM. 100% client-side, nothing uploaded.",
  category: "ai",
  keywords: [
    "keyword extractor", "extract keywords from text", "keyphrase extraction",
    "rake algorithm", "yake", "tf-idf keywords", "seo keyword finder",
    "private keyword tool", "tag generator",
  ],
  icon: "tags",
  requiresNetwork: false,
  seo: {
    title: "AI Keyword Extractor — TF-IDF + RAKE + YAKE, Private | UnQTools",
    faq: [
      {
        q: "How does the AI Keyword Extractor work?",
        a: "Paste your text and choose one of three classic algorithms: TF-IDF (term frequency × inverse document frequency), RAKE (Rapid Automatic Keyword Extraction, which scores candidate phrases by word co-occurrence), or YAKE (Yet Another Keyword Extractor, which combines casing, position, frequency, and sentence-spread signals). The extractor produces ranked keywords/keyphrases with their scores, frequency counts, and density percentages. You can control n-gram length (1–4), choose a language stopword pack, and view results as a ranked table or a tag cloud.",
      },
      {
        q: "What is the difference between TF-IDF, RAKE, and YAKE?",
        a: "TF-IDF scores single words (or n-grams) by how often they appear in this text vs a small built-in reference corpus — rare words that appear often here score higher. RAKE splits text on stopwords and punctuation to form candidate phrases, then scores each phrase by summing the word-degree / word-frequency of its members. YAKE weights each candidate using five features: casing (capitalized terms get a bonus), word position (early words score higher), word frequency, term position spread across sentences, and how often the word appears in different sentences. All three are deterministic and run entirely on-device.",
      },
      {
        q: "Can I extract multi-word keyphrases?",
        a: "Yes. Set the n-gram slider from 1 to 4. TF-IDF treats the n-gram as a single token for scoring. RAKE naturally produces multi-word phrases by joining non-stopwords between stopwords. YAKE scores single words by default but can also produce phrase candidates when you enable 'multi-word' mode. Each result row shows whether it is a 1-gram, 2-gram, 3-gram, or 4-gram.",
      },
      {
        q: "What extra features does this tool have compared to others?",
        a: "(1) Three algorithms — TF-IDF, RAKE, YAKE. (2) N-gram control (1–4). (3) Multi-language stopword packs (English, Spanish, French, German, Portuguese). (4) Ranked keyword table with score, frequency, density bar, n-gram size, capitalization flag. (5) Tag-cloud view sized by score. (6) Topic clustering by word co-occurrence (graph-based). (7) Stats — total words, unique words, top-10 share. (8) Top-N selector (5/10/15/20/50). (9) Copy keywords as comma-separated or one per line. (10) Export to CSV and JSON. (11) History (localStorage, last 20). (12) Shareable URL. (13) Sample texts. (14) Optional BYO-key LLM enhancement. (15) Deterministic — same input always produces the same output.",
      },
      {
        q: "Is my text sent anywhere?",
        a: "No. All extraction, scoring, and clustering run locally in your browser. Text never leaves this device. The only network call is if you paste your own LLM API key and click 'Enhance with LLM' — that request goes directly from your browser to the LLM provider you choose.",
      },
    ],
  },
  status: "done",
};
