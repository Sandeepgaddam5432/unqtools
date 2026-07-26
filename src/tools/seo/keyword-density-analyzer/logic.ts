/**
 * Keyword Density Analyzer — pure logic.
 * N-gram frequency + density, stop-words, Porter stemmer, position weighting,
 * over-optimization flags, HTML element breakdown.
 *
 * Reference: blueprint §5 (feature set) and §10 (acceptance criteria).
 * 100% client-side, no network.
 */

export type Language = "en" | "es" | "fr" | "de" | "it";

const STOP_WORDS: Record<Language, Set<string>> = {
  en: new Set("a an the and or but if then else for to of in on at by with from as is are was were be been being this that these those it its it's i you he she we they them us our your his her their my me him so not no yes do does did done have has had having will would could should can may might must shall about above after again against all am any because before below between both down during few further here how into just more most nor off other out over own same few than too very what when where which while who whom why".split(/\s+/)),
  es: new Set("el la los las un una unos unas y o u de del a en para por con sin sobre entre desde hasta como es son fue fueron ser estar este esta estos estas ese esa eso eso eso eso eso yo tu el ella nosotros vosotros ellos ellas mi tu su nuestro vuestro su me te se nos os le les lo la al mi tu su mio tuyo suyo".split(/\s+/)),
  fr: new Set("le la les un une des de du a au aux et ou de dans pour par avec sans sur entre depuis comme est sont fut furent etre etre ce cet cette ces celui celle ceux celles il elle nous vous ils elles je tu mon ton son notre votre leur me te se nous vous le la lui leur y en ne pas plus tres".split(/\s+/)),
  de: new Set("der die das ein eine einer eines den dem des und oder aber wenn dann sonst fuer zu von in an auf mit ohne ueber unter zwischen seit wie ist sind war waren sein dieser diese dieses jener jene jenes ich du er sie wir ihr sie mein dein sein unser euer ihr mich dich sich uns euch".split(/\s+/)),
  it: new Set("il lo la i gli le un uno una di del della dei delle a al ai agli alle da dal dai dagli alle in nel nei nelle con col coi sui sugli delle per tra fra e o come che se ma mentre sebbene perche questo questa questi queste quello quella quelli quelle io tu lui lei noi voi loro mi ti si ci vi lo la li le".split(/\s+/)),
};

/** Get a copy of the stop-word set for a language (mutable for editor). */
export function getStopWords(lang: Language): Set<string> {
  return new Set(STOP_WORDS[lang]);
}

export interface AnalyzeOptions {
  language?: Language;
  useStemming?: boolean;
  removeStopWords?: boolean;
  customStopWords?: string[];
  /** Top N results to return per n-gram level. */
  topN?: number;
  /** Threshold (percent) above which a term is flagged as stuffing. */
  stuffingThreshold?: number;
}

export interface NgramEntry {
  term: string;
  count: number;
  density: number;       // percent
  positions: { title?: number; h1?: number; h2?: number; body?: number; anchor?: number };
  weightedScore: number;
  flag: "ok" | "high" | "stuffing";
}

export interface AnalysisResult {
  wordCount: number;
  uniqueWords: number;
  charCount: number;
  fleschScore: number;
  unigrams: NgramEntry[];
  bigrams: NgramEntry[];
  trigrams: NgramEntry[];
  elementCounts: { title: number; h1: number; h2: number; h3: number; body: number; anchor: number };
  flags: string[];
  readingTimeMin: number;
  tokens: string[];
  /** Raw tokens (before stop-word removal) for highlighting. */
  rawTokens: string[];
}

/** Strip HTML to plain text. */
export function stripHtml(html: string): string {
  return html
    .replace(/<script[\s\S]*?<\/script>/gi, "")
    .replace(/<style[\s\S]*?<\/style>/gi, "")
    .replace(/<!--[\s\S]*?-->/g, "")
    .replace(/<[^>]+>/g, " ")
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&[a-z]+;/gi, " ")
    .replace(/\s+/g, " ")
    .trim();
}

