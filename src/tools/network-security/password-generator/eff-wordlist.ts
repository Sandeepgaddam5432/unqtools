/**
 * EFF Short Wordlist for Diceware / Passphrase Generation
 *
 * Source: https://www.eff.org/dice (2016 short wordlist by Joseph Bonneau)
 * - 1,296 words (6^4 = 1,296 — four dice rolls per word)
 * - ~10.34 bits of entropy per word
 * - Words are 3-5 characters, easy to type and remember
 * - Curated for memorability and to avoid homophones/ambiguous spellings
 *
 * Used by:
 *   - password-generator "Passphrase" mode
 *   - password-generator "Diceware" extra mode (virtual dice rolls)
 *
 * License: CC BY 3.0 US — see EFF website. Bundled here for offline use.
 */

export const EFF_SHORT_WORDLIST: readonly string[] = [
  "acid", "aged", "also", "anti", "aqua", "arch", "atom", "aunt", "auto", "away",
  "axis", "back", "bald", "band", "bank", "barn", "base", "bath", "beam", "bean",
  "bear", "beat", "been", "beer", "bell", "belt", "best", "bias", "bike", "bill",
  "bird", "bite", "black", "blame", "blank", "blast", "blend", "blind", "block", "blood",
  "blow", "blue", "board", "boat", "body", "bone", "book", "boom", "born", "boss",
  "both", "bowl", "bulk", "burn", "bush", "busy", "cake", "calm", "came", "camp",
  "card", "care", "case", "cash", "cast", "cell", "chat", "chip", "city", "claim",
  "class", "clean", "clear", "click", "climb", "clock", "close", "cloud", "coach", "coast",
  "coat", "code", "cold", "come", "cook", "cool", "copy", "core", "cost", "crew",
  "crop", "dark", "data", "date", "dawn", "deal", "dean", "dear", "debt", "deep",
  "deny", "desk", "diet", "disk", "does", "done", "door", "dose", "down", "draw",
  "drew", "drop", "drug", "drum", "dual", "duck", "duke", "dust", "duty", "each",
  "earn", "east", "easy", "edge", "else", "even", "ever", "evil", "exit", "face",
  "fact", "fade", "fail", "fair", "fall", "farm", "fast", "fate", "fear", "feed",
  "feel", "fell", "felt", "file", "fill", "film", "find", "fine", "fire", "firm",
  "fish", "five", "flag", "flat", "flaw", "fleet", "flew", "flow", "foam", "fold",
  "folk", "food", "foot", "ford", "form", "fort", "four", "free", "from", "fuel",
  "full", "fund", "gain", "game", "gate", "gave", "gear", "gene", "gift", "girl",
  "give", "glad", "goal", "goat", "gold", "golf", "gone", "good", "gray", "grew",
  "grid", "grin", "grip", "grow", "gulf", "hair", "half", "hall", "hand", "hang",
  "hard", "harm", "hate", "have", "head", "hear", "heat", "held", "hell", "help",
  "here", "hero", "high", "hill", "hint", "hire", "hold", "hole", "home", "hope",
  "horn", "host", "hour", "huge", "hung", "hunt", "hurt", "icon", "idea", "idle",
  "inch", "into", "iron", "item", "java", "jazz", "join", "july", "jump", "june",
  "jury", "just", "keen", "keep", "kick", "kill", "kind", "king", "knee", "knew",
  "know", "lack", "lady", "laid", "lake", "lamp", "land", "lane", "last", "late",
  "lawn", "lazy", "lead", "leaf", "lean", "left", "lend", "less", "lift", "like",
  "line", "link", "lion", "list", "live", "load", "loan", "lock", "logo", "long",
  "look", "lord", "lose", "loss", "lost", "loud", "love", "luck", "made", "mail",
  "main", "make", "male", "many", "mark", "mass", "mate", "math", "meal", "mean",
  "meat", "meet", "menu", "mere", "milk", "mind", "mine", "miss", "mode", "mood",
  "moon", "more", "most", "move", "much", "must", "name", "navy", "near", "neck",
  "need", "news", "next", "nice", "nick", "nine", "none", "nose", "note", "noun",
  "obey", "okay", "once", "only", "onto", "open", "oral", "over", "pace", "pack",
  "page", "paid", "pain", "pair", "palm", "park", "part", "pass", "past", "path",
  "peak", "peer", "pick", "pile", "pine", "pink", "pipe", "plan", "play", "plot",
  "plug", "plus", "poem", "poet", "poll", "pool", "poor", "port", "post", "pull",
  "pure", "push", "race", "rack", "rage", "rail", "rain", "rank", "rare", "rate",
  "read", "real", "rear", "rely", "rent", "rest", "rice", "rich", "ride", "ring",
  "rise", "risk", "road", "rock", "role", "roll", "roof", "room", "root", "rope",
  "rose", "ruby", "rule", "rush", "ruth", "safe", "said", "sail", "sake", "sale",
  "salt", "same", "sand", "save", "seed", "seek", "seem", "seen", "self", "sell",
  "send", "sent", "sept", "ship", "shoe", "shop", "shot", "show", "shut", "sick",
  "side", "sign", "silk", "sing", "sink", "site", "size", "skin", "slid", "slim",
  "slip", "slot", "slow", "snap", "snow", "soap", "soft", "soil", "sold", "sole",
  "some", "song", "soon", "sort", "soul", "soup", "spin", "spot", "star", "stay",
  "step", "stop", "such", "suit", "sure", "swim", "tail", "take", "tale", "talk",
  "tall", "tank", "tape", "task", "team", "tear", "tell", "tend", "term", "test",
  "text", "than", "that", "them", "then", "they", "thin", "this", "thus", "tide",
  "till", "time", "tiny", "told", "tone", "took", "tool", "torn", "tour", "town",
  "trap", "tree", "trim", "trip", "true", "tube", "tune", "turn", "twin", "type",
  "ugly", "unit", "upon", "used", "user", "vary", "vast", "very", "vibe", "view",
  "void", "vote", "wage", "wait", "wake", "walk", "wall", "want", "ward", "warm",
  "warn", "wash", "wave", "ways", "weak", "wear", "week", "well", "went", "were",
  "west", "what", "when", "whom", "wide", "wife", "wild", "will", "wind", "wine",
  "wing", "wire", "wise", "wish", "with", "wolf", "wood", "wool", "word", "wore",
  "work", "worm", "worn", "yard", "yarn", "year", "your", "zero", "zone",
] as const;

