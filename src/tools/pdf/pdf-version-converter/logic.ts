/**
 * PDF Version Converter — pure logic.
 *
 * Pure functions only — no DOM, no pdf-lib. The actual PDF loading, header
 * rewriting, font embedding, XMP / output-intent insertion, and re-saving
 * live in ui.tsx; this module handles version detection / setting,
 * requirements checking for PDF/A & PDF/X, feature compatibility analysis,
 * unsupported-feature removal planning, XMP / color-profile / output-intent
 * metadata generation, multi-format reporting, history (localStorage), and
 * shareable URLs.
 */
import type { ToolResult } from "../../../lib/tool";

// ---------------------------------------------------------------------------
// Types & constants
// ---------------------------------------------------------------------------

/** All 9 supported target versions. */
export type TargetVersion =
  | "pdf-1.4"
  | "pdf-1.5"
  | "pdf-1.6"
  | "pdf-1.7"
  | "pdf-2.0"
  | "pdf-a-1b"
  | "pdf-a-2b"
  | "pdf-a-3b"
  | "pdf-x-1a";

export const TARGET_VERSIONS: TargetVersion[] = [
  "pdf-1.4",
  "pdf-1.5",
  "pdf-1.6",
  "pdf-1.7",
  "pdf-2.0",
  "pdf-a-1b",
  "pdf-a-2b",
  "pdf-a-3b",
  "pdf-x-1a",
];

export const VERSION_LABELS: Record<TargetVersion, string> = {
  "pdf-1.4": "PDF 1.4 (Acrobat 5 — 2001)",
  "pdf-1.5": "PDF 1.5 (Acrobat 6 — 2003)",
  "pdf-1.6": "PDF 1.6 (Acrobat 7 — 2005)",
  "pdf-1.7": "PDF 1.7 (Acrobat 8 — 2006, ISO 32000-1)",
  "pdf-2.0": "PDF 2.0 (ISO 32000-2 — 2017)",
  "pdf-a-1b": "PDF/A-1b (ISO 19005-1 — basic archival)",
  "pdf-a-2b": "PDF/A-2b (ISO 19005-2 — archival w/ JPEG2000)",
  "pdf-a-3b": "PDF/A-3b (ISO 19005-3 — archival w/ embedded files)",
  "pdf-x-1a": "PDF/X-1a (ISO 15930-1 — print exchange, CMYK)",
};

/** Numeric PDF version strings as they appear in the file header. */
export const HEADER_VERSIONS: Record<TargetVersion, string> = {
  "pdf-1.4": "1.4",
  "pdf-1.5": "1.5",
  "pdf-1.6": "1.6",
  "pdf-1.7": "1.7",
  "pdf-2.0": "2.0",
  "pdf-a-1b": "1.4", // PDF/A-1b is based on PDF 1.4
  "pdf-a-2b": "1.7", // PDF/A-2b is based on PDF 1.7
  "pdf-a-3b": "1.7", // PDF/A-3b is based on PDF 1.7
  "pdf-x-1a": "1.3", // PDF/X-1a is based on PDF 1.3
};

export type VersionFamily = "standard" | "pdf-a" | "pdf-x";

export const VERSION_FAMILY: Record<TargetVersion, VersionFamily> = {
  "pdf-1.4": "standard",
  "pdf-1.5": "standard",
  "pdf-1.6": "standard",
  "pdf-1.7": "standard",
  "pdf-2.0": "standard",
  "pdf-a-1b": "pdf-a",
  "pdf-a-2b": "pdf-a",
  "pdf-a-3b": "pdf-a",
  "pdf-x-1a": "pdf-x",
};

export interface ConverterOptions {
  targetVersion: TargetVersion;
  preserveMetadata: boolean;
  embedFonts: boolean;
  removeUnsupportedFeatures: boolean;
}

export const DEFAULT_OPTIONS: ConverterOptions = {
  targetVersion: "pdf-1.7",
  preserveMetadata: true,
  embedFonts: true,
  removeUnsupportedFeatures: true,
};

// ---------------------------------------------------------------------------
// Version detector — read PDF header
// ---------------------------------------------------------------------------

/** PDF version as detected from the file header. */
export interface DetectedVersion {
  raw: string;
  major: number;
  minor: number;
  ok: boolean;
  error?: string;
}

