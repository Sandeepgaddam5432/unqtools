/**
 * Task-based tool grouping — the cure for "which tool do I need?" confusion.
 *
 * Instead of dumping every tool in a category as one flat alphabetized grid,
 * each category is split into small job-oriented groups ("Page editing",
 * "Compress & optimize", "Protect & sign"…) so a user can find what they want
 * by *what they want to do*, not by guessing tool names.
 *
 * Pure + deterministic: a tool belongs to the FIRST group whose matcher hits
 * (name → keywords → description, in that order), else it falls into "Other".
 */

import type { CatalogItem } from "./catalog";
import type { ToolCategory, ToolManifest } from "./tool";

export interface ToolGroupDef {
  id: string;
  label: string;
  /** Short plain-language hint shown under the group heading. */
  blurb: string;
  /** Regex tested against "name keywords description". */
  match: RegExp;
}

interface ToolLike {
  id: string;
  name: string;
  keywords?: string[];
  description?: string;
  status?: string;
}

/** Stable order of groups per category. First match wins — so "convert from PDF"
 * is checked before generic page ops (e.g. "Extract Text from PDF" must land in
 * conversion, while "Extract PDF Pages" falls through to page editing). */
const PDF_GROUPS: ToolGroupDef[] = [
  { id: "convert-from", label: "Convert from PDF", blurb: "Pull text, images, tables or other formats out of a PDF.", match: /\bpdf\s?(-|to)?\s?(word|excel|image|html|text|epub|powerpoint|rtf|odt|ods|djvu|mobi|azw3|xps|postscript|pdfx)\b|extract (text|images|tables|attachments)/i },
  { id: "convert-to", label: "Convert to PDF", blurb: "Turn Word, images, HTML, Markdown and more into PDF.", match: /\b(html|markdown|texts?|images?|words?|excel|powerpoint|office|epubs?|svgs?|rtf|webpages?|urls?)\s?(to|-)?\s?pdf\b|make .* pdf|create pdf\b/i },
  { id: "compress", label: "Compress & optimize", blurb: "Shrink file size, repair, linearize and clean up PDFs.", match: /\b(compress\w*|optimiz\w*|reduc\w*|repair|lineariz\w*|clean|flatten|ocr)\b/i },
  { id: "protect", label: "Protect & sign", blurb: "Passwords, encryption, signatures, watermarks, redaction.", match: /\b(password|encrypt|decrypt|protect|security|sign|signature|watermark|stamp|redact|permission|unlock)\b/i },
  { id: "merge-split", label: "Merge & split", blurb: "Combine PDFs into one, or split one into many.", match: /\b(merge|combine|interleave|separate|split|organizer|side-by-side|2-up|2up)\b/i },
  { id: "page-edit", label: "Page editing", blurb: "Rotate, reorder, delete, extract, duplicate or insert pages.", match: /\b(rotate|reorder|reverse|delete|extract|duplicate|insert|n-up|booklet|blank|numbering|page number\w*)\b/i },
  { id: "layout", label: "Layout & design", blurb: "Backgrounds, borders, margins, headers, footers, crop and resize.", match: /\b(background|border|margin|header|footer|crop|resize|scale|page size|orientation|dimension|padding|overlay)\b/i },
  { id: "forms", label: "Forms & annotations", blurb: "Fill forms, add highlights, comments, links and bookmarks.", match: /\b(form|fill|annotation|highlight|comment|markup|bookmark|hyperlink|link|label|field)\b/i },
  { id: "inspect", label: "Inspect & analyze", blurb: "View metadata, read text, understand the document.", match: /\b(metadata|viewer|inspect|analyz\w*|read|info|compare|diff|checker|fonts?|properties|size|dimension)\b/i },
];

