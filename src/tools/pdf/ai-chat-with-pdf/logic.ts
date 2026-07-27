/**
 * AI Chat with PDF — pure logic.
 * Text chunking, TF-IDF retrieval, and citation grounding.
 * All pure functions — no DOM, no React, no network.
 */

// ============================================================
// Types
// ============================================================

export interface PageText {
  pageNumber: number; // 1-based
  text: string;
}

export interface Chunk {
  id: number;
  documentName: string;
  pageNumber: number;
  text: string;
  startChar: number;
  endChar: number;
}

export interface ScoredChunk extends Chunk {
  score: number;
}

export interface Citation {
  documentName: string;
  pageNumber: number;
  quote: string;
}

export interface ChatMessage {
  role: "user" | "assistant";
  text: string;
  citations?: Citation[];
  timestamp: number;
}

export interface DocumentIndex {
  documentName: string;
  chunks: Chunk[];
  tfidf: TFIDFIndex;
}

export interface IndexResult {
  documents: string[];
  totalChunks: number;
  totalPages: number;
}

// ============================================================
// Constants
// ============================================================

export const DEFAULT_CHUNK_SIZE = 800;
export const DEFAULT_CHUNK_OVERLAP = 120;
export const DEFAULT_TOP_K = 5;
export const MIN_SIMILARITY = 0.01;

// ============================================================
// Text Processing
// ============================================================

/** Normalize text: collapse whitespace, trim. */
export function normalizeText(text: string): string {
  return text.replace(/\s+/g, " ").trim();
}

