/**
 * Text Reverser — pure logic.
 */

export type ReverseMode = "chars" | "words" | "lines" | "sentences" | "words-chars" | "preserve-punctuation" | "digits-only" | "letters-only";

export interface ReverseOptions {
  mode: ReverseMode;
  /** Preserve case position (so 'Hello' → 'Olleh' instead of 'olleH'). */
  preserveCasePosition?: boolean;
  /** Skip punctuation when reversing chars. */
  skipPunctuation?: boolean;
}

export interface ReverseResult {
  output: string;
  mode: ReverseMode;
  inputLength: number;
  outputLength: number;
}

const SENTENCE_SPLIT_REGEX = /([.!?]+(?:\s+|$))/g;

export function reverseText(input: string, options: ReverseOptions): ReverseResult | { error: string } {
  if (!input) return { output: "", mode: options.mode, inputLength: 0, outputLength: 0 };
  let output: string;

  switch (options.mode) {
    case "chars":
      output = reverseChars(input, options);
      break;
    case "words":
      output = reverseWords(input);
      break;
    case "lines":
      output = reverseLines(input);
      break;
    case "sentences":
      output = reverseSentences(input);
      break;
    case "words-chars":
      output = reverseWords(input).split(" ").map((w) => reverseChars(w, options)).join(" ");
      break;
    case "preserve-punctuation":
      output = reversePreservePunctuation(input);
      break;
    case "digits-only":
      output = reverseOnlyMatching(input, /\d/);
      break;
    case "letters-only":
      output = reverseOnlyMatching(input, /[a-zA-Z]/);
      break;
    default:
      return { error: `Unknown mode: ${options.mode}` };
  }

  if (options.preserveCasePosition && options.mode !== "preserve-punctuation") {
    output = preserveCasePositionFromInput(input, output);
  }

  return {
    output,
    mode: options.mode,
    inputLength: input.length,
    outputLength: output.length,
  };
}

function reverseChars(s: string, options: ReverseOptions): string {
  if (options.skipPunctuation) {
    // Split into chars, separate non-alphanumeric
    const chars = Array.from(s);
    const alpha = chars.filter((c) => /[a-zA-Z0-9]/.test(c)).reverse();
    let idx = 0;
    return chars.map((c) => /[a-zA-Z0-9]/.test(c) ? alpha[idx++]! : c).join("");
  }
  // Use Array.from to handle surrogate pairs
  return Array.from(s).reverse().join("");
}

function reverseWords(s: string): string {
  // Preserve line structure
  return s.split("\n").map((line) => line.split(/(\s+)/).reverse().join("")).join("\n");
}

function reverseLines(s: string): string {
  return s.split("\n").reverse().join("\n");
}

function reverseSentences(s: string): string {
  // Split keeping the delimiter (punctuation + trailing whitespace)
  const parts = s.split(SENTENCE_SPLIT_REGEX).filter(Boolean);
  // Group sentences with their terminators
  const sentences: string[] = [];
  for (let i = 0; i < parts.length; i += 2) {
    const text = parts[i] ?? "";
    const term = parts[i + 1] ?? "";
    sentences.push(text + term);
  }
  return sentences.reverse().join("");
}

function reversePreservePunctuation(s: string): string {
  // Reverse each word but keep punctuation in original position
  return s.split(/(\s+)/).map((token) => {
    if (/^\s+$/.test(token)) return token;
    const letters = token.split("").filter((c) => /[a-zA-Z]/.test(c));
    letters.reverse();
    let idx = 0;
    return token.split("").map((c) => /[a-zA-Z]/.test(c) ? letters[idx++]! : c).join("");
  }).join("");
}

function reverseOnlyMatching(s: string, regex: RegExp): string {
  const matches = s.match(new RegExp(regex, "g")) ?? [];
  matches.reverse();
  let idx = 0;
  return s.replace(new RegExp(regex, "g"), () => matches[idx++]!);
}

function preserveCasePositionFromInput(input: string, output: string): string {
  // Apply the case pattern of input to output (position-wise)
  const inChars = Array.from(input);
  const outChars = Array.from(output);
  for (let i = 0; i < outChars.length && i < inChars.length; i++) {
    const inChar = inChars[i]!;
    const outChar = outChars[i]!;
    if (inChar === inChar.toUpperCase() && inChar !== inChar.toLowerCase()) {
      outChars[i] = outChar.toUpperCase();
    } else if (inChar === inChar.toLowerCase() && inChar !== inChar.toUpperCase()) {
      outChars[i] = outChar.toLowerCase();
    }
  }
  return outChars.join("");
}

/** Batch mode: one input per line, returns array of outputs. */
export function reverseBatch(inputs: string[], options: ReverseOptions): ReverseResult[] {
  return inputs.map((input) => {
    const r = reverseText(input, options);
    return "error" in r ? { output: "", mode: options.mode, inputLength: input.length, outputLength: 0 } : r;
  });
}

/** Convert batch results to CSV. */
export function batchToCsv(results: ReverseResult[], inputs: string[]): string {
  const lines = ["Input,Output,Mode"];
  for (let i = 0; i < results.length; i++) {
    const r = results[i]!;
    const escapedIn = `"${inputs[i]!.replace(/"/g, '""')}"`;
    const escapedOut = `"${r.output.replace(/"/g, '""')}"`;
    lines.push(`${escapedIn},${escapedOut},${r.mode}`);
  }
  return lines.join("\n");
}
