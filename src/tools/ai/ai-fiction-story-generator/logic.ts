/**
 * AI Fiction Story Generator — pure logic.
 *
 * Generate genre-aware fiction stories from a premise with six-stage plot
 * arc (setup, inciting, rising, climax, falling, resolution). Pure functions
 * only — no DOM, no network. The optional LLM call (BYO API key) lives in
 * ui.tsx because it touches the network.
 */

// ---------- Types ----------

export type Genre = "fantasy" | "sci-fi" | "mystery" | "romance" | "horror";
export type Tone = "light" | "dark" | "comedic" | "dramatic" | "neutral";
export type POV = "first" | "third-limited" | "third-omniscient" | "second";
export type Length = "flash" | "short" | "novelette" | "novella";
export type PlotStage = "setup" | "inciting" | "rising" | "climax" | "falling" | "resolution";

export interface Character {
  name: string;
  role: string;       // e.g. "protagonist", "antagonist", "ally", "mentor"
  description: string;
}

export interface StorySection {
  id: string;
  stage: PlotStage;
  heading: string;
  paragraphs: string[];
  wordEstimate: number;
}

export interface Story {
  title: string;
  premise: string;
  genre: Genre;
  tone: Tone;
  pov: POV;
  length: Length;
  characters: Character[];
  setting: string;
  sections: StorySection[];
  wordCount: number;
  generatedAt: number;
}

export interface StoryBible {
  characters: Character[];
  setting: string;
  themes: string[];
  conflicts: string[];
  plotPoints: string[];
}

export interface Stats {
  totalSections: number;
  totalParagraphs: number;
  totalWords: number;
  totalCharacters: number;
  byStage: Record<PlotStage, number>;
  genreLabel: string;
  toneLabel: string;
  povLabel: string;
}

export interface HistoryEntry {
  ts: number;
  title: string;
  premise: string;
  genre: Genre;
  tone: Tone;
  pov: POV;
  length: Length;
  wordCount: number;
  sectionCount: number;
}

export interface ShareState {
  premise: string;
  genre: Genre;
  tone: Tone;
  pov: POV;
  length: Length;
  setting: string;
  charactersText: string;
}

export interface LlmPrompt {
  system: string;
  user: string;
}

// ---------- Constants ----------

export const HISTORY_KEY = "unqtools:ai-fiction-story-generator:history";
export const HISTORY_MAX = 20;

export const GENRE_LABELS: Record<Genre, string> = {
  fantasy: "Fantasy",
  "sci-fi": "Science Fiction",
  mystery: "Mystery",
  romance: "Romance",
  horror: "Horror",
};

export const TONE_LABELS: Record<Tone, string> = {
  light: "Light",
  dark: "Dark",
  comedic: "Comedic",
  dramatic: "Dramatic",
  neutral: "Neutral",
};

export const POV_LABELS: Record<POV, string> = {
  first: "First person (I)",
  "third-limited": "Third person limited",
  "third-omniscient": "Third person omniscient",
  second: "Second person (you)",
};

export const LENGTH_LABELS: Record<Length, string> = {
  flash: "Flash (~250 words)",
  short: "Short (~750 words)",
  novelette: "Novelette (~1,500 words)",
  novella: "Novella (~3,000 words)",
};

export const LENGTH_TARGETS: Record<Length, number> = {
  flash: 250,
  short: 750,
  novelette: 1500,
  novella: 3000,
};

/** Plot arc stage metadata. */
export const PLOT_STAGES: { stage: PlotStage; label: string; weight: number }[] = [
  { stage: "setup",      label: "Setup",                weight: 0.15 },
  { stage: "inciting",   label: "Inciting Incident",   weight: 0.10 },
  { stage: "rising",     label: "Rising Action",       weight: 0.25 },
  { stage: "climax",     label: "Climax",              weight: 0.20 },
  { stage: "falling",    label: "Falling Action",      weight: 0.15 },
  { stage: "resolution", label: "Resolution",          weight: 0.15 },
];

export const STAGE_LABELS: Record<PlotStage, string> = {
  setup: "Setup",
  inciting: "Inciting Incident",
  rising: "Rising Action",
  climax: "Climax",
  falling: "Falling Action",
  resolution: "Resolution",
};

/** Sample premises per genre. */
export const SAMPLE_PREMISES: Record<Genre, string[]> = {
  fantasy: [
    "An apprentice mage discovers an ancient spellbook that whispers back.",
    "A peasant girl finds a dragon egg in her village's well.",
    "The kingdom's magic is fading and only a forgotten child can restore it.",
  ],
  "sci-fi": [
    "A deep-space colony receives a message from a star that died centuries ago.",
    "An AI maintenance drone wakes up alone on a derelict generation ship.",
    "A physicist invents a machine that can replay any five minutes of the past.",
  ],
  mystery: [
    "A detective is called to a locked-room murder where the victim's will was changed that morning.",
    "The small town's most beloved citizen is found dead and everyone has an alibi.",
    "A cold-case podcaster receives a confession from someone who couldn't have done it.",
  ],
  romance: [
    "Two rival pastry chefs are forced to share a kitchen for a charity bake-off.",
    "A bookshop owner falls for the customer who only buys books she hates.",
    "A stranded traveler and a grumpy lighthouse keeper weather a week-long storm together.",
  ],
  horror: [
    "A family moves into a house where every mirror shows a slightly different room.",
    "A late-night radio host starts receiving calls from listeners who died years ago.",
    "A hiking group finds a cabin in the woods with their own names carved into the door.",
  ],
};

