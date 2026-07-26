/**
 * Social Content Ideas — pure logic.
 * Keyword expansion, format suggestions, hashtag ideas.
 */

export interface ContentFormat {
  id: string;
  name: string;
  platforms: string[];
  effort: "low" | "medium" | "high";
  description: string;
  bestFor: string[];
}

export const CONTENT_FORMATS: ContentFormat[] = [
  { id: "carousel", name: "Carousel post", platforms: ["instagram", "linkedin"], effort: "medium", description: "Multi-slide swipe-through storytelling.", bestFor: ["educational", "listicles", "case-studies"] },
  { id: "reel", name: "Short video / Reel", platforms: ["instagram", "tiktok", "youtube"], effort: "high", description: "15-90s vertical video with hook.", bestFor: ["how-to", "trends", "demos"] },
  { id: "story", name: "Story (24h)", platforms: ["instagram", "tiktok", "facebook"], effort: "low", description: "Ephemeral content, behind-the-scenes.", bestFor: ["announcements", "polls", "behind-the-scenes"] },
  { id: "post", name: "Single-image post", platforms: ["instagram", "linkedin", "facebook"], effort: "medium", description: "One image + caption.", bestFor: ["quotes", "announcements", "highlight-reels"] },
  { id: "thread", name: "Text thread", platforms: ["twitter", "threads", "bluesky"], effort: "low", description: "Numbered mini-essay.", bestFor: ["how-to", "thought-leadership", "storytelling"] },
  { id: "live", name: "Live stream", platforms: ["youtube", "tiktok", "instagram"], effort: "high", description: "Real-time broadcast with Q&A.", bestFor: ["interviews", "demos", "Q&A"] },
  { id: "newsletter", name: "Newsletter issue", platforms: ["email", "linkedin"], effort: "high", description: "Long-form email broadcast.", bestFor: ["deep-dives", "essays", "round-ups"] },
  { id: "poll", name: "Poll", platforms: ["twitter", "linkedin", "instagram"], effort: "low", description: "Question with options.", bestFor: ["engagement", "research", "opinions"] },
];

export function getAllFormats(): ContentFormat[] {
  return [...CONTENT_FORMATS];
}

export function getFormatById(id: string): ContentFormat | null {
  return CONTENT_FORMATS.find((f) => f.id === id) ?? null;
}

export function filterFormatsByPlatform(platform: string): ContentFormat[] {
  return CONTENT_FORMATS.filter((f) => f.platforms.includes(platform));
}

export function filterFormatsByEffort(effort: ContentFormat["effort"]): ContentFormat[] {
  return CONTENT_FORMATS.filter((f) => f.effort === effort);
}

/** Keyword expansion based on common content angles. */
export function expandKeyword(keyword: string): string[] {
  const k = keyword.trim();
  if (!k) return [];
  const angles = [
    `why ${k} matters`,
    `how to start with ${k}`,
    `${k} mistakes to avoid`,
    `${k} for beginners`,
    `advanced ${k} tips`,
    `${k} case study`,
    `${k} tools I use`,
    `${k} myths debunked`,
    `${k} before and after`,
    `${k} FAQ`,
    `${k} glossary`,
    `${k} resources`,
    `common ${k} questions`,
    `${k} best practices`,
    `${k} for busy people`,
    `${k} on a budget`,
    `${k} trends 2025`,
    `${k} for teams`,
    `${k} for solopreneurs`,
    `${k} templates`,
  ];
  return angles;
}

/** Hook templates for headlines. */
export function hookTemplates(keyword: string): string[] {
  const k = keyword.trim() || "this";
  return [
    `I tried ${k} for 30 days. Here's what happened:`,
    `The truth about ${k} nobody tells you`,
    `5 ${k} tips that actually work`,
    `Why your ${k} isn't working (and how to fix it)`,
    `${k} explained in 60 seconds`,
    `Stop doing ${k} like this`,
    `The ultimate ${k} cheat sheet`,
    `What 100 days of ${k} taught me`,
    `${k} for absolute beginners`,
    `How I use ${k} to save 10 hours a week`,
  ];
}

