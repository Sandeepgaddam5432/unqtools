/**
 * PDF to Images — extract embedded images from PDF files.
 *
 * This tool extracts images that are already embedded in the PDF's page
 * resource dictionaries. It does NOT rasterize pages (which would require
 * pdf.js as a dependency — see PROGRESS.md decision point).
 *
 * Uses pdf-lib (already a project dependency) to parse the PDF structure
 * and extract embedded image XObjects.
 *
 * Backward compat: preserves all existing exports (validate, process,
 * formatBytes, formatDuration, randomId, copyToClipboard, downloadFile,
 * detectFileType, getFileExtension, getMimeType, getStats, bulkProcess)
 * with their exact signatures and return shapes.
 */

export interface ProcessResult {
  output: string;
  error?: string;
  metadata?: Record<string, unknown>;
}

export interface ValidationIssue {
  severity: "error" | "warning" | "info";
  message: string;
  line?: number;
  column?: number;
}

export interface ExtractedImage {
  /** Page number (1-indexed) where the image was found. */
  pageNumber: number;
  /** Image format: "png", "jpeg", "gif", etc. */
  format: string;
  /** Image width in pixels. */
  width: number;
  /** Image height in pixels. */
  height: number;
  /** Image bytes (raw file bytes). */
  bytes: Uint8Array;
  /** Suggested filename. */
  filename: string;
  /** MIME type. */
  mimeType: string;
}

export interface ExtractionOptions {
  /** Output format: "original" (keep source format) or "png" or "jpeg". */
  outputFormat?: "original" | "png" | "jpeg";
  /** Minimum image dimension to include (filters out tiny decorative images). */
  minDimension?: number;
  /** Maximum number of images to extract (0 = no limit). */
  maxImages?: number;
  /** Filename template. Tokens: {index}, {page}, {format}, {tool}. */
  filenameTemplate?: string;
}

export interface ExtractionResult {
  images: ExtractedImage[];
  totalPages: number;
  totalImages: number;
  skipped: number;
  warnings: string[];
}

// ============================================================================
// Validation (preserved from original)
// ============================================================================

export function validate(input: string): ValidationIssue[] {
  const issues: ValidationIssue[] = [];
  if (!input || !input.trim()) {
    issues.push({ severity: "error", message: "Input is empty" });
    return issues;
  }
  if (input.length > 10 * 1024 * 1024) {
    issues.push({ severity: "warning", message: "Input is very large (>10MB) — may be slow" });
  }
  return issues;
}

// ============================================================================
// Process (preserved from original — text-based stub for backward compat)
// ============================================================================

export function process(input: string, options: Record<string, unknown> = {}): ProcessResult {
  const issues = validate(input);
  const errors = issues.filter((i) => i.severity === "error");
  if (errors.length > 0) {
    return { output: "", error: errors[0].message };
  }
  try {
    const output = input;
    return {
      output,
      metadata: {
        inputLength: input.length,
        outputLength: output.length,
        processingTime: Date.now(),
      },
    };
  } catch (e) {
    return { output: "", error: e instanceof Error ? e.message : "Processing failed" };
  }
}

// ============================================================================
// Real PDF image extraction (new — uses pdf-lib lazily)
// ============================================================================

/**
 * Extract embedded images from a PDF file.
 *
 * Uses pdf-lib to parse the PDF structure and walk the page resource
 * dictionaries looking for image XObjects. Each image is extracted as
 * raw bytes with its original format (PNG/JPEG).
 *
 * Note: This does NOT rasterize pages. If a page contains vector graphics
 * or text, those are not extracted as images. Only raster images embedded
 * in the PDF are extracted.
 */
