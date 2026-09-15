import {
  AlignLeft,
  AppWindow,
  Binary,
  BookOpenCheck,
  Bot,
  Boxes,
  Braces,
  Cake,
  Calculator,
  CalendarDays,
  Captions,
  CaseSensitive,
  Clock3,
  Code2,
  Coins,
  Crop,
  Database,
  Diff,
  Eraser,
  FileDigit,
  FileImage,
  FileKey,
  FileLock,
  FileSearch,
  FileText,
  Fingerprint,
  Gauge,
  Glasses,
  Globe,
  Hash,
  HeartPulse,
  Image,
  KeyRound,
  Landmark,
  Languages,
  Link2,
  ListChecks,
  Lock,
  Mic,
  Minimize2,
  Palette,
  PenLine,
  Percent,
  Pipette,
  QrCode,
  Receipt,
  Regex,
  Repeat,
  Replace,
  RotateCw,
  Ruler,
  Scaling,
  ScanSearch,
  ScanText,
  Scissors,
  Search,
  ShieldCheck,
  Sigma,
  Sparkles,
  Spline,
  SquareTerminal,
  Text,
  TextQuote,
  Timer,
  TrendingUp,
  Type,
  Workflow,
} from "lucide-react";
import type { LucideIcon } from "lucide-react";

export interface Tool {
  id: string;
  name: string;
  blurb: string;
  icon: LucideIcon;
  hot?: boolean;
}

export interface Category {
  id: string;
  label: string;
  short: string;
  icon: LucideIcon;
  count: number;
  tagline: string;
  /** tailwind class tokens (kept literal so the JIT picks them up) */
  iconTile: string; // gradient tile behind the category icon
  iconShadow: string;
  text: string;
  chipBorder: string;
  chipBg: string;
  cardTint: string; // subtle card background tint
  blob: string; // radial glow blob
  bar: string; // meter gradient
  dot: string;
  tools: Tool[];
}