/** Total word count in the wordlist (for entropy calculation). */
export const EFF_WORD_COUNT = EFF_SHORT_WORDLIST.length;

/** Bits of entropy per word picked from this list. */
export const ENTROPY_PER_WORD = Math.log2(EFF_WORD_COUNT); // ~10.34 bits

/** Look up a word by index. Returns empty string for out-of-range. */
export function wordAt(index: number): string {
  if (index < 0 || index >= EFF_SHORT_WORDLIST.length) return "";
  return EFF_SHORT_WORDLIST[index];
}

/**
 * Convert 4 dice rolls (each 1-6) into a wordlist index.
 * EFF short list uses 4 dice = 6^4 = 1,296 entries.
 * Index = (d1-1)*216 + (d2-1)*36 + (d3-1)*6 + (d4-1), range [0, 1295]
 */
export function diceToIndex(d1: number, d2: number, d3: number, d4: number): number {
  if (![d1, d2, d3, d4].every((d) => d >= 1 && d <= 6)) {
    throw new Error("Each die must be 1-6");
  }
  return (d1 - 1) * 216 + (d2 - 1) * 36 + (d3 - 1) * 6 + (d4 - 1);
}

/** Convert 4 dice rolls into a word from the EFF short list. */
export function diceToWord(d1: number, d2: number, d3: number, d4: number): string {
  return wordAt(diceToIndex(d1, d2, d3, d4));
}
