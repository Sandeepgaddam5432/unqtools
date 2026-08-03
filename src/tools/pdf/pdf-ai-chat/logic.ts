/**
 * AI Chat with PDF — pure logic.
 * Extracts text from PDF using pdf-lib and provides keyword-based Q&A search.
 * 100% client-side, no external API needed.
 */

export interface PdfTextExtract {
  ok: true;
  text: string;
  pageCount: number;
  wordsCount: number;
  charsCount: number;
}

export interface PdfError {
  ok: false;
  error: string;
}

export interface QaResult {
  question: string;
  answer: string;
  relevantExcerpt: string;
  confidence: "high" | "medium" | "low";
  pageNumber?: number;
}

/** Extract text from PDF file bytes */
export async function extractPdfText(fileBytes: ArrayBuffer): Promise<PdfTextExtract | PdfError> {
  try {
    const { PDFDocument } = await import("pdf-lib");
    const pdf = await PDFDocument.load(fileBytes);
    const pageCount = pdf.getPageCount();

    // pdf-lib doesn't extract text directly, so we use a simple approach
    // We'll read the raw content and extract visible text strings
    const textParts: string[] = [];

    for (let i = 0; i < pageCount; i++) {
      const page = pdf.getPage(i);
      // Get page dimensions for context
      const { width, height } = page.getSize();
      textParts.push(`[Page ${i + 1} - ${Math.round(width)}x${Math.round(height)}]`);
    }

    // Extract text from raw PDF stream
    const rawText = extractTextFromPdfRaw(fileBytes);
    const fullText = rawText || textParts.join("\n");

    const wordsCount = fullText.split(/\s+/).filter(Boolean).length;
    const charsCount = fullText.length;

    return {
      ok: true,
      text: fullText,
      pageCount,
      wordsCount,
      charsCount,
    };
  } catch (e) {
    return { ok: false, error: `Failed to load PDF: ${e instanceof Error ? e.message : String(e)}` };
  }
}

/** Simple text extraction from PDF raw bytes */
function extractTextFromPdfRaw(buffer: ArrayBuffer): string {
  const bytes = new Uint8Array(buffer);
  const text = new TextDecoder("latin1").decode(bytes);
  const parts: string[] = [];

  // Extract text between BT/ET markers (text objects in PDF)
  const btEtRegex = /BT\s([\s\S]*?)ET/g;
  let match;
  while ((match = btEtRegex.exec(text)) !== null) {
    const content = match[1];
    // Extract strings in parentheses (PDF string literals)
    const stringRegex = /\(([^)]*)\)/g;
    let strMatch;
    while ((strMatch = stringRegex.exec(content)) !== null) {
      const decoded = strMatch[1]
        .replace(/\\n/g, "\n")
        .replace(/\\r/g, "\r")
        .replace(/\\t/g, "\t")
        .replace(/\\\(/g, "(")
        .replace(/\\\)/g, ")")
        .replace(/\\\\/g, "\\");
      if (decoded.trim()) parts.push(decoded);
    }
    // Also extract hex strings
    const hexRegex = /<([0-9A-Fa-f]+)>/g;
    let hexMatch;
    while ((hexMatch = hexRegex.exec(content)) !== null) {
      const hex = hexMatch[1];
      let decoded = "";
      for (let i = 0; i < hex.length; i += 2) {
        const code = parseInt(hex.substring(i, i + 2), 16);
        if (code > 31 && code < 127) decoded += String.fromCharCode(code);
      }
      if (decoded.trim()) parts.push(decoded);
    }
  }

  return parts.join(" ");
}

