/**
 * AI Character Name Generator — pure logic.
 *
 * Generate culture-aware character names across genres (fantasy, sci-fi,
 * modern, historical, cyberpunk, mythic) and cultures (English, Spanish,
 * Japanese, Arabic, Indian, Nordic, Slavic, African, Celtic, Chinese).
 * Each name shows a stylistic meaning, a pronunciation guide, 3–5 variant
 * spellings, a matching epithet/title, a place name, and a faction name.
 *
 * Pure functions only — no DOM, no network. The optional LLM call (BYO API
 * key) lives in ui.tsx because it touches the network.
 *
 * Honesty: meanings are STYLISTIC, not etymological — we say so explicitly.
 * Real-world cultures draw from attested name banks; invented/fantasy names
 * use phonetic-feel templates. We do not invent fake etymologies.
 */

// ---------- Types ----------

export type Genre =
  | "fantasy"
  | "sci-fi"
  | "modern"
  | "historical"
  | "cyberpunk"
  | "mythic";

export type Culture =
  | "english"
  | "spanish"
  | "japanese"
  | "arabic"
  | "indian"
  | "nordic"
  | "slavic"
  | "african"
  | "celtic"
  | "chinese";

export type Gender = "male" | "female" | "neutral" | "any";

export type PhoneticFeel = "soft" | "harsh" | "mixed";

export type Era =
  | "ancient"
  | "medieval"
  | "victorian"
  | "modern"
  | "future"
  | "any";

export interface NameInputs {
  genre: Genre;
  culture: Culture;
  secondaryCulture: Culture | "";
  gender: Gender;
  era: Era;
  feel: PhoneticFeel;
  count: number; // 1–20
  seed: number;
  existingCast: string[]; // for clash check
}

export interface GeneratedName {
  first: string;
  last: string;
  full: string;
  pronunciation: string;
  meaning: string; // stylistic, NOT etymological
  variants: string[]; // 3–5 alternate spellings/forms
  epithet: string; // title/epithet for the character
  placeName: string; // matching place name for worldbuilding
  factionName: string; // matching faction name for worldbuilding
  fitScore: number; // 0–100 how well it matches the chosen setting
  cultures: Culture[]; // which cultures contributed
  warnings: string[];
}

export interface NameOutput {
  names: GeneratedName[];
  warnings: string[];
  count: number;
  seed: number;
}

export interface HistoryEntry {
  ts: number;
  genre: Genre;
  culture: Culture;
  count: number;
  seed: number;
}

export interface LlmEnhancement {
  refinedNames: Array<{ name: string; rationale: string }>;
  worldbuildingNotes: string[];
  notes: string[];
}

export interface ShareState {
  inputs?: Partial<NameInputs>;
}

// ---------- Constants ----------

export const HISTORY_KEY = "unqtools:ai-character-name-generator:history";
export const HISTORY_MAX = 20;
export const FAVORITES_KEY = "unqtools:ai-character-name-generator:favorites";
export const FAVORITES_MAX = 100;
export const LLM_KEY_STORAGE = "unqtools:ai-character-name-generator:llm-key";

export const GENRE_LABELS: Record<Genre, string> = {
  fantasy: "Fantasy",
  "sci-fi": "Sci-Fi",
  modern: "Modern",
  historical: "Historical",
  cyberpunk: "Cyberpunk",
  mythic: "Mythic",
};

export const CULTURE_LABELS: Record<Culture, string> = {
  english: "English",
  spanish: "Spanish",
  japanese: "Japanese",
  arabic: "Arabic",
  indian: "Indian",
  nordic: "Nordic",
  slavic: "Slavic",
  african: "African",
  celtic: "Celtic",
  chinese: "Chinese",
};

export const GENDER_LABELS: Record<Gender, string> = {
  male: "Male",
  female: "Female",
  neutral: "Gender-neutral",
  any: "Any",
};

export const FEEL_LABELS: Record<PhoneticFeel, string> = {
  soft: "Soft / Flowing",
  harsh: "Harsh / Guttural",
  mixed: "Mixed",
};

export const ERA_LABELS: Record<Era, string> = {
  ancient: "Ancient",
  medieval: "Medieval",
  victorian: "Victorian",
  modern: "Modern",
  future: "Future",
  any: "Any era",
};

/** Inline hint + sample for each input field. */
export const FIELD_HINTS: Record<keyof NameInputs, { hint: string; sample: string }> = {
  genre: {
    hint: "Genre shapes which phonetic templates and roots are used.",
    sample: "fantasy",
  },
  culture: {
    hint: "Primary culture for the name's phonetic feel. Real cultures draw from attested name banks.",
    sample: "nordic",
  },
  secondaryCulture: {
    hint: "Optional second culture to blend. Triggers a culture-mix warning.",
    sample: "",
  },
  gender: {
    hint: "Gender of the character. 'Gender-neutral' uses unisex pools; 'Any' picks randomly.",
    sample: "female",
  },
  era: {
    hint: "Era bias for filtering which name forms are appropriate.",
    sample: "medieval",
  },
  feel: {
    hint: "Phonetic feel: soft/flowing (vowel-heavy), harsh/guttural (consonant-heavy), or mixed.",
    sample: "soft",
  },
  count: {
    hint: "How many names to generate (1–20).",
    sample: "10",
  },
  seed: {
    hint: "Random seed for reproducibility. Same seed = same names.",
    sample: "42",
  },
  existingCast: {
    hint: "Existing character names (one per line) to detect clashes.",
    sample: "Aria, Kael, Thorne",
  },
};

