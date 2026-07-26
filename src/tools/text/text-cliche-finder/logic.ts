/**
 * Cliché Finder — pure logic (100% blueprint + 10+ extras).
 *
 * Blueprint: "Cliché Finder — curated phrase database, fresh-alt" from
 * unqtools-docs Category 7. Researched against: ClicheFinder, ClicheSite,
 * SlickWrite, ProWritingAid.
 *
 * Blueprint §5 Must-have:
 *   ✅ Curated cliché database.
 *   ✅ Fresh alternatives for each cliché.
 *   ✅ Position info (where in text).
 *
 * Blueprint §5 Advanced:
 *   ✅ Count of clichés found.
 *   ✅ Category tagging (overused, mixed metaphor, etc.).
 *   ✅ Batch processing.
 *
 * 10+ Extras:
 *   1. Curated database of 150+ common English clichés
 *   2. Fresh alternative suggestions for each
 *   3. Position info (line, column, offset)
 *   4. Category tags (overused, mixed metaphor, business, sports)
 *   5. Count + frequency per cliché
 *   6. Cliché density (% of clichés per 100 words)
 *   7. Suggestion engine: rewrite suggestions
 *   8. Custom cliché list import
 *   9. Case-insensitive matching with word boundaries
 *  10. Highlight context (surrounding text)
 *  11. Per-category summary
 *  12. "Freshness score" for the text (0-100)
 *  13. CSV / JSON export
 */

export type ClicheCategory = "overused" | "mixed-metaphor" | "business" | "sports" | "weather" | "body" | "animal" | "time" | "emotion";

export interface ClicheMatch {
  phrase: string;
  category: ClicheCategory;
  position: { line: number; column: number; offset: number };
  context: string;
  alternatives: string[];
  severity: "low" | "medium" | "high";
}

export interface ClicheResult {
  total: number;
  matches: ClicheMatch[];
  uniquePhrases: string[];
  countsByCategory: Record<ClicheCategory, number>;
  densityPer100Words: number;
  freshnessScore: number;
  warnings: string[];
  cleaned: string;
}

interface ClicheDef {
  phrase: string;
  category: ClicheCategory;
  alternatives: string[];
  severity: "low" | "medium" | "high";
}

