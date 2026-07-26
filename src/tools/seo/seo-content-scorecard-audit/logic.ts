/**
 * SEO Content Scorecard Audit — pure logic.
 * Transparent, weighted sub-scores + prioritized fix list.
 *
 * Reference: blueprint §5 (feature set) and §10 (acceptance criteria).
 * 100% client-side, no network.
 */

export interface AuditInput {
  /** Page HTML or plain text. */
  content: string;
  /** Target primary keyword phrase. */
  keyword: string;
  /** Optional: competitor content (for benchmark target). */
  competitor?: string;
  /** Optional: expected minimum word count for full depth score. */
  minWords?: number;
}

export interface SubScore {
  id: string;
  label: string;
  weight: number;       // 0..1
  score: number;        // 0..100
  maxScore: number;     // always 100
  rule: string;
  evidence: string[];
  fixes: { impact: "high" | "medium" | "low"; text: string }[];
}

export interface AuditResult {
  overall: number;
  subScores: SubScore[];
  allFixes: { impact: "high" | "medium" | "low"; area: string; text: string }[];
  metrics: {
    wordCount: number;
    uniqueWords: number;
    headingCounts: { h1: number; h2: number; h3: number; h4: number; h5: number; h6: number };
    internalLinks: number;
    externalLinks: number;
    images: number;
    imagesWithoutAlt: number;
    title: string;
    metaDescription: string;
    hasSchema: boolean;
    schemaTypes: string[];
    fleschScore: number;
    keywordDensity: number;
  };
  competitorWordCount?: number;
  recommendation: string;
}

const WEIGHTS = {
  titleMeta: 0.15,
  headings: 0.15,
  keyword: 0.20,
  depth: 0.15,
  links: 0.10,
  images: 0.10,
  schema: 0.10,
  readability: 0.05,
} as const;

/** Strip HTML tags + entities to plain text. */
export function stripHtml(html: string): string {
  return html
    .replace(/<script[\s\S]*?<\/script>/gi, "")
    .replace(/<style[\s\S]*?<\/style>/gi, "")
    .replace(/<noscript[\s\S]*?<\/noscript>/gi, "")
    .replace(/<!--[\s\S]*?-->/g, "")
    .replace(/<[^>]+>/g, " ")
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&[a-z]+;/gi, " ")
    .replace(/\s+/g, " ")
    .trim();
}

/** Extract <title> from HTML. */
export function extractTitle(html: string): string {
  const m = html.match(/<title[^>]*>([\s\S]*?)<\/title>/i);
  return m ? m[1]!.replace(/\s+/g, " ").trim() : "";
}