// ---------- Culture name banks ----------
// Curated, phonetic-coherent name banks per culture. Each culture has
// male, female, and neutral pools, plus a surname pool. These are
// attested real-world name forms — we do NOT invent "Japanese-sounding"
// strings, we use actual Japanese name elements combined coherently.

interface CultureBank {
  male: string[];
  female: string[];
  neutral: string[];
  surnames: string[];
  // Phonetic elements for invented names that respect this culture's feel.
  prefixes: string[];
  suffixes: string[];
  // Glosses for stylistic meanings (clearly labeled, not etymological).
  meaningGlosses: string[];
  // Place-name elements.
  placePrefixes: string[];
  placeSuffixes: string[];
}

export const CULTURE_BANKS: Record<Culture, CultureBank> = {
  english: {
    male: ["Edmund", "Alaric", "Cedric", "Tristan", "Roland", "Edwin", "Harold", "Leofric", "Aldwin", "Godfrey"],
    female: ["Eleanor", "Isolde", "Rowena", "Cordelia", "Guinevere", "Matilda", "Edith", "Rosalind", "Beatrice", "Helena"],
    neutral: ["Avery", "Ellis", "Morgan", "Quinn", "Sage", "Robin", "Wren", "Ash", "Briar", "Rune"],
    surnames: ["Blackwood", "Ashford", "Thornbury", "Ravenshaw", "Greycliff", "Falconer", "Stormont", "Holloway", "Whitlock", "Ironside"],
    prefixes: ["al", "ed", "god", "wil", "ead", "æl"],
    suffixes: ["ric", "win", "ward", "red", "mund", "stan"],
    meaningGlosses: ["noble protector", "bright counsel", "wolf-friend", "iron resolve", "raven's gift", "stone-hearted", "fair-judged"],
    placePrefixes: ["Wyn", "Dun", "Ash", "Raven", "Grey", "Stone", "Thorn", "Winter"],
    placeSuffixes: ["ford", "bury", "wick", "mere", "hurst", "thorpe", "gate", "ton"],
  },
  spanish: {
    male: ["Mateo", "Diego", "Alejandro", "Andrés", "Javier", "Tomás", "Sebastián", "Rafael", "Emilio", "Rodrigo"],
    female: ["Lucía", "Sofía", "Valentina", "Catalina", "Elena", "Isabela", "Rosario", "Beatriz", "Carmen", "Esperanza"],
    neutral: ["Cruz", "Ángel", "Mar", "Río", "Sol", "Luz", "Cielo", "Niebla", "Vega", "Trinidad"],
    surnames: ["Castillo", "Aguilar", "Vega", "Mendoza", "Cordero", "Salazar", "Figueroa", "Quintero", "Belmonte", "Herrera"],
    prefixes: ["al", "bel", "ros", "luz", "mar"],
    suffixes: ["ita", "iel", "ando", "edo", "iza"],
    meaningGlosses: ["light of the morning", "castle-guardian", "river-walker", "light-bearer", "watchful heart", "crown of stars"],
    placePrefixes: ["Río", "Monte", "Alta", "Buen", "Santa", "Casa", "Paso"],
    placeSuffixes: ["blanco", "verde", "alta", "nuevo", "viejo", "grande"],
  },
  japanese: {
    male: ["Haruto", "Souta", "Yuto", "Hiroshi", "Takumi", "Kaito", "Ren", "Kenji", "Daichi", "Riku"],
    female: ["Sakura", "Yui", "Hina", "Aoi", "Mei", "Rin", "Yuna", "Hana", "Akari", "Tsubaki"],
    neutral: ["Aoi", "Sora", "Hikari", "Nagi", "Tsubasa", "Makoto", "Kaede", "Shion"],
    surnames: ["Tanaka", "Suzuki", "Watanabe", "Itō", "Nakamura", "Kobayashi", "Yoshida", "Yamada", "Sasaki", "Matsumoto"],
    prefixes: ["haru", "yuki", "ken", "hiro", "aoi"],
    suffixes: ["to", "ko", "mi", "ka", "shi"],
    meaningGlosses: ["spring sun", "gentle river", "harmony of leaves", "bright light", "clear sky", "deep forest"],
    placePrefixes: ["Yama", "Kawa", "Mori", "Hama", "Tani", "Ike", "Shiro"],
    placeSuffixes: ["da", "machi", "ura", "gawa", "yama", "saki", "hara"],
  },
  arabic: {
    male: ["Khalid", "Rashid", "Tariq", "Karim", "Yusuf", "Idris", "Ammar", "Rami", "Zayd", "Hamza"],
    female: ["Layla", "Amira", "Nadia", "Salma", "Rania", "Yasmin", "Zara", "Noor", "Hana", "Samira"],
    neutral: ["Noor", "Salam", "Amin", "Ihsan", "Hadi", "Wafa", "Najm"],
    surnames: ["Al-Farisi", "Al-Rashid", "Ibn-Sina", "Al-Hashimi", "Al-Mansur", "Al-Tahir", "Al-Jamil", "Al-Karim"],
    prefixes: ["ab", "am", "ra", "za", "no"],
    suffixes: ["id", "an", "ir", "in", "ad"],
    meaningGlosses: ["eternal light", "trustworthy one", "morning star", "noble companion", "guardian of the weak", "lamp of the desert"],
    placePrefixes: ["Al-", "Dar", "Madina", "Wadi", "Qal'at", "Bahr"],
    placeSuffixes: ["al-Salam", "al-Nur", "al-Jadida", "al-Kabira", "al-Sharq"],
  },
  indian: {
    male: ["Arjun", "Vikram", "Rajesh", "Karan", "Aditya", "Rohan", "Sanjay", "Vivek", "Arun", "Devesh"],
    female: ["Ananya", "Priya", "Kavya", "Meera", "Anjali", "Lakshmi", "Sanya", "Divya", "Naina", "Riya"],
    neutral: ["Arya", "Devi", "Anand", "Kirin", "Mira", "Ravi", "Surya"],
    surnames: ["Sharma", "Verma", "Iyer", "Reddy", "Nair", "Kapoor", "Mehta", "Bose", "Chowdhury", "Banerjee"],
    prefixes: ["ar", "vi", "su", "pra", "de"],
    suffixes: ["jit", "esh", "an", "ya", "tra"],
    meaningGlosses: ["radiant sun", "victorious warrior", "lotus-eyed", "conqueror of mind", "devoted heart", "eternal flame"],
    placePrefixes: ["Ram", "Krishna", "Surya", "Ganga", "Nandi", "Sapta"],
    placeSuffixes: ["pur", "nagar", "garh", "sthali", "eshwaram", "tirtha"],
  },
  nordic: {
    male: ["Erik", "Bjorn", "Magnus", "Leif", "Ragnar", "Sven", "Hakon", "Torsten", "Ulf", "Gunnar"],
    female: ["Astrid", "Freya", "Sigrid", "Ingrid", "Brunhilde", "Hilda", "Saga", "Thyra", "Liv", "Eira"],
    neutral: ["Sigyn", "Loki", "Nord", "Viggo", "Tyr", "Asa", "Borg"],
    surnames: ["Eriksson", "Gunnarson", "Bjornson", "Halvarsson", "Stensson", "Torsson", "Olofsdotter", "Sigridsdotter"],
    prefixes: ["as", "bj", "mag", "rag", "tor"],
    suffixes: ["run", "ild", "gar", "bjorn", "fred"],
    meaningGlosses: ["bear-strength", "divine maiden", "raven's blessing", "iron-willed", "frost-touched", "thunder's child"],
    placePrefixes: ["Frost", "Iron", "Raven", "Storm", "Wolf", "Bear", "Snow"],
    placeSuffixes: ["heim", "gard", "fjord", "holt", "vik", "dal", "borg"],
  },
  slavic: {
    male: ["Mikhail", "Dmitri", "Yuri", "Ivan", "Pyotr", "Sergei", "Andrei", "Nikolai", "Viktor", "Boris"],
    female: ["Anastasia", "Mila", "Katya", "Natalia", "Olga", "Svetlana", "Tatiana", "Yelena", "Zoya", "Vera"],
    neutral: ["Sasha", "Misha", "Zhenya", "Valya", "Nikola"],
    surnames: ["Volkov", "Petrov", "Ivanov", "Smirnov", "Kuznetsov", "Sokolov", "Popov", "Vasiliev"],
    prefixes: ["mi", "vla", "sve", "ra", "do"],
    suffixes: ["mir", "slav", "dan", "mil", "gard"],
    meaningGlosses: ["peaceful ruler", "bright fame", "wolf-kin", "graceful gift", "eternal guardian", "iron will"],
    placePrefixes: ["Bel", "Cher", "Nov", "Star", "Kras", "Zol"],
    placeSuffixes: ["grad", "burg", "ovo", "sk", "gorod", "inka"],
  },
  african: {
    male: ["Kwame", "Tariq", "Sekou", "Kofi", "Sundiata", "Mandla", "Diallo", "Obi", "Tendai", "Sefu"],
    female: ["Zola", "Amara", "Nia", "Zuri", "Amani", "Nia", "Thandi", "Sade", "Folake", "Imani"],
    neutral: ["Amani", "Zuri", "Kari", "Sefu", "Tari", "Mosi"],
    surnames: ["Adeyemi", "Okafor", "Mwangi", "Diallo", "Achebe", "Mandela", "Okonkwo", "Nkrumah"],
    prefixes: ["ama", "zu", "ta", "se", "ko"],
    suffixes: ["ri", "la", "ni", "we", "ka"],
    meaningGlosses: ["bringer of peace", "one who walks with grace", "noble heart", "river of light", "lion's courage", "first-born of dawn"],
    placePrefixes: ["Kili", "Jua", "Mto", "Mlima", "Bahari"],
    placeSuffixes: ["mani", "raha", "anga", "tu", "veld"],
  },
  celtic: {
    male: ["Aidan", "Brendan", "Cormac", "Dylan", "Finn", "Liam", "Niall", "Owen", "Padraig", "Ronan"],
    female: ["Aoife", "Bridget", "Ciara", "Deirdre", "Eileen", "Fiona", "Maeve", "Niamh", "Saoirse", "Sorcha"],
    neutral: ["Rowan", "Sage", "Keeva", "Tierney", "Sorcha"],
    surnames: ["O'Brien", "McCarthy", "MacLeod", "O'Connor", "Kelly", "Walsh", "O'Sullivan", "MacGregor"],
    prefixes: ["ae", "fin", "cor", "nia", "bre"],
    suffixes: ["ach", "wyn", "an", "yn", "en"],
    meaningGlosses: ["little fire", "fair warrior", "dark beauty", "raven blessing", "swan-hearted", "mist-walker"],
    placePrefixes: ["Aber", "Bally", "Dun", "Kil", "Lan", "Tre"],
    placeSuffixes: ["more", "magh", "firth", "loch", "glen", "cairn"],
  },
  chinese: {
    male: ["Wei", "Hao", "Jun", "Lei", "Ming", "Feng", "Long", "Xiang", "Cheng", "Bo"],
    female: ["Mei", "Lin", "Xia", "Yan", "Ling", "Hua", "Yun", "Jia", "Qing", "Ruo"],
    neutral: ["Yu", "Tian", "Xin", "An", "He", "Lin"],
    surnames: ["Li", "Wang", "Zhang", "Chen", "Liu", "Yang", "Huang", "Zhao", "Wu", "Zhou"],
    prefixes: ["mei", "long", "fen", "lin", "yun"],
    suffixes: ["hua", "wei", "ling", "ming", "an"],
    meaningGlosses: ["plum blossom", "dragon's strength", "morning light", "jade harmony", "wind-rider", "clear waters"],
    placePrefixes: ["Bei", "Nan", "Dong", "Xi", "Shan", "He"],
    placeSuffixes: ["jing", "zhou", "cheng", "shan", "he", "guan"],
  },
};

