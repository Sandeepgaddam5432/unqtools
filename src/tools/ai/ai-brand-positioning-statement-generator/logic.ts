/**
 * AI Brand Positioning Statement Generator — pure logic.
 *
 * Generate positioning statements from structured brand inputs using
 * Moore, April Dunford, Jobs-to-be-Done, and Geiger frameworks. Derive
 * messaging pillars, elevator pitch, and taglines. Pure functions only —
 * no DOM, no network. The optional LLM call (BYO API key) lives in
 * ui.tsx because it touches the network.
 *
 * Honesty: positioning is a thinking exercise — this tool *structures and
 * phrases your thinking* into proven frameworks. Great positioning comes
 * from real customer/market insight, not from a template. Use the output
 * as a starting point, not a finished strategy.
 */

// ---------- Types ----------

export type Framework = "moore" | "dunford" | "jtbd" | "geiger";
export type Tone = "concise" | "energetic" | "formal";

export interface BrandInputs {
  brandName: string;
  category: string;
  audience: string;
  need: string;
  benefit: string;
  differentiator: string;
  reasonToBelieve: string;
}

export interface MessagingPillar {
  title: string;
  description: string;
}

export interface PositioningStatement {
  framework: Framework;
  tone: Tone;
  text: string;
  primary: boolean;
}

export interface SharpenResult {
  sharpened: string;
  issues: string[];
  genericPhrases: string[];
}

export interface PositioningOutput {
  statements: PositioningStatement[];
  pillars: MessagingPillar[];
  elevatorPitch: string;
  taglines: string[];
  warnings: string[];
  sharpenResult: SharpenResult | null;
}

export interface HistoryEntry {
  ts: number;
  brandName: string;
  framework: Framework;
  tone: Tone;
  statement: string;
}

export interface ShareState {
  inputs: Partial<BrandInputs>;
  framework: Framework;
  tone: Tone;
}

export interface LlmEnhancement {
  polishedStatement: string;
  polishedPillars: Array<{ title: string; description: string }>;
  polishedPitch: string;
  polishedTaglines: string[];
  suggestions: string[];
}

// ---------- Constants ----------

export const HISTORY_KEY = "unqtools:ai-brand-positioning-statement-generator:history";
export const HISTORY_MAX = 20;
export const LLM_KEY_STORAGE = "unqtools:ai-brand-positioning-statement-generator:llm-key";

export const FRAMEWORK_LABELS: Record<Framework, string> = {
  moore: "Moore (classic)",
  dunford: "April Dunford",
  jtbd: "Jobs-to-be-Done",
  geiger: "Geiger",
};

export const TONE_LABELS: Record<Tone, string> = {
  concise: "Concise",
  energetic: "Energetic",
  formal: "Formal",
};

/** Inline hint + sample for each input field. */
export const FIELD_HINTS: Record<keyof BrandInputs, { hint: string; sample: string }> = {
  brandName: {
    hint: "Your product, service, or company name.",
    sample: "Acme Analytics",
  },
  category: {
    hint: "The market category you sit in (1–3 words). Avoid made-up categories — customers must already understand the word.",
    sample: "product analytics platform",
  },
  audience: {
    hint: "Who you are for. Be specific (role, segment, industry). Avoid 'everyone'.",
    sample: "growth-stage SaaS product teams",
  },
  need: {
    hint: "The customer's unmet need or pain, in their words. Start with a verb (e.g., 'understand', 'automate', 'find').",
    sample: "understand feature adoption without writing SQL",
  },
  benefit: {
    hint: "The single most important outcome the customer gets. Lead with the verb.",
    sample: "answer product questions in seconds with no-code dashboards",
  },
  differentiator: {
    hint: "What only you do. Be concrete (a feature, a method, a proof point). Avoid 'high quality' or 'innovative'.",
    sample: "ingest events from any source with a visual schema mapper",
  },
  reasonToBelieve: {
    hint: "Why should the customer believe you? Cite proof: methodology, certifications, customer count, performance numbers.",
    sample: "trusted by 400+ SaaS teams including Notion, Linear, and Vercel",
  },
};

/**
 * Generic differentiator phrases — words that sound good but carry no
 * specific meaning. Detected and flagged by the sharpener.
 */
