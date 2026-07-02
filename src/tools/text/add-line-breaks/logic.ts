/**
 * Add Line Breaks — pure logic.
 *
 * Strategies:
 * - wrap: word-wrap at a column width (word-safe or hard-break)
 * - delimiter: insert a break before/after a delimiter string
 * - chars: break every N characters
 * - words: break every N words
 * - sentences: break after each sentence
 *
 * Unicode-safe: uses Intl.Segmenter for grapheme/word/sentence segmentation
 * and an East-Asian-width heuristic for column math.
 */

export type BreakStrategy = "wrap" | "delimiter" | "chars" | "words" | "sentences";

export interface AddLineBreaksOptions {
  strategy: BreakStrategy;
  /** Column width for wrap strategy */
  width: number;
  /** If true, break mid-word when a word exceeds the width */
  hardBreak: boolean;
  /** Delimiter string for delimiter strategy */
  delimiter: string;
  /** Break before or after the delimiter */
  delimiterPosition: "before" | "after";
  /** N for chars/words strategies */
  n: number;
  /** Preserve existing line breaks (true) or treat input as single flow (false) */
  preserveExistingBreaks: boolean;
  /** Trim trailing spaces on each line */
  trimTrailing: boolean;
  /** Collapse multiple blank lines into one */
  collapseBlanks: boolean;
  /** Output line ending */
  lineEnding: "lf" | "crlf";
  /** Indent string applied to each line */
  indent: string;
  /** Hanging indent (applied to all lines after the first) */
  hangingIndent: string;
}

export const DEFAULT_OPTIONS: AddLineBreaksOptions = {
  strategy: "wrap",
  width: 80,
  hardBreak: false,
  delimiter: ", ",
  delimiterPosition: "after",
  n: 5,
  preserveExistingBreaks: true,
  trimTrailing: true,
  collapseBlanks: false,
  lineEnding: "lf",
  indent: "",
  hangingIndent: "",
};

/**
 * Estimate the display width of a grapheme cluster.
 * CJK and wide emoji count as 2 columns; everything else as 1.
 * This is a heuristic — a full East-Asian-width table would be more precise
 * but would add significant weight. This covers the common cases.
 */
export function graphemeWidth(grapheme: string): number {
  // Common CJK Unicode ranges (BMP + a few extensions)
  const code = grapheme.codePointAt(0) ?? 0;
  if (
    (code >= 0x1100 && code <= 0x115f) || // Hangul Jamo
    (code >= 0x2e80 && code <= 0x303e) || // CJK radicals + Kangxi
    (code >= 0x3040 && code <= 0x33bf) || // Hiragana, Katakana, CJK
    (code >= 0x3400 && code <= 0x4dbf) || // CJK Ext A
    (code >= 0x4e00 && code <= 0xa4cf) || // CJK Unified + Yi
    (code >= 0xa960 && code <= 0xa97f) || // Hangul Jamo Extended-A
    (code >= 0xac00 && code <= 0xd7a3) || // Hangul Syllables
    (code >= 0xf900 && code <= 0xfaff) || // CJK Compatibility Ideographs
    (code >= 0xfe30 && code <= 0xfe6f) || // CJK Compatibility Forms
    (code >= 0xff00 && code <= 0xff60) || // Fullwidth Forms
    (code >= 0xffe0 && code <= 0xffe6) || // Fullwidth signs
    (code >= 0x1f300 && code <= 0x1faff) || // Emoji + symbols
    (code >= 0x20000 && code <= 0x3fffd) // CJK Ext B-F
  ) {
    return 2;
  }
  return 1;
}

/**
 * Segment text into grapheme clusters using Intl.Segmenter.
 * Falls back to Array.from (code points) if Intl.Segmenter is unavailable.
 */
export function segmentGraphemes(text: string): string[] {
  if (typeof Intl !== "undefined" && "Segmenter" in Intl) {
    const seg = new Intl.Segmenter("en", { granularity: "grapheme" });
    return Array.from(seg.segment(text), (s) => s.segment);
  }
  return Array.from(text);
}

/**
 * Segment text into words using Intl.Segmenter.
 * Each word includes trailing whitespace so joining preserves spacing.
 */
export function segmentWords(text: string): string[] {
  if (typeof Intl !== "undefined" && "Segmenter" in Intl) {
    const seg = new Intl.Segmenter("en", { granularity: "word" });
    return Array.from(seg.segment(text), (s) => s.segment);
  }
  return text.split(/(\s+)/).filter((s) => s.length > 0);
}

/**
 * Segment text into sentences using Intl.Segmenter.
 */
export function segmentSentences(text: string): string[] {
  if (typeof Intl !== "undefined" && "Segmenter" in Intl) {
    const seg = new Intl.Segmenter("en", { granularity: "sentence" });
    return Array.from(seg.segment(text), (s) => s.segment);
  }
  // Fallback: split on . ! ? followed by space/end
  return text.match(/[^.!?]+[.!?]+|\S[^.!?]*$/g) ?? [text];
}

/**
 * Word-wrap text at a column width, respecting grapheme widths.
 * If hardBreak is false, words longer than width are kept on their own line.
 * If hardBreak is true, words are broken mid-grapheme at the width boundary.
 */