export const STOP_WORDS = new Set<string>([
  "the", "a", "an", "and", "or", "but", "if", "of", "in", "on", "at", "to",
  "for", "with", "is", "was", "are", "were", "be", "been", "do", "does",
  "have", "has", "had", "will", "would", "should", "this", "that", "it",
  "as", "by", "from", "into", "onto",
]);

/** Genre-specific plot beats per stage. Each beat is a paragraph template. */
interface GenreTemplates {
  titleHints: string[];
  setupOpeners: string[];
  incitingOpeners: string[];
  risingOpeners: string[];
  climaxOpeners: string[];
  fallingOpeners: string[];
  resolutionOpeners: string[];
  settings: string[];
  themes: string[];
  conflicts: string[];
}

export const GENRE_TEMPLATES: Record<Genre, GenreTemplates> = {
  fantasy: {
    titleHints: [
      "The {NOUN} of {PLACE}",
      "Whispers of the {ADJ} {NOUN}",
      "The Last {NOUN}",
      "Crown of {PLACE}",
    ],
    setupOpeners: [
      "In the kingdom of {setting}, where magic flowed like rivers through ancient stone, {protagonist} lived an ordinary life — or so it seemed.",
      "The land of {setting} had known peace for a thousand years, but {protagonist} had always felt the old legends tugging at the edges of their dreams.",
      "Magic in {setting} came with a price, and {protagonist} had spent their life avoiding the cost.",
    ],
    incitingOpeners: [
      "Everything changed the day a stranger arrived at {setting} bearing a broken sword and a desperate plea.",
      "When the wards around {setting} began to fail, {protagonist} was the only one who could see the cracks.",
      "The night the stars fell, {protagonist} knew the legends had chosen them.",
    ],
    risingOpeners: [
      "{protagonist} gathered what allies they could — a disgraced knight, a hedge-witch, a thief with a price on their head — and set out across {setting}.",
      "The road from {setting} wound through cursed woods and forgotten ruins, and at each turn {protagonist} learned a little more of what they were up against.",
      "Old secrets surfaced. {protagonist} discovered that the threat they faced was older than the kingdom itself.",
    ],
    climaxOpeners: [
      "At the heart of the corrupted citadel, {protagonist} confronted the source of the darkness — and recognized a face they had not expected.",
      "The final battle was not fought with swords alone; {protagonist} had to choose between two impossible truths.",
      "When the moment came, {protagonist} raised the ancient blade and spoke a name no living tongue had uttered in a thousand years.",
    ],
    fallingOpeners: [
      "The dust settled over {setting}, and {protagonist} began the long work of what came after.",
      "Wounded but alive, {protagonist} carried the cost of victory back through the ruined gates of {setting}.",
      "In the silence that followed, {protagonist} understood what the legends had meant all along.",
    ],
    resolutionOpeners: [
      "{setting} healed slowly, and {protagonist} — no longer the person they had been — watched a new age dawn.",
      "The bards would sing of {protagonist} for centuries, but the truth of what happened that day belonged only to them.",
      "And so, in the kingdom of {setting}, a new legend was born — one that {protagonist} would never tell the same way twice.",
    ],
    settings: ["the kingdom of Aerith", "the floating city of Solandria", "the moss-bound realm of Vael", "the dragon-guarded highlands of Tor"],
    themes: ["the cost of power", "loyalty beyond blood", "the weight of prophecy", "tradition versus change"],
    conflicts: ["a forgotten evil waking beneath the throne", "a succession war fracturing the realm", "an ancient oath finally coming due"],
  },
  "sci-fi": {
    titleHints: [
      "Signal from {PLACE}",
      "The {NOUN} Protocol",
      "Beyond the {ADJ} Horizon",
      "{NOUN} Drift",
    ],
    setupOpeners: [
      "Aboard the long-haul freighter drifting past {setting}, {protagonist} maintained the schedule the way their grandparents had — by hand, by habit, by faith.",
      "In the colony of {setting}, far from the light of any sun that had a name, {protagonist} monitored the deep-space array and waited for messages that never came.",
      "The station at {setting} ran on routines older than any of its crew, and {protagonist} had learned to trust the routines more than the people.",
    ],
    incitingOpeners: [
      "Then the array lit up with a transmission from a star that had died three hundred years before.",
      "The routine broke when a maintenance drone returned from the outer hull carrying something that should not have been there.",
      "It started, as these things often do, with a single reading that did not match the model.",
    ],
    risingOpeners: [
      "{protagonist} pulled at the thread of the anomaly until the whole fabric of {setting} began to unravel.",
      "What they found in the deep records of {setting} contradicted every history they had been taught.",
      "Allies became suspects; suspects became something else entirely. {protagonist} stopped sleeping.",
    ],
    climaxOpeners: [
      "In the silent core of the station, {protagonist} faced the truth the founders of {setting} had buried.",
      "The choice was stark: broadcast what they knew and shatter the colony, or carry the secret to their grave.",
      "When the alarm finally sounded, {protagonist} was already running — but toward what, they could no longer say.",
    ],
    fallingOpeners: [
      "After the airlocks sealed and the lights came back on, {protagonist} sat alone in the observation deck and watched {setting} drift on.",
      "The colony's surviving council met in emergency session, and {protagonist} told them everything.",
      "Slowly, the routines of {setting} resumed — but they were different routines now, with {protagonist} at their center.",
    ],
    resolutionOpeners: [
      "{setting} would never be the same, and neither would {protagonist}; some truths, once learned, cannot be unlearned.",
      "The transmission from the dead star went on repeating, and {protagonist} stayed to listen — for as long as it took.",
      "In the end, the colony of {setting} did not save itself. {protagonist} did.",
    ],
    settings: ["the Kepler-186f relay", "the Titan-orbit research platform Meridian", "the long-haul freighter Indigo Spur", "the derelict colony at Theta-7"],
    themes: ["the limits of human knowledge", "loyalty under pressure", "the ethics of discovery", "isolation and survival"],
    conflicts: ["a signal that should not exist", "an AI waking up with the wrong memories", "a corporation covering up a fatal design flaw"],
  },
  mystery: {
    titleHints: [
      "The {PLACE} Affair",
      "Death at {PLACE}",
      "The {ADJ} {NOUN}",
      "A Question of {NOUN}",
    ],
    setupOpeners: [
      "Detective {protagonist} had seen a hundred crime scenes, but the one waiting at {setting} was unlike any of them.",
      "The morning paper at {setting} announced the death before the body was even found. {protagonist} read it twice.",
      "When {protagonist} arrived at {setting}, the guests were still in the drawing room, pretending nothing had happened.",
    ],
    incitingOpeners: [
      "The first body was found in a locked room. The second, before {protagonist} could finish interviewing the staff.",
      "Everyone at {setting} had an alibi. Everyone at {setting} had a motive. {protagonist} did not believe in coincidence.",
      "The victim's will had been changed that morning, and {protagonist} had a list of six people who knew it.",
    ],
    risingOpeners: [
      "{protagonist} interviewed each guest in turn, and each interview left them with more questions than they'd started with.",
      "The forensic reports came back wrong in three different ways, and {protagonist} began to suspect the case had been built to fail.",
      "A second disappearance, a missing page from the household ledger, an overheard phone call — the threads multiplied, and {protagonist} followed each one.",
    ],
    climaxOpeners: [
      "When {protagonist} gathered everyone in the library, they already knew who had done it. What they didn't know was why everyone else was lying.",
      "The killer made one mistake — one small, devastating mistake — and {protagonist} was there to catch it.",
      "In the empty parlor of {setting}, {protagonist} laid out the truth, piece by piece, and watched the room realize what it meant.",
    ],
    fallingOpeners: [
      "The arrest was almost an afterthought. {protagonist} had known the answer since the third interview.",
      "After the confession, {protagonist} sat alone in the {setting} library and tried to understand what had broken inside the killer.",
      "The case closed, but {protagonist} filed it under unsolved — not in law, but in their own mind.",
    ],
    resolutionOpeners: [
      "{setting} reopened its doors within the year, but the staff who remembered preferred not to speak of that week.",
      "{protagonist} wrote the case up in their notebook, closed it, and poured a drink. Tomorrow there would be another body, another room, another lie.",
      "The truth, when it finally came out, was quieter than anyone had expected — and far worse.",
    ],
    settings: ["the Briarwood estate", "the tide-locked village of Mallowport", "the riverside penthouse of the Halberd Hotel", "the secluded writer's retreat at Foxglove Lodge"],
    themes: ["the unreliability of memory", "the corrupting weight of secrets", "justice versus mercy", "appearance versus reality"],
    conflicts: ["a locked-room murder with no weapon", "a confession that doesn't fit the facts", "a victim who was hated by everyone who knew them"],
  },
  romance: {
    titleHints: [
      "A Recipe for {NOUN}",
      "The {ADJ} {NOUN}",
      "Letters from {PLACE}",
      "Between {NOUN} and {NOUN}",
    ],
    setupOpeners: [
      "{protagonist} had not come to {setting} looking for anything — and certainly not for {love_interest}, who seemed determined to be disagreeable from the very first morning.",
      "If you had told {protagonist} a week ago that they would be sharing a kitchen at {setting} with {love_interest}, they would have laughed. Or cried. Possibly both.",
      "{setting} was supposed to be quiet, ordinary, exactly what {protagonist} needed. Then {love_interest} walked in.",
    ],
    incitingOpeners: [
      "The first time {protagonist} and {love_interest} agreed on anything, the kitchen nearly caught fire. The second time, {protagonist} began to wonder if maybe — just maybe — they were not so insufferable after all.",
      "It started with a stolen glance over a half-folded napkin, and by the end of the evening {protagonist} couldn't stop thinking about {love_interest}'s hands.",
      "They argued about everything. Then, one quiet evening, they argued about nothing at all — and that was when {protagonist} knew.",
    ],
    risingOpeners: [
      "Days at {setting} blurred into evenings, and evenings into the kind of conversations that {protagonist} had not had in years.",
      "Their friends noticed before they did. Their friends said nothing, and waited.",
      "Every time {protagonist} thought they understood {love_interest}, something would shift — a smile, a silence, a half-finished sentence — and they would have to start over.",
    ],
    climaxOpeners: [
      "On the night the storm finally broke over {setting}, {protagonist} stood at {love_interest}'s door with a thousand things to say, and no words for any of them.",
      "The misunderstanding was ordinary — the kind that happens a hundred times — but this time it mattered, and they both knew it.",
      "What {protagonist} said next, they had not planned. What {love_interest} said back, they had been holding for weeks.",
    ],
    fallingOpeners: [
      "After the words had been spoken and the silence that followed had finally softened, {protagonist} and {love_interest} sat together at {setting} and watched the rain move on.",
      "It was not, in the end, a grand gesture that brought them back together. It was a cup of tea, made exactly the way {protagonist} liked it.",
      "They argued again the next morning about something small, and they both laughed, and that was when they knew it would be all right.",
    ],
    resolutionOpeners: [
      "{setting} would close for the season in two weeks, but {protagonist} and {love_interest} had already agreed on a different plan.",
      "Some people, {protagonist} decided, you do not meet by accident. Some people you are sent to find.",
      "And so, between one ordinary evening and the next, two lives that had been moving in parallel quietly began to braid together — and {protagonist} could not, for the life of them, stop smiling.",
    ],
    settings: ["the seafront bakery at Saltmere", "the second-hand bookshop on Linden Street", "the lighthouse at Cape Maren", "the candle-lit trattoria above the harbor"],
    themes: ["vulnerability and trust", "the courage to begin again", "small kindnesses", "the ordinary magic of daily life"],
    conflicts: ["a rivalry neither of them asked for", "a past neither of them has quite escaped", "a deadline that will take them in opposite directions"],
  },
  horror: {
    titleHints: [
      "The {NOUN} in {PLACE}",
      "What Lives at {PLACE}",
      "The {ADJ} Hours",
      "{NOUN} No More",
    ],
    setupOpeners: [
      "The house at {setting} had been empty for eleven years when {protagonist}'s family moved in. The realtor had not mentioned the mirrors.",
      "{protagonist} did not believe in ghosts when they took the night-shift job at {setting}. They did, by the end of the first week.",
      "There were three rules posted at the entrance to {setting}. {protagonist} broke the first one before sundown.",
    ],
    incitingOpeners: [
      "It began with the mirrors. By the second night, {protagonist} understood that the room reflected back was not, exactly, their own.",
      "The first call came at 3:07 a.m. The voice on the other end identified itself as a listener who had died at {setting} in 1974. Then it asked {protagonist} a question they had never told anyone.",
      "{protagonist} found their own name carved into the door of the cabin at {setting}, along with a date — that evening's date.",
    ],
    risingOpeners: [
      "Sleep stopped being safe. {protagonist} started recording everything, and the recordings said things the room had not.",
      "Every door in {setting} now opened onto a hallway that should not have been there. {protagonist} stopped opening doors.",
      "The thing at {setting} wanted something. {protagonist} was beginning to understand what.",
    ],
    climaxOpeners: [
      "When {protagonist} finally saw it — really saw it — they understood why no one who had stayed at {setting} had ever been the same.",
      "There was no escape from {setting}; {protagonist} had known that for days. What they had not known was that they were not alone in wanting to leave.",
      "The choice was simple, and it was not a choice at all: {protagonist} could open the door, or they could become the door.",
    ],
    fallingOpeners: [
      "Dawn came to {setting} eventually, gray and reluctant, and {protagonist} — what was left of them — walked out into it.",
      "The house at {setting} was quiet at last. {protagonist} tried not to think about what they had paid for that quiet.",
      "When the police arrived the next morning, they found {setting} empty. They did not find {protagonist}.",
    ],
    resolutionOpeners: [
      "{protagonist} never spoke of what happened at {setting}, and the house stood empty for another eleven years — until the next family moved in.",
      "Some nights, in the new apartment, {protagonist} still heard the mirror in the hallway ticking softly, like a clock counting down to something they had not yet done.",
      "And the house at {setting} waited, the way it always waited, patient as winter, for the next one who would break the first rule.",
    ],
    settings: ["the Holloway house on Greer Lane", "the abandoned WREN listening station at Beacon Hill", "the lake cabin at Stillwater", "the condemned children's hospital on Violet Street"],
    themes: ["the unbearable weight of memory", "what waits in silence", "the cost of curiosity", "the unreliability of the senses"],
    conflicts: ["a presence that wants to be seen", "a family curse coming due", "a door that should have stayed closed"],
  },
};