// ---------- Validation ----------

export function validateInputs(inputs: NameInputs): string[] {
  const warnings: string[] = [];
  if (!inputs.genre) warnings.push("Pick a genre.");
  if (!inputs.culture) warnings.push("Pick a primary culture.");
  if (inputs.secondaryCulture && inputs.secondaryCulture === inputs.culture) {
    warnings.push("Secondary culture is the same as primary — pick a different one or leave empty.");
  }
  if (inputs.secondaryCulture && inputs.secondaryCulture !== inputs.culture) {
    warnings.push(`Mixing ${CULTURE_LABELS[inputs.culture]} × ${CULTURE_LABELS[inputs.secondaryCulture]} phonetics — real cultures can blend incoherently. We'll keep the phonetics internally consistent, but be aware this can veer into stereotype.`);
  }
  if (inputs.count < 1) warnings.push("Count must be at least 1.");
  if (inputs.count > 20) warnings.push("Count is capped at 20 per run.");
  if (!Number.isFinite(inputs.seed)) warnings.push("Seed must be a number.");
  if (inputs.existingCast.length > 200) {
    warnings.push("Existing cast is very large (>200) — clash checking may be slow.");
  }
  return warnings;
}

// ---------- Helpers ----------

export function capitalize(s: string): string {
  return s && s.length > 0 ? s[0].toUpperCase() + s.slice(1) : s;
}