/** Answer a question about the PDF content using keyword matching */
export function answerQuestion(question: string, pdfText: string): QaResult {
  if (!question.trim()) {
    return { question, answer: "Please enter a question.", relevantExcerpt: "", confidence: "low" };
  }
  if (!pdfText.trim()) {
    return { question, answer: "No PDF content loaded. Please load a PDF first.", relevantExcerpt: "", confidence: "low" };
  }

  // Extract keywords from question (remove common words)
  const stopWords = new Set([
    "what", "is", "the", "a", "an", "in", "on", "at", "to", "for", "of",
    "and", "or", "but", "with", "this", "that", "are", "was", "were", "be",
    "been", "being", "have", "has", "had", "do", "does", "did", "will",
    "would", "could", "should", "may", "might", "can", "how", "when",
    "where", "who", "why", "which", "its", "it", "by", "from", "about",
    "as", "into", "through", "during", "before", "after", "above", "below",
    "tell", "me", "explain", "describe", "summarize", "list", "find",
  ]);

  const questionWords = question
    .toLowerCase()
    .replace(/[^\w\s]/g, "")
    .split(/\s+/)
    .filter((w) => w.length > 2 && !stopWords.has(w));

  if (questionWords.length === 0) {
    // Fall back to full question matching
    const idx = pdfText.toLowerCase().indexOf(question.toLowerCase().slice(0, 30));
    if (idx >= 0) {
      const start = Math.max(0, idx - 100);
      const end = Math.min(pdfText.length, idx + 300);
      const excerpt = pdfText.slice(start, end).trim();
      return {
        question,
        answer: `Found relevant content in the document:`,
        relevantExcerpt: excerpt + (end < pdfText.length ? "…" : ""),
        confidence: "high",
      };
    }
    return {
      question,
      answer: "Could not find relevant content for your question. Try rephrasing with specific terms from the document.",
      relevantExcerpt: "",
      confidence: "low",
    };
  }

  // Split text into sentences for matching
  const sentences = pdfText.split(/[.!?]+/).filter((s) => s.trim().length > 10);

  // Score each sentence by keyword matches
  const scored = sentences.map((sentence, idx) => {
    const lower = sentence.toLowerCase();
    let score = 0;
    for (const kw of questionWords) {
      if (lower.includes(kw)) score += 1;
    }
    // Bonus for consecutive keywords
    for (let i = 0; i < questionWords.length - 1; i++) {
      if (lower.includes(questionWords[i] + " " + questionWords[i + 1])) {
        score += 2;
      }
    }
    return { sentence: sentence.trim(), score, idx };
  });

  const topMatches = scored
    .filter((s) => s.score > 0)
    .sort((a, b) => b.score - a.score)
    .slice(0, 3);

  if (topMatches.length === 0) {
    return {
      question,
      answer: `No direct matches found for keywords: ${questionWords.join(", ")}. The document may use different terminology.`,
      relevantExcerpt: "",
      confidence: "low",
    };
  }

  const confidence = topMatches[0].score >= 3 ? "high" : topMatches[0].score >= 2 ? "medium" : "low";
  const bestExcerpt = topMatches.slice(0, 2).map((m) => m.sentence).join(". ");

  return {
    question,
    answer: `Based on the document, here is relevant information related to "${questionWords.join(", ")}":`,
    relevantExcerpt: bestExcerpt + ".",
    confidence,
  };
}

/** Get summary statistics of the PDF text */
export function getTextStats(text: string) {
  const words = text.split(/\s+/).filter(Boolean);
  const sentences = text.split(/[.!?]+/).filter((s) => s.trim().length > 0);
  const paragraphs = text.split(/\n\n+/).filter((p) => p.trim().length > 0);

  // Most common words (excluding stop words)
  const stopWords = new Set(["the", "a", "an", "is", "are", "was", "were", "be", "been", "being", "have", "has", "had", "do", "does", "did", "will", "would", "could", "should", "may", "might", "can", "to", "of", "in", "for", "on", "with", "at", "by", "from", "as", "into", "through", "and", "or", "but", "not", "this", "that", "it", "its", "which", "who", "when", "where", "how", "all", "each", "every", "both", "few", "more", "most", "other", "some", "such", "no", "nor", "too", "very", "just"]);
  const wordFreq = new Map<string, number>();
  for (const w of words) {
    const clean = w.toLowerCase().replace(/[^a-z0-9]/g, "");
    if (clean.length > 3 && !stopWords.has(clean)) {
      wordFreq.set(clean, (wordFreq.get(clean) || 0) + 1);
    }
  }
  const topWords = Array.from(wordFreq.entries())
    .sort((a, b) => b[1] - a[1])
    .slice(0, 10);

  return {
    words: words.length,
    characters: text.length,
    sentences: sentences.length,
    paragraphs: paragraphs.length,
    avgWordsPerSentence: sentences.length > 0 ? Math.round(words.length / sentences.length) : 0,
    topWords,
  };
}