// ---------- Helpers ----------

/** Normalize whitespace in a premise. */
export function normalizePremise(s: string): string {
  return (s || "").replace(/\s+/g, " ").trim();
}

/** Normalize the setting string. */
export function normalizeSetting(s: string | undefined | null): string {
  return (s ?? "").replace(/\s+/g, " ").trim();
}

/** Parse a multi-line characters input into Character[].
 * Format: one character per line, optional "Name | role | description". */
export function parseCharacters(input: string): Character[] {
  if (!input) return [];
  const lines = input.split(/\n+/).map((l) => l.trim()).filter(Boolean);
  const out: Character[] = [];
  for (const line of lines) {
    const parts = line.split("|").map((p) => p.trim());
    if (parts.length === 0) continue;
    const name = parts[0] || "Unnamed";
    const role = parts[1] || (out.length === 0 ? "protagonist" : "supporting");
    const description = parts[2] || "";
    out.push({ name, role, description });
  }
  return out;
}

/** Render a Character[] back to the multi-line text format. */
export function renderCharacters(chars: Character[]): string {
  return chars.map((c) => `${c.name} | ${c.role} | ${c.description}`.trim()).join("\n");
}

/** Extract keywords (lowercase) from a string, filtering stop words. */
export function extractKeywords(s: string): string[] {
  if (!s) return [];
  const out: string[] = [];
  const seen = new Set<string>();
  const words = s.toLowerCase().match(/[a-z0-9]{2,}/g) ?? [];
  for (const w of words) {
    if (STOP_WORDS.has(w)) continue;
    if (w.length < 2) continue;
    if (seen.has(w)) continue;
    seen.add(w);
    out.push(w);
  }
  return out;
}

