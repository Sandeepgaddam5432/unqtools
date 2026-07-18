import type { ToolManifest } from "../../../lib/tool";

export const manifest: ToolManifest = {
  id: "tf-idf-content-optimizer",
  name: "TF-IDF Content Optimizer",
  description:
    "Analyze content using Term Frequency-Inverse Document Frequency (TF-IDF). Compare to competitor content, identify important terms, find missing terms, flag over-optimization, compute content score, CSV export, history, shareable URL. 100% client-side.",
  category: "seo",
  keywords: [
    "tf-idf", "term frequency", "inverse document frequency", "content optimization",
    "competitor analysis", "seo content", "term importance", "lsi keywords",
  ],
  icon: "bar-chart",
  requiresNetwork: false,
  seo: {
    title: "TF-IDF Content Optimizer — Term Importance + Competitor Gap | UnQTools",
    faq: [
      {
        q: "What is TF-IDF?",
        a: "TF-IDF (Term Frequency-Inverse Document Frequency) scores how important a term is to a document in a collection. Terms that appear frequently in your content but rarely across competitors score high — those are your 'signature' terms. Terms that appear in competitors but not in yours are content gaps to fill.",
      },
      {
        q: "How is TF-IDF calculated?",
        a: "TF = (count of term in document) / (total terms in document). IDF = log( (total documents) / (documents containing term) ). TF-IDF = TF × IDF. Stop words are filtered out before scoring.",
      },
      {
        q: "What does the content score mean?",
        a: "The content score (0-100) reflects how well your content covers the important terms shared with competitors. A higher score means your content includes more of the terms that competitors collectively use — but watch for over-optimization warnings if your TF-IDF is much higher than competitors.",
      },
      {
        q: "What extra features does this tool have compared to others?",
        a: "(1) TF-IDF calculation (TF, IDF, final score). (2) Term importance ranking. (3) Competitor comparison. (4) Missing-term suggestions (terms in competitors but not yours). (5) Over-optimization warnings (terms where your TF is 2x+ the competitor average). (6) Word-cloud data export. (7) CSV export. (8) Content score 0-100. (9) History (localStorage, last 20). (10) Shareable URL. (11) Stop-word filtering (English).",
      },
      {
        q: "Is my data sent anywhere?",
        a: "No. All TF-IDF computation runs locally. History is stored in localStorage on this device only.",
      },
    ],
  },
  status: "done",
};
