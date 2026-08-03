/**
 * AI Chat with PDF (Q&A) — enhanced Q&A variant with summary generation.
 * 100% client-side PDF analysis.
 */

export interface PdfAnalysis {
  pageCount: number;
  text: string;
  wordCount: number;
  sentenceCount: number;
  topKeywords: [string, number][];
  readingTimeMinutes: number;
}

/** Extract text and stats from PDF */
export async function analyzePdf(fileBytes: ArrayBuffer): Promise<{ ok: true; analysis: PdfAnalysis } | { ok: false; error: string }> {
  try {
    const { PDFDocument } = await import("pdf-lib");
    const pdf = await PDFDocument.load(fileBytes);
    const pageCount = pdf.getPageCount();
    const text = extractText(fileBytes);
    const words = text.split(/\s+/).filter(Boolean);
    const sentences = text.split(/[.!?]+/).filter((s) => s.trim().length > 0);

    // Top keywords
    const stopWords = new Set(["the", "a", "an", "is", "are", "was", "were", "be", "been", "have", "has", "had", "do", "does", "did", "will", "would", "could", "should", "to", "of", "in", "for", "on", "with", "at", "by", "from", "as", "and", "or", "but", "not", "this", "that", "it", "its", "which", "who", "when", "where", "how", "all", "each", "every", "both", "few", "more", "most", "other", "some", "such", "no", "nor", "too", "very", "just", "can", "may", "might"]);
    const freq = new Map<string, number>();
    for (const w of words) {
      const c = w.toLowerCase().replace(/[^a-z0-9]/g, "");
      if (c.length > 3 && !stopWords.has(c)) freq.set(c, (freq.get(c) || 0) + 1);
    }
    const topKeywords = Array.from(freq.entries()).sort((a, b) => b[1] - a[1]).slice(0, 15);

    return {
      ok: true,
      analysis: {
        pageCount,
        text,
        wordCount: words.length,
        sentenceCount: sentences.length,
        topKeywords,
        readingTimeMinutes: Math.ceil(words.length / 200),
      },
    };
  } catch (e) {
    return { ok: false, error: `Failed to analyze PDF: ${e instanceof Error ? e.message : String(e)}` };
  }
}

function extractText(buffer: ArrayBuffer): string {
  const bytes = new Uint8Array(buffer);
  const raw = new TextDecoder("latin1").decode(bytes);
  const parts: string[] = [];
  const re = /BT\s([\s\S]*?)ET/g;
  let m;
  while ((m = re.exec(raw)) !== null) {
    const strRe = /\(([^)]*)\)/g;
    let sm;
    while ((sm = strRe.exec(m[1])) !== null) {
      const t = sm[1].replace(/\\n/g, "\n").replace(/\\r/g, "").replace(/\\t/g, " ").replace(/\\\(/g, "(").replace(/\\\)/g, ")").replace(/\\\\/g, "\\");
      if (t.trim()) parts.push(t);
    }
  }
  return parts.join(" ");
}

/** Generate a document summary */
export function generateSummary(text: string, maxLength: number = 300): string {
  if (!text.trim()) return "No text content found in this PDF.";

  const sentences = text.split(/[.!?]+/).filter((s) => s.trim().length > 15);
  if (sentences.length === 0) return text.slice(0, maxLength) + (text.length > maxLength ? "…" : "");

  // Score sentences by position and keyword density
  const stopWords = new Set(["the", "a", "an", "is", "are", "was", "were", "to", "of", "in", "for", "on", "with", "at", "by", "from", "as", "and", "or", "but", "not", "this", "that", "it", "its"]);
  const wordFreq = new Map<string, number>();
  for (const w of text.split(/\s+/)) {
    const c = w.toLowerCase().replace(/[^a-z0-9]/g, "");
    if (c.length > 3 && !stopWords.has(c)) wordFreq.set(c, (wordFreq.get(c) || 0) + 1);
  }

  const scored = sentences.map((s, i) => {
    let score = 0;
    // Position bonus (first sentences tend to be most important)
    if (i < 5) score += 3;
    else if (i < 10) score += 1;
    // Keyword density
    const words = s.toLowerCase().split(/\s+/);
    for (const w of words) {
      const c = w.replace(/[^a-z0-9]/g, "");
      score += (wordFreq.get(c) || 0) * 0.1;
    }
    return { sentence: s.trim(), score, index: i };
  });

  const topSentences = scored
    .sort((a, b) => b.score - a.score)
    .slice(0, 5)
    .sort((a, b) => a.index - b.index);

  let summary = topSentences.map((s) => s.sentence).join(". ") + ".";
  if (summary.length > maxLength) {
    summary = summary.slice(0, maxLength).replace(/\s+\S*$/, "") + "…";
  }
  return summary;
}

/** Search for relevant passages */
export function searchPassages(query: string, text: string, maxResults: number = 5): { passage: string; relevance: number }[] {
  if (!query.trim() || !text.trim()) return [];

  const keywords = query
    .toLowerCase()
    .replace(/[^\w\s]/g, "")
    .split(/\s+/)
    .filter((w) => w.length > 2);

  const sentences = text.split(/[.!?]+/).filter((s) => s.trim().length > 15);
  const results: { passage: string; relevance: number }[] = [];

  for (const s of sentences) {
    const lower = s.toLowerCase();
    let score = 0;
    for (const kw of keywords) {
      const count = (lower.match(new RegExp(kw, "g")) || []).length;
      score += count;
    }
    if (score > 0) {
      results.push({ passage: s.trim(), relevance: score / keywords.length });
    }
  }

  return results.sort((a, b) => b.relevance - a.relevance).slice(0, maxResults);
}