/** Detect the most likely genre from premise keywords. */
export function detectGenre(premise: string): Genre {
  const p = (premise || "").toLowerCase();
  if (!p) return "fantasy";
  const keywords: Record<Genre, string[]> = {
    fantasy: ["dragon", "magic", "wizard", "kingdom", "sword", "spell", "quest", "elf", "king", "queen", "prophecy", "realm"],
    "sci-fi": ["space", "star", "ship", "ai", "robot", "alien", "colony", "future", "planet", "station", "android", "quantum", "machine"],
    mystery: ["detective", "murder", "body", "killed", "crime", "suspect", "case", "witness", "alibi", "clue", "police", "investigator"],
    romance: ["love", "kiss", "wedding", "rival", "heart", "flirt", "date", "relationship", "romance", "crush", "ex", "marriage"],
    horror: ["ghost", "haunted", "house", "monster", "dark", "fear", "blood", "dead", "died", "evil", "curse", "nightmare", "shadow"],
  };
  let best: Genre = "fantasy";
  let bestScore = 0;
  for (const g of Object.keys(keywords) as Genre[]) {
    let score = 0;
    for (const k of keywords[g]) {
      if (p.includes(k)) score += 1;
    }
    if (score > bestScore) {
      bestScore = score;
      best = g;
    }
  }
  return best;
}

