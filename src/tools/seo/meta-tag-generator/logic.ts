/**
 * Meta Tag Generator — pure logic.
 */

export interface MetaInput {
  title: string;
  description: string;
  url?: string;
  siteName?: string;
  image?: string;
  imageAlt?: string;
  author?: string;
  keywords?: string[];
  robots?: { index?: boolean; follow?: boolean; noarchive?: boolean; nosnippet?: boolean };
  canonical?: string;
  twitterCard?: "summary" | "summary_large_image" | "player" | "app";
  twitterSite?: string;       // @handle
  twitterCreator?: string;    // @handle
  ogType?: "website" | "article" | "product" | "profile" | "video.movie";
  publishedTime?: string;     // ISO 8601
  modifiedTime?: string;
  section?: string;           // article section
  tag?: string[];
  locale?: string;            // en_US
  themeColor?: string;        // #RRGGBB
  favicon?: string;           // /favicon.ico
  appleTouchIcon?: string;
  manifest?: string;          // /manifest.json
  refreshSeconds?: number;
  refreshUrl?: string;
  rating?: "general" | "mature" | "restricted" | "14 years" | "safe for kids";
  hreflang?: { lang: string; url: string }[];
}

export interface MetaResult {
  basic: string;
  openGraph: string;
  twitter: string;
  jsonLd?: string;
  extras: string;
  /** Google SERP snippet preview (title + URL + description). */
  serpPreview: { title: string; url: string; description: string; truncated: boolean };
  /** Pixel-width estimate of title (Google cutoff ~580px). */
  titlePixelWidth: number;
  /** Pixel-width estimate of description (Google cutoff ~990px for mobile, ~920 desktop). */
  descriptionPixelWidth: number;
  warnings: string[];
  fullHtml: string;
}

/** Approximate pixel width of text at typical SERP font (Arial ~16px). */
function estimatePixelWidth(text: string): number {
  // Average Arial char widths at 16px (approximate, lowercase/uppercase differ)
  // Use a simple weighted sum: lowercase ~8px, uppercase ~10px, digits ~8px, punctuation ~4-6px, space ~4px
  let width = 0;
  for (const ch of text) {
    if (ch === " ") width += 4;
    else if (ch === "i" || ch === "l" || ch === "1" || ch === "|" || ch === ".") width += 4;
    else if (ch === "I" || ch === "J") width += 5;
    else if (/[mwMW]/.test(ch)) width += 13;
    else if (/[A-Z]/.test(ch)) width += 10;
    else if (/[a-z]/.test(ch)) width += 7.5;
    else if (/[0-9]/.test(ch)) width += 8;
    else if (/[!,;:]/.test(ch)) width += 4;
    else width += 6;
  }
  return Math.round(width);
}

