/**
 * Text Reverse Words — pure logic. No DOM access.
 *
 * Reverses the word order on each line while preserving whitespace and
 * punctuation attached to words.
 */
export interface ReverseWordsOptions {
  /** Preserve trailing/leading whitespace on each line. */
  preserveEdges: boolean;
  /** Treat punctuation as part of the adjacent word. */
  keepPunctuation: boolean;
}

/** Tokenize a line into words (with optional punctuation) and whitespace gaps. */
export function tokenizeLine(line: string, keepPunctuation: boolean): string[] {
  if (keepPunctuation) {
    // Word = run of non-whitespace; gap = run of whitespace.
    return line.match(/\S+|\s+/g) ?? [];
  }
  // Split words (alphanumeric+punct-attached) and gaps strictly
  return line.match(/[A-Za-z0-9']+|\s+|[^\sA-Za-z0-9']+/g) ?? [];
}

/** Reverse word order on a single line, preserving whitespace runs. */
export function reverseLine(line: string, opts: ReverseWordsOptions): string {
  const tokens = tokenizeLine(line, opts.keepPunctuation);
  const words = tokens.filter((t) => /\S/.test(t));
  const reversed = words.slice().reverse();
  // Re-insert: tokens array contains alternating gap/word; we replace each
  // word slot with the next reversed word.
  let wi = 0;
  const out = tokens.map((t) => (/\S/.test(t) ? reversed[wi++] ?? "" : t));
  let result = out.join("");
  if (!opts.preserveEdges) result = result.trim();
  return result;
}

/** Reverse word order on each line. */
export function reverseWords(input: string, opts: ReverseWordsOptions): string {
  if (!input) return "";
  return input
    .split("\n")
    .map((line) => reverseLine(line, opts))
    .join("\n");
}

/** Default options. */
export const DEFAULT_OPTIONS: ReverseWordsOptions = {
  preserveEdges: true,
  keepPunctuation: true,
};

/** Validate options. */
export function validateOptions(opts: Partial<ReverseWordsOptions>): ReverseWordsOptions {
  return {
    preserveEdges: opts.preserveEdges ?? true,
    keepPunctuation: opts.keepPunctuation ?? true,
  };
}