/** Pull a noun (longest non-stopword) from a string — used for title templates. */
export function pickNoun(s: string): string {
  const kw = extractKeywords(s);
  if (kw.length === 0) return "Story";
  // Prefer the longest keyword (often the most specific noun).
  return kw.slice().sort((a, b) => b.length - a.length)[0]!;
}

/** Pull an adjective (any keyword ending with common adjective suffixes). */
export function pickAdjective(s: string): string {
  const kw = extractKeywords(s);
  const adj = kw.find((w) => /(ous|ful|less|able|ible|ic|ive|al|ant|ent)$/.test(w));
  return adj ?? (kw[0] ?? "Hidden");
}

/** Capitalize the first letter. */
function cap(s: string): string {
  if (!s) return "";
  return s.charAt(0).toUpperCase() + s.slice(1);
}

/** Title-case a phrase. */
export function titleCase(s: string): string {
  if (!s) return "";
  return s.split(/\s+/).map((w) => cap(w)).join(" ");
}

/** Generate a title from the premise + setting. */
export function generateTitle(premise: string, setting: string, genre: Genre): string {
  const templates = GENRE_TEMPLATES[genre].titleHints;
  const tpl = templates[Math.floor(Math.random() * templates.length)] ?? "The {NOUN} of {PLACE}";
  const noun = cap(pickNoun(premise || setting || "Story"));
  const adj = cap(pickAdjective(premise || setting || ""));
  const place = cap(pickNoun(setting || premise || "Nowhere"));
  return tpl
    .replace("{NOUN}", noun)
    .replace("{ADJ}", adj)
    .replace("{PLACE}", place);
}

/** Get the protagonist name from characters (or fall back). */
export function getProtagonistName(chars: Character[]): string {
  const proto = chars.find((c) => /protagonist|hero|main/i.test(c.role));
  return proto?.name ?? chars[0]?.name ?? "the protagonist";
}

/** Get a secondary character name (love interest / antagonist / ally). */
export function getSecondaryName(chars: Character[], genre: Genre): string {
  if (genre === "romance") {
    const li = chars.find((c) => /love|interest|partner|rival/i.test(c.role));
    if (li) return li.name;
  }
  const ant = chars.find((c) => /antagonist|villain|enemy/i.test(c.role));
  if (ant) return ant.name;
  const ally = chars.find((c) => /ally|friend|sidekick|mentor/i.test(c.role));
  if (ally) return ally.name;
  return chars[1]?.name ?? "the stranger";
}

/** Fill a template string with protagonist / setting / love_interest placeholders. */
export function fillTemplate(
  tpl: string,
  ctx: { protagonist: string; loveInterest: string; setting: string },
): string {
  return tpl
    .replace(/\{protagonist\}/g, ctx.protagonist)
    .replace(/\{love_interest\}/g, ctx.loveInterest)
    .replace(/\{setting\}/g, ctx.setting);
}

/** Pick a random element from an array (deterministic if seed given). */
export function pick<T>(arr: T[], seed?: number): T {
  if (arr.length === 0) throw new Error("pick from empty array");
  if (seed === undefined) return arr[Math.floor(Math.random() * arr.length)]!;
  return arr[seed % arr.length]!;
}