export const CATEGORIES: Category[] = [
  {
    id: "pdf",
    label: "PDF & Documents",
    short: "PDF",
    icon: FileText,
    count: 305,
    tagline: "Merge, compress, convert & sign — entirely in-browser.",
    iconTile: "from-orange-500 to-amber-500",
    iconShadow: "shadow-orange-500/30",
    text: "text-orange-300",
    chipBorder: "border-orange-400/20",
    chipBg: "bg-orange-400/10",
    cardTint:
      "bg-[linear-gradient(135deg,rgba(249,115,22,0.14),rgba(234,88,12,0.05)_45%,transparent_75%)]",
    blob: "bg-orange-500/20",
    bar: "from-orange-400 to-amber-400",
    dot: "bg-orange-400",
    tools: [
      { id: "pdf-merge", name: "PDF Merge", blurb: "Combine PDFs into one file locally", icon: FileText, hot: true },
      { id: "pdf-compress", name: "PDF Compressor", blurb: "Shrink PDF size without uploads", icon: Minimize2, hot: true },
      { id: "pdf-split", name: "PDF Split", blurb: "Extract pages into separate files", icon: Scissors },
      { id: "pdf-to-image", name: "PDF to Image", blurb: "Render pages to PNG / JPG", icon: FileImage },
      { id: "pdf-sign", name: "Sign PDF", blurb: "Draw & place digital signatures", icon: PenLine, hot: true },
      { id: "pdf-ocr", name: "OCR Scanner", blurb: "Extract text from scanned PDFs", icon: ScanText },
      { id: "pdf-rotate", name: "Rotate Pages", blurb: "Fix orientation in seconds", icon: RotateCw },
      { id: "pdf-protect", name: "Protect PDF", blurb: "Encrypt with a local passphrase", icon: Lock },
      { id: "pdf-metadata", name: "Metadata Editor", blurb: "View & scrub document metadata", icon: FileSearch },
    ],
  },
  {
    id: "dev",
    label: "Developer & Code",
    short: "Dev & Code",
    icon: Code2,
    count: 342,
    tagline: "Formatters, encoders and debuggers with zero servers.",
    iconTile: "from-emerald-500 to-teal-500",
    iconShadow: "shadow-emerald-500/30",
    text: "text-emerald-300",
    chipBorder: "border-emerald-400/20",
    chipBg: "bg-emerald-400/10",
    cardTint:
      "bg-[linear-gradient(135deg,rgba(16,185,129,0.13),rgba(13,148,136,0.05)_45%,transparent_75%)]",
    blob: "bg-emerald-500/20",
    bar: "from-emerald-400 to-teal-400",
    dot: "bg-emerald-400",
    tools: [
      { id: "json-formatter", name: "JSON Formatter", blurb: "Prettify, validate & minify JSON", icon: Braces, hot: true },
      { id: "base64-encoder", name: "Base64 Encoder", blurb: "Encode & decode Base64 instantly", icon: FileDigit, hot: true },
      { id: "uuid-generator", name: "UUID Generator", blurb: "Cryptographically random v4 UUIDs", icon: Fingerprint, hot: true },
      { id: "regex-tester", name: "Regex Tester", blurb: "Live matching with group capture", icon: Regex },
      { id: "diff-checker", name: "Diff Checker", blurb: "Side-by-side text comparison", icon: Diff },
      { id: "color-picker", name: "Color Picker", blurb: "Pick, convert & contrast-check", icon: Pipette },
      { id: "jwt-decoder", name: "JWT Decoder", blurb: "Inspect tokens without a server", icon: FileKey },
      { id: "url-encoder", name: "URL Encoder", blurb: "Percent-encode query strings", icon: Link2 },
      { id: "timestamp", name: "Unix Timestamp", blurb: "Convert epochs to human dates", icon: Clock3 },
      { id: "markdown-preview", name: "Markdown Preview", blurb: "Render GitHub-flavored markdown", icon: BookOpenCheck },
    ],
  },
  {
    id: "security",
    label: "Security & Privacy",
    short: "Security",
    icon: ShieldCheck,
    count: 218,
    tagline: "Keys, hashes and vaults that never touch a network.",
    iconTile: "from-cyan-500 to-blue-600",
    iconShadow: "shadow-cyan-500/30",
    text: "text-cyan-300",
    chipBorder: "border-cyan-400/20",
    chipBg: "bg-cyan-400/10",
    cardTint:
      "bg-[linear-gradient(135deg,rgba(6,182,212,0.13),rgba(37,99,235,0.06)_45%,transparent_75%)]",
    blob: "bg-cyan-500/20",
    bar: "from-cyan-400 to-blue-500",
    dot: "bg-cyan-400",
    tools: [
      { id: "password-generator", name: "Password Generator", blurb: "Strong keys via WebCrypto", icon: KeyRound, hot: true },
      { id: "password-strength", name: "Strength Meter", blurb: "Entropy & crack-time analysis", icon: Gauge },
      { id: "hash-generator", name: "Hash Generator", blurb: "SHA-1/256/512 digests locally", icon: Hash, hot: true },
      { id: "aes-encryptor", name: "AES Encryptor", blurb: "AES-GCM text & file encryption", icon: Lock },
      { id: "totp-generator", name: "TOTP Authenticator", blurb: "Offline 2FA code generator", icon: Timer },
      { id: "file-encryptor", name: "File Vault", blurb: "Encrypt files before sharing", icon: FileLock },
      { id: "qr-generator", name: "QR Generator", blurb: "Offline QR for links & Wi-Fi", icon: QrCode },
      { id: "breach-scan", name: "Breach Scanner", blurb: "k-anonymity hash checking", icon: Database },
    ],
  },
  {
    id: "ai",
    label: "AI & Machine Learning",
    short: "AI",
    icon: Sparkles,
    count: 186,
    tagline: "On-device models — WebGPU & WASM, no API keys.",
    iconTile: "from-violet-500 to-fuchsia-500",
    iconShadow: "shadow-violet-500/30",
    text: "text-violet-300",
    chipBorder: "border-violet-400/20",
    chipBg: "bg-violet-400/10",
    cardTint:
      "bg-[linear-gradient(135deg,rgba(139,92,246,0.14),rgba(217,70,239,0.06)_45%,transparent_78%)]",
    blob: "bg-fuchsia-500/20",
    bar: "from-violet-400 to-fuchsia-400",
    dot: "bg-violet-400",
    tools: [
      { id: "ai-summarizer", name: "Text Summarizer", blurb: "On-device abstractive summaries", icon: Captions, hot: true },
      { id: "ai-sentiment", name: "Sentiment Analysis", blurb: "Tiny transformer, zero upload", icon: HeartPulse },
      { id: "ai-tokenizer", name: "Token Visualizer", blurb: "See how LLMs split your text", icon: AlignLeft },
      { id: "ai-embeddings", name: "Embedding Explorer", blurb: "Local vector similarity maps", icon: Boxes },
      { id: "ai-playground", name: "Prompt Playground", blurb: "Template & test prompt chains", icon: SquareTerminal },
      { id: "ai-local-llm", name: "Local LLM Chat", blurb: "WebGPU chat, fully private", icon: Bot, hot: true },
      { id: "ai-classifier", name: "Image Classifier", blurb: "Label images with WASM CNNs", icon: ScanSearch },
      { id: "ai-speech", name: "Speech to Text", blurb: "Whisper.cpp in your browser", icon: Mic },
    ],
  },
  {
    id: "calc",
    label: "Calculators & Math",
    short: "Calculators",
    icon: Calculator,
    count: 240,
    tagline: "Every calculator you will ever need, instant & exact.",
    iconTile: "from-amber-500 to-yellow-400",
    iconShadow: "shadow-amber-500/30",
    text: "text-amber-300",
    chipBorder: "border-amber-400/20",
    chipBg: "bg-amber-400/10",
    cardTint:
      "bg-[linear-gradient(135deg,rgba(245,158,11,0.13),rgba(234,179,8,0.05)_45%,transparent_75%)]",
    blob: "bg-amber-500/20",
    bar: "from-amber-400 to-yellow-300",
    dot: "bg-amber-400",
    tools: [
      { id: "calc-scientific", name: "Scientific Calc", blurb: "Trig, logs & precision math", icon: Calculator, hot: true },
      { id: "calc-units", name: "Unit Converter", blurb: "1,900+ unit pairs, offline", icon: Ruler },
      { id: "calc-currency", name: "Currency Calc", blurb: "Cached rates, works offline", icon: Coins },
      { id: "calc-bmi", name: "BMI & Health", blurb: "Body metrics with insights", icon: HeartPulse },
      { id: "calc-age", name: "Age Calculator", blurb: "Exact age down to seconds", icon: Cake },
      { id: "calc-percent", name: "Percentage Calc", blurb: "Discounts, tips & growth", icon: Percent },
      { id: "calc-loan", name: "Loan & EMI", blurb: "Amortization schedules locally", icon: Landmark },
      { id: "calc-date", name: "Date Difference", blurb: "Days between any two dates", icon: CalendarDays },
      { id: "calc-solver", name: "Equation Solver", blurb: "Symbolic algebra step-by-step", icon: Sigma },
      { id: "calc-tip", name: "Tip Splitter", blurb: "Split bills fairly, fast", icon: Receipt },
    ],
  },
  {
    id: "image",
    label: "Image & Media",
    short: "Image",
    icon: Image,
    count: 168,
    tagline: "Resize, compress & convert pixels without a cloud.",
    iconTile: "from-rose-500 to-red-400",
    iconShadow: "shadow-rose-500/30",
    text: "text-rose-300",
    chipBorder: "border-rose-400/20",
    chipBg: "bg-rose-400/10",
    cardTint:
      "bg-[linear-gradient(135deg,rgba(244,63,94,0.13),rgba(225,29,72,0.05)_45%,transparent_75%)]",
    blob: "bg-rose-500/20",
    bar: "from-rose-400 to-red-400",
    dot: "bg-rose-400",
    tools: [
      { id: "image-resizer", name: "Image Resizer", blurb: "Batch resize with smart crop", icon: Scaling, hot: true },
      { id: "image-compressor", name: "Image Compressor", blurb: "WebP/AVIF squeeze, offline", icon: Minimize2, hot: true },
      { id: "image-converter", name: "Format Converter", blurb: "PNG ⇄ JPG ⇄ WebP ⇄ AVIF", icon: Repeat },
      { id: "exif-remover", name: "EXIF Remover", blurb: "Strip location & camera data", icon: Eraser, hot: true },
      { id: "image-crop", name: "Smart Cropper", blurb: "Aspect presets & free crop", icon: Crop },
      { id: "svg-optimizer", name: "SVG Optimizer", blurb: "Minify vectors losslessly", icon: Spline },
      { id: "favicon-studio", name: "Favicon Studio", blurb: "Generate every icon size", icon: AppWindow },
      { id: "palette-pro", name: "Palette Extractor", blurb: "Pull colors from any photo", icon: Palette },
    ],
  },
  {
    id: "text",
    label: "Text & Writing",
    short: "Text",
    icon: Type,
    count: 142,
    tagline: "Count, convert, clean and compare any text.",
    iconTile: "from-sky-500 to-indigo-500",
    iconShadow: "shadow-sky-500/30",
    text: "text-sky-300",
    chipBorder: "border-sky-400/20",
    chipBg: "bg-sky-400/10",
    cardTint:
      "bg-[linear-gradient(135deg,rgba(14,165,233,0.13),rgba(99,102,241,0.05)_45%,transparent_75%)]",
    blob: "bg-sky-500/20",
    bar: "from-sky-400 to-indigo-400",
    dot: "bg-sky-400",
    tools: [
      { id: "word-counter", name: "Word Counter", blurb: "Words, chars & reading time", icon: Text, hot: true },
      { id: "case-converter", name: "Case Converter", blurb: "camelCase, snake_case & more", icon: CaseSensitive },
      { id: "lorem-ipsum", name: "Lorem Ipsum", blurb: "Generate placeholder copy", icon: TextQuote },
      { id: "slug-generator", name: "Slug Generator", blurb: "URL-safe slugs from titles", icon: Link2 },
      { id: "find-replace", name: "Find & Replace", blurb: "Bulk edits with regex power", icon: Replace },
      { id: "text-repeater", name: "Text Repeater", blurb: "Repeat with separators", icon: Repeat },
      { id: "readability", name: "Readability Score", blurb: "Flesch-Kincaid in-browser", icon: Glasses },
      { id: "list-cleaner", name: "List Cleaner", blurb: "Dedupe, sort & trim lines", icon: ListChecks },
      { id: "translator", name: "Offline Translator", blurb: "38 languages, on-device", icon: Languages },
    ],
  },
  {
    id: "seo",
    label: "SEO & Web",
    short: "SEO",
    icon: TrendingUp,
    count: 78,
    tagline: "Audit, preview & generate metadata like a pro.",
    iconTile: "from-lime-500 to-green-500",
    iconShadow: "shadow-lime-500/30",
    text: "text-lime-300",
    chipBorder: "border-lime-400/20",
    chipBg: "bg-lime-400/10",
    cardTint:
      "bg-[linear-gradient(135deg,rgba(132,204,22,0.12),rgba(34,197,94,0.05)_45%,transparent_75%)]",
    blob: "bg-lime-500/20",
    bar: "from-lime-400 to-green-400",
    dot: "bg-lime-400",
    tools: [
      { id: "meta-preview", name: "Meta Tag Preview", blurb: "Google, X & Slack previews", icon: Globe, hot: true },
      { id: "serp-simulator", name: "SERP Simulator", blurb: "Pixel-perfect snippet testing", icon: Search },
      { id: "sitemap-gen", name: "Sitemap Generator", blurb: "XML sitemaps from a URL list", icon: Workflow },
      { id: "robots-tester", name: "Robots.txt Tester", blurb: "Validate crawl rules locally", icon: Bot },
      { id: "keyword-density", name: "Keyword Density", blurb: "N-gram frequency analysis", icon: Hash },
      { id: "schema-builder", name: "Schema Builder", blurb: "JSON-LD structured data", icon: Binary },
    ],
  },
];

export const TOTAL_TOOLS = CATEGORIES.reduce((acc, c) => acc + c.count, 0); // 1,679

export interface FlatTool extends Tool {
  category: Category;
}

export const ALL_TOOLS: FlatTool[] = CATEGORIES.flatMap((category) =>
  category.tools.map((t) => ({ ...t, category }))
);

export function findTool(id: string): FlatTool | undefined {
  return ALL_TOOLS.find((t) => t.id === id);
}

/** Pinned chips shown on the "Recent & Pinned" widget. */
export const RECENT_IDS = [
  "json-formatter",
  "pdf-compress",
  "uuid-generator",
  "image-resizer",
  "password-generator",
  "exif-remover",
  "meta-preview",
  "ai-local-llm",
];