/** Extract text within a tag (first occurrence or all). */
export function extractTag(html: string, tag: string): string[] {
  const re = new RegExp(`<${tag}\\b[^>]*>([\\s\\S]*?)<\\/${tag}>`, "gi");
  const out: string[] = [];
  let m: RegExpExecArray | null;
  while ((m = re.exec(html)) !== null) out.push(stripHtml(m[1]!));
  return out;
}

/** Tokenize using Intl.Segmenter (CJK-aware) if available. */
export function tokenize(text: string, language: Language = "en"): string[] {
  const langMap: Record<Language, string> = { en: "en", es: "es", fr: "fr", de: "de", it: "it" };
  const cleaned = text.replace(/[\u0000-\u001f\u007f]/g, " ").replace(/\s+/g, " ").trim();
  if (!cleaned) return [];
  // Try Intl.Segmenter for word boundaries (good for CJK/Thai).
  const Segmenter = (typeof Intl !== "undefined" && (Intl as unknown as { Segmenter?: new (lang: string, opts: { granularity: "word" }) => { segment: (s: string) => Iterable<{ segment: string; isWordLike: boolean }> } }).Segmenter);
  if (Segmenter) {
    try {
      const seg = new Segmenter(langMap[language], { granularity: "word" });
      const out: string[] = [];
      for (const { segment, isWordLike } of seg.segment(cleaned)) {
        if (isWordLike) out.push(segment.toLowerCase());
      }
      return out;
    } catch {
      // fall through
    }
  }
  // Fallback: split on non-letter.
  return cleaned.toLowerCase().split(/[^a-z0-9\u4e00-\u9fff]+/i).map((t) => t.trim()).filter(Boolean);
}

/** Simple Porter-like stemmer for English (lightweight, not full Porter). */
export function stem(word: string, language: Language = "en"): string {
  if (language !== "en") return word.toLowerCase();
  let w = word.toLowerCase();
  if (w.length <= 3) return w;
  // Plural / past tense / progressive endings (simplified).
  w = w.replace(/(ies)$/i, "y");
  w = w.replace(/(sses)$/i, "ss");
  w = w.replace(/(ss)$/i, "ss");          // no-op safety
  w = w.replace(/(ing)$/i, "");
  w = w.replace(/(ed)$/i, "");
  w = w.replace(/(ly)$/i, "");
  w = w.replace(/(ment)$/i, "");
  w = w.replace(/(s)$/i, "");
  return w || word.toLowerCase();
}

/** Build n-grams from tokens. */
export function buildNgrams(tokens: string[], n: number): string[] {
  if (n <= 1 || tokens.length < n) return [];
  const out: string[] = [];
  for (let i = 0; i <= tokens.length - n; i++) out.push(tokens.slice(i, i + n).join(" "));
  return out;
}

/** Flesch reading ease (English approximation). */
export function fleschReadingEase(text: string): number {
  const words = tokenize(text);
  if (words.length === 0) return 0;
  const sentences = text.split(/[.!?]+/).filter((s) => s.trim().length > 0);
  const sentenceCount = Math.max(1, sentences.length);
  let syllables = 0;
  for (const w of words) syllables += countSyllables(w);
  const wordsPerSentence = words.length / sentenceCount;
  const syllablesPerWord = syllables / words.length;
  const score = 206.835 - 1.015 * wordsPerSentence - 84.6 * syllablesPerWord;
  return Math.max(0, Math.min(100, Math.round(score)));
}

export function countSyllables(word: string): number {
  word = word.toLowerCase().replace(/[^a-z]/g, "");
  if (!word) return 0;
  if (word.length <= 3) return 1;
  word = word.replace(/(?:[^laeiouy]es|ed|[^laeiouy]e)$/, "");
  word = word.replace(/^y/, "");
  const m = word.match(/[aeiouy]{1,2}/g);
  return m ? m.length : 1;
}