/** Adjust prose tone — wraps a sentence with tone-appropriate flavor. */
export function applyTone(text: string, tone: Tone): string {
  if (tone === "comedic") {
    // Light comedic flavor: occasional self-aware aside.
    if (Math.random() < 0.3) {
      return `${text} (Which, in retrospect, was probably the moment everything started going sideways.)`;
    }
    return text;
  }
  if (tone === "dark") {
    if (Math.random() < 0.3) {
      return `${text} There was no comfort in any of it, and none coming.`;
    }
    return text;
  }
  if (tone === "light") {
    if (Math.random() < 0.3) {
      return `${text} It was, for once, a good day.`;
    }
    return text;
  }
  if (tone === "dramatic") {
    if (Math.random() < 0.3) {
      return `${text} Nothing, after this, would ever be the same.`;
    }
    return text;
  }
  return text;
}

/** Apply POV adjustments to a paragraph — pronoun rewrites for first/second person. */
export function applyPov(text: string, pov: POV, protagonist: string): string {
  if (pov === "first") {
    return text
      .replace(new RegExp(`\\b${escapeRegex(protagonist)}\\b`, "g"), "I")
      .replace(/\btheir\b/gi, "my")
      .replace(/\bthem\b/gi, "me")
      .replace(/\bthey were\b/gi, "I was")
      .replace(/\bthey\b/gi, "I");
  }
  if (pov === "second") {
    return text
      .replace(new RegExp(`\\b${escapeRegex(protagonist)}\\b`, "g"), "you")
      .replace(/\btheir\b/gi, "your")
      .replace(/\bthem\b/gi, "you")
      .replace(/\bthey were\b/gi, "you were")
      .replace(/\bthey\b/gi, "you");
  }
  return text;
}