/** Decode the first 16 bytes of a PDF and return the version string. */
export function detectPdfVersion(bytes: Uint8Array): DetectedVersion {
  if (!bytes || bytes.length < 8) {
    return { raw: "", major: 0, minor: 0, ok: false, error: "File too small to be a PDF." };
  }
  // PDF header is typically: %PDF-1.X (8 bytes)
  const head = bytesToAscii(bytes.subarray(0, 16));
  const match = head.match(/^%PDF-(\d+)\.(\d+)/);
  if (!match) {
    // Some PDFs have a leading BOM or garbage — try a wider search in first 1024 bytes
    const wider = bytesToAscii(bytes.subarray(0, Math.min(1024, bytes.length)));
    const m2 = wider.match(/%PDF-(\d+)\.(\d+)/);
    if (!m2) {
      return { raw: "", major: 0, minor: 0, ok: false, error: "No %PDF- header found." };
    }
    return { raw: `${m2[1]}.${m2[2]}`, major: Number(m2[1]), minor: Number(m2[2]), ok: true };
  }
  return { raw: `${match[1]}.${match[2]}`, major: Number(match[1]), minor: Number(match[2]), ok: true };
}

/** Map a detected version to the closest TargetVersion label. */
export function classifyDetectedVersion(d: DetectedVersion): TargetVersion | null {
  if (!d.ok) return null;
  const key = `pdf-${d.major}.${d.minor}` as TargetVersion;
  return TARGET_VERSIONS.includes(key) ? key : null;
}

// ---------------------------------------------------------------------------
// Version setter — produce the new header bytes
// ---------------------------------------------------------------------------

/** Build the new PDF header bytes (%PDF-X.Y\n) for the target version. */
export function buildHeader(target: TargetVersion): Uint8Array {
  const v = HEADER_VERSIONS[target] ?? "1.7";
  return asciiToBytes(`%PDF-${v}\n`);
}

/** Patch the header of an existing PDF byte array with the new version. */
export function patchPdfHeader(bytes: Uint8Array, target: TargetVersion): Uint8Array {
  const newHeader = buildHeader(target);
  const out = bytes.slice();
  // Replace the existing %PDF-X.Y (8 bytes) in place
  if (out.length >= newHeader.length) {
    for (let i = 0; i < newHeader.length; i++) {
      out[i] = newHeader[i];
    }
  }
  return out;
}

// ---------------------------------------------------------------------------
// PDF/A requirements checker
// ---------------------------------------------------------------------------

export interface PdfARequirement {
  id: string;
  description: string;
  required: boolean;
  met: boolean;
  remediation: string;
}

export interface PdfContent {
  hasEncryption: boolean;
  hasJavaScript: boolean;
  hasEmbeddedFiles: boolean;
  hasExternalReferences: boolean;
  hasAudio: boolean;
  hasVideo: boolean;
  hasForms: boolean;
  hasRgbColors: boolean;
  hasCmykColors: boolean;
  fontsAllEmbedded: boolean;
  hasXmpMetadata: boolean;
  hasOutputIntent: boolean;
  hasTrimBox: boolean;
  hasBleedBox: boolean;
  fontCount: number;
  embeddedFontCount: number;
}

export const EMPTY_CONTENT: PdfContent = {
  hasEncryption: false,
  hasJavaScript: false,
  hasEmbeddedFiles: false,
  hasExternalReferences: false,
  hasAudio: false,
  hasVideo: false,
  hasForms: false,
  hasRgbColors: false,
  hasCmykColors: false,
  fontsAllEmbedded: true,
  // XMP metadata is auto-added by the converter for PDF/A targets, so the
  // "post-conversion" baseline content has XMP present.
  hasXmpMetadata: true,
  hasOutputIntent: false,
  hasTrimBox: false,
  hasBleedBox: false,
  fontCount: 0,
  embeddedFontCount: 0,
};

/** Check PDF/A-1b requirements. */
export function checkPdfA1bRequirements(content: PdfContent): PdfARequirement[] {
  return [
    {
      id: "no-encryption",
      description: "No encryption (PDF/A documents must be unencrypted)",
      required: true,
      met: !content.hasEncryption,
      remediation: "Remove password protection before conversion.",
    },
    {
      id: "no-javascript",
      description: "No JavaScript",
      required: true,
      met: !content.hasJavaScript,
      remediation: "Remove all JavaScript actions.",
    },
    {
      id: "no-audio-video",
      description: "No audio or video content",
      required: true,
      met: !content.hasAudio && !content.hasVideo,
      remediation: "Strip audio/video annotations.",
    },
    {
      id: "no-external-refs",
      description: "No external references (URL actions, GoToR)",
      required: true,
      met: !content.hasExternalReferences,
      remediation: "Remove all external link annotations.",
    },
    {
      id: "fonts-embedded",
      description: "All fonts embedded",
      required: true,
      met: content.fontsAllEmbedded,
      remediation: "Embed all non-standard fonts (enable 'Embed fonts' option).",
    },
    {
      id: "xmp-metadata",
      description: "XMP metadata with PDF/A identification",
      required: true,
      met: content.hasXmpMetadata,
      remediation: "Add XMP metadata block (auto-generated by this tool).",
    },
    {
      id: "no-embedded-files-a1",
      description: "No embedded files (PDF/A-1b disallows attachments)",
      required: true,
      met: !content.hasEmbeddedFiles,
      remediation: "Strip embedded file attachments.",
    },
  ];
}