function attr(s: string): string {
  return s.replace(/&/g, "&amp;").replace(/"/g, "&quot;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}

export function generateMetaTags(input: MetaInput): MetaResult | { error: string } {
  if (!input.title) return { error: "Title is required." };
  if (!input.description) return { error: "Description is required." };
  if (input.title.length > 200) return { error: "Title is too long (max 200 chars)." };
  if (input.description.length > 500) return { error: "Description is too long (max 500 chars)." };

  const warnings: string[] = [];
  const titlePx = estimatePixelWidth(input.title);
  const descPx = estimatePixelWidth(input.description);
  if (titlePx > 580) warnings.push(`Title pixel width (${titlePx}px) exceeds Google's ~580px cutoff — title will be truncated in SERP.`);
  if (input.title.length > 60) warnings.push(`Title length (${input.title.length} chars) exceeds recommended 60 chars.`);
  if (input.description.length > 160) warnings.push(`Description length (${input.description.length} chars) exceeds recommended 160 chars.`);
  if (descPx > 990) warnings.push(`Description pixel width (${descPx}px) exceeds mobile cutoff (~990px).`);

  // Basic meta tags
  const basicLines: string[] = [
    `<meta charset="utf-8">`,
    `<meta name="viewport" content="width=device-width, initial-scale=1">`,
    `<title>${attr(input.title)}</title>`,
    `<meta name="description" content="${attr(input.description)}">`,
  ];
  if (input.author) basicLines.push(`<meta name="author" content="${attr(input.author)}">`);
  if (input.keywords?.length) basicLines.push(`<meta name="keywords" content="${attr(input.keywords.join(", "))}">`);
  const robots = input.robots ?? {};
  const robotsParts: string[] = [];
  robotsParts.push(robots.index === false ? "noindex" : "index");
  robotsParts.push(robots.follow === false ? "nofollow" : "follow");
  if (robots.noarchive) robotsParts.push("noarchive");
  if (robots.nosnippet) robotsParts.push("nosnippet");
  basicLines.push(`<meta name="robots" content="${robotsParts.join(", ")}">`);
  if (input.canonical) basicLines.push(`<link rel="canonical" href="${attr(input.canonical)}">`);

  // Open Graph
  const ogLines: string[] = [
    `<meta property="og:title" content="${attr(input.title)}">`,
    `<meta property="og:description" content="${attr(input.description)}">`,
    `<meta property="og:type" content="${input.ogType ?? "website"}">`,
  ];
  if (input.url) ogLines.push(`<meta property="og:url" content="${attr(input.url)}">`);
  if (input.siteName) ogLines.push(`<meta property="og:site_name" content="${attr(input.siteName)}">`);
  if (input.image) {
    ogLines.push(`<meta property="og:image" content="${attr(input.image)}">`);
    if (input.imageAlt) ogLines.push(`<meta property="og:image:alt" content="${attr(input.imageAlt)}">`);
  }
  if (input.locale) ogLines.push(`<meta property="og:locale" content="${attr(input.locale)}">`);
  if (input.ogType === "article") {
    if (input.publishedTime) ogLines.push(`<meta property="article:published_time" content="${attr(input.publishedTime)}">`);
    if (input.modifiedTime) ogLines.push(`<meta property="article:modified_time" content="${attr(input.modifiedTime)}">`);
    if (input.author) ogLines.push(`<meta property="article:author" content="${attr(input.author)}">`);
    if (input.section) ogLines.push(`<meta property="article:section" content="${attr(input.section)}">`);
    if (input.tag?.length) for (const t of input.tag) ogLines.push(`<meta property="article:tag" content="${attr(t)}">`);
  }

  // Twitter Card
  const twitterLines: string[] = [
    `<meta name="twitter:card" content="${input.twitterCard ?? "summary"}">`,
    `<meta name="twitter:title" content="${attr(input.title)}">`,
    `<meta name="twitter:description" content="${attr(input.description)}">`,
  ];
  if (input.twitterSite) twitterLines.push(`<meta name="twitter:site" content="${attr(input.twitterSite)}">`);
  if (input.twitterCreator) twitterLines.push(`<meta name="twitter:creator" content="${attr(input.twitterCreator)}">`);
  if (input.image) twitterLines.push(`<meta name="twitter:image" content="${attr(input.image)}">`);

  // Extras
  const extraLines: string[] = [];
  if (input.themeColor) extraLines.push(`<meta name="theme-color" content="${attr(input.themeColor)}">`);
  if (input.favicon) extraLines.push(`<link rel="icon" href="${attr(input.favicon)}">`);
  if (input.appleTouchIcon) extraLines.push(`<link rel="apple-touch-icon" href="${attr(input.appleTouchIcon)}">`);
  if (input.manifest) extraLines.push(`<link rel="manifest" href="${attr(input.manifest)}">`);
  if (input.rating) extraLines.push(`<meta name="rating" content="${attr(input.rating)}">`);
  if (input.refreshSeconds !== undefined) {
    extraLines.push(`<meta http-equiv="refresh" content="${input.refreshSeconds}${input.refreshUrl ? `; url=${attr(input.refreshUrl)}` : ""}">`);
  }
  if (input.hreflang?.length) {
    for (const h of input.hreflang) {
      extraLines.push(`<link rel="alternate" hreflang="${attr(h.lang)}" href="${attr(h.url)}">`);
    }
    // x-default
    if (input.url) extraLines.push(`<link rel="alternate" hreflang="x-default" href="${attr(input.url)}">`);
  }

  // JSON-LD (basic WebSite schema)
  const jsonLdObj: Record<string, unknown> = {
    "@context": "https://schema.org",
    "@type": input.ogType === "article" ? "Article" : input.ogType === "product" ? "Product" : "WebSite",
    name: input.title,
    description: input.description,
  };
  if (input.url) jsonLdObj.url = input.url;
  if (input.image) jsonLdObj.image = input.image;
  if (input.author) jsonLdObj.author = { "@type": "Person", name: input.author };
  if (input.publishedTime && input.ogType === "article") {
    jsonLdObj.datePublished = input.publishedTime;
    if (input.modifiedTime) jsonLdObj.dateModified = input.modifiedTime;
  }
  const jsonLd = `<script type="application/ld+json">\n${JSON.stringify(jsonLdObj, null, 2)}\n</script>`;

  // SERP preview (Google truncates title at ~580px, description at ~990px mobile / ~920 desktop)
  const serpTitle = titlePx > 580 ? input.title.slice(0, 60) + "…" : input.title;
  const serpDesc = descPx > 990 ? input.description.slice(0, 160) + "…" : input.description;
  const serpUrl = input.canonical || input.url || "https://example.com";

  const basic = basicLines.join("\n");
  const openGraph = ogLines.join("\n");
  const twitter = twitterLines.join("\n");
  const extras = extraLines.join("\n");
  const fullHtml = [basic, openGraph, twitter, extras, jsonLd].filter(Boolean).join("\n\n");

  return {
    basic,
    openGraph,
    twitter,
    jsonLd,
    extras,
    serpPreview: { title: serpTitle, url: serpUrl, description: serpDesc, truncated: titlePx > 580 || descPx > 990 },
    titlePixelWidth: titlePx,
    descriptionPixelWidth: descPx,
    warnings,
    fullHtml,
  };
}

/** Generate hreflang alternates from a list of locales + base URL. */
export function generateHreflang(baseUrl: string, locales: string[]): { lang: string; url: string }[] {
  return locales.map((locale) => ({
    lang: locale,
    url: `${baseUrl}/${locale === "en_US" ? "" : locale.toLowerCase().replace("_", "-") + "/"}`,
  }));
}