export const GENERIC_PHRASES: string[] = [
  "high quality", "high-quality", "best in class", "best-in-class",
  "world class", "world-class", "industry leading", "industry-leading",
  "leading", "premier", "premium", "top rated", "top-rated",
  "innovative", "innovation", "cutting edge", "cutting-edge",
  "next generation", "next-generation", "revolutionary", "revolutionize",
  "game changing", "game-changing", "game changer", "game-changer",
  "state of the art", "state-of-the-art", "best", "trusted",
  "reliable", "user friendly", "user-friendly", "easy to use",
  "easy-to-use", "seamless", "robust", "scalable", "flexible",
  "powerful", "comprehensive", "advanced", "modern",
];

/** Substitution suggestions: generic phrase → specificity prompt. */
export const GENERIC_SUGGESTIONS: Record<string, string> = {
  "high quality": "[which quality dimension — e.g. ISO 9001 certified]",
  "high-quality": "[which quality dimension — e.g. ISO 9001 certified]",
  "best in class": "[best at what metric, vs which competitor]",
  "best-in-class": "[best at what metric, vs which competitor]",
  "world class": "[what does 'world class' mean here — name a benchmark]",
  "world-class": "[what does 'world class' mean here — name a benchmark]",
  "industry leading": "[leading by which metric — name the ranking]",
  "industry-leading": "[leading by which metric — name the ranking]",
  "leading": "[leading in which segment, by which measure]",
  "premier": "[premier among which peer set]",
  "premium": "[premium at what price point, with what extras]",
  "top rated": "[rated by whom — name the publication/score]",
  "top-rated": "[rated by whom — name the publication/score]",
  "innovative": "[which specific capability is novel]",
  "innovation": "[which specific capability is novel]",
  "cutting edge": "[cutting edge compared to which prior baseline]",
  "cutting-edge": "[cutting edge compared to which prior baseline]",
  "next generation": "[next generation vs which prior generation]",
  "next-generation": "[next generation vs which prior generation]",
  "revolutionary": "[which specific behavior is now possible]",
  "revolutionize": "[which specific behavior is now possible]",
  "game changing": "[which game; what changed]",
  "game-changing": "[which game; what changed]",
  "game changer": "[which game; what changed]",
  "game-changer": "[which game; what changed]",
  "state of the art": "[compared to which prior art]",
  "state-of-the-art": "[compared to which prior art]",
  "best": "[best at what, for whom]",
  "trusted": "[trusted by whom — name a customer]",
  "reliable": "[reliability SLA or uptime %]",
  "user friendly": "[which UX metric — e.g. NPS 70]",
  "user-friendly": "[which UX metric — e.g. NPS 70]",
  "easy to use": "[easy compared to which alternative]",
  "easy-to-use": "[easy compared to which alternative]",
  "seamless": "[which manual step is removed]",
  "robust": "[robust against what failure mode]",
  "scalable": "[scaled to what volume — name a number]",
  "flexible": "[flexible in which dimension]",
  "powerful": "[powerful enough to do what]",
  "comprehensive": "[comprehensive across which scope]",
  "advanced": "[advanced compared to which baseline]",
  "modern": "[modern compared to which prior stack]",
};

// ---------- Validation ----------

/**
 * Validate brand inputs and return a list of human-readable warnings.
 * Empty / short / generic inputs are flagged.
 */
export function validateInputs(inputs: BrandInputs): string[] {
  const warnings: string[] = [];
  const required: Array<[keyof BrandInputs, string]> = [
    ["brandName", "Brand name"],
    ["category", "Category"],
    ["audience", "Target audience"],
    ["need", "Customer need"],
    ["benefit", "Key benefit"],
    ["differentiator", "Differentiator"],
  ];
  for (const [key, label] of required) {
    if (!inputs[key] || !inputs[key].trim()) {
      warnings.push(`${label} is required to generate a complete statement.`);
    }
  }
  if (inputs.brandName && inputs.brandName.trim().length > 60) {
    warnings.push("Brand name is longer than 60 characters — consider a shorter brand mark.");
  }
  if (inputs.category && inputs.category.trim().length > 40) {
    warnings.push("Category is longer than 40 characters — customers may not recognize a long category name.");
  }
  if (inputs.benefit && inputs.benefit.trim().length < 12) {
    warnings.push("Key benefit is very short — describe the outcome the customer gets.");
  }
  if (inputs.differentiator && inputs.differentiator.trim().length < 12) {
    warnings.push("Differentiator is very short — name the specific capability or proof point.");
  }
  if (inputs.audience && /\b(everyone|anyone|all users|everybody|anybody)\b/i.test(inputs.audience)) {
    warnings.push("Audience 'everyone' weakens positioning — pick a specific segment.");
  }
  const generic = detectGenericPhrases(inputs.differentiator || "");
  if (generic.length > 0) {
    warnings.push(
      `Differentiator contains generic phrasing: ${generic.map((g) => `"${g}"`).join(", ")}. Use the sharpener to make it specific.`,
    );
  }
  return warnings;
}

