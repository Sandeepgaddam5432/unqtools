"use client";

import React, { useEffect, useMemo, useRef, useState } from "react";
import {
  PDFDocument,
  PDFDict,
  PDFName,
  PDFString,
  PDFHexString,
  type PDFPage,
} from "pdf-lib";
import { Card, CardContent } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Download,
  FileUp,
  Trash2,
  ImagePlus,
  History,
  ShieldCheck,
  AlertTriangle,
  ListChecks,
} from "lucide-react";
import { toast } from "sonner";
import {
  ActionBar,
  ClearButton,
  CopyButton,
  DownloadButton,
  EmptyState,
  ErrorBanner,
  RunButton,
  ShareButton,
} from "../../_shared";
import { formatBytes, downloadBytes } from "../_shared/download";
import { parsePageRanges } from "../_shared/page-ranges";
import {
  DEFAULT_OPTIONS,
  IMAGE_TYPE_LABELS,
  normalizePageRangeSpec,
  resolveAllRange,
  parseAltTextData,
  serializeAltTextData,
  generateAutoAltEntries,
  findMissingAlt,
  formatImageList,
  buildApplyPlan,
  detectImageType,
  checkWcagCompliance,
  countImagesPerPage,
  computeSummaryStats,
  renderTextReport,
  renderCsvReport,
  renderJsonReport,
  loadHistory,
  saveHistory,
  clearHistory,
  buildShareUrl,
  parseShareUrl,
  validateOptions,
  type AltTextOptions,
  type ImageEntry,
  type ApplyResult,
  type SummaryStats,
  type WcagComplianceResult,
  type HistoryEntry,
} from "./logic";

// ---------------------------------------------------------------------------
// pdf-lib helpers
// ---------------------------------------------------------------------------

function nameToString(v: unknown): string {
  if (!v) return "";
  try {
    const s = String(v);
    return s.startsWith("/") ? s.slice(1) : s;
  } catch {
    return "";
  }
}

function pdfStringToString(v: unknown): string {
  if (!v) return "";
  try {
    if (v instanceof PDFString) return v.asString();
    if (v instanceof PDFHexString) return v.decodeText();
    if (typeof (v as { asString?: () => string }).asString === "function") {
      return (v as { asString: () => string }).asString();
    }
    const s = String(v);
    return s.startsWith("/") ? s.slice(1) : s;
  } catch {
    return "";
  }
}

/** Enumerate image XObjects on a page and read their existing /Alt + dimensions. */
function scanPageImages(page: PDFPage, pageNumber: number): ImageEntry[] {
  const out: ImageEntry[] = [];
  try {
    const resources = (page.node as unknown as { Resources?: () => unknown }).Resources?.();
    if (!(resources instanceof PDFDict)) return out;
    const xobj = resources.lookup(PDFName.of("XObject"));
    if (!(xobj instanceof PDFDict)) return out;
    let imageIndex = 0;
    for (const [name] of xobj.entries()) {
      const lookedUp = xobj.lookup(name);
      if (!(lookedUp instanceof PDFDict)) continue;
      const subtype = nameToString(lookedUp.get(PDFName.of("Subtype")));
      const isImage = subtype === "Image";
      const isForm = subtype === "Form";
      if (!isImage && !isForm) continue;
      // Skip Form XObjects that contain no nested images (keep them in list as Form containers).
      const widthNum = lookedUp.get(PDFName.of("Width"));
      const heightNum = lookedUp.get(PDFName.of("Height"));
      const width = widthNum ? Number(nameToString(widthNum)) || 0 : 0;
      const height = heightNum ? Number(nameToString(heightNum)) || 0 : 0;
      const bpc = lookedUp.get(PDFName.of("BitsPerComponent"));
      const colorSpace = nameToString(lookedUp.get(PDFName.of("ColorSpace")));
      const existingAltRaw = lookedUp.get(PDFName.of("Alt"));
      const actualTextRaw = lookedUp.get(PDFName.of("ActualText"));
      const existingAlt = pdfStringToString(existingAltRaw);
      const actualText = pdfStringToString(actualTextRaw);
      const hasAlt = !!existingAltRaw || !!actualTextRaw;
      const altText = existingAlt || actualText;
      const isDecorative = hasAlt && altText.trim() === "";
      out.push({
        page: pageNumber,
        imageIndex,
        name: nameToString(name) || `Im${imageIndex + 1}`,
        width,
        height,
        colorSpace,
        bitsPerComponent: bpc ? Number(nameToString(bpc)) || 0 : 0,
        hasAlt,
        existingAlt: altText,
        isDecorative,
        isForm,
      });
      imageIndex += 1;
    }
  } catch {
    // ignore
  }
  return out;
}