function wrapText(text: string, width: number, hardBreak: boolean): string {
  const lines: string[] = [];
  const paragraphs = text.split(/\n/);

  for (const para of paragraphs) {
    if (para.trim() === "") {
      lines.push("");
      continue;
    }

    const words = para.split(/(\s+)/);
    let currentLine = "";
    let currentWidth = 0;

    for (const word of words) {
      if (word === "") continue;
      if (/^\s+$/.test(word)) {
        // Whitespace — add to line if there's room, else skip (line break handles it)
        if (currentLine !== "" && currentWidth + graphemeWidth(word) <= width) {
          currentLine += word;
          currentWidth += graphemeWidth(word);
        }
        continue;
      }

      const wordWidth = segmentGraphemes(word).reduce((sum, g) => sum + graphemeWidth(g), 0);

      if (currentLine === "") {
        // Starting a new line with this word
        if (wordWidth <= width) {
          currentLine = word;
          currentWidth = wordWidth;
        } else if (hardBreak) {
          // Break the word
          const graphemes = segmentGraphemes(word);
          let chunk = "";
          let chunkWidth = 0;
          for (const g of graphemes) {
            const gw = graphemeWidth(g);
            if (chunkWidth + gw > width && chunk !== "") {
              lines.push(chunk);
              chunk = g;
              chunkWidth = gw;
            } else {
              chunk += g;
              chunkWidth += gw;
            }
          }
          if (chunk !== "") {
            currentLine = chunk;
            currentWidth = chunkWidth;
          }
        } else {
          // Word longer than width, no hard break — put on its own line
          currentLine = word;
          currentWidth = wordWidth;
        }
      } else if (currentWidth + wordWidth <= width) {
        currentLine += word;
        currentWidth += wordWidth;
      } else {
        // Word doesn't fit — flush current line, start new
        lines.push(currentLine);
        if (wordWidth <= width) {
          currentLine = word;
          currentWidth = wordWidth;
        } else if (hardBreak) {
          const graphemes = segmentGraphemes(word);
          let chunk = "";
          let chunkWidth = 0;
          for (const g of graphemes) {
            const gw = graphemeWidth(g);
            if (chunkWidth + gw > width && chunk !== "") {
              lines.push(chunk);
              chunk = g;
              chunkWidth = gw;
            } else {
              chunk += g;
              chunkWidth += gw;
            }
          }
          currentLine = chunk;
          currentWidth = chunkWidth;
        } else {
          currentLine = word;
          currentWidth = wordWidth;
        }
      }
    }
    if (currentLine !== "") lines.push(currentLine);
  }
  return lines.join("\n");
}

/**
 * Main entry point — applies the chosen break strategy to the input text.
 */
export function addLineBreaks(input: string, opts: AddLineBreaksOptions): string {
  if (!input) return "";

  const o = { ...DEFAULT_OPTIONS, ...opts };
  let result = input;

  // Normalize existing line endings to LF
  result = result.replace(/\r\n/g, "\n").replace(/\r/g, "\n");

  if (!o.preserveExistingBreaks) {
    // Collapse existing breaks into spaces (single flow)
    result = result.replace(/\n+/g, " ").replace(/  +/g, " ");
  }

  switch (o.strategy) {
    case "wrap":
      result = wrapText(result, o.width, o.hardBreak);
      break;
    case "delimiter": {
      if (!o.delimiter) break;
      const escaped = o.delimiter.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
      const re = new RegExp(escaped, "g");
      if (o.delimiterPosition === "after") {
        result = result.replace(re, o.delimiter + "\n");
      } else {
        result = result.replace(re, "\n" + o.delimiter);
      }
      break;
    }
    case "chars": {
      const graphemes = segmentGraphemes(result.replace(/\n/g, ""));
      const lines: string[] = [];
      for (let i = 0; i < graphemes.length; i += o.n) {
        lines.push(graphemes.slice(i, i + o.n).join(""));
      }
      result = lines.join("\n");
      break;
    }
    case "words": {
      const words = segmentWords(result.replace(/\n/g, " "));
      // Filter pure-whitespace segments but keep word+space pairs
      const realWords = words.filter((w) => w.trim() !== "");
      const lines: string[] = [];
      for (let i = 0; i < realWords.length; i += o.n) {
        lines.push(realWords.slice(i, i + o.n).join(" "));
      }
      result = lines.join("\n");
      break;
    }
    case "sentences": {
      const sentences = segmentSentences(result.replace(/\n/g, " "));
      result = sentences
        .map((s) => s.trim())
        .filter((s) => s)
        .join("\n");
      break;
    }
  }

  // Post-processing
  let lines = result.split("\n");

  if (o.trimTrailing) {
    lines = lines.map((l) => l.replace(/\s+$/g, ""));
  }
  if (o.collapseBlanks) {
    lines = lines.filter((line, i) => !(line === "" && lines[i - 1] === ""));
  }

  // Apply indent + hanging indent
  if (o.indent || o.hangingIndent) {
    lines = lines.map((line, i) => {
      if (i === 0) return o.indent + line;
      return o.indent + o.hangingIndent + line;
    });
  }

  result = lines.join(o.lineEnding === "crlf" ? "\r\n" : "\n");
  return result;
}