/** Split text into words (lowercase, alphanumeric). */
export function tokenize(text: string): string[] {
  return text
    .toLowerCase()
    .split(/[^a-z0-9']+/)
    .filter((w) => w.length > 1);
}

/** English stop words for TF-IDF. */
const STOP_WORDS = new Set([
  "the", "a", "an", "and", "or", "but", "in", "on", "at", "to", "for",
  "of", "with", "by", "from", "as", "is", "was", "are", "were", "be",
  "been", "being", "have", "has", "had", "do", "does", "did", "will",
  "would", "could", "should", "may", "might", "must", "can", "this",
  "that", "these", "those", "i", "you", "he", "she", "it", "we", "they",
  "them", "their", "what", "which", "who", "when", "where", "why", "how",
  "all", "each", "every", "both", "few", "more", "most", "other", "some",
  "such", "no", "nor", "not", "only", "own", "same", "so", "than", "too",
  "very", "just", "also", "if", "then", "else", "about", "into", "through",
  "during", "before", "after", "above", "below", "up", "down", "out", "off",
  "over", "under", "again", "further", "once", "here", "there",
]);

/** Remove stop words from token list. */
export function removeStopWords(tokens: string[]): string[] {
  return tokens.filter((t) => !STOP_WORDS.has(t));
}

// ============================================================
// Chunking
// ============================================================

/** Split page texts into overlapping chunks that never cross page boundaries. */
export function chunkPages(
  documentName: string,
  pages: PageText[],
  chunkSize: number = DEFAULT_CHUNK_SIZE,
  overlap: number = DEFAULT_CHUNK_OVERLAP,
): Chunk[] {
  if (!documentName.trim()) throw new Error("Document has no name.");
  if (chunkSize < 100) throw new Error("Chunk size must be at least 100 characters.");
  if (overlap < 0 || overlap >= chunkSize) throw new Error("Overlap must be non-negative and smaller than chunk size.");

  const chunks: Chunk[] = [];
  let id = 0;
  for (const page of pages) {
    const text = normalizeText(page.text);
    if (!text) continue;
    let start = 0;
    while (start < text.length) {
      const end = Math.min(text.length, start + chunkSize);
      chunks.push({
        id,
        documentName,
        pageNumber: page.pageNumber,
        text: text.slice(start, end),
        startChar: start,
        endChar: end,
      });
      id += 1;
      if (end === text.length) break;
      start = end - overlap;
    }
  }
  if (chunks.length === 0) {
    throw new Error("No extractable text found. If this is a scanned PDF, run OCR first.");
  }
  return chunks;
}

// ============================================================
// TF-IDF Index
// ============================================================

export interface TFIDFIndex {
  documents: Map<number, Map<string, number>>; // chunkId -> term -> tf
  idf: Map<string, number>; // term -> inverse document frequency
  chunkIds: number[];
  totalChunks: number;
}

/** Build a TF-IDF index from chunks. */
export function buildTFIDFIndex(chunks: Chunk[]): TFIDFIndex {
  const documents = new Map<number, Map<string, number>>();
  const df = new Map<string, number>(); // document frequency
  const chunkIds: number[] = [];

  for (const chunk of chunks) {
    chunkIds.push(chunk.id);
    const tokens = removeStopWords(tokenize(chunk.text));
    const tf = new Map<string, number>();
    for (const token of tokens) {
      tf.set(token, (tf.get(token) || 0) + 1);
    }
    // Normalize TF by document length
    const totalTokens = tokens.length || 1;
    for (const [term, count] of tf) {
      tf.set(term, count / totalTokens);
      df.set(term, (df.get(term) || 0) + 1);
    }
    documents.set(chunk.id, tf);
  }

  // Compute IDF: log(N / df)
  const N = chunks.length;
  const idf = new Map<string, number>();
  for (const [term, docFreq] of df) {
    idf.set(term, Math.log((N + 1) / (docFreq + 1)) + 1);
  }

  return { documents, idf, chunkIds, totalChunks: N };
}

/** Compute TF-IDF vector for a query string. */
export function queryToTFIDF(query: string, index: TFIDFIndex): Map<string, number> {
  const tokens = removeStopWords(tokenize(query));
  const tf = new Map<string, number>();
  for (const token of tokens) {
    tf.set(token, (tf.get(token) || 0) + 1);
  }
  const totalTokens = tokens.length || 1;
  const result = new Map<string, number>();
  for (const [term, count] of tf) {
    const idfVal = index.idf.get(term) || 0;
    if (idfVal > 0) {
      result.set(term, (count / totalTokens) * idfVal);
    }
  }
  return result;
}

/** Cosine similarity between a query vector and a document vector. */
export function cosineSimilarity(
  queryVec: Map<string, number>,
  docVec: Map<string, number>,
): number {
  let dot = 0;
  let normQ = 0;
  let normD = 0;
  for (const [term, qVal] of queryVec) {
    const dVal = docVec.get(term);
    if (dVal !== undefined) {
      dot += qVal * dVal;
    }
    normQ += qVal * qVal;
  }
  for (const [, dVal] of docVec) {
    normD += dVal * dVal;
  }
  if (normQ === 0 || normD === 0) return 0;
  return dot / (Math.sqrt(normQ) * Math.sqrt(normD));
}

// ============================================================
// Retrieval
// ============================================================

/** Rank chunks against a query using TF-IDF and keep the top-k. */
export function retrieveTopK(
  query: string,
  chunks: Chunk[],
  index: TFIDFIndex,
  topK: number = DEFAULT_TOP_K,
  minSimilarity: number = MIN_SIMILARITY,
): ScoredChunk[] {
  if (topK < 1) throw new Error("topK must be at least 1.");
  const queryVec = queryToTFIDF(query, index);
  if (queryVec.size === 0) return [];

  const scored: ScoredChunk[] = [];
  for (const chunk of chunks) {
    const docVec = index.documents.get(chunk.id);
    if (!docVec) continue;
    const score = cosineSimilarity(queryVec, docVec);
    if (score >= minSimilarity) {
      scored.push({ ...chunk, score });
    }
  }
  scored.sort((a, b) => b.score - a.score);
  return scored.slice(0, topK);
}

// ============================================================
// Citations & Answer Generation
// ============================================================

/** Build page-cited quotes from retrieved chunks (deduped by document+page). */
export function buildCitations(retrieved: ScoredChunk[], maxQuoteLength = 240): Citation[] {
  const seen = new Set<string>();
  const citations: Citation[] = [];
  for (const chunk of retrieved) {
    const key = `${chunk.documentName}#${chunk.pageNumber}`;
    if (seen.has(key)) continue;
    seen.add(key);
    const quote = chunk.text.length > maxQuoteLength
      ? `${chunk.text.slice(0, maxQuoteLength - 1)}…`
      : chunk.text;
    citations.push({ documentName: chunk.documentName, pageNumber: chunk.pageNumber, quote });
  }
  return citations;
}

/** Generate an answer from retrieved chunks (keyword-based, no LLM). */
export function generateAnswer(question: string, retrieved: ScoredChunk[]): { answer: string; citations: Citation[] } {
  if (retrieved.length === 0) {
    return {
      answer: "Not found in the document. The answer to your question does not appear in the indexed content. Try rephrasing or adding more documents.",
      citations: [],
    };
  }

  const citations = buildCitations(retrieved);

  // Find the most relevant sentences across retrieved chunks
  const questionTokens = new Set(removeStopWords(tokenize(question)));
  const sentences: { text: string; score: number; page: number; doc: string }[] = [];

  for (const chunk of retrieved) {
    const chunkSentences = chunk.text.split(/(?<=[.!?])\s+/).filter((s) => s.trim().length > 20);
    for (const sentence of chunkSentences) {
      const sentTokens = removeStopWords(tokenize(sentence));
      let overlap = 0;
      for (const token of sentTokens) {
        if (questionTokens.has(token)) overlap++;
      }
      const score = overlap / Math.max(sentTokens.length, 1);
      sentences.push({ text: sentence.trim(), score, page: chunk.pageNumber, doc: chunk.documentName });
    }
  }

  sentences.sort((a, b) => b.score - a.score);

  if (sentences.length === 0 || sentences[0].score === 0) {
    // No sentence overlap — return the most relevant chunk text
    const best = retrieved[0];
    return {
      answer: `Based on the document, here is the most relevant passage from ${best.documentName} (p. ${best.pageNumber}):\n\n"${best.text.slice(0, 300)}${best.text.length > 300 ? "…" : ""}"`,
      citations,
    };
  }

  // Build answer from top 2-3 sentences
  const topSentences = sentences.slice(0, 3);
  const answerParts = topSentences.map((s) => s.text);
  const pagesCited = [...new Set(topSentences.map((s) => s.page))].sort((a, b) => a - b);
  const pageStr = pagesCited.length === 1 ? `p. ${pagesCited[0]}` : `pp. ${pagesCited.join(", ")}`;

  return {
    answer: `${answerParts.join(" ")} (${pageStr})`,
    citations,
  };
}

/** Detect the honest "not found" answer. */
export function isNotFoundAnswer(answer: string): boolean {
  return answer.trim().toLowerCase().startsWith("not found in the document");
}

// ============================================================
// Suggested Questions
// ============================================================

/** Generate suggested questions from document content. */
export function generateSuggestedQuestions(chunks: Chunk[], count = 5): string[] {
  // Find the most frequent non-stopword terms
  const termFreq = new Map<string, number>();
  for (const chunk of chunks) {
    const tokens = removeStopWords(tokenize(chunk.text));
    for (const token of tokens) {
      termFreq.set(token, (termFreq.get(token) || 0) + 1);
    }
  }

  const topTerms = Array.from(termFreq.entries())
    .sort((a, b) => b[1] - a[1])
    .slice(0, 20)
    .map(([term]) => term);

  const templates = [
    (t: string) => `What is ${t}?`,
    (t: string) => `How does ${t} work?`,
    (t: string) => `Why is ${t} important?`,
    (t: string) => `What are the key features of ${t}?`,
    (t: string) => `Explain ${t} in detail.`,
    (t: string) => `What are the benefits of ${t}?`,
    (t: string) => `How is ${t} used?`,
    (t: string) => `What are the requirements for ${t}?`,
  ];

  const questions: string[] = [];
  const usedTerms = new Set<string>();
  let templateIdx = 0;
  for (const term of topTerms) {
    if (usedTerms.has(term)) continue;
    if (questions.length >= count) break;
    questions.push(templates[templateIdx % templates.length](term));
    usedTerms.add(term);
    templateIdx++;
  }

  return questions;
}

// ============================================================
// Conversation Export
// ============================================================

/** Export conversation as JSON. */
export function exportConversationJSON(messages: ChatMessage[]): string {
  return JSON.stringify(messages, null, 2);
}

/** Export conversation as Markdown. */
export function exportConversationMarkdown(messages: ChatMessage[]): string {
  let md = "# PDF Chat Conversation\n\n";
  for (const msg of messages) {
    const role = msg.role === "user" ? "**You**" : "**Assistant**";
    md += `### ${role}\n\n${msg.text}\n\n`;
    if (msg.citations && msg.citations.length > 0) {
      md += "**Citations:**\n";
      for (const c of msg.citations) {
        md += `- ${c.documentName}, p. ${c.pageNumber}: "${c.quote}"\n`;
      }
      md += "\n";
    }
  }
  return md;
}

// ============================================================
// PDF Text Extraction (stub — real extraction uses pdf.js in UI)
// ============================================================

/** Simulate PDF text extraction (placeholder for pdf.js). */
export function simulatePdfExtraction(text: string, pages: number = 1): PageText[] {
  const result: PageText[] = [];
  const perPage = Math.ceil(text.length / pages);
  for (let i = 0; i < pages; i++) {
    const start = i * perPage;
    const end = Math.min(text.length, start + perPage);
    result.push({ pageNumber: i + 1, text: text.slice(start, end) });
  }
  return result;
}
