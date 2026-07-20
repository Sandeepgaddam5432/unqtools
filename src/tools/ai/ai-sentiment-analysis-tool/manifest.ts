import type { ToolManifest } from "../../../lib/tool";

export const manifest: ToolManifest = {
  id: "ai-sentiment-analysis-tool",
  name: "AI Sentiment Analysis Tool",
  description:
    "On-device sentiment analysis: paste any text (reviews, tweets, feedback, emails) and get a positive / negative / neutral label, a -1 to +1 score, per-sentence breakdowns, emotion detection (joy, anger, sadness, fear, surprise, disgust, trust, anticipation), aspect-based sentiment, confidence scores, and bulk CSV analysis with a summary chart. Built-in 200+ word lexicon with negation handling. Pure-JS engine — optional BYO-key LLM. 100% client-side, nothing uploaded.",
  category: "ai",
  keywords: [
    "sentiment analysis", "emotion detection", "text sentiment",
    "positive negative", "review analyzer", "feedback sentiment",
    "csv sentiment", "bulk sentiment", "aspect-based sentiment",
    "private sentiment",
  ],
  icon: "smile",
  requiresNetwork: false,
  seo: {
    title: "AI Sentiment Analysis Tool — On-Device + Bulk CSV, Private | UnQTools",
    faq: [
      {
        q: "How does the Sentiment Analysis Tool work?",
        a: "Paste any text — a tweet, a product review, a customer email, a paragraph of feedback — and the engine classifies it as positive, negative, or neutral with a confidence score. It uses a curated 200+ word lexicon (each word scored from -1 to +1 across eight emotions), handles negation ('not good' flips to negative), boosters ('very good' amplifies), and dampeners ('somewhat good' softens). You get: (1) a document-level label and score, (2) per-sentence breakdowns with the words that drove each verdict, (3) an emotion profile (joy / anger / sadness / fear / surprise / disgust / trust / anticipation), (4) aspect-based sentiment extraction ('battery: negative, screen: positive'), and (5) a confidence rating (low / medium / high) based on lexicon coverage and sentence count.",
      },
      {
        q: "How is the sentiment score calculated and how does negation work?",
        a: "Each token is looked up in the lexicon; matched words contribute their score (-1 to +1). Negation words ('not', 'never', 'no', \"don't\", 'hardly', 'barely') within a 3-word window flip the polarity of the following sentiment word ('not good' = -0.7 instead of +0.7). Booster words ('very', 'extremely', 'incredibly') multiply the following score by 1.5; dampener words ('somewhat', 'slightly', 'fairly') multiply by 0.5. The per-sentence score is the sum of token scores normalized to [-1, +1] using tanh. The document score is the mean of sentence scores. Labels: score >= +0.15 = positive; score <= -0.15 = negative; otherwise neutral.",
      },
      {
        q: "Can I analyze bulk text from a CSV file?",
        a: "Yes. Click 'Load CSV' and pick a file (or paste CSV text). The engine parses the rows, lets you map any text column to analyze, and produces per-row scores plus a summary chart (positive / negative / neutral counts, mean score, top 5 most positive and most negative rows). Results export as CSV or JSON. Large files are processed in chunks so the UI stays responsive — there's no row limit, but very large CSVs (10k+ rows) will take a few seconds on weaker devices.",
      },
      {
        q: "What extra features does this tool have compared to other sentiment tools?",
        a: "(1) 200+ word lexicon across 8 emotions. (2) Negation handling (3-word window). (3) Booster + dampener modifiers. (4) Per-sentence + document-level analysis. (5) Emotion profile (joy, anger, sadness, fear, surprise, disgust, trust, anticipation). (6) Aspect-based sentiment extraction ('screen: positive, battery: negative'). (7) Confidence score (low / medium / high) based on lexicon coverage. (8) Inline word highlighting (positive = green, negative = red). (9) Bulk CSV upload with column mapper. (10) Summary chart (positive / negative / neutral counts + mean score). (11) Top 5 most positive + most negative rows. (12) Export results as CSV or JSON. (13) Threshold tuning (adjust the positive/negative cutoff). (14) Local history (localStorage, last 20). (15) Shareable URL. (16) Honesty disclaimer (on-device classifiers are strong but not perfect — sarcasm and slang reduce accuracy). (17) Optional BYO-key LLM enhancement.",
      },
      {
        q: "Is my text sent anywhere?",
        a: "No. All lexicon matching, scoring, emotion detection, and aspect extraction runs locally in your browser. Your text — whether a single review or a 10,000-row CSV — never leaves this device. The only network call is if you paste your own LLM API key (OpenAI or Anthropic) and click 'Enhance with LLM' — that request goes directly from your browser to the provider you choose, never to UnQTools. History is stored in localStorage on this device only and can be cleared at any time.",
      },
    ],
  },
  status: "done",
};