/** Apply alt text to a single image XObject on a page. Returns true on success. */
function applyAltToImage(
  page: PDFPage,
  pageNumber: number,
  imageIndex: number,
  altText: string,
  markDecorative: boolean,
): boolean {
  try {
    const resources = (page.node as unknown as { Resources?: () => unknown }).Resources?.();
    if (!(resources instanceof PDFDict)) return false;
    const xobj = resources.lookup(PDFName.of("XObject"));
    if (!(xobj instanceof PDFDict)) return false;
    const entries = Array.from(xobj.entries());
    let idx = 0;
    for (const [name] of entries) {
      const lookedUp = xobj.lookup(name);
      if (!(lookedUp instanceof PDFDict)) continue;
      const subtype = nameToString(lookedUp.get(PDFName.of("Subtype")));
      if (subtype !== "Image" && subtype !== "Form") continue;
      if (idx === imageIndex) {
        if (markDecorative) {
          // Mark as decorative: set empty Alt + add Artifact entry per PDF/UA convention.
          lookedUp.set(PDFName.of("Alt"), PDFHexString.of(""));
          lookedUp.set(PDFName.of("Artifact"), PDFName.of("True"));
        } else {
          // Set /Alt entry. Use PDFHexString for non-ASCII safety.
          lookedUp.set(PDFName.of("Alt"), PDFHexString.fromText(altText));
        }
        return true;
      }
      idx += 1;
    }
    return false;
  } catch {
    return false;
  }
}

// ---------------------------------------------------------------------------
// React component
// ---------------------------------------------------------------------------

