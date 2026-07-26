/**
 * Tone Analyzer — pure logic.
 *
 * Lightweight, rule-based tone analysis with three axes:
 *   • Formal ↔ Casual   (contractions, slang, emojis, sentence length)
 *   • Positive ↔ Negative (sentiment word lists, intensifiers, negation)
 *   • Confident ↔ Tentative (hedge words, modal verbs, question marks)
 *
 * Each axis returns a score from -100 to +100 where 0 is neutral.
 * The UI can map scores to badges / bars.
 *
 * This is intentionally simple — no NLP model is loaded. For most
 * writing-feedback use cases it gives a useful first approximation.
 */

export interface ToneResult {
  formality: number; // -100 (casual) .. +100 (formal)
  sentiment: number; // -100 (negative) .. +100 (positive)
  confidence: number; // -100 (tentative) .. +100 (confident)
  dominantTone: string;
  labels: {
    formality: string;
    sentiment: string;
    confidence: string;
  };
  metrics: {
    wordCount: number;
    sentenceCount: number;
    avgWordsPerSentence: number;
    contractionCount: number;
    emojiCount: number;
    exclamationCount: number;
    questionCount: number;
    slangCount: number;
    hedgeCount: number;
    positiveWordCount: number;
    negativeWordCount: number;
  };
  matchedWords: {
    positive: string[];
    negative: string[];
    hedges: string[];
    slang: string[];
  };
  warnings: string[];
}

const POSITIVE_WORDS = new Set([
  "good","great","excellent","amazing","wonderful","fantastic","love","loved","loves","best","better","happy","happier","happiest","glad","pleased","delighted","awesome","brilliant","superb","outstanding","perfect","enjoy","enjoyed","enjoyable","positive","benefit","beneficial","success","successful","win","winning","victory","joy","joyful","beautiful","nice","kind","warm","friendly","recommend","recommended","favorite","favourite","impressive","remarkable","exceptional","valuable","helpful","grateful","thank","thanks","thankful","appreciate","appreciated","exciting","excited","thrilled","satisfied","satisfaction","praise","celebrate","celebrated","smile","laugh","laughing",
]);

const NEGATIVE_WORDS = new Set([
  "bad","terrible","horrible","awful","worst","worse","hate","hated","hates","angry","anger","sad","unhappy","disappointed","disappointing","disappointment","frustrated","frustrating","annoyed","annoying","wrong","fail","failed","failure","lose","losing","loss","lost","poor","useless","broken","damage","damaged","harmful","dangerous","threat","threatening","fear","afraid","scared","scary","worry","worried","worried","painful","pain","suffer","suffering","sick","tired","exhausted","boring","bored","dull","stupid","idiotic","ridiculous","pathetic","miserable","depressing","depressed","unpleasant","disgusting","gross","nasty","mean","cruel","harsh","unfair","injustice","complaint","complain","problem","issue","difficult","hard","impossible",
]);

const HEDGE_WORDS = new Set([
  "maybe","perhaps","possibly","probably","likely","might","may","could","would","sort","kind","somewhat","slightly","somewhat","apparently","seemingly","allegedly","supposedly","roughly","around","about","almost","nearly","I","think","believe","guess","feel","assume","suppose","suspect","wonder","consider","suggest",
]);

const SLANG_WORDS = new Set([
  "ok","okay","lol","omg","btw","tbh","imo","idk","yolo","fomo","noob","cool","dude","bro","mate","yeah","nope","gonna","wanna","gotta","kinda","sorta","ya","ya'll","y'all","sup","hi","hey","yo","nah","ugh","meh","btw","fwiw","ICYMI",
]);

const CONTRACTIONS = /\b\w+'(t|re|ve|ll|s|d|m)\b/gi;
const EMOJI = /[\u{1F300}-\u{1FAFF}\u{2600}-\u{27BF}]/gu;
const HEDGE_PHRASES = /\b(I think|I believe|I guess|I feel|I assume|I suppose|I suspect|I wonder|it seems|it appears)\b/gi;