/** Check PDF/A-2b requirements (relaxes embedded files but adds JPEG2000). */
export function checkPdfA2bRequirements(content: PdfContent): PdfARequirement[] {
  return [
    ...checkPdfA1bRequirements(content).filter((r) => r.id !== "no-embedded-files-a1"),
    {
      id: "no-embedded-files-a2",
      description: "Embedded files allowed in PDF/A-2 (must be PDF/A compliant)",
      required: false,
      met: true,
      remediation: "Optional — embedded files allowed.",
    },
  ];
}

/** Check PDF/A-3b requirements (allows any embedded files). */
export function checkPdfA3bRequirements(content: PdfContent): PdfARequirement[] {
  // PDF/A-3b allows embedded files of any type
  return checkPdfA1bRequirements(content).filter((r) => r.id !== "no-embedded-files-a1");
}

// ---------------------------------------------------------------------------
// PDF/X-1a requirements checker
// ---------------------------------------------------------------------------

export function checkPdfX1aRequirements(content: PdfContent): PdfARequirement[] {
  return [
    {
      id: "no-rgb",
      description: "All color is CMYK or spot (no RGB)",
      required: true,
      met: !content.hasRgbColors && content.hasCmykColors,
      remediation: "Convert all RGB colors to CMYK (auto-converter applies).",
    },
    {
      id: "fonts-embedded",
      description: "All fonts embedded",
      required: true,
      met: content.fontsAllEmbedded,
      remediation: "Embed all non-standard fonts.",
    },
    {
      id: "output-intent",
      description: "Output intent (ICC color profile) present",
      required: true,
      met: content.hasOutputIntent,
      remediation: "Add output intent (auto-generated by this tool).",
    },
    {
      id: "trim-box",
      description: "Trim box defined on every page",
      required: true,
      met: content.hasTrimBox,
      remediation: "Set trim boxes (auto-applied by this tool).",
    },
    {
      id: "bleed-box",
      description: "Bleed box defined on every page",
      required: true,
      met: content.hasBleedBox,
      remediation: "Set bleed boxes (auto-applied by this tool).",
    },
    {
      id: "no-encryption",
      description: "No encryption",
      required: true,
      met: !content.hasEncryption,
      remediation: "Remove password protection.",
    },
    {
      id: "no-javascript",
      description: "No JavaScript",
      required: true,
      met: !content.hasJavaScript,
      remediation: "Remove all JavaScript actions.",
    },
  ];
}

/** Dispatch to the right requirements checker based on target. */
export function checkRequirements(target: TargetVersion, content: PdfContent): PdfARequirement[] {
  switch (target) {
    case "pdf-a-1b": return checkPdfA1bRequirements(content);
    case "pdf-a-2b": return checkPdfA2bRequirements(content);
    case "pdf-a-3b": return checkPdfA3bRequirements(content);
    case "pdf-x-1a": return checkPdfX1aRequirements(content);
    default: return [];
  }
}

// ---------------------------------------------------------------------------
// Feature compatibility checker
// ---------------------------------------------------------------------------

export interface FeatureCompat {
  feature: string;
  supportedInTarget: boolean;
  description: string;
}

/** Features introduced in each PDF version. */
export const FEATURE_INTRODUCED: Record<string, string> = {
  "1.4": "JPEG2000, transparency, RC4 128-bit encryption, tagged PDF",
  "1.5": "Object streams (compressed object tables), AES-128 encryption, JPEG2000 baseline",
  "1.6": "AES-128 encryption improvements, additional CID font support",
  "1.7": "AES-256 encryption, 3D content, additional signature handling",
  "2.0": "Annotation extensions, associated files, UTF-8 in PDF strings",
};