const DEVELOPER_GROUPS: ToolGroupDef[] = [
  { id: "calc", label: "Calculators & math", blurb: "Dates, bytes, CRC, CIDR and other dev math.", match: /\b(calculat\w*|calc)\b/i },
  { id: "format", label: "Format & beautify", blurb: "Indent, minify, prettify code and data files.", match: /\b(format\w*|beautif\w*|prettif\w*|minif\w*|indent\w*|compact\w*)\b/i },
  { id: "encode", label: "Encode & decode", blurb: "Base64, URL, hex, binary, JWT, ciphers — encode or decode anything.", match: /\b(encod\w*|decod\w*|base64|base32|url|hex|binary|jwt|escape|unicode|percent|cipher|encrypt\w*|decrypt\w*)\b/i },
  { id: "convert", label: "Convert & transpile", blurb: "Transform code or data between formats.", match: /\b(convert\w*|transpil\w*|to |from |\w+ to \w+)\b/i },
  { id: "generate", label: "Generate", blurb: "Create UUIDs, hashes, code, names and more.", match: /\b(generate\w*|creator?|uuid|hash|random|password|slug|boilerplate|template)\b/i },
  { id: "validate", label: "Validate & lint", blurb: "Check syntax, errors and best practices.", match: /\b(validat\w*|verif\w*|checker|check\w*|lint\w*|error|regex)\b/i },
  { id: "diff", label: "Diff & compare", blurb: "Compare two versions of code, text or data.", match: /\b(diff\w*|compare|similarity|conflict)\b/i },
  { id: "network", label: "HTTP & web", blurb: "Headers, endpoints, APIs and web debugging.", match: /\b(http|rest|api|header|endpoint|request|response|status|curl)\b/i },
];

const IMAGE_GROUPS: ToolGroupDef[] = [
  { id: "resize", label: "Resize & crop", blurb: "Change dimensions, crop and create thumbnails.", match: /\b(resize|crop|scale|thumbnail|aspect|ratio|dimension|size)\b/i },
  { id: "convert", label: "Convert format", blurb: "PNG ↔ JPG ↔ WebP ↔ GIF ↔ SVG ↔ ICO and more.", match: /\b(convert\w*|png|jpg|jpeg|webp|gif|svg|heic|ico|bmp|tiff|avif|format\w*)\b/i },
  { id: "compress", label: "Compress & optimize", blurb: "Shrink image file size without losing quality.", match: /\b(compress\w*|optimiz\w*|reduc\w*|minif\w*)\b/i },
  { id: "edit", label: "Edit & enhance", blurb: "Rotate, flip, filters, brightness, contrast, blur and more.", match: /\b(rotate|flip|mirror|filter|brightness|contrast|saturat|blur|sharpen|exposure|hue|gamma|vignette|border|round|adjust|color|invert|grayscale|sepia)\b/i },
  { id: "effects", label: "Effects & art", blurb: "Pixelate, glitch, mosaic, ASCII, sketch and fun effects.", match: /\b(pixel|glitch|mosaic|ascii|sketch|cartoon|effect|anaglyph|kaleido|dither|emboss|posterize|solarize|doodle|sticker|emoji)\b/i },
  { id: "organize", label: "Organize & batch", blurb: "Rename, watermark, collage, split and combine images.", match: /\b(rename|watermark|collage|split|combine|stitch|merge|batch|organize|sprite|tile|contact sheet|thumbnail|grid)\b/i },
];