export default function PdfAltTextGenerator() {
  const inputRef = useRef<HTMLInputElement>(null);
  const [file, setFile] = useState<{ name: string; bytes: Uint8Array; pageCount: number } | null>(null);
  const [opts, setOpts] = useState<AltTextOptions>(DEFAULT_OPTIONS);
  const [altTextData, setAltTextData] = useState("");
  const [images, setImages] = useState<ImageEntry[]>([]);
  const [applyResults, setApplyResults] = useState<ApplyResult[]>([]);
  const [resultBytes, setResultBytes] = useState<Uint8Array | null>(null);
  const [error, setError] = useState("");
  const [working, setWorking] = useState(false);
  const [history, setHistory] = useState<HistoryEntry[]>([]);

  useEffect(() => {
    setHistory(loadHistory());
    if (typeof window !== "undefined" && window.location.hash) {
      const p = parseShareUrl(window.location.hash);
      if (Object.keys(p).length > 0) {
        setOpts((prev) => ({ ...prev, ...p }));
        toast.info("Loaded settings from share link");
      }
    }
  }, []);

  async function loadFile(f: File) {
    try {
      const bytes = new Uint8Array(await f.arrayBuffer());
      const doc = await PDFDocument.load(bytes);
      setFile({ name: f.name, bytes, pageCount: doc.getPageCount() });
      setImages([]);
      setApplyResults([]);
      setResultBytes(null);
      setError("");
      // Pre-enumerate images so the user can see what needs alt text.
      const all: ImageEntry[] = [];
      const pages = doc.getPages();
      pages.forEach((p, i) => all.push(...scanPageImages(p, i + 1)));
      setImages(all);
      if (all.length === 0) {
        toast.info("No images found in this PDF.");
      } else {
        toast.success(`Found ${all.length} image(s) across ${pages.length} page(s).`);
      }
    } catch {
      toast.error(`Could not read ${f.name} — it may be corrupted or password-protected.`);
    }
  }

  function reset() {
    setFile(null);
    setOpts(DEFAULT_OPTIONS);
    setAltTextData("");
    setImages([]);
    setApplyResults([]);
    setResultBytes(null);
    setError("");
  }

  async function run() {
    if (!file) return;
    setWorking(true);
    setError("");
    setApplyResults([]);
    setResultBytes(null);
    try {
      const validation = validateOptions(opts, file.pageCount);
      if (!validation.ok) {
        setError(validation.error);
        setWorking(false);
        return;
      }
      const validOpts = validation.output;

      // Parse user alt-text data.
      const parsed = parseAltTextData(altTextData);
      if (!parsed.ok) {
        setError(parsed.error);
        setWorking(false);
        return;
      }

      // Resolve page range.
      const normalized = normalizePageRangeSpec(validOpts.pageRange);
      const doc = await PDFDocument.load(file.bytes);
      const pages = doc.getPages();
      let indices: number[];
      if (normalized === "all") {
        indices = pages.map((_, i) => i);
      } else {
        const r = parsePageRanges(resolveAllRange(normalized, pages.length), pages.length);
        if (!r.ok) {
          setError(r.error);
          setWorking(false);
          return;
        }
        indices = r.output;
      }

      // Filter images by selected pages.
      const pageSet = new Set(indices.map((i) => i + 1));
      const targetImages = images.filter((img) => pageSet.has(img.page));

      // Build apply plan.
      const plan = buildApplyPlan(targetImages, parsed.output.entries, validOpts);

      // Apply each plan step.
      const results: ApplyResult[] = [];
      for (const step of plan) {
        const page = pages[step.page - 1];
        if (!page) {
          results.push({
            page: step.page,
            imageIndex: step.imageIndex,
            altText: step.altText,
            action: "error",
            message: "Page out of range.",
          });
          continue;
        }
        const ok = applyAltToImage(
          page,
          step.page,
          step.imageIndex,
          step.altText,
          step.action === "marked-decorative",
        );
        if (ok) {
          results.push({
            page: step.page,
            imageIndex: step.imageIndex,
            altText: step.altText,
            action: step.action,
            message: step.action === "marked-decorative"
              ? "Marked as decorative."
              : "Alt text applied.",
          });
        } else {
          results.push({
            page: step.page,
            imageIndex: step.imageIndex,
            altText: step.altText,
            action: "error",
            message: "Image not found at that index.",
          });
        }
      }

      const saved = await doc.save({ useObjectStreams: true, addDefaultPage: false });
      setResultBytes(saved);
      setApplyResults(results);

      // Re-enumerate to refresh existing-alt flags after applying changes.
      const refreshed: ImageEntry[] = [];
      const newDoc = await PDFDocument.load(saved);
      newDoc.getPages().forEach((p, i) => refreshed.push(...scanPageImages(p, i + 1)));
      setImages(refreshed);

      // Save history.
      const summary = computeSummaryStats(refreshed, results, newDoc.getPageCount());
      saveHistory({
        ts: Date.now(),
        fileName: file.name,
        pageCount: newDoc.getPageCount(),
        totalImages: summary.totalImages,
        appliedCount: summary.appliedCount,
        decorativeCount: summary.decorativeCount,
        wcagPct: summary.wcagPct,
      });
      setHistory(loadHistory());
      toast.success(`Alt text applied: ${results.length} image(s) updated.`);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Something went wrong while applying alt text.");
    } finally {
      setWorking(false);
    }
  }

  function handleAutoFill() {
    const missing = findMissingAlt(images);
    if (missing.length === 0) {
      toast.info("No images are missing alt text.");
      return;
    }
    const entries = generateAutoAltEntries(images);
    const text = serializeAltTextData(entries);
    setAltTextData((prev) => (prev.trim() ? `${prev.trim()}\n${text}` : text));
    toast.success(`Auto-filled ${entries.length} alt text entry(ies).`);
  }

  function handleClearHistory() {
    clearHistory();
    setHistory([]);
    toast.success("History cleared");
  }

  const update = <K extends keyof AltTextOptions>(key: K, value: AltTextOptions[K]) =>
    setOpts((prev) => ({ ...prev, [key]: value }));

  const summary: SummaryStats | null = useMemo(
    () => images.length > 0
      ? computeSummaryStats(images, applyResults, file?.pageCount ?? 0)
      : null,
    [images, applyResults, file],
  );
  const wcag: WcagComplianceResult | null = useMemo(
    () => images.length > 0 ? checkWcagCompliance(images) : null,
    [images],
  );
  const perPage = useMemo(() => countImagesPerPage(images), [images]);
  const textReport = useMemo(
    () => summary && wcag ? renderTextReport(images, applyResults, summary, wcag) : "",
    [summary, wcag, images, applyResults],
  );
  const csvReport = useMemo(() => renderCsvReport(images), [images]);
  const jsonReport = useMemo(
    () => summary && wcag ? renderJsonReport(images, applyResults, summary, wcag) : "",
    [summary, wcag, images, applyResults],
  );

  return (
    <div className="space-y-4 unq-animate-fade-in-up">
      {file ? (
        <div className="flex flex-wrap items-center justify-between gap-3 rounded-lg border bg-card p-4">
          <div className="min-w-0 flex-1">
            <p className="truncate text-sm font-medium">{file.name}</p>
            <p className="text-xs text-muted-foreground">
              {file.pageCount} page{file.pageCount === 1 ? "" : "s"} • {formatBytes(file.bytes.length)} • {images.length} image{images.length === 1 ? "" : "s"}
            </p>
          </div>
          <Button variant="ghost" size="icon" aria-label="Remove file" onClick={reset}>
            <Trash2 className="h-4 w-4" />
          </Button>
        </div>
      ) : (
        <button
          type="button"
          onClick={() => inputRef.current?.click()}
          onDragOver={(e) => e.preventDefault()}
          onDrop={(e) => {
            e.preventDefault();
            const f = e.dataTransfer.files[0];
            if (f) void loadFile(f);
          }}
          className="w-full rounded-xl border-2 border-dashed border-border p-8 text-center hover:border-primary/50 hover:bg-primary/5 transition-colors"
        >
          <FileUp className="mx-auto mb-2 h-8 w-8 text-muted-foreground" />
          <p className="text-sm font-medium">Drop a PDF here or click to browse</p>
          <p className="mt-1 text-xs text-muted-foreground">Enumerates every image and lets you add alt text for accessibility.</p>
        </button>
      )}
      <input
        ref={inputRef}
        type="file"
        accept="application/pdf,.pdf"
        className="hidden"
        aria-label="Choose PDF"
        onChange={(e) => {
          const f = e.target.files?.[0];
          if (f) void loadFile(f);
          e.target.value = "";
        }}
      />

      {file && (
        <Card>
          <CardContent className="p-4 space-y-3">
            <div className="space-y-1.5">
              <Label htmlFor="alt-range">Page range (e.g. 1-3, 5, 8-10)</Label>
              <Input
                id="alt-range"
                value={opts.pageRange}
                onChange={(e) => update("pageRange", e.target.value)}
                placeholder="all"
                className="h-9"
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="alt-data">Alt text (one per line: page|image_index|alt_text)</Label>
              <textarea
                id="alt-data"
                value={altTextData}
                onChange={(e) => setAltTextData(e.target.value)}
                rows={6}
                placeholder={"1|0|Company logo showing blue circle\n2|1|Quarterly revenue chart for Q1 2024\n# Lines starting with # are comments"}
                className="w-full rounded-md border bg-background p-2 font-mono text-xs"
              />
              <p className="text-[10px] text-muted-foreground">
                Press the button below to auto-fill placeholder entries for all images missing alt text.
              </p>
              <div className="flex flex-wrap gap-2">
                <Button variant="outline" size="sm" onClick={handleAutoFill} disabled={images.length === 0}>
                  Auto-fill placeholders
                </Button>
              </div>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <label className="flex items-center gap-2 text-sm cursor-pointer">
                <input
                  type="checkbox"
                  checked={opts.autoGenerate}
                  onChange={(e) => update("autoGenerate", e.target.checked)}
                  className="h-4 w-4 rounded border-border"
                />
                Auto-generate placeholder alt text for images without one
              </label>
              <label className="flex items-center gap-2 text-sm cursor-pointer">
                <input
                  type="checkbox"
                  checked={opts.markAsDecorative}
                  onChange={(e) => update("markAsDecorative", e.target.checked)}
                  className="h-4 w-4 rounded border-border"
                />
                Mark images without alt as decorative (screen readers skip)
              </label>
            </div>
          </CardContent>
        </Card>
      )}

      <ActionBar>
        <RunButton onClick={() => void run()} disabled={!file} loading={working} label="Apply alt text" />
        <ClearButton onClick={reset} disabled={!file && !resultBytes && !error} label="Clear" />
      </ActionBar>

      {error && <ErrorBanner message={error} />}

      {images.length > 0 && (
        <Card>
          <CardContent className="p-4 space-y-2">
            <h3 className="text-sm font-semibold text-foreground flex items-center gap-1.5">
              <ListChecks className="h-4 w-4" /> Images ({images.length})
            </h3>
            <div className="space-y-1 max-h-[300px] overflow-auto">
              {formatImageList(images).map((line, i) => {
                const img = images[i];
                const type = detectImageType(img);
                return (
                  <div key={i} className="rounded border bg-background px-3 py-1.5 text-xs">
                    <div className="flex items-center gap-2">
                      <Badge
                        variant={img.isDecorative ? "outline" : img.hasAlt ? "default" : "destructive"}
                        className="text-[10px]"
                      >
                        {img.isDecorative ? "DECORATIVE" : img.hasAlt ? "HAS ALT" : "MISSING"}
                      </Badge>
                      <Badge variant="secondary" className="text-[10px]">{IMAGE_TYPE_LABELS[type]}</Badge>
                      <span className="font-mono text-foreground">{line}</span>
                    </div>
                  </div>
                );
              })}
            </div>
          </CardContent>
        </Card>
      )}

      {summary && wcag && (
        <>
          <div className="space-y-3 rounded-lg border border-primary/30 bg-primary/5 p-4">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div>
                <p className="text-sm font-medium">Alt text coverage</p>
                <p className="text-xs text-muted-foreground">
                  {summary.imagesWithAlt} with alt • {summary.decorativeCount} decorative • {summary.imagesWithoutAlt} missing • {summary.coveragePct}% coverage
                </p>
              </div>
              <Badge variant={summary.wcagPct >= 80 ? "default" : summary.wcagPct >= 50 ? "secondary" : "destructive"}>
                {summary.wcagPct}% WCAG
              </Badge>
            </div>
          </div>

          <Card>
            <CardContent className="p-4 space-y-2">
              <h3 className="text-sm font-semibold text-foreground flex items-center gap-1.5">
                <ShieldCheck className="h-4 w-4" /> WCAG 2.1 SC 1.1.1
              </h3>
              <p className="text-xs text-muted-foreground">
                {wcag.passed ? "PASS — all informative images have alt text." : `FAIL — ${wcag.missing} informative image(s) missing alt text.`}
              </p>
              {wcag.issues.length > 0 && (
                <div className="space-y-1 max-h-[200px] overflow-auto">
                  {wcag.issues.slice(0, 50).map((issue, i) => (
                    <div key={i} className="rounded border border-destructive/30 bg-destructive/5 px-3 py-1.5 text-xs">
                      <Badge variant="destructive" className="text-[10px] mr-2">MISSING</Badge>
                      <span className="font-mono">Page {issue.page} • Image #{issue.imageIndex}</span>
                      <span className="text-muted-foreground ml-2">{issue.reason}</span>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>

          {applyResults.length > 0 && (
            <Card>
              <CardContent className="p-4 space-y-2">
                <h3 className="text-sm font-semibold text-foreground flex items-center gap-1.5">
                  <AlertTriangle className="h-4 w-4" /> Apply results ({applyResults.length})
                </h3>
                <div className="space-y-1 max-h-[200px] overflow-auto">
                  {applyResults.map((r, i) => (
                    <div key={i} className="rounded border bg-background px-3 py-1.5 text-xs">
                      <div className="flex items-center gap-2">
                        <Badge
                          variant={r.action === "error" ? "destructive" : r.action === "applied" ? "default" : "secondary"}
                          className="text-[10px]"
                        >
                          {r.action.toUpperCase()}
                        </Badge>
                        <span className="font-mono text-foreground">Page {r.page} • Image #{r.imageIndex}</span>
                        <span className="text-muted-foreground ml-auto">{r.message}</span>
                      </div>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          )}

          <Card>
            <CardContent className="p-4 space-y-2">
              <h3 className="text-sm font-semibold text-foreground flex items-center gap-1.5">
                <ListChecks className="h-4 w-4" /> Images per page
              </h3>
              <div className="space-y-1 max-h-[200px] overflow-auto">
                {perPage.map((p) => (
                  <div key={p.page} className="rounded border bg-background px-3 py-1.5 text-xs flex items-center gap-2">
                    <Badge variant="outline" className="text-[10px]">Page {p.page}</Badge>
                    <span className="text-muted-foreground">
                      {p.total} image(s) — {p.withAlt} with alt, {p.decorative} decorative, {p.missing} missing
                    </span>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>

          <div className="flex flex-wrap gap-2">
            <CopyButton getText={() => textReport} label="Copy report" />
            <DownloadButton getText={() => textReport} filename="alt-text-report.txt" mime="text/plain" label=".txt" />
            <DownloadButton getText={() => csvReport} filename="alt-text-report.csv" mime="text/csv" label=".csv" />
            <DownloadButton getText={() => jsonReport} filename="alt-text-report.json" mime="application/json" label=".json" />
            <ShareButton getUrl={() => buildShareUrl(opts)} />
            {resultBytes && (
              <Button
                onClick={() => downloadBytes(resultBytes, `alt-text-${file?.name ?? "output.pdf"}`)}
                className="gap-1.5"
              >
                <Download className="h-3.5 w-3.5" /> Download PDF
              </Button>
            )}
          </div>
        </>
      )}

      {!summary && !error && file && images.length === 0 && (
        <EmptyState
          title="No images found"
          hint="This PDF doesn't appear to contain any image XObjects. Try another file."
          icon={<ImagePlus className="h-8 w-8" />}
        />
      )}

      {!summary && !error && file && images.length > 0 && (
        <EmptyState
          title="Ready to apply alt text"
          hint="Enter alt text in the textarea above (or use Auto-fill placeholders), then click 'Apply alt text'. The tool writes /Alt entries on each image XObject for screen readers."
          icon={<ImagePlus className="h-8 w-8" />}
        />
      )}

      {history.length > 0 && (
        <Card>
          <CardContent className="p-4 space-y-2">
            <div className="flex items-center justify-between">
              <h3 className="text-sm font-semibold text-foreground flex items-center gap-1.5">
                <History className="h-4 w-4" /> Recent ({history.length})
              </h3>
              <Button variant="ghost" size="sm" onClick={handleClearHistory}>Clear</Button>
            </div>
            <div className="space-y-1">
              {history.slice(0, 5).map((h, i) => (
                <div key={i} className="rounded border bg-background px-3 py-2 text-xs">
                  <Badge variant={h.wcagPct >= 80 ? "default" : h.wcagPct >= 50 ? "secondary" : "destructive"} className="mr-2">
                    {h.wcagPct}%
                  </Badge>
                  <span className="text-muted-foreground">
                    {h.totalImages} images • {h.appliedCount} applied • {h.decorativeCount} decorative
                  </span>
                  <span className="text-muted-foreground ml-2">· {h.fileName} · {new Date(h.ts).toLocaleString()}</span>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      <p className="text-xs text-muted-foreground">
        <strong className="text-foreground">Privacy:</strong> All alt-text processing runs 100% locally in your browser using JavaScript and pdf-lib. Your PDF never leaves your device. History is stored in localStorage on this device only.
      </p>
    </div>
  );
}
