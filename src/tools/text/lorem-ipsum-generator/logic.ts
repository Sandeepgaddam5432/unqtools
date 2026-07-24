/**
 * Lorem Ipsum Generator — pure logic.
 */

export type Variant = "lorem-ipsum" | "cicero" | "hipster" | "bacon" | "custom";
export type Unit = "paragraphs" | "sentences" | "words" | "characters";
export type OutputFormat = "text" | "html" | "markdown";

export interface GenerateOptions {
  variant: Variant;
  unit: Unit;
  count: number;
  startWithLorem: boolean;
  minWordsPerSentence: number;
  maxWordsPerSentence: number;
  minSentencesPerParagraph: number;
  maxSentencesPerParagraph: number;
  format: OutputFormat;
  customWords?: string[];
}

export const DEFAULT_OPTIONS: GenerateOptions = {
  variant: "lorem-ipsum",
  unit: "paragraphs",
  count: 3,
  startWithLorem: true,
  minWordsPerSentence: 5,
  maxWordsPerSentence: 15,
  minSentencesPerParagraph: 3,
  maxSentencesPerParagraph: 7,
  format: "text",
};

const LOREM_WORDS = "lorem ipsum dolor sit amet consectetur adipiscing elit sed do eiusmod tempor incididunt ut labore et dolore magna aliqua enim ad minim veniam quis nostrud exercitation ullamco laboris nisi aliquip ex ea commodo consequat duis aute irure in reprehenderit voluptate velit esse cillum eu fugiat nulla pariatur excepteur sint occaecat cupidatat non proident sunt culpa qui officia deserunt mollit anim id est laborum".split(" ");

const CICERO_SENTENCES = [
  "Sed ut perspiciatis unde omnis iste natus error sit voluptatem accusantium doloremque laudantium, totam rem aperiam, eaque ipsa quae ab illo inventore veritatis et quasi architecto beatae vitae dicta sunt explicabo.",
  "Nemo enim ipsam voluptatem quia voluptas sit aspernatur aut odit aut fugit, sed quia consequuntur magni dolores eos qui ratione voluptatem sequi nesciunt.",
  "Neque porro quisquam est, qui dolorem ipsum quia dolor sit amet, consectetur, adipisci velit, sed quia non numquam eius modi tempora incidunt ut labore et dolore magnam aliquam quaerat voluptatem.",
  "Ut enim ad minima veniam, quis nostrum exercitationem ullam corporis suscipit laboriosam, nisi ut aliquid ex ea commodi consequatur.",
  "Quis autem vel eum iure reprehenderit qui in ea voluptate velit esse quam nihil molestiae consequatur, vel illum qui dolorem eum fugiat quo voluptas nulla pariatur.",
  "At vero eos et accusamus et iusto odio dignissimos ducimus qui blanditiis praesentium voluptatum deleniti atque corrupti quos dolores et quas molestias excepturi sint occaecati cupiditate non provident.",
  "Similique sunt in culpa qui officia deserunt mollitia animi, id est laborum et dolorum fuga.",
];

const HIPSTER_WORDS = "artisan craft beer ethical sustainable small batch single-origin coffee cold-pressed pour-over vinyl typewriter mason jar kombucha gentrify fixie bicycle beard flannel organic gluten-free farm-to-table bespoke handmade vintage retro upcycled minimalist hydroponic terrarium succulent air-plant macrame kiln-fired hand-thrown".split(" ");

const BACON_WORDS = "bacon ipsum dolor sit amet flank pork chop ribeye tenderloin andouille jerky pastrami sausage ham hock turkey drumstick pancetta meatball corned beef bresaola prosciutto capicola strip steak short ribs shankle brisket pork loin belly chuck sirloin t-bone filet mignon porchetta rump picanha venison".split(" ");

function getWordPool(variant: Variant, customWords?: string[]): string[] {
  switch (variant) {
    case "cicero": return []; // Special handling — returns pre-written sentences
    case "hipster": return HIPSTER_WORDS;
    case "bacon": return BACON_WORDS;
    case "custom": return customWords?.length ? customWords : LOREM_WORDS;
    case "lorem-ipsum":
    default: return LOREM_WORDS;
  }
}

function randomInt(min: number, max: number): number {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}

function pickRandom<T>(arr: T[]): T {
  return arr[Math.floor(Math.random() * arr.length)]!;
}

function capitalize(s: string): string {
  return s.charAt(0).toUpperCase() + s.slice(1);
}