const FILE_GROUPS: ToolGroupDef[] = [
  { id: "extract", label: "Extract archives", blurb: "Open ZIP, RAR, 7z, TAR and dozens of archive formats.", match: /\b(extract|unzip|unrar|un7z|untar|open|viewer|read|reader)\b|archive/i },
  { id: "compress", label: "Create archives", blurb: "Compress files into ZIP, GZIP, BZIP2 and more.", match: /\b(compress|create|zip|tar|gzip|bzip|7z|archive|make)\b/i },
  { id: "convert", label: "Convert files", blurb: "CSV ↔ Excel ↔ JSON ↔ XML, e-books and documents.", match: /\b(convert|csv|excel|json|xml|tsv|epub|mobi|azw3|pdf|word|text|odt|ods)\b/i },
  { id: "inspect", label: "Inspect & verify", blurb: "Hashes, metadata, hex views and file-type detection.", match: /\b(hash|checksum|metadata|hex|viewer|type|detect|integrity|verify|audit|inspect|lookup)\b/i },
  { id: "manage", label: "Manage & organize", blurb: "Rename, join, split, sort and clean up files.", match: /\b(rename|join|split|sort|merge|organize|clean|duplicate|find|tree|timestamp|extension|line ending|encoding)\b/i },
];

const TEXT_GROUPS: ToolGroupDef[] = [
  { id: "case", label: "Case & transform", blurb: "UPPERCASE, lowercase, Title Case, camelCase, reverse…", match: /\b(case|upper|lower|title|capital|camel|snake|kebab|pascal|reverse|scramble|pig latin)\b/i },
  { id: "format", label: "Format & clean", blurb: "Trim, strip, dedupe, replace, wrap and tidy text.", match: /\b(format|trim|strip|remove|dedupe|duplicate|replace|wrap|line break|indent|unindent|spaces|tabs|redact|mask)\b/i },
  { id: "count", label: "Count & analyze", blurb: "Words, characters, sentences, reading time, frequency.", match: /\b(count|word|character|sentence|paragraph|statistic|frequency|reading|length|width|syllable|tone|level|entropy)\b/i },
  { id: "convert", label: "Convert text", blurb: "Text ↔ binary, hex, base64, URL, Markdown, HTML…", match: /\b(convert|to |from |binary|hex|base64|url|markdown|html|slug|leetspeak|keyboard|numeric|letters)\b/i },
  { id: "cipher", label: "Ciphers & encode", blurb: "ROT13, Caesar, Vigenère, Morse and other codes.", match: /\b(cipher|encode|decrypt|encrypt|rot13|caesar|vigenere|morse|atbash|substitution|rot)\b/i },
  { id: "generate", label: "Generate text", blurb: "Lorem ipsum, filler words, random text and lists.", match: /\b(generate|lorem|filler|random|create|make)\b/i },
];

const SEO_GROUPS: ToolGroupDef[] = [
  { id: "schema", label: "Schema & structured data", blurb: "JSON-LD, FAQ, breadcrumbs, how-to and rich snippets.", match: /\b(schema|json-ld|structured data|faq|breadcrumb|how-to|rich snippet|local business|article|review)\b/i },
  { id: "onpage", label: "On-page SEO", blurb: "Meta tags, titles, headings, alt text, robots, sitemaps.", match: /\b(meta|title|description|heading|alt|canonical|hreflang|robots|sitemap|og |open graph|slug|pagination)\b/i },
  { id: "keyword", label: "Keywords & research", blurb: "Density, difficulty, grouping and long-tail ideas.", match: /\b(keyword|research|density|difficulty|cannibal|grouping|long-tail|match type|intent)\b/i },
  { id: "links", label: "Links & authority", blurb: "Backlinks, redirects, anchor text and link equity.", match: /\b(backlink|link|anchor|redirect|authority|domain|disavow|prospect|guest post|internal linking)\b/i },
  { id: "content", label: "Content analysis", blurb: "Readability, word counts, outlines and briefs.", match: /\b(readab|word count|content|outline|brief|text ratio|prun|tone|plagiarism)\b/i },
  { id: "ads", label: "Ads & analytics", blurb: "GA4 events, conversion tags, responsive ads, pixels.", match: /\b(ad|analytics|ga4|pixel|conversion|tracking|responsive search|remarketing)\b/i },
];