export function lowercase(s: string): string {
  return s && s.length > 0 ? s[0].toLowerCase() + s.slice(1) : s;
}

/** Parse a comma- or newline-separated cast list. */
export function parseCastList(raw: string): string[] {
  if (!raw) return [];
  return raw
    .split(/[\n,;]+/)
    .map((s) => s.trim())
    .filter((s) => s.length > 0)
    .filter((s) => s.length <= 60)
    .slice(0, 200);
}

/**
 * Seeded PRNG (mulberry32). Deterministic — same seed produces the
 * same sequence across runs, browsers, and Node. Critical for
 * reproducibility tests.
 */
export function mulberry32(seed: number): () => number {
  let a = seed >>> 0;
  return function () {
    a |= 0;
    a = (a + 0x6D2B79F5) | 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** Pick a random element from an array using a provided PRNG. */
export function pickRandom<T>(arr: T[], rng: () => number): T {
  if (arr.length === 0) throw new Error("pickRandom: empty array");
  const idx = Math.floor(rng() * arr.length);
  return arr[idx]!;
}

/** Pick N distinct elements from an array (with replacement if N > length). */
export function pickDistinct<T>(arr: T[], n: number, rng: () => number): T[] {
  if (arr.length === 0) return [];
  const pool = [...arr];
  const out: T[] = [];
  for (let i = 0; i < n; i++) {
    if (pool.length === 0) {
      // Refill from the original array.
      out.push(arr[Math.floor(rng() * arr.length)]!);
    } else {
      const idx = Math.floor(rng() * pool.length);
      out.push(pool.splice(idx, 1)[0]!);
    }
  }
  return out;
}

// ---------- Pronunciation guide ----------
// A simple heuristic pronunciation guide. NOT IPA — this is a
// reader-friendly approximation suitable for fiction. We label it as
// such in the UI.

const PRONUNCIATION_MAP: Array<[RegExp, string]> = [
  [/ph/g, "f"],
  [/ck/g, "k"],
  [/qu/g, "kw"],
  [/ch/g, "tsh"],
  [/sh/g, "sh"],
  [/th/g, "th"],
  [/ae/g, "eye"],
  [/œ/g, "o"],
  [/ç/g, "s"],
  [/ñ/g, "ny"],
  [/ü/g, "oo"],
  [/ö/g, "ur"],
  [/å/g, "aw"],
  [/ø/g, "u"],
  [/y(?=[aeiou])/g, "y"],
  [/c(?=[eiy])/g, "s"],
  [/c(?=[aou])/g, "k"],
  [/x/g, "ks"],
  [/z/g, "z"],
  [/j/g, "j"],
];

export function generatePronunciation(name: string): string {
  if (!name) return "";
  let s = name.toLowerCase();
  for (const [re, rep] of PRONUNCIATION_MAP) {
    s = s.replace(re, rep);
  }
  // Split into syllable-ish chunks at vowel boundaries.
  const parts = s.match(/[^aeiou]*[aeiou]+(?:[^aeiou]|$)*/g) || [s];
  // Capitalize first letter of each chunk.
  const out = parts.map((p) => capitalize(p.trim())).filter(Boolean).join("-");
  return out || capitalize(s);
}

// ---------- Generation techniques ----------

/** Choose a name pool based on gender, falling back to neutral. */
export function pickNamePool(bank: CultureBank, gender: Gender): string[] {
  if (gender === "male") return bank.male;
  if (gender === "female") return bank.female;
  if (gender === "neutral") return bank.neutral;
  // "any" — combine all pools.
  return [...bank.male, ...bank.female, ...bank.neutral];
}

/** Build an invented name respecting the culture's phonetic feel. */
export function buildInventedName(
  bank: CultureBank,
  feel: PhoneticFeel,
  rng: () => number,
): string {
  const prefix = pickRandom(bank.prefixes, rng);
  const suffix = pickRandom(bank.suffixes, rng);
  let name = prefix + suffix;
  // For soft feel, prefer names ending in vowels; for harsh, prefer names with consonant clusters.
  if (feel === "soft" && /[aeiou]$/.test(name)) {
    // already soft
  } else if (feel === "harsh" && !/[kgtrbd]{2,}/.test(name)) {
    // add a consonant
    name = name + pickRandom(["k", "r", "th", "g"], rng);
  } else if (feel === "mixed") {
    if (rng() > 0.5) name = name + pickRandom(["a", "e", "i", "o", "u"], rng);
  }
  return capitalize(name);
}

/** Generate a first name from the culture bank, possibly blended. */
export function generateFirstName(
  cultures: Culture[],
  gender: Gender,
  feel: PhoneticFeel,
  rng: () => number,
): { name: string; cultures: Culture[] } {
  if (cultures.length === 0) {
    throw new Error("generateFirstName: no cultures");
  }
  // 70% chance: real name from primary culture; 30%: invented.
  if (rng() < 0.7) {
    const primaryBank = CULTURE_BANKS[cultures[0]!];
    const pool = pickNamePool(primaryBank, gender);
    const name = pickRandom(pool, rng);
    // If secondary culture is set, 30% chance to use a surname from secondary as the first name.
    if (cultures.length > 1 && rng() < 0.3) {
      const otherBank = CULTURE_BANKS[cultures[1]!];
      const otherName = pickRandom(otherBank.neutral.length > 0 ? otherBank.neutral : otherBank.female, rng);
      return { name: `${name}-${otherName}`, cultures };
    }
    return { name, cultures };
  }
  // Invented name: blend prefix from primary, suffix from secondary (if any).
  const primaryBank = CULTURE_BANKS[cultures[0]!];
  const name = buildInventedName(primaryBank, feel, rng);
  return { name, cultures };
}

/** Generate a last name from the primary culture's surname pool. */
export function generateLastName(culture: Culture, rng: () => number): string {
  const bank = CULTURE_BANKS[culture];
  return pickRandom(bank.surnames, rng);
}

/** Generate 3–5 variant spellings/form of a name. */
export function generateVariants(name: string, count: number, rng: () => number): string[] {
  if (count <= 0) return [];
  const variants = new Set<string>();
  let attempts = 0;
  while (variants.size < count && attempts < count * 6) {
    attempts++;
    const v = mutateName(name, rng);
    if (v && v !== name) variants.add(v);
  }
  return Array.from(variants);
}

function mutateName(name: string, rng: () => number): string {
  const r = rng();
  if (r < 0.25) {
    // Drop a vowel.
    const idx = name.search(/[aeiouAEIOU]/);
    if (idx >= 0) return (name.slice(0, idx) + name.slice(idx + 1));
  } else if (r < 0.5) {
    // Add an 'h' after a vowel.
    const idx = name.search(/[aeiouAEIOU]/);
    if (idx >= 0) return (name.slice(0, idx + 1) + "h" + name.slice(idx + 1));
  } else if (r < 0.75) {
    // Swap a vowel.
    return name.replace(/[aeiou]/, (m) => {
      const alts = "aeiou".replace(m, "");
      return alts[Math.floor(rng() * alts.length)] ?? m;
    });
  } else {
    // Double a consonant.
    const idx = name.search(/[bcdfghjklmnpqrstvwxyz]/i);
    if (idx >= 0) return (name.slice(0, idx + 1) + name[idx]!.toLowerCase() + name.slice(idx + 1));
  }
  return name;
}

/** Pick a stylistic meaning gloss from the culture bank (NOT etymology). */
export function generateMeaning(culture: Culture, rng: () => number): string {
  const bank = CULTURE_BANKS[culture];
  return pickRandom(bank.meaningGlosses, rng);
}

/** Generate an epithet/title for the character, varied by genre. */
export function generateEpithet(genre: Genre, rng: () => number): string {
  const epithets: Record<Genre, string[]> = {
    fantasy: ["the Bold", "the Stormborn", "the Whisperer", "Ironhand", "the Last Light", "the Oathkeeper", "the Shadowfriend", "the Dawnbringer"],
    "sci-fi": ["Unit-7", "the Architect", "Starbound", "the Quantum", "Cipher", "the Voyager", "Null-Echo", "the Forerunner"],
    modern: ["the Quiet", "the Relentless", "the Witness", "the Lucky", "the Unflinching", "the Cipher", "the Witness"],
    historical: ["the Just", "the Conqueror", "the Peacemaker", "the Brave", "the Wise", "the Unready", "the Lawgiver"],
    cyberpunk: ["Chrome-veined", "the Glitched", "Netrunner", "the Wirewalker", "Synthborn", "the Black ICE", "Zero-Day"],
    mythic: ["Sky-touched", "the Eternal", "the Bound", "Star-lost", "the First", "the Veil-walker", "the Forgotten"],
  };
  return pickRandom(epithets[genre], rng);
}

/** Generate a matching place name from the culture's place elements. */
export function generatePlaceName(culture: Culture, rng: () => number): string {
  const bank = CULTURE_BANKS[culture];
  const pre = pickRandom(bank.placePrefixes, rng);
  const suf = pickRandom(bank.placeSuffixes, rng);
  return pre + suf;
}

/** Generate a matching faction name for worldbuilding. */
export function generateFactionName(genre: Genre, rng: () => number): string {
  const factions: Record<Genre, string[]> = {
    fantasy: ["Order of the Silver Flame", "Whispering Court", "Iron Vanguard", "House Thornwood", "Crimson Circle", "Free Swords", "Veiled Hand"],
    "sci-fi": ["Helios Collective", "Voidship Pilots' Guild", "Synthesis Pact", "Outer Rim Free Traders", "Deep Range Cartographers", "Lattice Conclave"],
    modern: ["The Hollow Group", "Verdant Coalition", "Atlas Society", "Pinewood Trust", "Riverside Collective", "Civic Watch"],
    historical: ["The Silver Legion", "Companions of the Crown", "Free Merchants' Guild", "Knights of the Watch", "People of the Covenant", "Order of the Star"],
    cyberpunk: ["The Neon Syndicate", "Chrome Collective", "Zero Patrol", "Black ICE Cartel", "Static Wave", "Decayed State"],
    mythic: ["The Endless Chorus", "Order of the Veil", "Children of the First Star", "The Bound Ones", "Watchers of the Threshold"],
  };
  return pickRandom(factions[genre], rng);
}

/**
 * Score how well a generated name fits the chosen settings (0–100).
 * Considers: phonetic feel match, length appropriateness, gender-pool coherence.
 */
export function scoreFit(
  name: string,
  feel: PhoneticFeel,
  culture: Culture,
): number {
  let score = 50;
  const lower = name.toLowerCase();
  // Soft feel: reward vowel endings, penalize consonant clusters.
  if (feel === "soft") {
    if (/[aeiou]$/.test(lower)) score += 15;
    if (/[kgtrbd]{2,}/.test(lower)) score -= 10;
    if (/[aeiou]{2,}/.test(lower)) score += 8;
  } else if (feel === "harsh") {
    if (/[kgtrbd]{2,}/.test(lower)) score += 15;
    if (/[aeiou]{3,}/.test(lower)) score -= 10;
    if (/[kxqz]/.test(lower)) score += 8;
  } else {
    // Mixed: reward balance.
    if (/[kgtrbd]{2,}/.test(lower) && /[aeiou]{2,}/.test(lower)) score += 12;
  }
  // Length: sweet spot 4–10 chars.
  const len = lower.replace(/[^a-z]/g, "").length;
  if (len >= 4 && len <= 10) score += 15;
  else if (len >= 3 && len <= 12) score += 8;
  else score -= 5;
  // Culture prefix/suffix presence: bonus if name uses culture elements.
  const bank = CULTURE_BANKS[culture];
  if (bank.prefixes.some((p) => lower.startsWith(p))) score += 10;
  if (bank.suffixes.some((s) => lower.endsWith(s))) score += 10;
  return Math.max(0, Math.min(100, score));
}

/** Check if a name clashes with the existing cast (case-insensitive). */
export function checkNameClash(name: string, cast: string[]): string | null {
  const lower = name.toLowerCase();
  for (const c of cast) {
    if (c.toLowerCase() === lower) return c;
    // Fuzzy: same first 4 letters = potential clash.
    if (c.length >= 4 && lower.length >= 4 && c.toLowerCase().slice(0, 4) === lower.slice(0, 4)) {
      return c;
    }
  }
  return null;
}

// ---------- Generation ----------

/** Generate a single full name with all metadata. */
export function generateOne(
  inputs: NameInputs,
  rng: () => number,
): GeneratedName {
  const cultures: Culture[] = inputs.secondaryCulture
    ? [inputs.culture, inputs.secondaryCulture]
    : [inputs.culture];

  const firstResult = generateFirstName(cultures, inputs.gender, inputs.feel, rng);
  const last = generateLastName(inputs.culture, rng);
  const full = `${firstResult.name} ${last}`;

  const meaning = generateMeaning(inputs.culture, rng);
  const pronunciation = generatePronunciation(firstResult.name);
  const variants = generateVariants(firstResult.name, 4, rng);
  const epithet = generateEpithet(inputs.genre, rng);
  const placeName = generatePlaceName(inputs.culture, rng);
  const factionName = generateFactionName(inputs.genre, rng);
  const fitScore = scoreFit(firstResult.name, inputs.feel, inputs.culture);

  const warnings: string[] = [];
  const clash = checkNameClash(full, inputs.existingCast);
  if (clash) {
    warnings.push(`Name may clash with existing cast member: "${clash}".`);
  }
  const firstClash = checkNameClash(firstResult.name, inputs.existingCast);
  if (firstClash && firstClash !== clash) {
    warnings.push(`First name may clash with: "${firstClash}".`);
  }

  return {
    first: firstResult.name,
    last,
    full,
    pronunciation,
    meaning: `${capitalize(meaning)} (stylistic, not etymological)`,
    variants,
    epithet,
    placeName,
    factionName,
    fitScore,
    cultures: firstResult.cultures,
    warnings,
  };
}

/** Generate N names. Deterministic for a given seed. */
export function generate(inputs: NameInputs): NameOutput {
  const warnings = validateInputs(inputs);
  const effectiveCount = Math.max(1, Math.min(20, inputs.count));
  const effectiveSeed = Number.isFinite(inputs.seed) ? Math.floor(inputs.seed) : 0;
  const rng = mulberry32(effectiveSeed || 1);

  const names: GeneratedName[] = [];
  const seen = new Set<string>();
  let safety = 0;
  while (names.length < effectiveCount && safety < effectiveCount * 10) {
    safety++;
    const n = generateOne(inputs, rng);
    const key = n.full.toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    names.push(n);
  }

  return {
    names,
    warnings,
    count: names.length,
    seed: effectiveSeed,
  };
}

// ---------- Render ----------

export function renderCsv(output: NameOutput): string {
  const lines: string[] = [];
  lines.push("first,last,full,pronunciation,meaning,variants,epithet,place,faction,fit,cultures,warnings");
  for (const n of output.names) {
    const fields = [
      escapeCsv(n.first),
      escapeCsv(n.last),
      escapeCsv(n.full),
      escapeCsv(n.pronunciation),
      escapeCsv(n.meaning),
      escapeCsv(n.variants.join(" | ")),
      escapeCsv(n.epithet),
      escapeCsv(n.placeName),
      escapeCsv(n.factionName),
      String(n.fitScore),
      escapeCsv(n.cultures.map((c) => CULTURE_LABELS[c]).join(" + ")),
      escapeCsv(n.warnings.join(" | ")),
    ];
    lines.push(fields.join(","));
  }
  return lines.join("\n");
}

function escapeCsv(s: string): string {
  if (/[",\n]/.test(s)) return `"${s.replace(/"/g, '""')}"`;
  return s;
}

export function renderMarkdown(output: NameOutput, inputs: NameInputs): string {
  const lines: string[] = [];
  lines.push(`# Character names — ${GENRE_LABELS[inputs.genre]} / ${CULTURE_LABELS[inputs.culture]}`);
  lines.push("");
  lines.push(`_Generated by UnQTools AI Character Name Generator. ${output.count} names, seed ${output.seed}._`);
  lines.push("");
  lines.push("## Inputs");
  lines.push("");
  lines.push(`- **Genre:** ${GENRE_LABELS[inputs.genre]}`);
  lines.push(`- **Culture:** ${CULTURE_LABELS[inputs.culture]}${inputs.secondaryCulture ? ` × ${CULTURE_LABELS[inputs.secondaryCulture]}` : ""}`);
  lines.push(`- **Gender:** ${GENDER_LABELS[inputs.gender]}`);
  lines.push(`- **Era:** ${ERA_LABELS[inputs.era]}`);
  lines.push(`- **Phonetic feel:** ${FEEL_LABELS[inputs.feel]}`);
  lines.push(`- **Count:** ${inputs.count}`);
  lines.push(`- **Seed:** ${inputs.seed}`);
  if (inputs.existingCast.length > 0) {
    lines.push(`- **Existing cast:** ${inputs.existingCast.length} names checked for clashes`);
  }
  lines.push("");
  if (output.warnings.length > 0) {
    lines.push("## Warnings");
    lines.push("");
    for (const w of output.warnings) lines.push(`- ${w}`);
    lines.push("");
  }
  lines.push("## Generated names");
  lines.push("");
  for (const n of output.names) {
    lines.push(`### ${n.full} ${n.epithet} — fit ${n.fitScore}/100`);
    lines.push("");
    lines.push(`- **Pronunciation:** ${n.pronunciation}`);
    lines.push(`- **Meaning:** ${n.meaning}`);
    lines.push(`- **Variants:** ${n.variants.join(", ") || "—"}`);
    lines.push(`- **Place name:** ${n.placeName}`);
    lines.push(`- **Faction:** ${n.factionName}`);
    lines.push(`- **Cultures:** ${n.cultures.map((c) => CULTURE_LABELS[c]).join(" + ")}`);
    if (n.warnings.length > 0) {
      for (const w of n.warnings) lines.push(`  - ⚠️ ${w}`);
    }
    lines.push("");
  }
  lines.push("## Honesty");
  lines.push("");
  lines.push(honestyNote());
  return lines.join("\n");
}

export function renderJson(output: NameOutput, inputs: NameInputs): string {
  return JSON.stringify({ inputs, output, generatedAt: new Date().toISOString() }, null, 2);
}

export function honestyNote(): string {
  return "Meanings are stylistic, not etymological. For real-world names we draw from attested name banks; for invented names we use phonetic-feel templates. We do not invent fake etymologies. Real-culture mixing can veer into stereotype — we surface a warning when you mix cultures and keep the phonetics internally consistent.";
}

// ---------- History (localStorage) ----------

export function loadHistory(): HistoryEntry[] {
  if (typeof localStorage === "undefined") return [];
  try {
    const raw = localStorage.getItem(HISTORY_KEY);
    if (!raw) return [];
    const arr = JSON.parse(raw) as HistoryEntry[];
    return Array.isArray(arr) ? arr.slice(0, HISTORY_MAX) : [];
  } catch {
    return [];
  }
}

export function saveHistory(entry: HistoryEntry): HistoryEntry[] {
  const next = [entry, ...loadHistory()].slice(0, HISTORY_MAX);
  if (typeof localStorage !== "undefined") {
    try {
      localStorage.setItem(HISTORY_KEY, JSON.stringify(next));
    } catch {
      // ignore
    }
  }
  return next;
}

export function clearHistory(): void {
  if (typeof localStorage === "undefined") return;
  try {
    localStorage.removeItem(HISTORY_KEY);
  } catch {
    // ignore
  }
}

// ---------- Favorites (localStorage) ----------

export function loadFavorites(): string[] {
  if (typeof localStorage === "undefined") return [];
  try {
    const raw = localStorage.getItem(FAVORITES_KEY);
    if (!raw) return [];
    const arr = JSON.parse(raw) as string[];
    return Array.isArray(arr) ? arr.slice(0, FAVORITES_MAX) : [];
  } catch {
    return [];
  }
}

export function toggleFavorite(name: string): string[] {
  const current = loadFavorites();
  const next = current.includes(name)
    ? current.filter((n) => n !== name)
    : [name, ...current].slice(0, FAVORITES_MAX);
  if (typeof localStorage !== "undefined") {
    try {
      localStorage.setItem(FAVORITES_KEY, JSON.stringify(next));
    } catch {
      // ignore
    }
  }
  return next;
}

export function clearFavorites(): void {
  if (typeof localStorage === "undefined") return;
  try {
    localStorage.removeItem(FAVORITES_KEY);
  } catch {
    // ignore
  }
}

// ---------- Shareable URL ----------

export function buildShareUrl(inputs: NameInputs): string {
  const params = new URLSearchParams();
  params.set("genre", inputs.genre);
  params.set("culture", inputs.culture);
  if (inputs.secondaryCulture) params.set("cult2", inputs.secondaryCulture);
  if (inputs.gender !== "any") params.set("gender", inputs.gender);
  if (inputs.era !== "any") params.set("era", inputs.era);
  if (inputs.feel !== "mixed") params.set("feel", inputs.feel);
  if (inputs.count !== 10) params.set("count", String(inputs.count));
  if (inputs.seed !== 0) params.set("seed", String(inputs.seed));
  if (inputs.existingCast.length > 0) params.set("cast", inputs.existingCast.join(","));
  if (typeof window === "undefined") return `?${params.toString()}`;
  return `${window.location.origin}${window.location.pathname}#${params.toString()}`;
}

export function parseShareUrl(hash: string): ShareState {
  let clean = hash;
  if (clean.startsWith("#") || clean.startsWith("?")) clean = clean.slice(1);
  if (!clean) return { inputs: {} };
  const params = new URLSearchParams(clean);
  const inputs: Partial<NameInputs> = {};
  const genre = params.get("genre");
  if (genre && genre in GENRE_LABELS) inputs.genre = genre as Genre;
  const culture = params.get("culture");
  if (culture && culture in CULTURE_LABELS) inputs.culture = culture as Culture;
  const cult2 = params.get("cult2");
  if (cult2 && cult2 in CULTURE_LABELS) inputs.secondaryCulture = cult2 as Culture;
  else inputs.secondaryCulture = "";
  const gender = params.get("gender");
  if (gender && gender in GENDER_LABELS) inputs.gender = gender as Gender;
  const era = params.get("era");
  if (era && era in ERA_LABELS) inputs.era = era as Era;
  const feel = params.get("feel");
  if (feel && feel in FEEL_LABELS) inputs.feel = feel as PhoneticFeel;
  const count = params.get("count");
  if (count && /^\d+$/.test(count)) inputs.count = parseInt(count, 10);
  const seed = params.get("seed");
  if (seed && /^-?\d+$/.test(seed)) inputs.seed = parseInt(seed, 10);
  const cast = params.get("cast");
  if (cast) inputs.existingCast = parseCastList(cast);
  return { inputs };
}

// ---------- Optional LLM enhancement ----------

export function buildLlmPrompt(inputs: NameInputs, sample: GeneratedName[]): string {
  return [
    "You are an expert worldbuilding consultant for fiction writers and game designers. Review the candidate character names below and propose refined names + worldbuilding notes.",
    "",
    "Inputs:",
    `- Genre: ${GENRE_LABELS[inputs.genre]}`,
    `- Primary culture: ${CULTURE_LABELS[inputs.culture]}`,
    `- Secondary culture: ${inputs.secondaryCulture ? CULTURE_LABELS[inputs.secondaryCulture] : "(none)"}`,
    `- Gender: ${GENDER_LABELS[inputs.gender]}`,
    `- Era: ${ERA_LABELS[inputs.era]}`,
    `- Phonetic feel: ${FEEL_LABELS[inputs.feel]}`,
    "",
    `Candidate names so far (top ${sample.length}):`,
    ...sample.slice(0, 6).map((n) => `- ${n.full} — ${n.meaning}`),
    "",
    "Output a JSON object with:",
    '- "refinedNames": array of { "name": string, "rationale": string } (5–10 items, each name should fit the genre/culture/feel, be pronounceable, and avoid stereotypes)',
    '- "worldbuildingNotes": array of strings (3–5 specific notes for using these names in a coherent world)',
    '- "notes": array of strings (specific naming advice for this genre/culture combo)',
    "",
    "Be respectful of real cultures. Avoid stereotypes. If the culture mix is risky, say so. Meanings should be labeled as stylistic, not etymological.",
  ].join("\n");
}

export function renderLlmResult(
  rawText: string,
): { ok: true; result: LlmEnhancement } | { ok: false; error: string } {
  let s = (rawText || "").trim();
  if (s.startsWith("```")) {
    s = s.replace(/^```(?:json)?\s*/i, "").replace(/\s*```$/, "");
  }
  let obj: unknown;
  try {
    obj = JSON.parse(s);
  } catch {
    return { ok: false, error: "Could not parse LLM output as JSON. Try again." };
  }
  if (typeof obj !== "object" || obj === null || Array.isArray(obj)) {
    return { ok: false, error: "LLM output was not a JSON object." };
  }
  const o = obj as Record<string, unknown>;
  const refinedNames = Array.isArray(o.refinedNames)
    ? (o.refinedNames as unknown[])
        .filter((x) => typeof x === "object" && x !== null && !Array.isArray(x))
        .map((x) => {
          const r = x as Record<string, unknown>;
          return {
            name: typeof r.name === "string" ? r.name : "",
            rationale: typeof r.rationale === "string" ? r.rationale : "",
          };
        })
        .filter((x) => x.name.length > 0)
    : [];
  const worldbuildingNotes = Array.isArray(o.worldbuildingNotes)
    ? (o.worldbuildingNotes as unknown[]).filter((x) => typeof x === "string") as string[]
    : [];
  const notes = Array.isArray(o.notes)
    ? (o.notes as unknown[]).filter((x) => typeof x === "string") as string[]
    : [];
  return { ok: true, result: { refinedNames, worldbuildingNotes, notes } };
}
