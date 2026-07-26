/**
 * Anagram Solver — pure logic.
 * Letter input, word database, scoring, multi-word, wildcards.
 */

/** Compact word list (3-7 letter common English words). */
export const WORD_LIST: string[] = [
  "cat", "act", "bat", "tab", "rat", "tar", "art", "car", "arc", "dog", "god", "fog", "log", "cog", "got", "tog", "net", "ten", "pet", "let", "get", "set", "met", "bet", "jet", "wet", "yet", "but", "tub", "nut", "tun", "fun", "run", "sun", "gun", "pun", "bun", "cup", "pup", "sup", "mug", "hug", "jug", "rug", "dug", "bug", "pig", "wig", "big", "dig", "fig", "jig", "fit", "sit", "hit", "bit", "kit", "lit", "mit", "pit", "wit", "zip", "tip", "rip", "sip", "hip", "lip", "dip", "kip", "nip",
  "care", "race", "acre", "scar", "cars", "arcs", "star", "rats", "arts", "tars", "tsar", "teas", "seat", "east", "eats", "sate", "etas", "seta", "lets", "lest", "teals", "slate", "stale", "steal", "tales", "leasts", "slates", "stales", "taless", "least", "steal", "tales", "tesla", "alert", "alter", "later", "latte", "tepal", "leapt", "pleat", "plate", "petal", "plead", "pedal", "paled", "plea", "leap", "peal", "pale", "peal", "plea", "leap", "leer", "peer", "reel", "deed", "seed", "feed", "need", "deem", "seem", "seen", "keen", "teen", "deft", "left", "felt", "slow", "owls", "lows", "soul", "loos", "tool", "loot", "tools", "stool", "lots", "slot", "sloe", "sole", "lose", "loves", "slove",
  "stone", "tones", "notes", "onset", "steno", "snote", "toons", "snoot", "snots", "shots", "hosts", "stohs", "shtol", "tolls", "stoll", "sloth", "slots", "toils", "silt", "slit", "list", "tails", "slait", "tisane", "sienna", "senor", "soner", "reins", "resin", "rinse", "siren", "serin", "sinter", "niter", "remit", "timer", "merit", "miter", "reims", "rimes", "risen", "siren", "rines", "serin",
  "stream", "master", "tamers", "maters", "smears", "marses", "reams", "mares", "smear", "marsh", "maths", "smash", "hasty", "hates", "teash", "haunts", "haunt", "aught", "haunt", "taught",
];

export interface AnagramResult {
  word: string;
  score: number;
  isComplete: boolean; // uses all input letters
}

export interface AnagramJob {
  letters: string;
  /** Wildcard character (e.g. "?" or "*"). */
  wildcard: string;
  /** Minimum word length. */
  minLength: number;
  /** Maximum word length (defaults to letters length). */
  maxLength: number;
  /** Allow multi-word anagrams (each word ≥ minLength). */
  multiWord: boolean;
  /** Maximum number of results to return. */
  maxResults: number;
  /** Custom word list (overrides default). */
  customWordList?: string[];
}

export interface AnagramSolution {
  input: AnagramJob;
  results: AnagramResult[];
  multiWordResults: { words: string[]; score: number }[];
  warnings: string[];
  notes: string[];
}

/** Compute a letter frequency map. */
export function letterFreq(word: string): Record<string, number> {
  const out: Record<string, number> = {};
  for (const ch of word.toLowerCase()) {
    if (/[a-z]/.test(ch)) {
      out[ch] = (out[ch] ?? 0) + 1;
    }
  }
  return out;
}

/** Score a word using Scrabble-like tile values. */
export function scoreWord(word: string): number {
  const values: Record<string, number> = {
    a: 1, b: 3, c: 3, d: 2, e: 1, f: 4, g: 2, h: 4, i: 1, j: 8, k: 5, l: 1, m: 3, n: 1,
    o: 1, p: 3, q: 10, r: 1, s: 1, t: 1, u: 1, v: 4, w: 4, x: 8, y: 4, z: 10,
  };
  let score = 0;
  for (const ch of word.toLowerCase()) {
    if (values[ch]) score += values[ch];
  }
  return score;
}

/** Check if a word can be formed from the given letters (with wildcards). */
export function canForm(word: string, letters: string, wildcard: string): boolean {
  const wildChar = wildcard[0] ?? "?";
  const wildCount = ((letters.match(new RegExp(escapeRegex(wildChar), "g")) || []).length) +
    ((wildcard.match(new RegExp(escapeRegex(wildChar), "g")) || []).length);
  const lettersNoWild = letters.replace(new RegExp(escapeRegex(wildChar), "g"), "");
  const have = letterFreq(lettersNoWild);
  const need = letterFreq(word);
  let neededWild = 0;
  for (const [ch, n] of Object.entries(need)) {
    const available = have[ch] ?? 0;
    if (n > available) neededWild += (n - available);
  }
  return neededWild <= wildCount;
}