/** Extract <meta name="description">. */
export function extractMetaDescription(html: string): string {
  const m = html.match(/<meta[^>]+name=["']description["'][^>]+content=["']([\s\S]*?)["']/i);
  if (m) return m[1]!.replace(/\s+/g, " ").trim();
  const m2 = html.match(/<meta[^>]+content=["']([\s\S]*?)["'][^>]+name=["']description["']/i);
  return m2 ? m2[1]!.replace(/\s+/g, " ").trim() : "";
}

/** Count headings by level. */
export function countHeadings(html: string): { h1: number; h2: number; h3: number; h4: number; h5: number; h6: number } {
  const out = { h1: 0, h2: 0, h3: 0, h4: 0, h5: 0, h6: 0 };
  for (const lvl of Object.keys(out) as (keyof typeof out)[]) {
    const re = new RegExp(`<${lvl}\\b[^>]*>`, "gi");
    const matches = html.match(re);
    out[lvl] = matches ? matches.length : 0;
  }
  return out;
}

/** Extract anchor hrefs. */
export function extractLinks(html: string): { internal: number; external: number } {
  const re = /<a\b[^>]*href=["']([^"']+)["']/gi;
  let m: RegExpExecArray | null;
  let internal = 0;
  let external = 0;
  while ((m = re.exec(html)) !== null) {
    const href = m[1]!.trim();
    if (!href) continue;
    if (/^(https?:)?\/\//i.test(href) || href.startsWith("www.")) external++;
    else internal++;
  }
  return { internal, external };
}

/** Extract images + count missing alt. */
export function extractImages(html: string): { total: number; missingAlt: number } {
  const re = /<img\b[^>]*>/gi;
  let total = 0;
  let missingAlt = 0;
  let m: RegExpExecArray | null;
  while ((m = re.exec(html)) !== null) {
    total++;
    const tag = m[0]!;
    const altMatch = tag.match(/\balt=["']([^"']*)["']/i);
    if (!altMatch || altMatch[1]!.trim() === "") missingAlt++;
  }
  return { total, missingAlt };
}

/** Detect JSON-LD schema blocks + types. */
export function detectSchema(html: string): { has: boolean; types: string[] } {
  const re = /<script[^>]+type=["']application\/ld\+json["'][^>]*>([\s\S]*?)<\/script>/gi;
  const types = new Set<string>();
  let m: RegExpExecArray | null;
  while ((m = re.exec(html)) !== null) {
    const json = m[1]!.trim();
    try {
      const parsed = JSON.parse(json);
      const collect = (obj: unknown) => {
        if (Array.isArray(obj)) obj.forEach(collect);
        else if (obj && typeof obj === "object") {
          const o = obj as Record<string, unknown>;
          if ("@type" in o) {
            const t = o["@type"];
            if (typeof t === "string") types.add(t);
            else if (Array.isArray(t)) t.forEach((x) => typeof x === "string" && types.add(x));
          }
          if ("@graph" in o && Array.isArray(o["@graph"])) collect(o["@graph"]);
        }
      };
      collect(parsed);
    } catch {
      types.add("(invalid JSON)");
    }
  }
  return { has: types.size > 0, types: Array.from(types) };
}

/** Tokenize text into lowercase word tokens. */
export function tokenize(text: string): string[] {
  return text.toLowerCase().split(/[^a-z0-9]+/i).map((t) => t.trim()).filter(Boolean);
}

/** Count keyword occurrences (phrase or single word). */
export function countKeyword(text: string, keyword: string): { count: number; density: number } {
  if (!keyword.trim()) return { count: 0, density: 0 };
  const words = tokenize(text);
  if (words.length === 0) return { count: 0, density: 0 };
  const kwTokens = tokenize(keyword).filter(Boolean);
  if (kwTokens.length === 0) return { count: 0, density: 0 };
  let count = 0;
  if (kwTokens.length === 1) {
    const kw = kwTokens[0]!;
    for (const w of words) if (w === kw) count++;
  } else {
    const joined = words.join(" ");
    const phrase = kwTokens.join(" ");
    let idx = joined.indexOf(phrase);
    while (idx !== -1) { count++; idx = joined.indexOf(phrase, idx + phrase.length); }
  }
  return { count, density: (count / words.length) * 100 };
}

/** Flesch Reading Ease score (approximation). */
export function fleschReadingEase(text: string): number {
  const words = tokenize(text);
  if (words.length === 0) return 0;
  const sentences = text.split(/[.!?]+/).filter((s) => s.trim().length > 0);
  const sentenceCount = Math.max(1, sentences.length);
  let syllables = 0;
  for (const w of words) syllables += countSyllables(w);
  const wordsPerSentence = words.length / sentenceCount;
  const syllablesPerWord = syllables / words.length;
  const score = 206.835 - 1.015 * wordsPerSentence - 84.6 * syllablesPerWord;
  return Math.max(0, Math.min(100, Math.round(score)));
}

/** Count syllables in a word (heuristic). */
export function countSyllables(word: string): number {
  word = word.toLowerCase().replace(/[^a-z]/g, "");
  if (!word) return 0;
  if (word.length <= 3) return 1;
  word = word.replace(/(?:[^laeiouy]es|ed|[^laeiouy]e)$/, "");
  word = word.replace(/^y/, "");
  const m = word.match(/[aeiouy]{1,2}/g);
  return m ? m.length : 1;
}

/** Score title/meta sub-area. */
function scoreTitleMeta(title: string, description: string, keyword: string): SubScore {
  const evidence: string[] = [];
  const fixes: SubScore["fixes"] = [];
  let score = 0;

  if (title) {
    score += 30;
    evidence.push(`Title: "${title}" (${title.length} chars)`);
    if (title.length >= 30 && title.length <= 60) { score += 20; evidence.push("Title length in ideal 30–60 range."); }
    else if (title.length > 60) { evidence.push(`Title is ${title.length} chars — over 60.`); fixes.push({ impact: "medium", text: "Shorten title to 30–60 chars." }); }
    else { evidence.push(`Title is ${title.length} chars — under 30.`); fixes.push({ impact: "low", text: "Expand title to at least 30 chars." }); }
    if (keyword && title.toLowerCase().includes(keyword.toLowerCase())) { score += 20; evidence.push("Keyword found in title."); }
    else if (keyword) { evidence.push("Keyword not in title."); fixes.push({ impact: "high", text: "Add the target keyword to the title." }); }
  } else {
    evidence.push("No <title> tag found.");
    fixes.push({ impact: "high", text: "Add a unique <title> tag with the keyword." });
  }

  if (description) {
    score += 15;
    evidence.push(`Meta description: ${description.length} chars`);
    if (description.length >= 70 && description.length <= 160) { score += 15; evidence.push("Description length in ideal 70–160 range."); }
    else if (description.length > 160) { evidence.push(`Description is ${description.length} chars — over 160.`); fixes.push({ impact: "medium", text: "Shorten description to 70–160 chars." }); }
    else { evidence.push(`Description is ${description.length} chars — under 70.`); fixes.push({ impact: "low", text: "Expand description to at least 70 chars." }); }
  } else {
    evidence.push("No meta description found.");
    fixes.push({ impact: "high", text: "Add a meta description with the keyword near the front." });
  }

  return {
    id: "title-meta",
    label: "Title & Meta",
    weight: WEIGHTS.titleMeta,
    score: Math.min(100, score),
    maxScore: 100,
    rule: "Title 30–60 chars with keyword; description 70–160 chars with keyword.",
    evidence,
    fixes,
  };
}

/** Score headings structure. */
function scoreHeadings(headings: { h1: number; h2: number; h3: number; h4: number; h5: number; h6: number }, html: string, keyword: string): SubScore {
  const evidence: string[] = [];
  const fixes: SubScore["fixes"] = [];
  let score = 0;

  if (headings.h1 === 1) { score += 40; evidence.push("Exactly 1 <h1> — good."); }
  else if (headings.h1 === 0) { evidence.push("No <h1> tag."); fixes.push({ impact: "high", text: "Add exactly one <h1> with the primary keyword." }); }
  else { evidence.push(`${headings.h1} <h1> tags — should be 1.`); fixes.push({ impact: "high", text: "Use exactly one <h1> per page." }); }

  if (headings.h2 >= 2) { score += 30; evidence.push(`${headings.h2} <h2> tags — good structure.`); }
  else if (headings.h2 > 0) { evidence.push(`Only ${headings.h2} <h2> tag(s).`); fixes.push({ impact: "medium", text: "Add more <h2> sections (aim for 2+)."}); }
  else { evidence.push("No <h2> tags."); fixes.push({ impact: "medium", text: "Add <h2> subheadings to break up content." }); }

  // Check keyword in any heading.
  const allHeadingsText = (html.match(/<h[1-6][^>]*>([\s\S]*?)<\/h[1-6]>/gi) || []).join(" ");
  const plain = stripHtml(allHeadingsText);
  if (keyword && plain.toLowerCase().includes(keyword.toLowerCase())) {
    score += 30; evidence.push("Keyword found in a heading.");
  } else if (keyword) {
    evidence.push("Keyword not in any heading.");
    fixes.push({ impact: "medium", text: "Use the keyword in at least one <h2> or <h3>." });
  } else {
    score += 15;
  }

  return {
    id: "headings",
    label: "Headings",
    weight: WEIGHTS.headings,
    score: Math.min(100, score),
    maxScore: 100,
    rule: "Exactly 1 <h1>; 2+ <h2>; keyword in a heading.",
    evidence,
    fixes,
  };
}

/** Score keyword coverage. */
function scoreKeyword(text: string, keyword: string): SubScore {
  const evidence: string[] = [];
  const fixes: SubScore["fixes"] = [];
  let score = 0;
  if (!keyword.trim()) {
    evidence.push("No keyword provided — coverage scored at 0.");
    fixes.push({ impact: "high", text: "Provide a target keyword to score coverage." });
    return { id: "keyword", label: "Keyword Coverage", weight: WEIGHTS.keyword, score: 0, maxScore: 100, rule: "Keyword in first 100 words; density 0.5–2.5%; in headings.", evidence, fixes };
  }
  const { count, density } = countKeyword(text, keyword);
  const words = tokenize(text);
  const first100 = words.slice(0, 100).join(" ");
  if (first100.toLowerCase().includes(keyword.toLowerCase())) {
    score += 30; evidence.push("Keyword appears in first 100 words.");
  } else {
    evidence.push("Keyword missing from first 100 words.");
    fixes.push({ impact: "high", text: "Use the keyword in the first 100 words (intro paragraph)." });
  }
  if (density >= 0.5 && density <= 2.5) { score += 40; evidence.push(`Density ${density.toFixed(2)}% — within 0.5–2.5% range.`); }
  else if (density > 2.5) { evidence.push(`Density ${density.toFixed(2)}% — over 2.5%, possible stuffing.`); fixes.push({ impact: "high", text: "Reduce keyword density below 2.5% to avoid stuffing." }); }
  else if (count > 0) { evidence.push(`Density ${density.toFixed(2)}% — under 0.5%.`); fixes.push({ impact: "medium", text: "Increase keyword usage to at least 0.5% density." }); }
  else { evidence.push("Keyword not found anywhere in content."); fixes.push({ impact: "high", text: "Add the keyword to the content body." }); }
  if (count >= 3) { score += 30; evidence.push(`Keyword appears ${count} time(s).`); }
  else if (count > 0) { score += 15; evidence.push(`Keyword appears ${count} time(s) — consider more.`); fixes.push({ impact: "low", text: "Use the keyword 3+ times naturally." }); }
  return { id: "keyword", label: "Keyword Coverage", weight: WEIGHTS.keyword, score: Math.min(100, score), maxScore: 100, rule: "Keyword in first 100 words; density 0.5–2.5%; 3+ mentions.", evidence, fixes };
}

/** Score content depth. */
function scoreDepth(wordCount: number, minWords: number, competitor?: string): SubScore {
  const evidence: string[] = [];
  const fixes: SubScore["fixes"] = [];
  const target = competitor ? tokenize(stripHtml(competitor)).length : minWords;
  let score = 0;
  evidence.push(`Word count: ${wordCount}`);
  if (target) evidence.push(`Target: ${target} words${competitor ? " (competitor)" : ""}`);
  if (wordCount >= 300) { score += 30; evidence.push("Above 300 words — minimum for indexing."); }
  else { evidence.push("Under 300 words — thin content."); fixes.push({ impact: "high", text: "Expand content to at least 300 words." }); }
  if (target && wordCount >= target) { score += 50; evidence.push("Meets or exceeds target word count."); }
  else if (target) { evidence.push(`Short of target by ${target - wordCount} words.`); fixes.push({ impact: "medium", text: `Add ~${target - wordCount} more words to match target.` }); }
  else if (wordCount >= 600) { score += 50; evidence.push("Above 600 words — good depth."); }
  else { score += 25; fixes.push({ impact: "low", text: "Aim for 600+ words for in-depth content." }); }
  if (wordCount >= 1200) { score += 20; evidence.push("Above 1200 words — comprehensive."); }
  return { id: "depth", label: "Content Depth", weight: WEIGHTS.depth, score: Math.min(100, score), maxScore: 100, rule: "300+ words minimum; match competitor or aim for 600–1200+.", evidence, fixes };
}

/** Score links. */
function scoreLinks(internal: number, external: number): SubScore {
  const evidence: string[] = [];
  const fixes: SubScore["fixes"] = [];
  let score = 0;
  evidence.push(`Internal links: ${internal}; external links: ${external}`);
  if (internal >= 2) { score += 50; evidence.push("Good internal linking (2+)."); }
  else { evidence.push(`Only ${internal} internal link(s).`); fixes.push({ impact: "medium", text: "Add 2+ internal links to related pages." }); }
  if (external >= 1) { score += 30; evidence.push("Has at least 1 external link."); }
  else { evidence.push("No external links."); fixes.push({ impact: "low", text: "Add 1+ authoritative external link." }); }
  if (internal + external >= 3) { score += 20; }
  return { id: "links", label: "Links", weight: WEIGHTS.links, score: Math.min(100, score), maxScore: 100, rule: "2+ internal links; 1+ external link.", evidence, fixes };
}

/** Score images/alt. */
function scoreImages(total: number, missingAlt: number): SubScore {
  const evidence: string[] = [];
  const fixes: SubScore["fixes"] = [];
  let score = 0;
  evidence.push(`Images: ${total}; missing alt: ${missingAlt}`);
  if (total === 0) { evidence.push("No images."); fixes.push({ impact: "medium", text: "Add at least 1 relevant image with descriptive alt text." }); return { id: "images", label: "Images & Alt", weight: WEIGHTS.images, score: 30, maxScore: 100, rule: "1+ images; all images have alt text.", evidence, fixes }; }
  score += 30;
  if (missingAlt === 0) { score += 70; evidence.push("All images have alt text — good."); }
  else { evidence.push(`${missingAlt} image(s) missing alt text.`); fixes.push({ impact: "high", text: `Add alt text to ${missingAlt} image(s).` }); }
  return { id: "images", label: "Images & Alt", weight: WEIGHTS.images, score: Math.min(100, score), maxScore: 100, rule: "1+ images; all images have alt text.", evidence, fixes };
}

/** Score schema/structured data. */
function scoreSchema(schema: { has: boolean; types: string[] }): SubScore {
  const evidence: string[] = [];
  const fixes: SubScore["fixes"] = [];
  let score = 0;
  if (schema.has) {
    score += 70;
    evidence.push(`Schema types detected: ${schema.types.join(", ")}`);
    if (schema.types.some((t) => ["Article", "BlogPosting", "Product", "FAQPage", "HowTo", "Recipe", "VideoObject", "BreadcrumbList", "Organization", "WebPage"].includes(t))) {
      score += 30; evidence.push("Includes a Google rich-result eligible type.");
    } else { fixes.push({ impact: "low", text: "Consider adding a rich-result eligible schema (Article, FAQPage, HowTo, etc.)." }); }
  } else {
    evidence.push("No JSON-LD schema detected.");
    fixes.push({ impact: "medium", text: "Add JSON-LD structured data (Article, FAQPage, or HowTo)." });
  }
  return { id: "schema", label: "Schema / Structured Data", weight: WEIGHTS.schema, score: Math.min(100, score), maxScore: 100, rule: "JSON-LD with a rich-result eligible type.", evidence, fixes };
}

/** Score readability. */
function scoreReadability(flesch: number): SubScore {
  const evidence: string[] = [];
  const fixes: SubScore["fixes"] = [];
  let score = 0;
  evidence.push(`Flesch Reading Ease: ${flesch}`);
  if (flesch >= 60 && flesch <= 70) { score = 100; evidence.push("Ideal range (60–70) — plain English."); }
  else if (flesch >= 50 && flesch < 60) { score = 80; evidence.push("Fairly easy (50–60)."); }
  else if (flesch > 70 && flesch <= 80) { score = 80; evidence.push("Easy (70–80)."); }
  else if (flesch >= 30 && flesch < 50) { score = 60; evidence.push("Difficult (30–50)."); fixes.push({ impact: "low", text: "Simplify sentences for broader readability." }); }
  else if (flesch < 30) { score = 30; evidence.push("Very difficult (<30)."); fixes.push({ impact: "medium", text: "Break up long sentences; use simpler words." }); }
  else { score = 70; evidence.push("Very easy (>80)."); }
  return { id: "readability", label: "Readability", weight: WEIGHTS.readability, score, maxScore: 100, rule: "Flesch Reading Ease 60–70 (plain English).", evidence, fixes };
}

/** Main audit entry. */
export function auditContent(input: AuditInput): AuditResult | { error: string } {
  if (!input.content.trim()) return { error: "Content is required." };
  if (!input.keyword.trim()) return { error: "Target keyword is required." };

  const isHtml = /<\/?[a-z][\s\S]*>/i.test(input.content);
  const html = isHtml ? input.content : "";
  const text = isHtml ? stripHtml(input.content) : input.content;

  const title = extractTitle(html);
  const metaDescription = extractMetaDescription(html);
  const headings = countHeadings(html);
  const { internal, external } = extractLinks(html);
  const { total: images, missingAlt: imagesWithoutAlt } = extractImages(html);
  const schema = detectSchema(html);
  const words = tokenize(text);
  const wordCount = words.length;
  const uniqueWords = new Set(words).size;
  const fleschScore = fleschReadingEase(text);
  const { density: keywordDensity } = countKeyword(text, input.keyword);

  const subScores: SubScore[] = [
    scoreTitleMeta(title, metaDescription, input.keyword),
    scoreHeadings(headings, html, input.keyword),
    scoreKeyword(text, input.keyword),
    scoreDepth(wordCount, input.minWords ?? 600, input.competitor),
    scoreLinks(internal, external),
    scoreImages(images, imagesWithoutAlt),
    scoreSchema(schema),
    scoreReadability(fleschScore),
  ];

  const overall = Math.round(subScores.reduce((sum, s) => sum + s.score * s.weight, 0));
  const allFixes: AuditResult["allFixes"] = [];
  for (const s of subScores) for (const f of s.fixes) allFixes.push({ impact: f.impact, area: s.label, text: f.text });
  // Sort: high → medium → low.
  const order = { high: 0, medium: 1, low: 2 };
  allFixes.sort((a, b) => order[a.impact] - order[b.impact]);

  const competitorWordCount = input.competitor ? tokenize(stripHtml(input.competitor)).length : undefined;
  const topFix = allFixes[0];
  const recommendation = topFix
    ? `Score ${overall}/100. Top priority (${topFix.impact}): ${topFix.text}`
    : `Score ${overall}/100. Content is in good shape — minor improvements only.`;

  return {
    overall,
    subScores,
    allFixes,
    metrics: {
      wordCount,
      uniqueWords,
      headingCounts: headings,
      internalLinks: internal,
      externalLinks: external,
      images,
      imagesWithoutAlt,
      title,
      metaDescription,
      hasSchema: schema.has,
      schemaTypes: schema.types,
      fleschScore,
      keywordDensity,
    },
    competitorWordCount,
    recommendation,
  };
}

/** Build a shareable report (HTML) for download. */
export function buildHtmlReport(result: AuditResult, keyword: string): string {
  const lines: string[] = [];
  lines.push("<!doctype html><html><head><meta charset='utf-8'><title>SEO Audit Report</title>");
  lines.push("<style>body{font-family:Arial;max-width:800px;margin:2rem auto;padding:1rem;color:#222}h1{color:#1a0dab}.sub{margin:1rem 0;padding:1rem;border:1px solid #ddd;border-radius:6px}.fix{color:#b00}.ok{color:#080}</style>");
  lines.push("</head><body>");
  lines.push(`<h1>SEO Content Scorecard Audit</h1>`);
  lines.push(`<p>Overall score: <strong>${result.overall}/100</strong>. Target keyword: <em>${keyword}</em>.</p>`);
  lines.push(`<p>${result.recommendation}</p>`);
  for (const s of result.subScores) {
    lines.push(`<div class='sub'><h3>${s.label} — ${s.score}/100 (weight ${(s.weight * 100).toFixed(0)}%)</h3>`);
    lines.push(`<p><em>Rule:</em> ${s.rule}</p>`);
    lines.push(`<ul>${s.evidence.map((e) => `<li>${e}</li>`).join("")}</ul>`);
    if (s.fixes.length > 0) lines.push(`<p class='fix'>Fixes:</p><ul>${s.fixes.map((f) => `<li>[${f.impact}] ${f.text}</li>`).join("")}</ul>`);
    lines.push("</div>");
  }
  lines.push("</body></html>");
  return lines.join("\n");
}