export async function extractImagesFromPdf(
  pdfBytes: Uint8Array,
  options: ExtractionOptions = {},
): Promise<ExtractionResult> {
  const {
    outputFormat = "original",
    minDimension = 1,
    maxImages = 0,
    filenameTemplate = "pdf-image-{page}-{index}.{format}",
  } = options;

  const warnings: string[] = [];
  const images: ExtractedImage[] = [];
  let skipped = 0;

  try {
    // Lazy-load pdf-lib (heavy dependency, F047)
    const { PDFDocument } = await import("pdf-lib");

    const pdfDoc = await PDFDocument.load(pdfBytes, { ignoreEncryption: true });
    const pages = pdfDoc.getPages();
    const totalPages = pages.length;

    let imageIndex = 0;

    for (let pageIdx = 0; pageIdx < pages.length; pageIdx++) {
      const page = pages[pageIdx];
      const pageNumber = pageIdx + 1;

      // Access the page's resources. pdf-lib doesn't expose a direct API
      // for enumerating XObjects, so we use the low-level node traversal.
      // Cast to any to bypass pdf-lib's strict internal types.
      const node = page.node as any;
      const resources = node?.lookup?.(node.get?.("Resources"));
      if (!resources) continue;

      const xObjects = resources.lookup?.(resources.get?.("XObject"));
      if (!xObjects) continue;

      // Iterate over all XObject entries
      const xObjectDict = xObjects.dict;
      if (!xObjectDict) continue;

      for (const [name, ref] of Object.entries(xObjectDict)) {
        try {
          const xObject = xObjects.lookup(ref);
          if (!xObject) continue;

          const subtype = xObject.lookup(xObject.get("Subtype"));
          const subtypeName = subtype?.name;

          if (subtypeName !== "Image") continue;

          // Get image properties
          const width = xObject.lookup(xObject.get("Width")) ?? 0;
          const height = xObject.lookup(xObject.get("Height")) ?? 0;
          const colorSpace = xObject.lookup(xObject.get("ColorSpace"));
          const bitsPerComponent = xObject.lookup(xObject.get("BitsPerComponent")) ?? 8;
          const filter = xObject.lookup(xObject.get("Filter"));
          const filterName = typeof filter === "object" && filter?.name ? filter.name : (typeof filter === "string" ? filter : "");

          // Filter by minimum dimension
          if (width < minDimension || height < minDimension) {
            skipped++;
            continue;
          }

          // Check maxImages limit
          if (maxImages > 0 && images.length >= maxImages) {
            warnings.push(`Reached maxImages limit (${maxImages}). Stopping.`);
            break;
          }

          // Extract the image stream bytes
          const stream = xObject.getContents();
          if (!stream || stream.length === 0) {
            warnings.push(`Image ${name} on page ${pageNumber} has empty stream — skipped.`);
            skipped++;
            continue;
          }

          // Determine the image format from the filter
          let format: string;
          let imageBytes: Uint8Array;
          let mimeType: string;

          if (filterName === "DCTDecode") {
            // JPEG
            format = "jpeg";
            imageBytes = stream;
            mimeType = "image/jpeg";
          } else if (filterName === "FlateDecode" || filterName === "LZWDecode") {
            // Deflate-compressed raw image data — need to reconstruct PNG
            // This is a simplified approach: we wrap the raw pixels as PNG
            // using the image properties. A full implementation would use
            // the color space to determine channels.
            format = "png";
            mimeType = "image/png";
            // For now, return the raw stream (the UI will show it can't
            // be displayed directly for non-JPEG images)
            imageBytes = stream;
            warnings.push(`Image ${name} on page ${pageNumber} uses ${filterName} filter — extracted as raw bytes. PNG reconstruction not implemented for non-DCTDecode filters.`);
          } else if (filterName === "CCITTFaxDecode") {
            format = "tiff";
            imageBytes = stream;
            mimeType = "image/tiff";
            warnings.push(`Image ${name} on page ${pageNumber} uses CCITTFaxDecode (fax compression) — extracted as raw bytes.`);
          } else if (filterName === "RunLengthDecode" || filterName === "ASCII85Decode" || filterName === "ASCIIHexDecode") {
            format = "raw";
            imageBytes = stream;
            mimeType = "application/octet-stream";
            warnings.push(`Image ${name} on page ${pageNumber} uses ${filterName} filter — extracted as raw bytes.`);
          } else {
            // Unknown filter — try to detect from magic bytes
            format = detectImageFormat(stream) ?? "raw";
            imageBytes = stream;
            mimeType = getMimeType(format);
          }

          // Build filename
          const filename = filenameTemplate
            .replace("{index}", String(imageIndex + 1).padStart(3, "0"))
            .replace("{page}", String(pageNumber).padStart(2, "0"))
            .replace("{format}", format)
            .replace("{tool}", "pdf-to-images");

          images.push({
            pageNumber,
            format,
            width,
            height,
            bytes: imageBytes,
            filename,
            mimeType,
          });

          imageIndex++;
        } catch (e) {
          warnings.push(`Failed to extract image ${name} on page ${pageNumber}: ${(e as Error).message}`);
          skipped++;
        }
      }

      // Check maxImages again after each page
      if (maxImages > 0 && images.length >= maxImages) break;
    }

    return {
      images,
      totalPages,
      totalImages: images.length,
      skipped,
      warnings,
    };
  } catch (e) {
    return {
      images: [],
      totalPages: 0,
      totalImages: 0,
      skipped: 0,
      warnings: [`Failed to parse PDF: ${(e as Error).message}`],
    };
  }
}

/**
 * Detect image format from magic bytes.
 */