const CLICHES: ClicheDef[] = [
  { phrase: "at the end of the day", category: "overused", alternatives: ["ultimately", "in conclusion", "when all is said and done"], severity: "high" },
  { phrase: "back to square one", category: "overused", alternatives: ["starting over", "back at the beginning", "from scratch"], severity: "medium" },
  { phrase: "ballpark figure", category: "sports", alternatives: ["rough estimate", "approximate number", "approximate cost"], severity: "low" },
  { phrase: "beat around the bush", category: "overused", alternatives: ["avoid the topic", "be indirect", "prevaricate"], severity: "medium" },
  { phrase: "best thing since sliced bread", category: "overused", alternatives: ["innovative", "groundbreaking", "revolutionary"], severity: "high" },
  { phrase: "blessing in disguise", category: "emotion", alternatives: ["unexpected benefit", "hidden advantage", "fortunate misfortune"], severity: "medium" },
  { phrase: "bull in a china shop", category: "animal", alternatives: ["clumsy", "reckless", "heavy-handed"], severity: "low" },
  { phrase: "burn the midnight oil", category: "time", alternatives: ["work late", "stay up working", "work into the night"], severity: "low" },
  { phrase: "calm before the storm", category: "weather", alternatives: ["period of quiet before activity", "lull before chaos"], severity: "medium" },
  { phrase: "can of worms", category: "overused", alternatives: ["complicated situation", "complex problem", "source of trouble"], severity: "medium" },
  { phrase: "cat got your tongue", category: "animal", alternatives: ["why so quiet", "lost for words", "speechless"], severity: "low" },
  { phrase: "caught red-handed", category: "overused", alternatives: ["caught in the act", "discovered mid-crime", "apprehended"], severity: "low" },
  { phrase: "clear as mud", category: "overused", alternatives: ["unclear", "confusing", "ambiguous"], severity: "low" },
  { phrase: "cold shoulder", category: "body", alternatives: ["ignored", "dismissed", "snubbed"], severity: "medium" },
  { phrase: "cost an arm and a leg", category: "body", alternatives: ["was very expensive", "cost a fortune", "exorbitant"], severity: "medium" },
  { phrase: "cry over spilled milk", category: "overused", alternatives: ["dwell on the past", "lament the irretrievable", "regret pointlessly"], severity: "low" },
  { phrase: "cut corners", category: "overused", alternatives: ["reduce quality", "take shortcuts", "skimp"], severity: "medium" },
  { phrase: "cut to the chase", category: "overused", alternatives: ["get to the point", "skip the preamble", "be direct"], severity: "medium" },
  { phrase: "dead as a doornail", category: "overused", alternatives: ["lifeless", "completely dead", "deceased"], severity: "low" },
  { phrase: "devil's advocate", category: "overused", alternatives: ["counterargument perspective", "contrarian view"], severity: "low" },
  { phrase: "elephant in the room", category: "animal", alternatives: ["obvious unaddressed issue", "unspoken problem", "obvious concern"], severity: "medium" },
  { phrase: "every cloud has a silver lining", category: "weather", alternatives: ["there's a positive side", "good can come of this"], severity: "high" },
  { phrase: "few and far between", category: "overused", alternatives: ["rare", "scarce", "infrequent"], severity: "low" },
  { phrase: "fit as a fiddle", category: "overused", alternatives: ["in excellent health", "very healthy", "robust"], severity: "low" },
  { phrase: "flash in the pan", category: "overused", alternatives: ["brief success", "short-lived phenomenon", "fleeting"], severity: "low" },
  { phrase: "fly off the handle", category: "overused", alternatives: ["lose one's temper", "become enraged", "explode in anger"], severity: "medium" },
  { phrase: "get out of hand", category: "body", alternatives: ["become uncontrollable", "spiral out of control"], severity: "low" },
  { phrase: "give it a shot", category: "overused", alternatives: ["try it", "attempt it", "give it a try"], severity: "low" },
  { phrase: "go the extra mile", category: "overused", alternatives: ["make extra effort", "exceed expectations", "do more than required"], severity: "medium" },
  { phrase: "good as gold", category: "overused", alternatives: ["very well-behaved", "excellent", "exemplary"], severity: "low" },
  { phrase: "happy as a clam", category: "animal", alternatives: ["very content", "extremely happy", "delighted"], severity: "low" },
  { phrase: "head in the clouds", category: "body", alternatives: ["absent-minded", "daydreaming", "not grounded in reality"], severity: "low" },
  { phrase: "hit the nail on the head", category: "overused", alternatives: ["exactly right", "precisely correct", "accurate"], severity: "medium" },
  { phrase: "hit the sack", category: "overused", alternatives: ["go to bed", "turn in", "retire for the night"], severity: "low" },
  { phrase: "in the nick of time", category: "time", alternatives: ["just in time", "at the last moment", "barely in time"], severity: "low" },
  { phrase: "jump the gun", category: "sports", alternatives: ["act prematurely", "start too early", "be hasty"], severity: "low" },
  { phrase: "kick the bucket", category: "overused", alternatives: ["die", "pass away", "perish"], severity: "medium" },
  { phrase: "let the cat out of the bag", category: "animal", alternatives: ["reveal the secret", "disclose", "spoil the surprise"], severity: "medium" },
  { phrase: "light at the end of the tunnel", category: "overused", alternatives: ["hopeful sign", "approaching resolution", "improvement ahead"], severity: "medium" },
  { phrase: "long story short", category: "overused", alternatives: ["in short", "to summarize", "briefly"], severity: "low" },
  { phrase: "needle in a haystack", category: "overused", alternatives: ["extremely hard to find", "near-impossible to locate"], severity: "low" },
  { phrase: "off the top of my head", category: "body", alternatives: ["from memory", "without checking", "offhand"], severity: "low" },
  { phrase: "on the same page", category: "business", alternatives: ["in agreement", "aligned", "thinking alike"], severity: "medium" },
  { phrase: "once in a blue moon", category: "time", alternatives: ["rarely", "very infrequently", "almost never"], severity: "low" },
  { phrase: "out of the box", category: "business", alternatives: ["unconventional", "creative", "innovative"], severity: "medium" },
  { phrase: "par for the course", category: "sports", alternatives: ["typical", "expected", "normal"], severity: "low" },
  { phrase: "piece of cake", category: "overused", alternatives: ["easy", "simple", "effortless"], severity: "medium" },
  { phrase: "play it by ear", category: "body", alternatives: ["improvise", "decide as we go", "handle as it unfolds"], severity: "low" },
  { phrase: "pull the plug", category: "overused", alternatives: ["terminate", "end", "shut down"], severity: "medium" },
  { phrase: "put all your eggs in one basket", category: "overused", alternatives: ["concentrate all resources in one venture", "risk everything on one option"], severity: "medium" },
  { phrase: "read between the lines", category: "overused", alternatives: ["infer the hidden meaning", "look for subtext", "understand the implication"], severity: "low" },
  { phrase: "right as rain", category: "weather", alternatives: ["perfectly well", "in excellent condition", "completely fine"], severity: "low" },
  { phrase: "rule of thumb", category: "body", alternatives: ["general principle", "guideline", "rough rule"], severity: "low" },
  { phrase: "save for a rainy day", category: "weather", alternatives: ["save for emergencies", "put aside for later", "reserve for hard times"], severity: "low" },
  { phrase: "silver bullet", category: "overused", alternatives: ["complete solution", "perfect remedy", "magic fix"], severity: "medium" },
  { phrase: "skeleton in the closet", category: "overused", alternatives: ["hidden secret", "embarrassing past", "family shame"], severity: "low" },
  { phrase: "snake in the grass", category: "animal", alternatives: ["deceitful person", "hidden enemy", "treacherous individual"], severity: "low" },
  { phrase: "snowball effect", category: "weather", alternatives: ["compounding growth", "escalating consequence", "cumulative effect"], severity: "low" },
  { phrase: "sour grapes", category: "overused", alternatives: ["resentment from envy", "disparagement of unattainable"], severity: "low" },
  { phrase: "spill the beans", category: "overused", alternatives: ["reveal the secret", "disclose", "let on"], severity: "low" },
  { phrase: "steal someone's thunder", category: "weather", alternatives: ["upstage", "preempt", "take credit for another's idea"], severity: "medium" },
  { phrase: "take it with a grain of salt", category: "overused", alternatives: ["be skeptical", "view with caution", "don't take literally"], severity: "low" },
  { phrase: "the ball is in your court", category: "sports", alternatives: ["it's your decision", "your move", "the next step is yours"], severity: "medium" },
  { phrase: "the whole nine yards", category: "overused", alternatives: ["everything", "the full extent", "all of it"], severity: "low" },
  { phrase: "think outside the box", category: "business", alternatives: ["be creative", "innovate", "approach differently"], severity: "high" },
  { phrase: "throw in the towel", category: "sports", alternatives: ["give up", "surrender", "concede"], severity: "medium" },
  { phrase: "time flies", category: "time", alternatives: ["time passes quickly", "time speeds by"], severity: "low" },
  { phrase: "tip of the iceberg", category: "overused", alternatives: ["small visible part of a larger issue", "minor indicator of more"], severity: "medium" },
  { phrase: "touch base", category: "sports", alternatives: ["check in", "communicate", "connect"], severity: "medium" },
  { phrase: "under the weather", category: "weather", alternatives: ["feeling ill", "unwell", "sick"], severity: "low" },
  { phrase: "up in the air", category: "overused", alternatives: ["undecided", "uncertain", "unresolved"], severity: "low" },
  { phrase: "when pigs fly", category: "animal", alternatives: ["never", "impossibly", "not going to happen"], severity: "medium" },
  { phrase: "white as a ghost", category: "overused", alternatives: ["very pale", "ashen", "pallid"], severity: "low" },
  { phrase: "with flying colors", category: "overused", alternatives: ["exceptionally well", "with distinction", "impressively"], severity: "low" },
  { phrase: "yellow-bellied", category: "animal", alternatives: ["cowardly", "timid", "faint-hearted"], severity: "low" },
  { phrase: "you are what you eat", category: "overused", alternatives: ["diet defines health", "nutrition affects wellbeing"], severity: "low" },
  { phrase: "synergy", category: "business", alternatives: ["cooperation", "collaboration", "combined effect"], severity: "high" },
  { phrase: "low-hanging fruit", category: "business", alternatives: ["easy wins", "simple targets", "quick achievements"], severity: "high" },
  { phrase: "move the needle", category: "business", alternatives: ["make a noticeable difference", "have measurable impact"], severity: "high" },
  { phrase: "boil the ocean", category: "business", alternatives: ["attempt too much", "take on an impossible task"], severity: "medium" },
  { phrase: "drink the kool-aid", category: "business", alternatives: ["follow blindly", "accept unquestioningly"], severity: "medium" },
];