/** Check which features in the source PDF are supported in the target version. */
export function checkFeatureCompatibility(
  source: DetectedVersion,
  target: TargetVersion,
  content: PdfContent,
): FeatureCompat[] {
  const targetVer = HEADER_VERSIONS[target];
  const out: FeatureCompat[] = [];

  // Encryption strength
  if (content.hasEncryption) {
    const supportsAes256 = versionAtLeast(targetVer, "1.7");
    out.push({
      feature: "Encryption",
      supportedInTarget: true,
      description: supportsAes256
        ? "AES-256 supported in target"
        : "Downgrade to RC4 128-bit (PDF 1.4+) or remove encryption",
    });
  }

  // Object streams (PDF 1.5+)
  if (versionAtLeast(source.raw, "1.5") && !versionAtLeast(targetVer, "1.5")) {
    out.push({
      feature: "Object streams",
      supportedInTarget: false,
      description: "PDF 1.4 and below do not support object streams — will be unpacked",
    });
  }

  // JPEG2000 (PDF 1.5+)
  out.push({
    feature: "JPEG2000",
    supportedInTarget: versionAtLeast(targetVer, "1.5") || target === "pdf-a-2b" || target === "pdf-a-3b",
    description: target === "pdf-a-1b"
      ? "PDF/A-1b disallows JPEG2000 — images will be re-encoded"
      : "JPEG2000 supported",
  });

  // AES-256 (PDF 1.7 ExtensionLevel 3 / PDF 2.0)
  if (target === "pdf-2.0" || target === "pdf-1.7") {
    out.push({
      feature: "AES-256 encryption",
      supportedInTarget: true,
      description: "Supported in target",
    });
  }

  // Tagged PDF (1.4+) — required for PDF/A-1a but not A-1b
  out.push({
    feature: "Tagged PDF (structure tree)",
    supportedInTarget: versionAtLeast(targetVer, "1.4"),
    description: "Structure tree preserved for accessibility",
  });

  // 3D content (PDF 1.6+)
  out.push({
    feature: "3D content (U3D/PRC)",
    supportedInTarget: versionAtLeast(targetVer, "1.6") && VERSION_FAMILY[target] === "standard",
    description: VERSION_FAMILY[target] !== "standard"
      ? "3D content disallowed in PDF/A and PDF/X"
      : versionAtLeast(targetVer, "1.6") ? "Supported" : "Removed (requires PDF 1.6+)",
  });

  // Embedded files
  out.push({
    feature: "Embedded files (attachments)",
    supportedInTarget: target === "pdf-a-3b" || VERSION_FAMILY[target] === "standard",
    description: target === "pdf-a-1b" || target === "pdf-a-2b"
      ? "Stripped for PDF/A-1/2 compliance"
      : target === "pdf-a-3b" ? "Allowed in PDF/A-3" : "Allowed in standard PDF",
  });

  // JavaScript
  out.push({
    feature: "JavaScript",
    supportedInTarget: VERSION_FAMILY[target] === "standard",
    description: VERSION_FAMILY[target] === "standard"
      ? "Allowed (with user opt-in)"
      : "Disallowed in PDF/A and PDF/X — will be stripped",
  });

  return out;
}

/** True if version `a` is at least version `b` (compares major.minor). */
export function versionAtLeast(a: string, b: string): boolean {
  const pa = a.split(".").map((n) => Number(n) || 0);
  const pb = b.split(".").map((n) => Number(n) || 0);
  for (let i = 0; i < Math.max(pa.length, pb.length); i++) {
    const ai = pa[i] ?? 0;
    const bi = pb[i] ?? 0;
    if (ai > bi) return true;
    if (ai < bi) return false;
  }
  return true; // equal
}

// ---------------------------------------------------------------------------
// Unsupported feature remover — plan
// ---------------------------------------------------------------------------

export interface FeatureRemoval {
  feature: string;
  action: "remove" | "convert" | "keep";
  reason: string;
}