function generateSentence(words: string[], minWords: number, maxWords: number): string {
  const count = randomInt(minWords, maxWords);
  const sentenceWords: string[] = [];
  for (let i = 0; i < count; i++) {
    sentenceWords.push(pickRandom(words));
  }
  let sentence = sentenceWords.join(" ");
  sentence = capitalize(sentence) + ".";
  return sentence;
}

function generateParagraph(words: string[], options: GenerateOptions): string {
  const sentenceCount = randomInt(options.minSentencesPerParagraph, options.maxSentencesPerParagraph);
  const sentences: string[] = [];
  for (let i = 0; i < sentenceCount; i++) {
    sentences.push(generateSentence(words, options.minWordsPerSentence, options.maxWordsPerSentence));
  }
  return sentences.join(" ");
}

export function generate(options: GenerateOptions): string {
  const words = getWordPool(options.variant, options.customWords);

  // Handle Cicero variant (uses pre-written sentences)
  if (options.variant === "cicero") {
    const sentences: string[] = [];
    let needed = options.count;
    if (options.unit === "paragraphs") {
      const paragraphs: string[] = [];
      for (let i = 0; i < options.count; i++) {
        const sentCount = randomInt(options.minSentencesPerParagraph, options.maxSentencesPerParagraph);
        const paraSentences: string[] = [];
        for (let j = 0; j < sentCount; j++) paraSentences.push(pickRandom(CICERO_SENTENCES));
        paragraphs.push(paraSentences.join(" "));
      }
      return formatOutput(paragraphs, options);
    } else if (options.unit === "sentences") {
      for (let i = 0; i < needed; i++) sentences.push(pickRandom(CICERO_SENTENCES));
      return formatOutput([sentences.join(" ")], options);
    } else {
      // words or characters — fall back to word pool
      return generate({ ...options, variant: "lorem-ipsum" });
    }
  }

  // Handle canonical "Lorem ipsum..." start
  if (options.startWithLorem && options.unit === "paragraphs" && options.count > 0) {
    const paragraphs: string[] = [];
    // First paragraph starts with canonical text
    const canonical = "Lorem ipsum dolor sit amet, consectetur adipiscing elit, sed do eiusmod tempor incididunt ut labore et dolore magna aliqua. Ut enim ad minim veniam, quis nostrud exercitation ullamco laboris nisi ut aliquip ex ea commodo consequat.";
    paragraphs.push(canonical);
    for (let i = 1; i < options.count; i++) {
      paragraphs.push(generateParagraph(words, options));
    }
    return formatOutput(paragraphs, options);
  }

  switch (options.unit) {
    case "paragraphs": {
      const paragraphs: string[] = [];
      for (let i = 0; i < options.count; i++) {
        paragraphs.push(generateParagraph(words, options));
      }
      return formatOutput(paragraphs, options);
    }
    case "sentences": {
      const sentences: string[] = [];
      for (let i = 0; i < options.count; i++) {
        sentences.push(generateSentence(words, options.minWordsPerSentence, options.maxWordsPerSentence));
      }
      return formatOutput([sentences.join(" ")], options);
    }
    case "words": {
      const wordList: string[] = [];
      for (let i = 0; i < options.count; i++) {
        wordList.push(pickRandom(words));
      }
      if (options.startWithLorem && wordList.length >= 2) {
        wordList[0] = "lorem";
        wordList[1] = "ipsum";
      }
      const text = wordList.join(" ");
      return formatOutput([text], options);
    }
    case "characters": {
      let text = "";
      while (text.length < options.count) {
        text += pickRandom(words) + " ";
      }
      text = text.slice(0, options.count);
      // Try to end at a word boundary
      const lastSpace = text.lastIndexOf(" ");
      if (lastSpace > options.count * 0.8) text = text.slice(0, lastSpace);
      return formatOutput([text], options);
    }
    default:
      return "";
  }
}

function formatOutput(paragraphs: string[], options: GenerateOptions): string {
  switch (options.format) {
    case "html":
      return paragraphs.map((p) => `<p>${p}</p>`).join("\n");
    case "markdown":
      return paragraphs.join("\n\n");
    case "text":
    default:
      return paragraphs.join("\n\n");
  }
}

/** Count words in generated text. */
export function countWords(text: string): number {
  return text.split(/\s+/).filter(Boolean).length;
}

/** Count characters in generated text. */
export function countCharacters(text: string, includeSpaces = true): number {
  return includeSpaces ? text.length : text.replace(/\s/g, "").length;
}

/** Count sentences in generated text. */
export function countSentences(text: string): number {
  return (text.match(/[.!?]+/g) ?? []).length;
}