// ---------- Generic-phrase detection & sharpening ----------

/** Escape a string for use in a RegExp. */
export function escapeRegex(s: string): string {
  return s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

/**
 * Detect generic phrases in text. Returns matched phrases in order of
 * first appearance, longest-first per position (so "high quality" beats
 * "quality" if both were in the list).
 */
export function detectGenericPhrases(text: string): string[] {
  if (!text) return [];
  const lower = text.toLowerCase();
  const found: string[] = [];
  // Sort by length desc so multi-word phrases match before single words.
  const sorted = [...GENERIC_PHRASES].sort((a, b) => b.length - a.length);
  const seenRanges: Array<[number, number]> = [];
  for (const phrase of sorted) {
    const re = new RegExp(`\\b${escapeRegex(phrase)}\\b`, "gi");
    let m: RegExpExecArray | null;
    while ((m = re.exec(lower)) !== null) {
      const start = m.index;
      const end = start + phrase.length;
      // Skip if this range overlaps an already-found, longer phrase.
      const overlaps = seenRanges.some(([s, e]) => start < e && end > s);
      if (!overlaps) {
        found.push(phrase);
        seenRanges.push([start, end]);
      }
      re.lastIndex = end;
    }
  }
  // Sort found phrases by their first appearance index for stable output.
  return found.sort((a, b) => lower.indexOf(a) - lower.indexOf(b));
}

/**
 * Sharpen a differentiator by flagging each generic phrase with a
 * specificity prompt. Returns the rewritten text plus issue notes.
 */
export function sharpenDifferentiator(text: string): SharpenResult {
  if (!text || !text.trim()) {
    return { sharpened: "", issues: ["Differentiator is empty."], genericPhrases: [] };
  }
  const generic = detectGenericPhrases(text);
  if (generic.length === 0) {
    return {
      sharpened: text,
      issues: ["No generic phrasing detected — your differentiator is specific."],
      genericPhrases: [],
    };
  }
  let out = text;
  const issues: string[] = [];
  // Replace longest-first to avoid partial overlaps.
  for (const phrase of [...generic].sort((a, b) => b.length - a.length)) {
    const re = new RegExp(`\\b${escapeRegex(phrase)}\\b`, "gi");
    const suggestion = GENERIC_SUGGESTIONS[phrase] ?? "[make this specific]";
    out = out.replace(re, suggestion);
    issues.push(`"${phrase}" is generic. Replace with a concrete proof point.`);
  }
  return { sharpened: out, issues, genericPhrases: generic };
}

// ---------- Framework templates ----------

/** Lowercase the first character of a string. */
function lcFirst(s: string): string {
  return s && s.length > 0 ? s[0].toLowerCase() + s.slice(1) : s;
}

/** Build a Moore (classic) positioning statement in a given tone. */
export function buildMooreStatement(inputs: BrandInputs, tone: Tone): string {
  const {
    brandName, category, audience, need, benefit,
    differentiator, reasonToBelieve,
  } = inputs;
  const aud = audience || "[audience]";
  const need2 = lcFirst(need) || "[need]";
  const cat = category || "[category]";
  const brand = brandName || "[brand]";
  const ben = lcFirst(benefit) || "[benefit]";
  const diff = lcFirst(differentiator) || "[differentiator]";
  const rtb = lcFirst(reasonToBelieve) || "[reason to believe]";
  if (tone === "concise") {
    return `For ${aud} who ${need2}, ${brand} is a ${cat} that ${ben}. Unlike alternatives, ${brand} ${diff}, because ${rtb}.`;
  }
  if (tone === "energetic") {
    return `For ${aud} who ${need2}, ${brand} is the ${cat} that ${ben}. While other ${cat} options stall, ${brand} ${diff} — because ${rtb}.`;
  }
  // formal
  return `For ${aud} who require ${need2}, ${brand} is a ${cat} that delivers ${ben}. In contrast to competing ${cat} offerings, ${brand} ${diff}, because ${rtb}.`;
}

/** Build an April Dunford-style declarative positioning statement. */
export function buildDunfordStatement(inputs: BrandInputs, tone: Tone): string {
  const {
    brandName, category, audience, need, benefit,
    differentiator, reasonToBelieve,
  } = inputs;
  const brand = brandName || "[brand]";
  const cat = category || "[category]";
  const aud = audience || "[audience]";
  const need2 = lcFirst(need) || "[need]";
  const ben = lcFirst(benefit) || "[benefit]";
  const diff = lcFirst(differentiator) || "[differentiator]";
  const rtb = lcFirst(reasonToBelieve) || "[reason to believe]";
  if (tone === "concise") {
    return `${brand} is a ${cat} for ${aud} who ${need2}. It ${ben}. Unlike alternatives, ${brand} ${diff}, because ${rtb}.`;
  }
  if (tone === "energetic") {
    return `${brand}: the ${cat} for ${aud} who ${need2}. We ${ben}. Where others fall short, ${brand} ${diff} — because ${rtb}.`;
  }
  return `${brand} is a ${cat} designed for ${aud} who require ${need2}. The product ${ben}. Unlike competing alternatives, ${brand} ${diff}, because ${rtb}.`;
}

/** Build a Jobs-to-be-Done positioning statement. */
export function buildJtbdStatement(inputs: BrandInputs, tone: Tone): string {
  const {
    brandName, audience, need, benefit, differentiator, reasonToBelieve,
  } = inputs;
  const brand = brandName || "[brand]";
  const aud = audience || "[audience]";
  const need2 = lcFirst(need) || "[need]";
  const ben = lcFirst(benefit) || "[benefit]";
  const diff = lcFirst(differentiator) || "[differentiator]";
  const rtb = lcFirst(reasonToBelieve) || "[reason to believe]";
  if (tone === "concise") {
    return `When ${aud} want to ${need2}, they hire ${brand} to ${ben}. Unlike alternatives, ${brand} ${diff}, because ${rtb}.`;
  }
  if (tone === "energetic") {
    return `When ${aud} want to ${need2}, they hire ${brand} to ${ben}. Other tools fall short — ${brand} ${diff}, because ${rtb}.`;
  }
  return `When ${aud} seek to ${need2}, they engage ${brand} in order to ${ben}. Unlike competing alternatives, ${brand} ${diff}, because ${rtb}.`;
}

/** Build a Geiger-formula positioning statement. */
export function buildGeigerStatement(inputs: BrandInputs, tone: Tone): string {
  const {
    brandName, audience, benefit, differentiator, reasonToBelieve,
  } = inputs;
  const brand = brandName || "[brand]";
  const aud = audience || "[audience]";
  const ben = lcFirst(benefit) || "[benefit]";
  const diff = lcFirst(differentiator) || "[differentiator]";
  const rtb = lcFirst(reasonToBelieve) || "[reason to believe]";
  if (tone === "concise") {
    return `${brand} helps ${aud} ${ben} by ${diff}, because ${rtb}.`;
  }
  if (tone === "energetic") {
    return `${brand} helps ${aud} ${ben}. How? By ${diff} — because ${rtb}.`;
  }
  return `${brand} enables ${aud} to ${ben} by ${diff}, supported by the fact that ${rtb}.`;
}

/** Dispatch to the right framework builder. */
export function buildStatement(inputs: BrandInputs, framework: Framework, tone: Tone): string {
  switch (framework) {
    case "moore": return buildMooreStatement(inputs, tone);
    case "dunford": return buildDunfordStatement(inputs, tone);
    case "jtbd": return buildJtbdStatement(inputs, tone);
    case "geiger": return buildGeigerStatement(inputs, tone);
    default: return buildMooreStatement(inputs, tone);
  }
}

// ---------- Derived assets ----------

/**
 * Derive three messaging pillars from inputs. Each pillar leads with one
 * dimension (benefit, differentiator, reason-to-believe) and pairs it
 * with a description that ties back to the audience.
 */
export function derivePillars(inputs: BrandInputs): MessagingPillar[] {
  const brand = inputs.brandName || "[brand]";
  const aud = inputs.audience || "[audience]";
  const ben = inputs.benefit || "[benefit]";
  const diff = inputs.differentiator || "[differentiator]";
  const rtb = inputs.reasonToBelieve || "[reason to believe]";
  return [
    {
      title: titleCase(ben),
      description: `${brand} delivers ${lcFirst(ben)} for ${aud}. Lead messaging with this outcome — it is what customers buy.`,
    },
    {
      title: titleCase(diff),
      description: `Only ${brand} ${lcFirst(diff)}. Reinforce this differentiation in every channel; it is your defensible moat.`,
    },
    {
      title: titleCase(rtb),
      description: `${brand}'s claim is credible because ${lcFirst(rtb)}. Cite this proof point on the homepage, in sales decks, and in case studies.`,
    },
  ];
}

/** Build a 2–3 sentence elevator pitch combining brand, category, audience, benefit, and differentiation. */
export function deriveElevatorPitch(inputs: BrandInputs): string {
  const brand = inputs.brandName || "[brand]";
  const cat = inputs.category || "[category]";
  const aud = inputs.audience || "[audience]";
  const ben = inputs.benefit || "[benefit]";
  const diff = inputs.differentiator || "[differentiator]";
  const rtb = inputs.reasonToBelieve || "";
  const tail = rtb ? ` Because ${lcFirst(rtb)}.` : "";
  return `${brand} is a ${cat} built for ${aud}. It ${lcFirst(ben)} by ${lcFirst(diff)}.${tail}`;
}

/** Derive five tagline options from inputs. */
export function deriveTaglines(inputs: BrandInputs): string[] {
  const brand = inputs.brandName || "[brand]";
  const cat = inputs.category || "[category]";
  const aud = inputs.audience || "[audience]";
  const ben = inputs.benefit || "[benefit]";
  const diff = inputs.differentiator || "[differentiator]";
  const clean = (s: string) => s.replace(/[.!?]+$/g, "").trim();
  return [
    `${brand}. ${titleCase(ben)}.`,
    `${brand}: ${lcFirst(diff)}.`,
    `${titleCase(ben)}. ${brand}.`,
    `For ${aud}. ${titleCase(ben)}.`,
    `${brand} — ${cat}, done right.`,
  ].map((t) => clean(clean(t).replace(/\.\s*\.$/, ".")) + ".");
}

// ---------- Generate ----------

/**
 * Generate the full positioning output:
 * - Primary statement in the chosen framework + tone
 * - Two alternate tone variants of the same framework
 * - One statement per *other* framework in the chosen tone (so the user
 *   can compare frameworks side-by-side)
 * - Three messaging pillars
 * - Elevator pitch
 * - Five taglines
 * - Validation warnings
 * - Differentiator sharpen result (only if differentiator is non-empty)
 */
export function generate(
  inputs: BrandInputs,
  framework: Framework,
  tone: Tone,
): PositioningOutput {
  const warnings = validateInputs(inputs);
  const sharpenResult = inputs.differentiator && inputs.differentiator.trim()
    ? sharpenDifferentiator(inputs.differentiator)
    : null;
  const statements: PositioningStatement[] = [];
  // Primary: chosen framework in chosen tone.
  statements.push({
    framework,
    tone,
    text: buildStatement(inputs, framework, tone),
    primary: true,
  });
  // Two alternate tones for the chosen framework.
  const otherTones: Tone[] = (["concise", "energetic", "formal"] as Tone[]).filter((t) => t !== tone);
  for (const t of otherTones) {
    statements.push({
      framework,
      tone: t,
      text: buildStatement(inputs, framework, t),
      primary: false,
    });
  }
  // Other frameworks in the chosen tone.
  const otherFrameworks: Framework[] = (["moore", "dunford", "jtbd", "geiger"] as Framework[]).filter((f) => f !== framework);
  for (const f of otherFrameworks) {
    statements.push({
      framework: f,
      tone,
      text: buildStatement(inputs, f, tone),
      primary: false,
    });
  }
  return {
    statements,
    pillars: derivePillars(inputs),
    elevatorPitch: deriveElevatorPitch(inputs),
    taglines: deriveTaglines(inputs),
    warnings,
    sharpenResult,
  };
}

// ---------- Render ----------

/** Render the positioning output as a Markdown one-pager. */
export function renderMarkdown(output: PositioningOutput, inputs: BrandInputs): string {
  const lines: string[] = [];
  lines.push(`# ${inputs.brandName || "[brand]"} — Brand Positioning One-Pager`);
  lines.push("");
  lines.push(`_Generated by UnQTools AI Brand Positioning Statement Generator._`);
  lines.push("");
  lines.push("## Inputs");
  lines.push("");
  lines.push(`- **Brand:** ${inputs.brandName || "—"}`);
  lines.push(`- **Category:** ${inputs.category || "—"}`);
  lines.push(`- **Audience:** ${inputs.audience || "—"}`);
  lines.push(`- **Need:** ${inputs.need || "—"}`);
  lines.push(`- **Key benefit:** ${inputs.benefit || "—"}`);
  lines.push(`- **Differentiator:** ${inputs.differentiator || "—"}`);
  lines.push(`- **Reason to believe:** ${inputs.reasonToBelieve || "—"}`);
  lines.push("");
  const primary = output.statements.find((s) => s.primary);
  if (primary) {
    lines.push("## Positioning statement (primary)");
    lines.push("");
    lines.push(`> ${primary.text}`);
    lines.push("");
    lines.push(`_Framework: ${FRAMEWORK_LABELS[primary.framework]} · Tone: ${TONE_LABELS[primary.tone]}_`);
    lines.push("");
  }
  lines.push("## Alternative statements");
  lines.push("");
  for (const s of output.statements.filter((s) => !s.primary)) {
    lines.push(`- **${FRAMEWORK_LABELS[s.framework]} · ${TONE_LABELS[s.tone]}:** ${s.text}`);
  }
  lines.push("");
  lines.push("## Messaging pillars");
  lines.push("");
  for (const p of output.pillars) {
    lines.push(`### ${p.title}`);
    lines.push("");
    lines.push(p.description);
    lines.push("");
  }
  lines.push("## Elevator pitch");
  lines.push("");
  lines.push(output.elevatorPitch);
  lines.push("");
  lines.push("## Tagline options");
  lines.push("");
  for (const t of output.taglines) {
    lines.push(`- ${t}`);
  }
  if (output.sharpenResult && output.sharpenResult.genericPhrases.length > 0) {
    lines.push("");
    lines.push("## Differentiator sharpening");
    lines.push("");
    lines.push(`Detected generic phrases: ${output.sharpenResult.genericPhrases.map((g) => `\`${g}\``).join(", ")}`);
    lines.push("");
    lines.push("Sharpened:");
    lines.push("");
    lines.push(`> ${output.sharpenResult.sharpened}`);
  }
  if (output.warnings.length > 0) {
    lines.push("");
    lines.push("## Warnings");
    lines.push("");
    for (const w of output.warnings) {
      lines.push(`- ${w}`);
    }
  }
  return lines.join("\n");
}

/** Render the positioning output as JSON (full inputs + output). */
export function renderJson(output: PositioningOutput, inputs: BrandInputs): string {
  return JSON.stringify({ inputs, output, generatedAt: new Date().toISOString() }, null, 2);
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

export function buildShareUrl(inputs: BrandInputs, framework: Framework, tone: Tone): string {
  const params = new URLSearchParams();
  if (inputs.brandName) params.set("brand", inputs.brandName);
  if (inputs.category) params.set("cat", inputs.category);
  if (inputs.audience) params.set("aud", inputs.audience);
  if (inputs.need) params.set("need", inputs.need);
  if (inputs.benefit) params.set("ben", inputs.benefit);
  if (inputs.differentiator) params.set("diff", inputs.differentiator);
  if (inputs.reasonToBelieve) params.set("rtb", inputs.reasonToBelieve);
  if (framework !== "moore") params.set("fw", framework);
  if (tone !== "concise") params.set("tone", tone);
  if (typeof window === "undefined") return `?${params.toString()}`;
  return `${window.location.origin}${window.location.pathname}#${params.toString()}`;
}

export function parseShareUrl(hash: string): ShareState {
  let clean = hash;
  if (clean.startsWith("#") || clean.startsWith("?")) clean = clean.slice(1);
  if (!clean) return { inputs: {}, framework: "moore", tone: "concise" };
  const params = new URLSearchParams(clean);
  const inputs: Partial<BrandInputs> = {};
  if (params.get("brand")) inputs.brandName = params.get("brand")!;
  if (params.get("cat")) inputs.category = params.get("cat")!;
  if (params.get("aud")) inputs.audience = params.get("aud")!;
  if (params.get("need")) inputs.need = params.get("need")!;
  if (params.get("ben")) inputs.benefit = params.get("ben")!;
  if (params.get("diff")) inputs.differentiator = params.get("diff")!;
  if (params.get("rtb")) inputs.reasonToBelieve = params.get("rtb")!;
  const fwRaw = params.get("fw");
  const framework: Framework =
    fwRaw === "dunford" || fwRaw === "jtbd" || fwRaw === "geiger" ? fwRaw : "moore";
  const toneRaw = params.get("tone");
  const tone: Tone =
    toneRaw === "energetic" || toneRaw === "formal" ? toneRaw : "concise";
  return { inputs, framework, tone };
}

// ---------- Optional LLM enhancement ----------

export function buildLlmPrompt(inputs: BrandInputs, framework: Framework, tone: Tone): string {
  return [
    "You are an expert brand strategist. Polish the positioning inputs below into a sharper statement, pillars, elevator pitch, and taglines.",
    "",
    "Inputs:",
    `- Brand: ${inputs.brandName || "(empty)"}`,
    `- Category: ${inputs.category || "(empty)"}`,
    `- Audience: ${inputs.audience || "(empty)"}`,
    `- Need: ${inputs.need || "(empty)"}`,
    `- Key benefit: ${inputs.benefit || "(empty)"}`,
    `- Differentiator: ${inputs.differentiator || "(empty)"}`,
    `- Reason to believe: ${inputs.reasonToBelieve || "(empty)"}`,
    `- Preferred framework: ${FRAMEWORK_LABELS[framework]}`,
    `- Preferred tone: ${TONE_LABELS[tone]}`,
    "",
    "Output a JSON object with:",
    '- "polishedStatement": string (1–2 sentences, follows the preferred framework)',
    '- "polishedPillars": array of { "title": string, "description": string } (3 items)',
    '- "polishedPitch": string (2–3 sentence elevator pitch)',
    '- "polishedTaglines": array of 5 strings',
    '- "suggestions": array of strings (specific improvements the user could make to the inputs)',
    "",
    "Be honest. If the differentiator is generic, say so in suggestions. Do not invent proof points.",
  ].join("\n");
}

export function renderLlmResult(rawText: string):
  | { ok: true; result: LlmEnhancement }
  | { ok: false; error: string } {
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
  const polishedStatement = typeof o.polishedStatement === "string" ? o.polishedStatement : "";
  const polishedPitch = typeof o.polishedPitch === "string" ? o.polishedPitch : "";
  const polishedPillars = Array.isArray(o.polishedPillars)
    ? (o.polishedPillars as unknown[])
        .filter((x) => typeof x === "object" && x !== null && !Array.isArray(x))
        .map((x) => {
          const r = x as Record<string, unknown>;
          return {
            title: typeof r.title === "string" ? r.title : "",
            description: typeof r.description === "string" ? r.description : "",
          };
        })
    : [];
  const polishedTaglines = Array.isArray(o.polishedTaglines)
    ? (o.polishedTaglines as unknown[]).filter((x) => typeof x === "string") as string[]
    : [];
  const suggestions = Array.isArray(o.suggestions)
    ? (o.suggestions as unknown[]).filter((x) => typeof x === "string") as string[]
    : [];
  const result: LlmEnhancement = {
    polishedStatement,
    polishedPillars,
    polishedPitch,
    polishedTaglines,
    suggestions,
  };
  return { ok: true, result };
}

// ---------- Helpers ----------

function titleCase(s: string): string {
  if (!s) return s;
  const trimmed = s.trim();
  if (!trimmed) return trimmed;
  // Title-case the first ~6 words for a punchy pillar title.
  const words = trimmed.split(/\s+/).slice(0, 6);
  const out = words.map((w, i) => {
    // Keep small connector words lowercase unless first.
    if (i > 0 && /^(a|an|the|and|or|but|of|for|to|in|on|with|by)$/i.test(w)) {
      return w.toLowerCase();
    }
    return w.charAt(0).toUpperCase() + w.slice(1);
  });
  let result = out.join(" ");
  // Preserve trailing punctuation only if original had it.
  const lastChar = trimmed.slice(-1);
  if (/[.!?]/.test(lastChar)) result += lastChar;
  return result;
}