/** Plan which features to remove/convert for a target. */
export function planRemovals(
  target: TargetVersion,
  content: PdfContent,
): FeatureRemoval[] {
  const out: FeatureRemoval[] = [];
  const family = VERSION_FAMILY[target];

  if (family === "pdf-a" || family === "pdf-x") {
    if (content.hasEncryption) {
      out.push({ feature: "Encryption", action: "remove", reason: `${target.toUpperCase()} disallows encryption` });
    }
    if (content.hasJavaScript) {
      out.push({ feature: "JavaScript", action: "remove", reason: `${target.toUpperCase()} disallows JavaScript` });
    }
    if (content.hasAudio || content.hasVideo) {
      out.push({ feature: "Audio/Video", action: "remove", reason: `${target.toUpperCase()} disallows rich media` });
    }
    if (content.hasExternalReferences) {
      out.push({ feature: "External references", action: "remove", reason: `${target.toUpperCase()} disallows external links` });
    }
  }

  if (family === "pdf-a") {
    if (target === "pdf-a-1b" && content.hasEmbeddedFiles) {
      out.push({ feature: "Embedded files", action: "remove", reason: "PDF/A-1b disallows attachments" });
    }
  }

  if (target === "pdf-x-1a") {
    if (content.hasRgbColors) {
      out.push({ feature: "RGB colors", action: "convert", reason: "PDF/X-1a requires CMYK — will convert" });
    }
    if (content.hasForms) {
      out.push({ feature: "Interactive forms", action: "remove", reason: "PDF/X-1a disallows form fields" });
    }
  }

  return out;
}

// ---------------------------------------------------------------------------
// XMP metadata generator (for PDF/A)
// ---------------------------------------------------------------------------

export interface XmpOptions {
  title: string;
  author: string;
  subject: string;
  keywords: string[];
  creator: string;
  producer: string;
  target: TargetVersion;
}

export function generateXmpMetadata(opts: XmpOptions): string {
  const part = opts.target === "pdf-a-1b" ? "1" : opts.target === "pdf-a-2b" ? "2" : "3";
  const amd = "";
  const conformance = "B";
  const now = new Date().toISOString();
  const keywordsStr = opts.keywords.join(", ");
  return `<?xpacket begin="\uFEFF" id="W5M0MpCehiHzreSzNTczkc9d"?>
<x:xmpmeta xmlns:x="adobe:ns:meta/">
  <rdf:RDF xmlns:rdf="http://www.w3.org/1999/02/22-rdf-syntax-ns#">
    <rdf:Description xmlns:dc="http://purl.org/dc/elements/1.1/">
      <dc:title><rdf:Alt><rdf:li xml:lang="x-default">${escapeXml(opts.title)}</rdf:li></rdf:Alt></dc:title>
      <dc:creator><rdf:Seq><rdf:li>${escapeXml(opts.author)}</rdf:li></rdf:Seq></dc:creator>
      <dc:description><rdf:Alt><rdf:li xml:lang="x-default">${escapeXml(opts.subject)}</rdf:li></rdf:Alt></dc:description>
      <dc:subject><rdf:Bag>${opts.keywords.map((k) => `<rdf:li>${escapeXml(k)}</rdf:li>`).join("")}</rdf:Bag></dc:subject>
    </rdf:Description>
    <rdf:Description xmlns:xmp="http://ns.adobe.com/xap/1.0/">
      <xmp:CreatorTool>${escapeXml(opts.creator || "UnQTools PDF Version Converter")}</xmp:CreatorTool>
      <xmp:CreateDate>${now}</xmp:CreateDate>
      <xmp:ModifyDate>${now}</xmp:ModifyDate>
      <xmp:MetadataDate>${now}</xmp:MetadataDate>
    </rdf:Description>
    <rdf:Description xmlns:pdf="http://ns.adobe.com/pdf/1.3/">
      <pdf:Producer>${escapeXml(opts.producer || "UnQTools — PDF Version Converter")}</pdf:Producer>
    </rdf:Description>
    <rdf:Description xmlns:pdfaid="http://www.aiim.org/pdfa/ns/id/">
      <pdfaid:part>${part}</pdfaid:part>
      <pdfaid:amd>${amd}</pdfaid:amd>
      <pdfaid:conformance>${conformance}</pdfaid:conformance>
    </rdf:Description>
  </rdf:RDF>
</x:xmpmeta>
<?xpacket end="w"?>`;
}