/** Count n-grams and produce entries with density + flags. */
function countNgrams(
  ngramList: string[],
  total: number,
  positions: Map<string, NgramEntry["positions"]>,
  threshold: number,
  topN: number
): NgramEntry[] {
  const counts = new Map<string, number>();
  for (const g of ngramList) counts.set(g, (counts.get(g) ?? 0) + 1);
  const entries: NgramEntry[] = [];
  for (const [term, count] of counts) {
    const density = total > 0 ? (count / total) * 100 : 0;
    const pos = positions.get(term) ?? {};
    const weightedScore = count * 1 + (pos.title ?? 0) * 3 + (pos.h1 ?? 0) * 2.5 + (pos.h2 ?? 0) * 2 + (pos.anchor ?? 0) * 1.5;
    let flag: NgramEntry["flag"] = "ok";
    if (density >= threshold) flag = "stuffing";
    else if (density >= threshold * 0.6) flag = "high";
    entries.push({ term, count, density, positions: pos, weightedScore, flag });
  }
  entries.sort((a, b) => b.count - a.count || b.weightedScore - a.weightedScore);
  return entries.slice(0, topN);
}

/** Build position map: term → counts per element type. */
function buildPositions(
  titleTokens: string[],
  h1Tokens: string[],
  h2Tokens: string[],
  bodyTokens: string[],
  anchorTokens: string[],
  useStem: boolean,
  language: Language
): Map<string, NgramEntry["positions"]> {
  const map = new Map<string, NgramEntry["positions"]>();
  const add = (tokens: string[], field: keyof NgramEntry["positions"]) => {
    for (const t of tokens) {
      const key = useStem ? stem(t, language) : t;
      if (!map.has(key)) map.set(key, {});
      const pos = map.get(key)!;
      pos[field] = (pos[field] ?? 0) + 1;
    }
  };
  add(titleTokens, "title");
  add(h1Tokens, "h1");
  add(h2Tokens, "h2");
  add(bodyTokens, "body");
  add(anchorTokens, "anchor");
  return map;
}