function escapeRegex(s: string): string {
  return s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

/** Split a long paragraph into sentences. */
export function splitSentences(text: string): string[] {
  if (!text) return [];
  return text
    .replace(/\s+/g, " ")
    .split(/(?<=[.!?])\s+(?=[A-Z0-9"'`(])/)
    .map((s) => s.trim())
    .filter((s) => s.length > 0);
}

/** Count words in a string. */
export function countWords(s: string): number {
  if (!s) return 0;
  return s.split(/\s+/).filter(Boolean).length;
}

let idCounter = 0;
function nextId(): string {
  idCounter += 1;
  return `sec-${idCounter}-${Math.random().toString(36).slice(2, 8)}`;
}

/** Reset the internal id counter (for deterministic tests). */
export function resetIdCounter(): void {
  idCounter = 0;
}

/** Estimate word count for a stage based on its weight and total target. */
export function estimateStageWords(weight: number, totalWords: number): number {
  return Math.max(30, Math.round(weight * totalWords));
}

// ---------- Story generation ----------

export interface GenerateOptions {
  tone?: Tone;
  pov?: POV;
  length?: Length;
  setting?: string;
  characters?: Character[];
  title?: string;
}

/** Generate one paragraph for a plot stage. */
export function generateStageParagraph(
  stage: PlotStage,
  genre: Genre,
  ctx: { protagonist: string; loveInterest: string; setting: string },
  tone: Tone,
  pov: POV,
): string {
  const templates = GENRE_TEMPLATES[genre];
  const openerMap: Record<PlotStage, string[]> = {
    setup: templates.setupOpeners,
    inciting: templates.incitingOpeners,
    rising: templates.risingOpeners,
    climax: templates.climaxOpeners,
    falling: templates.fallingOpeners,
    resolution: templates.resolutionOpeners,
  };
  const openers = openerMap[stage];
  const tpl = openers[Math.floor(Math.random() * openers.length)] ?? openers[0]!;
  let para = fillTemplate(tpl, ctx);
  para = applyTone(para, tone);
  para = applyPov(para, pov, ctx.protagonist);
  return para;
}

/** Generate one full section (1–3 paragraphs based on length). */
export function generateSection(
  stage: PlotStage,
  genre: Genre,
  ctx: { protagonist: string; loveInterest: string; setting: string },
  tone: Tone,
  pov: POV,
  length: Length,
): StorySection {
  const target = LENGTH_TARGETS[length];
  const weight = PLOT_STAGES.find((p) => p.stage === stage)?.weight ?? 0.15;
  const wordEstimate = estimateStageWords(weight, target);
  // Number of paragraphs scales with target word count.
  const paraCount = Math.max(1, Math.min(4, Math.round(wordEstimate / 120)));
  const paragraphs: string[] = [];
  for (let i = 0; i < paraCount; i++) {
    paragraphs.push(generateStageParagraph(stage, genre, ctx, tone, pov));
  }
  return {
    id: nextId(),
    stage,
    heading: STAGE_LABELS[stage],
    paragraphs,
    wordEstimate,
  };
}

/** Generate a complete story from a premise + options. */
export function generateStory(premise: string, genre: Genre, opts: GenerateOptions = {}): Story {
  const p = normalizePremise(premise);
  const tone = opts.tone ?? "neutral";
  const pov = opts.pov ?? "third-limited";
  const length = opts.length ?? "short";
  const chars = opts.characters ?? [];
  const setting = normalizeSetting(opts.setting) || pick(GENRE_TEMPLATES[genre].settings);
  const protagonist = getProtagonistName(chars);
  const loveInterest = getSecondaryName(chars, genre);
  const ctx = { protagonist, loveInterest, setting };
  const title = opts.title || generateTitle(p || setting, setting, genre);

  const sections: StorySection[] = PLOT_STAGES.map((s) =>
    generateSection(s.stage, genre, ctx, tone, pov, length),
  );

  const wordCount = sections.reduce(
    (a, s) => a + s.paragraphs.reduce((b, p) => b + countWords(p), 0),
    0,
  );

  return {
    title,
    premise: p,
    genre,
    tone,
    pov,
    length,
    characters: chars,
    setting,
    sections,
    wordCount,
    generatedAt: Date.now(),
  };
}

/** Build a story-bible from a story. */
export function generateStoryBible(story: Story): StoryBible {
  const templates = GENRE_TEMPLATES[story.genre];
  const themes = templates.themes.slice(0, 2);
  const conflicts = templates.conflicts.slice(0, 1);
  const plotPoints = story.sections.map((s) => `${s.heading}: ${s.paragraphs[0] ?? ""}`.trim());
  return {
    characters: story.characters,
    setting: story.setting,
    themes,
    conflicts,
    plotPoints,
  };
}

/** Append a continuation paragraph to a section's prose. */
export function continueStory(story: Story, sectionId: string): Story {
  const idx = story.sections.findIndex((s) => s.id === sectionId);
  if (idx < 0) return story;
  const sec = story.sections[idx]!;
  const ctx = {
    protagonist: getProtagonistName(story.characters),
    loveInterest: getSecondaryName(story.characters, story.genre),
    setting: story.setting,
  };
  const para = generateStageParagraph(sec.stage, story.genre, ctx, story.tone, story.pov);
  const nextSec: StorySection = {
    ...sec,
    paragraphs: [...sec.paragraphs, para],
  };
  const sections = story.sections.slice();
  sections[idx] = nextSec;
  const wordCount = sections.reduce(
    (a, s) => a + s.paragraphs.reduce((b, p) => b + countWords(p), 0),
    0,
  );
  return { ...story, sections, wordCount, generatedAt: Date.now() };
}

/** Regenerate a section (re-roll the template beats and prose). */
export function regenerateSection(story: Story, sectionId: string): Story {
  const idx = story.sections.findIndex((s) => s.id === sectionId);
  if (idx < 0) return story;
  const ctx = {
    protagonist: getProtagonistName(story.characters),
    loveInterest: getSecondaryName(story.characters, story.genre),
    setting: story.setting,
  };
  const nextSec = generateSection(story.sections[idx]!.stage, story.genre, ctx, story.tone, story.pov, story.length);
  // Preserve the original id so UI keys stay stable.
  nextSec.id = story.sections[idx]!.id;
  const sections = story.sections.slice();
  sections[idx] = nextSec;
  const wordCount = sections.reduce(
    (a, s) => a + s.paragraphs.reduce((b, p) => b + countWords(p), 0),
    0,
  );
  return { ...story, sections, wordCount, generatedAt: Date.now() };
}

/** Expand a section: add one more paragraph (same as continue but semantics differ). */
export function expandSection(story: Story, sectionId: string): Story {
  return continueStory(story, sectionId);
}

/** Compute stats for a story. */
export function computeStats(story: Story): Stats {
  const byStage: Record<PlotStage, number> = {
    setup: 0, inciting: 0, rising: 0, climax: 0, falling: 0, resolution: 0,
  };
  let totalParagraphs = 0;
  for (const s of story.sections) {
    byStage[s.stage] = s.paragraphs.length;
    totalParagraphs += s.paragraphs.length;
  }
  return {
    totalSections: story.sections.length,
    totalParagraphs,
    totalWords: story.wordCount,
    totalCharacters: story.characters.length,
    byStage,
    genreLabel: GENRE_LABELS[story.genre],
    toneLabel: TONE_LABELS[story.tone],
    povLabel: POV_LABELS[story.pov],
  };
}

// ---------- Rendering ----------

/** Render story as plain text. */
export function renderText(story: Story): string {
  const lines: string[] = [];
  lines.push(story.title);
  lines.push("=".repeat(Math.max(8, story.title.length)));
  lines.push("");
  lines.push(`Premise: ${story.premise || "(none)"}`);
  lines.push(`Genre: ${GENRE_LABELS[story.genre]} | Tone: ${TONE_LABELS[story.tone]} | POV: ${POV_LABELS[story.pov]} | Length: ${LENGTH_LABELS[story.length]}`);
  if (story.setting) lines.push(`Setting: ${story.setting}`);
  if (story.characters.length > 0) {
    lines.push("Characters:");
    for (const c of story.characters) {
      lines.push(`  - ${c.name} (${c.role})${c.description ? ": " + c.description : ""}`);
    }
  }
  lines.push("");
  for (const s of story.sections) {
    lines.push(`## ${s.heading}`);
    lines.push("");
    for (const p of s.paragraphs) {
      lines.push(p);
      lines.push("");
    }
  }
  lines.push("---");
  lines.push(`Word count: ${story.wordCount}`);
  return lines.join("\n");
}

/** Render story as Markdown. */
export function renderMarkdown(story: Story): string {
  const lines: string[] = [];
  lines.push(`# ${story.title}`);
  lines.push("");
  lines.push(`*${GENRE_LABELS[story.genre]} · ${TONE_LABELS[story.tone]} · ${POV_LABELS[story.pov]} · ${LENGTH_LABELS[story.length]}*`);
  lines.push("");
  if (story.premise) {
    lines.push(`> ${story.premise}`);
    lines.push("");
  }
  if (story.setting) {
    lines.push(`**Setting:** ${story.setting}`);
    lines.push("");
  }
  if (story.characters.length > 0) {
    lines.push(`## Characters`);
    lines.push("");
    for (const c of story.characters) {
      lines.push(`- **${c.name}** (${c.role})${c.description ? ` — ${c.description}` : ""}`);
    }
    lines.push("");
  }
  for (const s of story.sections) {
    lines.push(`## ${s.heading}`);
    lines.push("");
    for (const p of s.paragraphs) {
      lines.push(p);
      lines.push("");
    }
  }
  lines.push("---");
  lines.push(`*Word count: ${story.wordCount}*`);
  return lines.join("\n");
}

/** Render story as JSON. */
export function renderJson(story: Story): string {
  return JSON.stringify(story, null, 2);
}

/** Render the story-bible as Markdown. */
export function renderBibleMarkdown(bible: StoryBible): string {
  const lines: string[] = [];
  lines.push("# Story Bible");
  lines.push("");
  lines.push("## Setting");
  lines.push("");
  lines.push(bible.setting || "(unspecified)");
  lines.push("");
  if (bible.characters.length > 0) {
    lines.push("## Characters");
    lines.push("");
    for (const c of bible.characters) {
      lines.push(`- **${c.name}** (${c.role})${c.description ? ` — ${c.description}` : ""}`);
    }
    lines.push("");
  }
  if (bible.themes.length > 0) {
    lines.push("## Themes");
    lines.push("");
    for (const t of bible.themes) lines.push(`- ${t}`);
    lines.push("");
  }
  if (bible.conflicts.length > 0) {
    lines.push("## Conflicts");
    lines.push("");
    for (const c of bible.conflicts) lines.push(`- ${c}`);
    lines.push("");
  }
  if (bible.plotPoints.length > 0) {
    lines.push("## Plot Points");
    lines.push("");
    for (let i = 0; i < bible.plotPoints.length; i++) {
      lines.push(`${i + 1}. ${bible.plotPoints[i]}`);
    }
    lines.push("");
  }
  return lines.join("\n");
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

// ---------- Shareable URL ----------

export function buildShareUrl(state: ShareState): string {
  const params = new URLSearchParams();
  if (state.premise) params.set("premise", state.premise);
  if (state.genre) params.set("genre", state.genre);
  if (state.tone && state.tone !== "neutral") params.set("tone", state.tone);
  if (state.pov && state.pov !== "third-limited") params.set("pov", state.pov);
  if (state.length && state.length !== "short") params.set("length", state.length);
  if (state.setting) params.set("setting", state.setting);
  if (state.charactersText) params.set("chars", state.charactersText);
  if (typeof window === "undefined") return `?${params.toString()}`;
  return `${window.location.origin}${window.location.pathname}#${params.toString()}`;
}

export function parseShareUrl(hash: string): ShareState {
  const clean = hash.startsWith("#") ? hash.slice(1) : hash;
  const defaults: ShareState = {
    premise: "",
    genre: "fantasy",
    tone: "neutral",
    pov: "third-limited",
    length: "short",
    setting: "",
    charactersText: "",
  };
  if (!clean) return defaults;
  const params = new URLSearchParams(clean);
  const premise = params.get("premise") ?? "";
  const validGenres = Object.keys(GENRE_LABELS) as Genre[];
  const gParam = params.get("genre") ?? "fantasy";
  const genre = validGenres.includes(gParam as Genre) ? (gParam as Genre) : "fantasy";
  const validTones = Object.keys(TONE_LABELS) as Tone[];
  const tParam = params.get("tone") ?? "neutral";
  const tone = validTones.includes(tParam as Tone) ? (tParam as Tone) : "neutral";
  const validPovs = Object.keys(POV_LABELS) as POV[];
  const pParam = params.get("pov") ?? "third-limited";
  const pov = validPovs.includes(pParam as POV) ? (pParam as POV) : "third-limited";
  const validLengths = Object.keys(LENGTH_LABELS) as Length[];
  const lParam = params.get("length") ?? "short";
  const length = validLengths.includes(lParam as Length) ? (lParam as Length) : "short";
  const setting = params.get("setting") ?? "";
  const charactersText = params.get("chars") ?? "";
  return { premise, genre, tone, pov, length, setting, charactersText };
}

// ---------- Optional LLM prompt builder ----------

export function buildLlmPrompt(
  premise: string,
  genre: Genre,
  tone: Tone,
  pov: POV,
  length: Length,
  bible: StoryBible,
): LlmPrompt {
  const system = [
    "You are a fiction writer.",
    `Genre: ${GENRE_LABELS[genre]}.`,
    `Tone: ${TONE_LABELS[tone]}.`,
    `POV: ${POV_LABELS[pov]}.`,
    `Target length: approximately ${LENGTH_TARGETS[length]} words.`,
    "Maintain consistency with the story-bible below. Use the six-stage plot arc (setup, inciting incident, rising action, climax, falling action, resolution). Show, don't tell. Avoid clichés. Match the tone precisely.",
  ].join(" ");
  const bibleStr = renderBibleMarkdown(bible);
  const user = [
    `Premise: ${premise || "(none provided — derive from the story-bible)"}`,
    "",
    "Story bible:",
    "```",
    bibleStr,
    "```",
    "",
    "Write the full story. Use Markdown headings for each plot stage.",
  ].join("\n");
  return { system, user };
}

export function renderLlmResult(raw: string): string {
  return (raw || "").trim();
}