function escapeXml(s: string): string {
  return (s ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&apos;");
}

// ---------------------------------------------------------------------------
// Color profile embedder (for PDF/A — basic sRGB)
// ---------------------------------------------------------------------------

export interface ColorProfileSpec {
  name: string;
  /** ICC profile bytes — placeholder, real implementation embeds a static sRGB profile. */
  bytes: Uint8Array;
  nComponents: number;
  alternateSpace: string;
}

/** Return an sRGB ICC profile spec. Real bytes are inserted by ui.tsx. */
export function buildSrgbProfile(): ColorProfileSpec {
  return {
    name: "sRGB IEC61966-2.1",
    bytes: new Uint8Array(0),
    nComponents: 3,
    alternateSpace: "DeviceRGB",
  };
}

// ---------------------------------------------------------------------------
// Output intent generator (for PDF/X)
// ---------------------------------------------------------------------------

export interface OutputIntentSpec {
  registryName: string;
  registryNameValue: string;
  outputCondition: string;
  outputConditionIdentifier: string;
  info: string;
  destOutputProfileBytes: Uint8Array;
  profileName: string;
}

/** Build a PDF/X-1a output intent pointing at a CMYK profile (FOGRA39). */
export function buildOutputIntent(): OutputIntentSpec {
  return {
    registryName: "Name",
    registryNameValue: "http://www.color.org",
    outputCondition: "Commercial and specialty printing",
    outputConditionIdentifier: "FOGRA39",
    info: "Coated FOGRA39 (ISO 12647-2:2004)",
    destOutputProfileBytes: new Uint8Array(0),
    profileName: "Coated FOGRA39 (ISO 12647-2:2004)",
  };
}

// ---------------------------------------------------------------------------
// Color space converter — RGB → CMYK (simple formula)
// ---------------------------------------------------------------------------

export interface RgbColor { r: number; g: number; b: number; }
export interface CmykColor { c: number; m: number; y: number; k: number; }

/** Convert an RGB color (0-255 each) to CMYK (0-1 each). */
export function rgbToCmyk(c: RgbColor): CmykColor {
  const r = c.r / 255;
  const g = c.g / 255;
  const b = c.b / 255;
  const k = 1 - Math.max(r, g, b);
  if (k >= 1) return { c: 0, m: 0, y: 0, k: 1 };
  const c2 = (1 - r - k) / (1 - k);
  const m = (1 - g - k) / (1 - k);
  const y = (1 - b - k) / (1 - k);
  return { c: round4(c2), m: round4(m), y: round4(y), k: round4(k) };
}

function round4(n: number): number {
  return Math.round(n * 10000) / 10000;
}

// ---------------------------------------------------------------------------
// Font embedding verifier
// ---------------------------------------------------------------------------

export interface FontEmbedStatus {
  totalFonts: number;
  embeddedFonts: number;
  missingFonts: string[];
  allEmbedded: boolean;
}

export function verifyFontEmbedding(
  totalFonts: number,
  embeddedFonts: number,
  missingNames: string[] = [],
): FontEmbedStatus {
  return {
    totalFonts,
    embeddedFonts,
    missingFonts: missingNames,
    allEmbedded: embeddedFonts >= totalFonts,
  };
}

// ---------------------------------------------------------------------------
// Compliance checker
// ---------------------------------------------------------------------------

export interface ComplianceResult {
  target: TargetVersion;
  requirements: PdfARequirement[];
  compliant: boolean;
  failedRequirements: string[];
}

export function checkCompliance(target: TargetVersion, content: PdfContent): ComplianceResult {
  const reqs = checkRequirements(target, content);
  const failed = reqs.filter((r) => r.required && !r.met);
  return {
    target,
    requirements: reqs,
    compliant: failed.length === 0,
    failedRequirements: failed.map((r) => r.id),
  };
}

// ---------------------------------------------------------------------------
// Feature loss reporter
// ---------------------------------------------------------------------------

export interface FeatureLossReport {
  removed: FeatureRemoval[];
  converted: FeatureRemoval[];
  kept: FeatureRemoval[];
}

export function buildFeatureLossReport(
  target: TargetVersion,
  content: PdfContent,
): FeatureLossReport {
  const removals = planRemovals(target, content);
  return {
    removed: removals.filter((r) => r.action === "remove"),
    converted: removals.filter((r) => r.action === "convert"),
    kept: removals.filter((r) => r.action === "keep"),
  };
}

// ---------------------------------------------------------------------------
// Summary stats + full conversion report
// ---------------------------------------------------------------------------

export interface ConversionSummary {
  sourceVersion: string;
  targetVersion: TargetVersion;
  targetHeader: string;
  family: VersionFamily;
  featuresRemoved: number;
  featuresConverted: number;
  requirementsMet: number;
  requirementsTotal: number;
  compliant: boolean;
  fontsEmbedded: boolean;
}

export interface ConversionResult {
  originalSize: number;
  convertedSize: number;
  options: ConverterOptions;
  sourceVersion: string;
  targetVersion: TargetVersion;
  summary: ConversionSummary;
  requirements: PdfARequirement[];
  featureCompat: FeatureCompat[];
  removals: FeatureRemoval[];
  fontEmbed: FontEmbedStatus;
  qualityImpacts: string[];
}

export function buildConversionReport(
  sourceVersion: string,
  originalSize: number,
  convertedSize: number,
  content: PdfContent,
  options: ConverterOptions,
): ToolResult<ConversionResult> {
  if (!TARGET_VERSIONS.includes(options.targetVersion)) {
    return { ok: false, error: "Invalid target version." };
  }
  const reqs = checkRequirements(options.targetVersion, content);
  const detected: DetectedVersion = {
    raw: sourceVersion, major: Number(sourceVersion.split(".")[0]) || 0,
    minor: Number(sourceVersion.split(".")[1]) || 0, ok: !!sourceVersion,
  };
  const compat = checkFeatureCompatibility(detected, options.targetVersion, content);
  const removals = planRemovals(options.targetVersion, content);
  const fontEmbed = verifyFontEmbedding(
    content.fontCount, content.embeddedFontCount,
    content.embeddedFontCount < content.fontCount ? ["Unknown"] : [],
  );
  const compliance = checkCompliance(options.targetVersion, content);

  const summary: ConversionSummary = {
    sourceVersion,
    targetVersion: options.targetVersion,
    targetHeader: HEADER_VERSIONS[options.targetVersion],
    family: VERSION_FAMILY[options.targetVersion],
    featuresRemoved: removals.filter((r) => r.action === "remove").length,
    featuresConverted: removals.filter((r) => r.action === "convert").length,
    requirementsMet: reqs.filter((r) => r.met).length,
    requirementsTotal: reqs.length,
    compliant: compliance.compliant,
    fontsEmbedded: fontEmbed.allEmbedded,
  };

  const qualityImpacts: string[] = [];
  if (removals.some((r) => r.feature === "Encryption" && r.action === "remove")) {
    qualityImpacts.push("Encryption removed — file is now openable without password");
  }
  if (removals.some((r) => r.feature === "RGB colors" && r.action === "convert")) {
    qualityImpacts.push("RGB colors converted to CMYK — slight gamut shift may occur");
  }
  if (removals.some((r) => r.feature === "JavaScript" && r.action === "remove")) {
    qualityImpacts.push("JavaScript actions stripped — interactive forms become static");
  }
  if (removals.some((r) => r.feature === "Embedded files" && r.action === "remove")) {
    qualityImpacts.push("Embedded file attachments stripped");
  }
  if (qualityImpacts.length === 0) {
    qualityImpacts.push("No quality-impacting changes (lossless version bump)");
  }

  return {
    ok: true,
    output: {
      originalSize,
      convertedSize,
      options,
      sourceVersion,
      targetVersion: options.targetVersion,
      summary,
      requirements: reqs,
      featureCompat: compat,
      removals,
      fontEmbed,
      qualityImpacts,
    },
  };
}

// ---------------------------------------------------------------------------
// Multi-format renderers
// ---------------------------------------------------------------------------

export function renderTextReport(r: ConversionResult): string {
  const lines: string[] = [];
  lines.push("PDF Version Converter — Conversion Report");
  lines.push("=".repeat(60));
  lines.push(`Source: ${r.sourceVersion || "(unknown)"}  →  Target: ${VERSION_LABELS[r.targetVersion]}`);
  lines.push(`Header: %PDF-${r.summary.targetHeader}`);
  lines.push(`Family: ${r.summary.family}`);
  lines.push(`Size: ${formatBytes(r.originalSize)} → ${formatBytes(r.convertedSize)}`);
  lines.push(`Compliant: ${r.summary.compliant ? "yes ✓" : "no ✗"}`);
  lines.push("");
  lines.push(`Requirements: ${r.summary.requirementsMet}/${r.summary.requirementsTotal} met`);
  lines.push("-".repeat(60));
  for (const req of r.requirements) {
    const mark = req.met ? "✓" : req.required ? "✗" : "○";
    lines.push(`  ${mark} ${req.description}`);
    if (!req.met && req.required) lines.push(`    → ${req.remediation}`);
  }
  lines.push("");
  lines.push(`Features: ${r.summary.featuresRemoved} removed, ${r.summary.featuresConverted} converted`);
  lines.push("-".repeat(60));
  for (const rem of r.removals) {
    lines.push(`  ${rem.action.toUpperCase().padEnd(8)} ${rem.feature} — ${rem.reason}`);
  }
  lines.push("");
  lines.push(`Fonts: ${r.fontEmbed.embeddedFonts}/${r.fontEmbed.totalFonts} embedded ${r.fontEmbed.allEmbedded ? "✓" : "✗"}`);
  if (r.fontEmbed.missingFonts.length > 0) {
    lines.push(`  Missing: ${r.fontEmbed.missingFonts.join(", ")}`);
  }
  lines.push("");
  lines.push("Quality impact:");
  for (const q of r.qualityImpacts) lines.push(`  • ${q}`);
  return lines.join("\n");
}

export function renderCsvReport(r: ConversionResult): string {
  const header = "component,source,target,status,notes";
  const rows: string[] = [];
  rows.push(`version,${csvEscape(r.sourceVersion)},${csvEscape(r.targetVersion)},${r.summary.compliant ? "compliant" : "non-compliant"},${csvEscape(VERSION_LABELS[r.targetVersion])}`);
  rows.push(`size,${r.originalSize},${r.convertedSize},ok,bytes`);
  for (const req of r.requirements) {
    rows.push(`requirement,,${req.id},${req.met ? "met" : "missing"},${csvEscape(req.description)}`);
  }
  for (const rem of r.removals) {
    rows.push(`feature,,${csvEscape(rem.feature)},${rem.action},${csvEscape(rem.reason)}`);
  }
  rows.push(`fonts,${r.fontEmbed.totalFonts},${r.fontEmbed.embeddedFonts},${r.fontEmbed.allEmbedded ? "ok" : "missing"},${csvEscape(r.fontEmbed.missingFonts.join(";"))}`);
  return [header, ...rows].join("\n");
}

export function renderJsonReport(r: ConversionResult): string {
  return JSON.stringify(r, null, 2);
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

export function formatBytes(n: number): string {
  if (n < 1024) return `${n} B`;
  if (n < 1024 * 1024) return `${(n / 1024).toFixed(1)} KB`;
  return `${(n / (1024 * 1024)).toFixed(2)} MB`;
}

function csvEscape(s: string | number | undefined): string {
  const v = s === undefined ? "" : String(s);
  return /[",\n]/.test(v) ? `"${v.replace(/"/g, '""')}"` : v;
}

function bytesToAscii(bytes: Uint8Array): string {
  let s = "";
  for (let i = 0; i < bytes.length; i++) s += String.fromCharCode(bytes[i]);
  return s;
}

function asciiToBytes(s: string): Uint8Array {
  const out = new Uint8Array(s.length);
  for (let i = 0; i < s.length; i++) out[i] = s.charCodeAt(i) & 0xff;
  return out;
}

// ---------------------------------------------------------------------------
// History (localStorage)
// ---------------------------------------------------------------------------

const HISTORY_KEY = "unqtools:pdf-version-converter:history";
const HISTORY_MAX = 20;

export interface HistoryEntry {
  ts: number;
  fileName: string;
  sourceVersion: string;
  targetVersion: TargetVersion;
  originalSize: number;
  convertedSize: number;
  compliant: boolean;
}

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

// ---------------------------------------------------------------------------
// Shareable URL
// ---------------------------------------------------------------------------

export function buildShareUrl(options: ConverterOptions): string {
  const params = new URLSearchParams();
  params.set("target", options.targetVersion);
  params.set("meta", String(options.preserveMetadata));
  params.set("fonts", String(options.embedFonts));
  params.set("unsupported", String(options.removeUnsupportedFeatures));
  if (typeof window === "undefined") return `?${params.toString()}`;
  return `${window.location.origin}${window.location.pathname}#${params.toString()}`;
}

export function parseShareUrl(hash: string): Partial<ConverterOptions> {
  const clean = hash.startsWith("#") ? hash.slice(1) : hash;
  if (!clean) return {};
  const params = new URLSearchParams(clean);
  const out: Partial<ConverterOptions> = {};
  const target = params.get("target");
  if (target && TARGET_VERSIONS.includes(target as TargetVersion)) {
    out.targetVersion = target as TargetVersion;
  }
  const meta = params.get("meta");
  if (meta === "true") out.preserveMetadata = true;
  if (meta === "false") out.preserveMetadata = false;
  const fonts = params.get("fonts");
  if (fonts === "true") out.embedFonts = true;
  if (fonts === "false") out.embedFonts = false;
  const unsup = params.get("unsupported");
  if (unsup === "true") out.removeUnsupportedFeatures = true;
  if (unsup === "false") out.removeUnsupportedFeatures = false;
  return out;
}

// ---------------------------------------------------------------------------
// Validation
// ---------------------------------------------------------------------------

export function validateOptions(options: ConverterOptions): string | null {
  if (!TARGET_VERSIONS.includes(options.targetVersion)) {
    return "Invalid target version.";
  }
  return null;
}