function escapeRegex(s: string): string {
  return s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

/** Find all anagrams of the given letters from a word list. */
export function findAnagrams(job: AnagramJob): AnagramSolution {
  const warnings: string[] = [];
  const notes: string[] = [];
  const letters = job.letters.toLowerCase().replace(/\s+/g, "");
  if (letters.length === 0) warnings.push("Input letters are empty.");
  if (letters.length > 20) warnings.push("Input has > 20 letters — results may be slow.");

  const wordList = job.customWordList ?? WORD_LIST;
  const seen = new Set<string>();
  const results: AnagramResult[] = [];

  const maxLength = job.maxLength > 0 ? job.maxLength : letters.length;
  const minLength = job.minLength > 0 ? job.minLength : 2;

  for (const word of wordList) {
    const w = word.toLowerCase();
    if (w.length < minLength || w.length > maxLength) continue;
    if (seen.has(w)) continue;
    if (canForm(w, letters, job.wildcard)) {
      seen.add(w);
      results.push({
        word: w,
        score: scoreWord(w),
        isComplete: w.length === letters.replace(new RegExp(escapeRegex(job.wildcard), "g"), "").length,
      });
    }
  }

  results.sort((a, b) => {
    if (b.score !== a.score) return b.score - a.score;
    if (b.word.length !== a.word.length) return b.word.length - a.word.length;
    return a.word.localeCompare(b.word);
  });

  const multiWordResults: { words: string[]; score: number }[] = [];
  if (job.multiWord && letters.length <= 10) {
    // Try 2-word combinations
    const candidates = results.filter((r) => r.word.length >= minLength);
    for (let i = 0; i < Math.min(candidates.length, 50); i++) {
      for (let j = i; j < Math.min(candidates.length, 50); j++) {
        const combo = candidates[i].word + candidates[j].word;
        if (combo.length === letters.replace(new RegExp(escapeRegex(job.wildcard), "g"), "").length && canForm(combo, letters, job.wildcard)) {
          multiWordResults.push({
            words: [candidates[i].word, candidates[j].word],
            score: candidates[i].score + candidates[j].score,
          });
        }
      }
    }
    multiWordResults.sort((a, b) => b.score - a.score);
  }

  if (results.length === 0) notes.push("No anagrams found — try adding wildcards or lowering the minimum length.");
  if (multiWordResults.length > 0) notes.push(`Found ${multiWordResults.length} multi-word anagram(s).`);

  return {
    input: job,
    results: results.slice(0, job.maxResults),
    multiWordResults: multiWordResults.slice(0, job.maxResults),
    warnings, notes,
  };
}

export function findAnagramsBatch(jobs: AnagramJob[]): AnagramSolution[] {
  return jobs.map(findAnagrams);
}

export function renderBatchCsv(solutions: AnagramSolution[]): string {
  const lines: string[] = ["index,input,result_count,top_result,top_score"];
  solutions.forEach((s, i) => {
    const top = s.results[0];
    lines.push([
      String(i + 1), s.input.letters, String(s.results.length),
      top?.word ?? "", String(top?.score ?? 0),
    ].join(","));
  });
  return lines.join("\n");
}

export function renderReport(s: AnagramSolution): string {
  const lines: string[] = [];
  lines.push(`Anagram Solver Report`);
  lines.push(`=====================`);
  lines.push(`Input letters: "${s.input.letters}"`);
  lines.push(`Wildcards: "${s.input.wildcard}"`);
  lines.push(`Length filter: ${s.input.minLength}–${s.input.maxLength || s.input.letters.length}`);
  lines.push(`Results found: ${s.results.length}`);
  lines.push("");
  lines.push("Top anagrams:");
  s.results.slice(0, 20).forEach((r, i) => {
    lines.push(`  ${i + 1}. ${r.word} (score ${r.score}${r.isComplete ? ", complete" : ""})`);
  });
  if (s.multiWordResults.length > 0) {
    lines.push("");
    lines.push("Multi-word anagrams:");
    s.multiWordResults.slice(0, 10).forEach((m, i) => {
      lines.push(`  ${i + 1}. ${m.words.join(" + ")} (score ${m.score})`);
    });
  }
  if (s.warnings.length) { lines.push(""); lines.push("Warnings:"); s.warnings.forEach((w) => lines.push(`  ! ${w}`)); }
  if (s.notes.length) { lines.push(""); lines.push("Notes:"); s.notes.forEach((n) => lines.push(`  • ${n}`)); }
  return lines.join("\n");
}

/** Suggest similar words by edit distance (for hints). */
export function levenshtein(a: string, b: string): number {
  const m = a.length, n = b.length;
  if (m === 0) return n;
  if (n === 0) return m;
  const dp: number[][] = Array.from({ length: m + 1 }, () => new Array(n + 1).fill(0));
  for (let i = 0; i <= m; i++) dp[i][0] = i;
  for (let j = 0; j <= n; j++) dp[0][j] = j;
  for (let i = 1; i <= m; i++) {
    for (let j = 1; j <= n; j++) {
      const cost = a[i - 1] === b[j - 1] ? 0 : 1;
      dp[i][j] = Math.min(dp[i - 1][j] + 1, dp[i][j - 1] + 1, dp[i - 1][j - 1] + cost);
    }
  }
  return dp[m][n];
}

/** Check if a word is a sub-anagram (subset) of letters. */
export function isSubset(word: string, letters: string): boolean {
  const have = letterFreq(letters);
  const need = letterFreq(word);
  for (const [ch, n] of Object.entries(need)) {
    if ((have[ch] ?? 0) < n) return false;
  }
  return true;
}