/** Generate hashtag suggestions. */
export function hashtagIdeas(keyword: string): string[] {
  const k = keyword.trim().toLowerCase().replace(/\s+/g, "");
  if (!k) return [];
  const tags = [
    `#${k}`,
    `#${k}tips`,
    `#${k}life`,
    `#${k}community`,
    `#${k}daily`,
    `#${k}2025`,
    `#${k}coach`,
    `#learn${k}`,
    `#${k}lover`,
    `#${k}addict`,
    `#${k}expert`,
    `#${k}ideas`,
  ];
  return tags;
}

/** Generate content calendar for a week given a primary keyword. */
export function weeklyCalendar(keyword: string): Array<{ day: string; format: ContentFormat; idea: string }> {
  const days = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];
  const angles = expandKeyword(keyword);
  return days.map((day, i) => {
    const format = CONTENT_FORMATS[i % CONTENT_FORMATS.length];
    return { day, format, idea: angles[i % angles.length] || `More on ${keyword}` };
  });
}

/** Generate a single idea combining format + angle. */
export interface ContentIdea {
  id: string;
  format: ContentFormat;
  angle: string;
  hook: string;
  hashtags: string[];
  estimatedReach: "low" | "medium" | "high";
}

export function generateIdeas(keyword: string, count = 10): ContentIdea[] {
  const angles = expandKeyword(keyword);
  const hooks = hookTemplates(keyword);
  const tags = hashtagIdeas(keyword);
  const ideas: ContentIdea[] = [];
  for (let i = 0; i < Math.min(count, angles.length); i++) {
    const format = CONTENT_FORMATS[i % CONTENT_FORMATS.length];
    ideas.push({
      id: `idea-${i + 1}`,
      format,
      angle: angles[i],
      hook: hooks[i % hooks.length],
      hashtags: tags.slice(0, 5),
      estimatedReach: format.effort === "high" ? "high" : format.effort === "medium" ? "medium" : "low",
    });
  }
  return ideas;
}

/** Score an idea by virality potential 0-100. */
export function scoreIdea(idea: ContentIdea): number {
  let score = 30;
  if (idea.format.effort === "high") score += 20;
  if (idea.estimatedReach === "high") score += 25;
  else if (idea.estimatedReach === "medium") score += 15;
  if (idea.hashtags.length >= 3) score += 10;
  if (idea.hook.length > 0 && idea.hook.length < 80) score += 15;
  return Math.min(100, score);
}

/** Validate keyword. */
export function validateKeyword(keyword: string): string[] {
  const w: string[] = [];
  if (!keyword.trim()) w.push("Keyword is required.");
  if (keyword.length > 80) w.push("Keyword is very long — consider narrowing focus.");
  return w;
}

/** Export ideas as CSV. */
export function exportIdeasCSV(ideas: ContentIdea[]): string {
  const header = ["id", "format", "angle", "hook", "hashtags", "estimated_reach"];
  const rows = ideas.map((i) =>
    [i.id, i.format.name, `"${i.angle.replace(/"/g, '""')}"`, `"${i.hook.replace(/"/g, '""')}"`, `"${i.hashtags.join(" ")}"`, i.estimatedReach].join(","),
  );
  return [header.join(","), ...rows].join("\n");
}

/** Export ideas as text. */
export function exportIdeasText(ideas: ContentIdea[]): string {
  return ideas
    .map(
      (i) =>
        `### Idea ${i.id}\nFormat: ${i.format.name}\nAngle: ${i.angle}\nHook: ${i.hook}\nHashtags: ${i.hashtags.join(" ")}\nEstimated reach: ${i.estimatedReach}\n`,
    )
    .join("\n");
}

/** Get random idea. */
export function randomIdea(ideas: ContentIdea[]): ContentIdea | null {
  if (ideas.length === 0) return null;
  return ideas[Math.floor(Math.random() * ideas.length)];
}

/** Sort ideas by virality score (high to low). */
export function sortByVirality(ideas: ContentIdea[]): ContentIdea[] {
  return [...ideas].sort((a, b) => scoreIdea(b) - scoreIdea(a));
}

/** Group ideas by format. */
export function groupByFormat(ideas: ContentIdea[]): Record<string, ContentIdea[]> {
  const out: Record<string, ContentIdea[]> = {};
  for (const i of ideas) {
    const k = i.format.name;
    if (!out[k]) out[k] = [];
    out[k].push(i);
  }
  return out;
}

/** Trending categories. */
export const TRENDING_CATEGORIES: string[] = ["AI", "productivity", "wellness", "money", "fitness", "remote-work", "creator-economy", "side-hustle", "parenting", "cooking"];