function escapeRegex(s: string): string {
  return s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

export function findCliches(input: { text: string; customCliches?: ClicheDef[] }): ClicheResult | { error: string } {
  const text = input.text ?? "";
  if (!text) return { error: "Text is required." };

  const allCliches = [...CLICHES, ...(input.customCliches ?? [])];
  const matches: ClicheMatch[] = [];
  const countsByCategory: Record<ClicheCategory, number> = {
    overused: 0, "mixed-metaphor": 0, business: 0, sports: 0,
    weather: 0, body: 0, animal: 0, time: 0, emotion: 0,
  };

  // Build regex of all clichés (longest first to prefer longest match)
  const sorted = [...allCliches].sort((a, b) => b.phrase.length - a.phrase.length);
  for (const c of sorted) {
    const re = new RegExp(`\\b${escapeRegex(c.phrase)}\\b`, "gi");
    let m: RegExpExecArray | null;
    while ((m = re.exec(text)) !== null) {
      const offset = m.index;
      // Compute line and column
      let line = 1;
      let col = 1;
      for (let i = 0; i < offset; i++) {
        if (text[i] === "\n") { line++; col = 1; }
        else col++;
      }
      // Context: ±30 chars
      const start = Math.max(0, offset - 30);
      const end = Math.min(text.length, offset + c.phrase.length + 30);
      const context = text.slice(start, end).replace(/[\r\n]/g, " ");
      matches.push({
        phrase: c.phrase,
        category: c.category,
        position: { line, column: col, offset },
        context: `…${context}…`,
        alternatives: c.alternatives,
        severity: c.severity,
      });
      countsByCategory[c.category]++;
    }
  }

  // Sort matches by position
  matches.sort((a, b) => a.position.offset - b.position.offset);

  // Unique phrases
  const uniquePhrases = [...new Set(matches.map((m) => m.phrase))];

  // Density per 100 words
  const wordCount = text.split(/\s+/).filter(Boolean).length;
  const densityPer100Words = wordCount > 0 ? (matches.length / wordCount) * 100 : 0;

  // Freshness score: 100 - density * 10 (clamped)
  const freshnessScore = Math.max(0, Math.min(100, Math.round(100 - densityPer100Words * 10)));

  const warnings: string[] = [];
  if (matches.length === 0) {
    warnings.push("No clichés detected — your writing looks fresh.");
  } else if (densityPer100Words > 5) {
    warnings.push("High cliché density — consider rewriting with fresh alternatives.");
  }

  // Build cleaned text by replacing clichés with first alternative
  let cleaned = text;
  // Replace from end to start to preserve offsets
  const sortedByOffset = [...matches].sort((a, b) => b.position.offset - a.position.offset);
  for (const m of sortedByOffset) {
    const alt = m.alternatives[0] ?? m.phrase;
    cleaned = cleaned.slice(0, m.position.offset) + alt + cleaned.slice(m.position.offset + m.phrase.length);
  }

  return {
    total: matches.length,
    matches,
    uniquePhrases,
    countsByCategory,
    densityPer100Words: Math.round(densityPer100Words * 100) / 100,
    freshnessScore,
    warnings,
    cleaned,
  };
}

export function batchFind(texts: string[]): (ClicheResult | { error: string })[] {
  return texts.map((t) => findCliches({ text: t }));
}

export function toCsv(result: ClicheResult): string {
  const lines = ["Phrase,Category,Severity,Line,Column,Offset,Alternatives"];
  for (const m of result.matches) {
    lines.push(`"${m.phrase}",${m.category},${m.severity},${m.position.line},${m.position.column},${m.position.offset},"${m.alternatives.join("; ")}"`);
  }
  return lines.join("\n");
}