function clamp(n: number, min = -100, max = 100): number {
  return Math.max(min, Math.min(max, n));
}

function tokenize(text: string): string[] {
  return text.toLowerCase().match(/[\p{L}\p{N}']+/gu) ?? [];
}

export function analyzeTone(input: string): ToneResult {
  const warnings: string[] = [];
  const text = input ?? "";
  if (!text.trim()) {
    return emptyResult();
  }

  const tokens = tokenize(text);
  const wordCount = tokens.length;
  const sentences = (text.match(/[^.!?]+[.!?]+/g) ?? []).length || (wordCount > 0 ? 1 : 0);
  const avgWordsPerSentence = sentences > 0 ? wordCount / sentences : 0;

  const contractionMatches = text.match(CONTRACTIONS) ?? [];
  const contractionCount = contractionMatches.length;
  const emojiMatches = text.match(EMOJI) ?? [];
  const emojiCount = emojiMatches.length;
  const exclamationCount = (text.match(/!/g) ?? []).length;
  const questionCount = (text.match(/\?/g) ?? []).length;

  let positiveWordCount = 0;
  let negativeWordCount = 0;
  let hedgeCount = 0;
  let slangCount = 0;
  const matchedPositive: string[] = [];
  const matchedNegative: string[] = [];
  const matchedHedges: string[] = [];
  const matchedSlang: string[] = [];
  for (const t of tokens) {
    if (POSITIVE_WORDS.has(t)) { positiveWordCount++; matchedPositive.push(t); }
    if (NEGATIVE_WORDS.has(t)) { negativeWordCount++; matchedNegative.push(t); }
    if (HEDGE_WORDS.has(t)) { hedgeCount++; matchedHedges.push(t); }
    if (SLANG_WORDS.has(t)) { slangCount++; matchedSlang.push(t); }
  }
  // Multi-word hedge phrases
  const phraseHedges = text.match(HEDGE_PHRASES) ?? [];
  hedgeCount += phraseHedges.length;

  // --- Formality scoring ---
  // Start at 0. Each casual signal pulls negative; formal signals pull positive.
  let formality = 0;
  if (wordCount > 0) {
    formality -= (contractionCount / wordCount) * 800; // contractions are very casual
    formality -= (emojiCount / Math.max(1, wordCount)) * 1500;
    formality -= (slangCount / wordCount) * 600;
    // Longer average sentence length → more formal
    if (avgWordsPerSentence > 15) formality += 25;
    if (avgWordsPerSentence > 25) formality += 25;
    if (avgWordsPerSentence < 8) formality -= 20;
  }
  formality = clamp(formality);

  // --- Sentiment scoring ---
  let sentiment = 0;
  if (wordCount > 0) {
    sentiment += (positiveWordCount / wordCount) * 800;
    sentiment -= (negativeWordCount / wordCount) * 800;
    // Exclamation marks amplify current sentiment direction (mild heuristic)
    if (exclamationCount > 0) {
      sentiment += sentiment >= 0 ? Math.min(15, exclamationCount * 3) : -Math.min(15, exclamationCount * 3);
    }
  }
  sentiment = clamp(sentiment);

  // --- Confidence scoring ---
  let confidence = 0;
  if (wordCount > 0) {
    confidence -= (hedgeCount / wordCount) * 700;
    confidence -= (questionCount / Math.max(1, sentences)) * 30;
    // Modal "will" / "must" / "definitely" → confident
    const confidentMatches = text.match(/\b(will|must|definitely|certainly|absolutely|clearly|obviously|undoubtedly|always|never)\b/gi) ?? [];
    confidence += (confidentMatches.length / wordCount) * 700;
  }
  confidence = clamp(confidence);

  if (wordCount < 5) warnings.push("Very short text — tone analysis may be unreliable.");
  if (sentiment === 0 && positiveWordCount === 0 && negativeWordCount === 0) {
    warnings.push("No clear sentiment words detected.");
  }

  const labels = {
    formality: formality > 25 ? "Formal" : formality < -25 ? "Casual" : "Neutral",
    sentiment: sentiment > 15 ? "Positive" : sentiment < -15 ? "Negative" : "Neutral",
    confidence: confidence > 20 ? "Confident" : confidence < -20 ? "Tentative" : "Balanced",
  };

  const dominantTone = pickDominantTone(labels);

  return {
    formality,
    sentiment,
    confidence,
    dominantTone,
    labels,
    metrics: {
      wordCount,
      sentenceCount: sentences,
      avgWordsPerSentence: Math.round(avgWordsPerSentence * 10) / 10,
      contractionCount,
      emojiCount,
      exclamationCount,
      questionCount,
      slangCount,
      hedgeCount,
      positiveWordCount,
      negativeWordCount,
    },
    matchedWords: {
      positive: dedupe(matchedPositive),
      negative: dedupe(matchedNegative),
      hedges: dedupe(matchedHedges),
      slang: dedupe(matchedSlang),
    },
    warnings,
  };
}

function pickDominantTone(labels: { formality: string; sentiment: string; confidence: string }): string {
  const parts: string[] = [];
  if (labels.sentiment !== "Neutral") parts.push(labels.sentiment);
  if (labels.formality !== "Neutral") parts.push(labels.formality);
  if (labels.confidence !== "Balanced") parts.push(labels.confidence);
  return parts.length ? parts.join(", ") : "Neutral";
}

function dedupe(arr: string[]): string[] {
  return [...new Set(arr)];
}

function emptyResult(): ToneResult {
  return {
    formality: 0,
    sentiment: 0,
    confidence: 0,
    dominantTone: "Unknown",
    labels: { formality: "Neutral", sentiment: "Neutral", confidence: "Balanced" },
    metrics: {
      wordCount: 0, sentenceCount: 0, avgWordsPerSentence: 0,
      contractionCount: 0, emojiCount: 0, exclamationCount: 0, questionCount: 0,
      slangCount: 0, hedgeCount: 0, positiveWordCount: 0, negativeWordCount: 0,
    },
    matchedWords: { positive: [], negative: [], hedges: [], slang: [] },
    warnings: ["No text provided."],
  };
}

/** Format a tone report as plain text. */
export function toneReport(r: ToneResult): string {
  const lines: string[] = [];
  lines.push(`Dominant tone: ${r.dominantTone}`);
  lines.push(`Formality: ${r.formality.toFixed(0)} (${r.labels.formality})`);
  lines.push(`Sentiment: ${r.sentiment.toFixed(0)} (${r.labels.sentiment})`);
  lines.push(`Confidence: ${r.confidence.toFixed(0)} (${r.labels.confidence})`);
  lines.push("");
  lines.push("Metrics:");
  lines.push(`  Words: ${r.metrics.wordCount}`);
  lines.push(`  Sentences: ${r.metrics.sentenceCount}`);
  lines.push(`  Avg words/sentence: ${r.metrics.avgWordsPerSentence}`);
  lines.push(`  Contractions: ${r.metrics.contractionCount}`);
  lines.push(`  Emojis: ${r.metrics.emojiCount}`);
  lines.push(`  Exclamation marks: ${r.metrics.exclamationCount}`);
  lines.push(`  Question marks: ${r.metrics.questionCount}`);
  lines.push(`  Slang words: ${r.metrics.slangCount}`);
  lines.push(`  Hedge words: ${r.metrics.hedgeCount}`);
  lines.push(`  Positive words: ${r.metrics.positiveWordCount}`);
  lines.push(`  Negative words: ${r.metrics.negativeWordCount}`);
  return lines.join("\n");
}