/** Main entry: analyze text or HTML. */
export function analyzeKeywordDensity(
  input: string,
  options: AnalyzeOptions = {}
): AnalysisResult | { error: string } {
  if (!input.trim()) return { error: "Input text is required." };
  const language = options.language ?? "en";
  const useStem = options.useStemming ?? false;
  const removeStop = options.removeStopWords ?? true;
  const topN = options.topN ?? 30;
  const threshold = options.stuffingThreshold ?? 4;

  const isHtml = /<\/?[a-z][\s\S]*>/i.test(input);
  const html = isHtml ? input : "";
  const text = isHtml ? stripHtml(input) : input;

  const titleText = html ? extractTag(html, "title").join(" ") : "";
  const h1Text = html ? extractTag(html, "h1").join(" ") : "";
  const h2Text = html ? extractTag(html, "h2").join(" ") : "";
  const anchorText = html ? (html.match(/<a\b[^>]*>([\s\S]*?)<\/a>/gi) || []).map((a) => stripHtml(a)).join(" ") : "";

  // Tokenize each region.
  const titleTokens = tokenize(titleText, language);
  const h1Tokens = tokenize(h1Text, language);
  const h2Tokens = tokenize(h2Text, language);
  const anchorTokens = tokenize(anchorText, language);
  const bodyTokens = tokenize(text, language);

  // Combine for overall density.
  const allTokens = [...bodyTokens, ...titleTokens, ...h1Tokens, ...h2Tokens, ...anchorTokens];
  let processedTokens = allTokens;
  const stop = getStopWords(language);
  if (options.customStopWords) for (const w of options.customStopWords) stop.add(w.toLowerCase());
  if (removeStop) processedTokens = allTokens.filter((t) => !stop.has(t.toLowerCase()));
  const finalTokens = useStem ? processedTokens.map((t) => stem(t, language)) : processedTokens;

  const positions = buildPositions(
    useStem ? titleTokens.map((t) => stem(t, language)) : titleTokens,
    useStem ? h1Tokens.map((t) => stem(t, language)) : h1Tokens,
    useStem ? h2Tokens.map((t) => stem(t, language)) : h2Tokens,
    finalTokens,
    useStem ? anchorTokens.map((t) => stem(t, language)) : anchorTokens,
    useStem,
    language
  );

  const unigrams = countNgrams(finalTokens, finalTokens.length, positions, threshold, topN);
  const bigramTokens = buildNgrams(finalTokens, 2);
  const trigramTokens = buildNgrams(finalTokens, 3);
  const bigrams = countNgrams(bigramTokens, bigramTokens.length, new Map(), threshold, topN);
  const trigrams = countNgrams(trigramTokens, trigramTokens.length, new Map(), threshold, topN);

  // Flags.
  const flags: string[] = [];
  const topUnigram = unigrams[0];
  if (topUnigram && topUnigram.flag === "stuffing") {
    flags.push(`"${topUnigram.term}" density ${topUnigram.density.toFixed(2)}% is very high — likely keyword stuffing. Consider using synonyms or related terms.`);
  }
  const highUnigrams = unigrams.filter((u) => u.flag === "high" || u.flag === "stuffing");
  if (highUnigrams.length >= 3) {
    flags.push(`${highUnigrams.length} terms exceed 60% of the stuffing threshold — content may read unnaturally. Aim for natural variation.`);
  }
  if (unigrams.length > 0 && unigrams[0]!.count / Math.max(1, finalTokens.length) > 0.05) {
    flags.push(`Top term "${unigrams[0]!.term}" appears in >5% of tokens — check for over-repetition.`);
  }

  const wordCount = bodyTokens.length;
  const uniqueWords = new Set(finalTokens).size;
  const charCount = text.length;
  const fleschScore = fleschReadingEase(text);
  const readingTimeMin = Math.max(1, Math.round(wordCount / 200));

  return {
    wordCount,
    uniqueWords,
    charCount,
    fleschScore,
    unigrams,
    bigrams,
    trigrams,
    elementCounts: {
      title: titleTokens.length,
      h1: h1Tokens.length,
      h2: h2Tokens.length,
      h3: html ? extractTag(html, "h3").reduce((s, t) => s + tokenize(t, language).length, 0) : 0,
      body: bodyTokens.length,
      anchor: anchorTokens.length,
    },
    flags,
    readingTimeMin,
    tokens: finalTokens,
    rawTokens: bodyTokens,
  };
}

/** Build a CSV export of the analysis. */
export function buildCsv(result: AnalysisResult): string {
  const lines: string[] = ["type,term,count,density,flag"];
  for (const u of result.unigrams) lines.push(`unigram,"${u.term}",${u.count},${u.density.toFixed(2)},${u.flag}`);
  for (const b of result.bigrams) lines.push(`bigram,"${b.term}",${b.count},${b.density.toFixed(2)},${b.flag}`);
  for (const t of result.trigrams) lines.push(`trigram,"${t.term}",${t.count},${t.density.toFixed(2)},${t.flag}`);
  return lines.join("\n");
}

/** Find all occurrences of a term in source text and return char ranges. */
export function findOccurrences(text: string, term: string): { start: number; end: number }[] {
  if (!term) return [];
  const lower = text.toLowerCase();
  const termLower = term.toLowerCase();
  const out: { start: number; end: number }[] = [];
  let idx = lower.indexOf(termLower);
  while (idx !== -1) {
    out.push({ start: idx, end: idx + termLower.length });
    idx = lower.indexOf(termLower, idx + termLower.length);
  }
  return out;
}