const NETWORK_GROUPS: ToolGroupDef[] = [
  { id: "encrypt", label: "Encrypt & hash", blurb: "AES, bcrypt, hashing and verification.", match: /\b(encrypt|decrypt|hash|aes|bcrypt|cipher|crypt|verify)\b/i },
  { id: "passwords", label: "Passwords & keys", blurb: "Generators, strength checks, TOTP and secure keys.", match: /\b(password|passphrase|pin|totp|otp|mfa|2fa|key|token|secret|entropy)\b/i },
  { id: "network", label: "IP & network", blurb: "Subnets, MAC addresses, DNS and network math.", match: /\b(ip|subnet|mac|dns|port|network|cidr|ipv4|ipv6|domain|whois|traceroute)\b/i },
  { id: "http", label: "HTTP & web", blurb: "Headers, status codes, MIME types, request parsing.", match: /\b(http|header|status|mime|user-agent|request|response|cookie|url|redirect)\b/i },
  { id: "audit", label: "Security audit", blurb: "CSP, certificates, PEM and vulnerability checks.", match: /\b(csp|security|vulnerab|pem|certificate|ssl|tls|audit|xss|injection|privacy|leak|hsts|preload)\b/i },
];

/** Group definitions per category (categories without a map get one "All" group). */
const GROUP_MAP: Record<string, ToolGroupDef[]> = {
  pdf: PDF_GROUPS,
  developer: DEVELOPER_GROUPS,
  image: IMAGE_GROUPS,
  file: FILE_GROUPS,
  text: TEXT_GROUPS,
  seo: SEO_GROUPS,
  "network-security": NETWORK_GROUPS,
};

export const ALL_GROUP_IDS: Record<string, string[]> = Object.fromEntries(
  Object.entries(GROUP_MAP).map(([cat, groups]) => [cat, groups.map((g) => g.id)])
);

/** Return the group id a tool belongs to (first match wins), or "other". */
export function groupIdFor(category: ToolCategory, tool: ToolLike): string {
  const groups = GROUP_MAP[category];
  if (!groups) return "other";
  const haystack = [
    tool.name,
    (tool.keywords ?? []).join(" "),
    (tool.description ?? "").slice(0, 160),
  ].join(" ");
  for (const g of groups) {
    if (g.match.test(haystack)) return g.id;
  }
  return "other";
}

export interface GroupedResult<T extends ToolLike> {
  group: ToolGroupDef | null; // null = "Other"
  items: T[];
}

/**
 * Group a category's tools into job-oriented buckets.
 * Items with status "planned" are always listed after done tools.
 */
export function groupTools<T extends ToolLike>(
  category: ToolCategory,
  tools: T[]
): GroupedResult<T>[] {
  const groups = GROUP_MAP[category] ?? [];
  const buckets = new Map<string, T[]>();
  for (const t of tools) {
    const id = groupIdFor(category, t);
    const key = id === "other" ? "__other__" : id;
    if (!buckets.has(key)) buckets.set(key, []);
    buckets.get(key)!.push(t);
  }
  const other = buckets.get("__other__") ?? [];
  const sortItems = (arr: T[]) =>
    [...arr].sort((a, b) => {
      const sa = a.status === "done" ? 0 : a.status === "beta" ? 1 : 2;
      const sb = b.status === "done" ? 0 : b.status === "beta" ? 1 : 2;
      return sa - sb || a.name.localeCompare(b.name);
    });

  const out: GroupedResult<T>[] = [];
  for (const g of groups) {
    const items = buckets.get(g.id);
    if (items && items.length > 0) out.push({ group: g, items: sortItems(items) });
  }
  if (other.length > 0) out.push({ group: null, items: sortItems(other) });
  return out;
}

/** Re-export helpers that act on the lightweight catalog directly. */
export function groupCatalog(
  category: ToolCategory,
  tools: readonly CatalogItem[]
): GroupedResult<CatalogItem>[] {
  return groupTools(category, tools as unknown as CatalogItem[]);
}

export type { ToolManifest };
