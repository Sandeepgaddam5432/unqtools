import type { ToolManifest } from "../../../lib/tool";

export const manifest: ToolManifest = {
  id: "review-sentiment-analyzer",
  name: "Review Sentiment Analyzer",
  description:
    "Analyze customer reviews for sentiment and extract topics — pure JS sentiment analysis with no AI or network calls. Built-in lexicon of 100+ positive/negative words, negation handling ('not good'), per-review score, sentiment label, star rating distribution, average star rating, mismatch detector (5 stars but negative text), top-5 topics, top-20 word frequency, filter, CSV export, history (localStorage), shareable URL. 100% client-side.",
  category: "seo",
  keywords: [
    "sentiment analysis", "review analyzer", "customer reviews",
    "sentiment", "opinion mining", "star rating", "topic extraction",
    "word frequency", "mismatch detector", "review sentiment",
  ],
  icon: "message-square-heart",
  requiresNetwork: false,
  seo: {
    title: "Review Sentiment Analyzer — Customer Review Sentiment + Topics | UnQTools",
    faq: [
      {
        q: "How does the review sentiment analyzer work?",
        a: "Enter one review per line. You can optionally prefix each review with a star rating like '[5] Amazing service!' The tool tokenizes each review, counts matches against a built-in lexicon of 100+ positive and negative words, applies negation handling ('not good' counts as negative), and computes a sentiment score from -10 to +10 plus a label (positive/neutral/negative). It also extracts the top-5 topics by keyword frequency across all reviews.",
      },
      {
        q: "What is the mismatch detector?",
        a: "If a review has a 5-star rating but negative text sentiment (or a 1-star rating with positive text), that's flagged as a likely mismatch — often sarcastic, or a misclick. The mismatch count appears in the summary stats so you can investigate suspicious reviews.",
      },
      {
        q: "Can I filter reviews by sentiment?",
        a: "Yes. Filter by positive only, negative only, neutral only, or mismatched reviews. Export as text report or CSV with columns: review, stars, sentiment_score, label, topics. Copy to clipboard or download as .txt or .csv.",
      },
      {
        q: "What extra features does this tool have compared to others?",
        a: "(1) Review parser with optional star rating [N] prefix. (2) Built-in sentiment lexicon (100+ words: 50+ positive, 50+ negative). (3) Negation handling ('not good', 'no problem', 'didn't enjoy'). (4) Per-review sentiment score (-10 to +10). (5) Sentiment label (positive/neutral/negative). (6) Topic extraction (top 5 keywords). (7) Star rating distribution (1-5). (8) Average star rating. (9) Sentiment vs star mismatch detector. (10) Text report renderer. (11) CSV export. (12) Copy + Download .txt + Download CSV. (13) History (localStorage, last 20). (14) Shareable URL. (15) Filter by sentiment/mismatch. (16) Summary stats (total, avg sentiment, avg stars, mismatch count). (17) Top-20 word frequency table.",
      },
      {
        q: "Is my data sent anywhere?",
        a: "No. All sentiment analysis runs locally in your browser using a built-in word list. No AI, no network calls. History is stored in localStorage on this device only.",
      },
    ],
  },
  status: "done",
};