function detectImageFormat(bytes: Uint8Array): string | null {
  if (bytes.length < 4) return null;
  // PNG
  if (bytes[0] === 0x89 && bytes[1] === 0x50 && bytes[2] === 0x4e && bytes[3] === 0x47) return "png";
  // JPEG
  if (bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff) return "jpeg";
  // GIF
  if (bytes[0] === 0x47 && bytes[1] === 0x49 && bytes[2] === 0x46) return "gif";
  // BMP
  if (bytes[0] === 0x42 && bytes[1] === 0x4d) return "bmp";
  // WebP (RIFF....WEBP)
  if (bytes[0] === 0x52 && bytes[1] === 0x49 && bytes[2] === 0x46 && bytes[3] === 0x46) return "webp";
  return null;
}

// ============================================================================
// Utility functions (preserved from original)
// ============================================================================

export function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  if (bytes < 1024 * 1024 * 1024) return `${(bytes / (1024 * 1024)).toFixed(2)} MB`;
  return `${(bytes / (1024 * 1024 * 1024)).toFixed(2)} GB`;
}

export function formatDuration(ms: number): string {
  if (ms < 1000) return `${ms}ms`;
  if (ms < 60000) return `${(ms / 1000).toFixed(1)}s`;
  if (ms < 3600000) return `${(ms / 60000).toFixed(1)}m`;
  return `${(ms / 3600000).toFixed(1)}h`;
}

export function randomId(length = 8): string {
  const chars = "abcdefghijklmnopqrstuvwxyz0123456789";
  let result = "";
  const arr = new Uint8Array(length);
  crypto.getRandomValues(arr);
  for (let i = 0; i < length; i++) result += chars[arr[i] % chars.length];
  return result;
}

export function copyToClipboard(text: string): Promise<void> {
  if (navigator.clipboard) {
    return navigator.clipboard.writeText(text);
  }
  return Promise.reject(new Error("Clipboard API not available"));
}

export function downloadFile(content: string | Blob, filename: string, mime = "text/plain"): void {
  const blob = content instanceof Blob ? content : new Blob([content], { type: mime });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

export function detectFileType(bytes: Uint8Array): string | null {
  if (bytes.length < 4) return null;
  // PDF
  if (bytes[0] === 0x25 && bytes[1] === 0x50 && bytes[2] === 0x44 && bytes[3] === 0x46) return "pdf";
  // PNG
  if (bytes[0] === 0x89 && bytes[1] === 0x50 && bytes[2] === 0x4e && bytes[3] === 0x47) return "png";
  // JPEG
  if (bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff) return "jpeg";
  // GIF
  if (bytes[0] === 0x47 && bytes[1] === 0x49 && bytes[2] === 0x46) return "gif";
  // ZIP
  if (bytes[0] === 0x50 && bytes[1] === 0x4b && bytes[2] === 0x03) return "zip";
  // GZIP
  if (bytes[0] === 0x1f && bytes[1] === 0x8b) return "gzip";
  return null;
}

export function getFileExtension(filename: string): string {
  const m = filename.match(/\.([a-z0-9]+)$/i);
  return m ? m[1].toLowerCase() : "";
}

export function getMimeType(format: string): string {
  const map: Record<string, string> = {
    pdf: "application/pdf",
    png: "image/png",
    jpg: "image/jpeg",
    jpeg: "image/jpeg",
    gif: "image/gif",
    webp: "image/webp",
    svg: "image/svg+xml",
    html: "text/html",
    css: "text/css",
    js: "application/javascript",
    json: "application/json",
    xml: "application/xml",
    csv: "text/csv",
    txt: "text/plain",
    md: "text/markdown",
    zip: "application/zip",
  };
  return map[format.toLowerCase()] || "application/octet-stream";
}

export function getStats(input: string, output: string): {
  inputSize: number;
  outputSize: number;
  ratio: number;
  savings: number;
} {
  const inputSize = new TextEncoder().encode(input).length;
  const outputSize = new TextEncoder().encode(output).length;
  const ratio = inputSize > 0 ? outputSize / inputSize : 0;
  const savings = inputSize - outputSize;
  return { inputSize, outputSize, ratio, savings };
}

export function bulkProcess(inputs: string[], options?: Record<string, unknown>): ProcessResult[] {
  return inputs.map((input) => process(input, options));
}

// ============================================================================
// Additional helpers for the new extraction functionality
// ============================================================================

/**
 * Build a manifest CSV of extracted images.
 */
export function buildImageManifest(images: ExtractedImage[]): string {
  const rows = ["index,page,format,width,height,bytes,filename"];
  images.forEach((img, i) => {
    rows.push(
      `${i + 1},${img.pageNumber},${img.format},${img.width},${img.height},${img.bytes.length},${img.filename}`,
    );
  });
  return rows.join("\n");
}

/**
 * Build a ZIP filename for the extracted images bundle.
 */
export function buildZipFilename(originalName: string = "document.pdf"): string {
  const base = originalName.replace(/\.pdf$/i, "");
  return `${base}-images.zip`;
}
