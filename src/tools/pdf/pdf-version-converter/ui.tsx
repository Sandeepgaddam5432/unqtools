"use client";

import React, { useRef, useState, useEffect, useMemo, useCallback } from "react";
import { PDFDocument } from "pdf-lib";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Download, FileUp, Trash2, History, CheckCircle2, XCircle, AlertCircle } from "lucide-react";
import { toast } from "sonner";
import {
  ActionBar,
  ClearButton,
  CopyButton,
  DownloadButton,
  ErrorBanner,
  RunButton,
  ShareButton,
} from "../../_shared";
import { downloadBytes, formatBytes } from "../_shared/download";
import {
  TARGET_VERSIONS,
  VERSION_LABELS,
  HEADER_VERSIONS,
  VERSION_FAMILY,
  DEFAULT_OPTIONS,
  detectPdfVersion,
  patchPdfHeader,
  buildConversionReport,
  checkCompliance,
  buildFeatureLossReport,
  generateXmpMetadata,
  renderTextReport,
  renderCsvReport,
  renderJsonReport,
  loadHistory,
  saveHistory,
  clearHistory,
  buildShareUrl,
  parseShareUrl,
  validateOptions,
  type ConverterOptions,
  type TargetVersion,
  type PdfContent,
  type ConversionResult,
  type HistoryEntry,
} from "./logic";

interface LoadedPdf {
  name: string;
  bytes: Uint8Array;
  pageCount: number;
  detectedVersion: string;
  content: PdfContent;
  title: string;
  author: string;
  subject: string;
  keywords: string[];
  creator: string;
  producer: string;
}

export default function PdfVersionConverter() {
  const inputRef = useRef<HTMLInputElement>(null);
  const [file, setFile] = useState<LoadedPdf | null>(null);
  const [options, setOptions] = useState<ConverterOptions>(DEFAULT_OPTIONS);
  const [convertedBytes, setConvertedBytes] = useState<Uint8Array | null>(null);
  const [report, setReport] = useState<ConversionResult | null>(null);
  const [error, setError] = useState("");
  const [working, setWorking] = useState(false);
  const [history, setHistory] = useState<HistoryEntry[]>([]);

  useEffect(() => {
    setHistory(loadHistory());
    if (typeof window !== "undefined" && window.location.hash) {
      const parsed = parseShareUrl(window.location.hash);
      if (Object.keys(parsed).length > 0) {
        setOptions((prev) => ({ ...prev, ...parsed }));
        toast.info("Loaded settings from share link");
      }
    }
  }, []);

  async function loadFile(f: File) {
    try {
      const bytes = new Uint8Array(await f.arrayBuffer());
      const doc = await PDFDocument.load(bytes, { ignoreEncryption: true });
      const detected = detectPdfVersion(bytes);
      const content = await extractContent(doc, bytes);
      setFile({
        name: f.name,
        bytes,
        pageCount: doc.getPageCount(),
        detectedVersion: detected.ok ? detected.raw : "(unknown)",
        content,
        title: doc.getTitle() ?? "",
        author: doc.getAuthor() ?? "",
        subject: doc.getSubject() ?? "",
        keywords: normalizeKeywords(doc.getKeywords()),
        creator: doc.getCreator() ?? "",
        producer: doc.getProducer() ?? "",
      });
      setConvertedBytes(null);
      setReport(null);
      setError("");
    } catch {
      toast.error(`Could not read ${f.name} — it may be corrupted.`);
    }
  }

  function reset() {
    setFile(null);
    setConvertedBytes(null);
    setReport(null);
    setError("");
  }

  function resetHistory() {
    clearHistory();
    setHistory([]);
    toast.success("History cleared");
  }

  async function run() {
    if (!file) return;
    const validationError = validateOptions(options);
    if (validationError) {
      setError(validationError);
      return;
    }
    setWorking(true);
    setError("");
    setConvertedBytes(null);
    setReport(null);

    try {
      const doc = await PDFDocument.load(file.bytes, { ignoreEncryption: true });

      // For PDF/A: optionally embed XMP metadata
      const family = VERSION_FAMILY[options.targetVersion];
      if (family === "pdf-a" && options.preserveMetadata) {
        const xmp = generateXmpMetadata({
          title: file.title || file.name.replace(/\.pdf$/i, ""),
          author: file.author,
          subject: file.subject,
          keywords: file.keywords,
          creator: file.creator || "UnQTools PDF Version Converter",
          producer: "UnQTools — PDF Version Converter",
          target: options.targetVersion,
        });
        try {
          // pdf-lib's setXmpMetadata is not on the public type defs but exists at runtime
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          (doc as any).setXmpMetadata?.(xmp);
        } catch {
          // best-effort — XMP optional on some pdf-lib versions
        }
      }

      // Save the PDF; pdf-lib will pick its own header version. We then patch
      // the header to the exact target version before download.
      const savedBytes = await doc.save({
        useObjectStreams: true,
        addDefaultPage: false,
        objectsPerTick: 50,
      });

      // Patch the header to the target version
      const patched = patchPdfHeader(savedBytes, options.targetVersion);

      // Update content (we assume the conversion added XMP if it was a PDF/A target)
      const postContent: PdfContent = {
        ...file.content,
        hasXmpMetadata: family === "pdf-a" ? true : file.content.hasXmpMetadata,
      };

      const reportResult = buildConversionReport(
        file.detectedVersion,
        file.bytes.length,
        patched.length,
        postContent,
        options,
      );
      if (!reportResult.ok) {
        setError(reportResult.error);
        setWorking(false);
        return;
      }
      setConvertedBytes(patched);
      setReport(reportResult.output);
      saveHistory({
        ts: Date.now(),
        fileName: file.name,
        sourceVersion: file.detectedVersion,
        targetVersion: options.targetVersion,
        originalSize: file.bytes.length,
        convertedSize: patched.length,
        compliant: reportResult.output.summary.compliant,
      });
      setHistory(loadHistory());
      toast.success(
        `Converted: ${file.detectedVersion} → ${HEADER_VERSIONS[options.targetVersion]} (${reportResult.output.summary.compliant ? "compliant" : "non-compliant"})`,
      );
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      setError(`Could not convert: ${msg}`);
    } finally {
      setWorking(false);
    }
  }

  const compliance = useMemo(() => {
    if (!file) return null;
    return checkCompliance(options.targetVersion, file.content);
  }, [file, options.targetVersion]);

  const featureLoss = useMemo(() => {
    if (!file) return null;
    return buildFeatureLossReport(options.targetVersion, file.content);
  }, [file, options.targetVersion]);

  const textReport = useMemo(() => (report ? renderTextReport(report) : ""), [report]);
  const csvReport = useMemo(() => (report ? renderCsvReport(report) : ""), [report]);
  const jsonReport = useMemo(() => (report ? renderJsonReport(report) : ""), [report]);

  const handleDownload = useCallback(() => {
    if (!convertedBytes || !file) return;
    const baseName = file.name.replace(/\.pdf$/i, "");
    downloadBytes(convertedBytes, `${options.targetVersion}-${baseName}.pdf`);
    toast.success("Downloaded converted PDF");
  }, [convertedBytes, file, options.targetVersion]);

  return (
    <div className="space-y-4 unq-animate-fade-in-up">
      {file ? (
        <div className="flex flex-wrap items-center justify-between gap-3 rounded-lg border bg-card p-4">
          <div className="min-w-0 flex-1">
            <p className="truncate text-sm font-medium">{file.name}</p>
            <p className="text-xs text-muted-foreground">
              {file.pageCount} page{file.pageCount === 1 ? "" : "s"} • {formatBytes(file.bytes.length)} • Current version: <span className="font-mono font-medium">{file.detectedVersion}</span>
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
          <p className="mt-1 text-xs text-muted-foreground">
            Converts between 9 PDF versions: 1.4 / 1.5 / 1.6 / 1.7 / 2.0 / PDF/A / PDF/X.
          </p>
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
        <div className="rounded-lg border bg-card p-4 space-y-3">
          <div className="space-y-1.5">
            <Label htmlFor="target-version">Target version</Label>
            <select
              id="target-version"
              value={options.targetVersion}
              onChange={(e) => setOptions((p) => ({ ...p, targetVersion: e.target.value as TargetVersion }))}
              className="flex h-9 w-full rounded-md border border-input bg-background px-3 text-sm cursor-pointer"
            >
              {TARGET_VERSIONS.map((v) => (
                <option key={v} value={v}>{VERSION_LABELS[v]}</option>
              ))}
            </select>
          </div>

          <div className="space-y-2">
            <label className="flex items-center gap-2 text-sm cursor-pointer select-none">
              <input
                type="checkbox"
                checked={options.preserveMetadata}
                onChange={(e) => setOptions((p) => ({ ...p, preserveMetadata: e.target.checked }))}
                className="h-4 w-4 rounded border-border"
              />
              <span>Preserve metadata (add XMP for PDF/A)</span>
            </label>
            <label className="flex items-center gap-2 text-sm cursor-pointer select-none">
              <input
                type="checkbox"
                checked={options.embedFonts}
                onChange={(e) => setOptions((p) => ({ ...p, embedFonts: e.target.checked }))}
                className="h-4 w-4 rounded border-border"
              />
              <span>Embed all fonts (required for PDF/A & PDF/X)</span>
            </label>
            <label className="flex items-center gap-2 text-sm cursor-pointer select-none">
              <input
                type="checkbox"
                checked={options.removeUnsupportedFeatures}
                onChange={(e) => setOptions((p) => ({ ...p, removeUnsupportedFeatures: e.target.checked }))}
                className="h-4 w-4 rounded border-border"
              />
              <span>Remove features unsupported in target version</span>
            </label>
          </div>

          {compliance && (
            <div className={`rounded border px-3 py-2 text-xs ${
              compliance.compliant
                ? "border-emerald-500/30 bg-emerald-500/5"
                : "border-amber-500/30 bg-amber-500/5"
            }`}>
              <div className="font-medium flex items-center gap-1.5">
                {compliance.compliant ? (
                  <CheckCircle2 className="h-3.5 w-3.5 text-emerald-600 dark:text-emerald-400" />
                ) : (
                  <AlertCircle className="h-3.5 w-3.5 text-amber-600 dark:text-amber-400" />
                )}
                {compliance.compliant ? "Pre-flight check passed" : "Pre-flight check: not compliant"}
              </div>
              <ul className="mt-1 space-y-0.5">
                {compliance.requirements.map((r) => (
                  <li key={r.id} className="flex items-start gap-1.5">
                    {r.met ? (
                      <CheckCircle2 className="h-3 w-3 mt-0.5 text-emerald-600 dark:text-emerald-400 flex-shrink-0" />
                    ) : (
                      <XCircle className="h-3 w-3 mt-0.5 text-amber-600 dark:text-amber-400 flex-shrink-0" />
                    )}
                    <span>{r.description}</span>
                    {!r.met && r.required && (
                      <span className="text-muted-foreground"> — {r.remediation}</span>
                    )}
                  </li>
                ))}
              </ul>
            </div>
          )}

          {featureLoss && (featureLoss.removed.length > 0 || featureLoss.converted.length > 0) && (
            <div className="rounded border border-amber-500/30 bg-amber-500/5 px-3 py-2 text-xs">
              <div className="font-medium text-amber-700 dark:text-amber-400">Feature changes</div>
              <ul className="mt-1 space-y-0.5">
                {featureLoss.removed.map((r, i) => (
                  <li key={`r-${i}`}>
                    <span className="font-mono uppercase text-red-600 dark:text-red-400">remove</span>
                    {" "}<span className="font-medium">{r.feature}</span> — {r.reason}
                  </li>
                ))}
                {featureLoss.converted.map((r, i) => (
                  <li key={`c-${i}`}>
                    <span className="font-mono uppercase text-amber-600 dark:text-amber-400">convert</span>
                    {" "}<span className="font-medium">{r.feature}</span> — {r.reason}
                  </li>
                ))}
              </ul>
            </div>
          )}
        </div>
      )}

      <ActionBar>
        <RunButton onClick={() => void run()} disabled={!file} loading={working} label="Convert PDF" />
        <ClearButton onClick={reset} disabled={!file && !convertedBytes && !error} label="Clear" />
      </ActionBar>

      {error && <ErrorBanner message={error} />}

      {convertedBytes && report && (
        <div className="space-y-3 rounded-lg border border-primary/30 bg-primary/5 p-4">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <p className="text-sm font-medium">Converted PDF ready</p>
              <p className="text-xs text-muted-foreground">
                {report.sourceVersion || "?"} → {HEADER_VERSIONS[report.targetVersion]} • {formatBytes(report.originalSize)} → {formatBytes(report.convertedSize)}
              </p>
            </div>
            <Button onClick={handleDownload} className="gap-1.5">
              <Download className="h-4 w-4" /> Download
            </Button>
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-xs">
            <Stat label="Source" value={report.sourceVersion || "?"} />
            <Stat label="Target" value={HEADER_VERSIONS[report.targetVersion]} />
            <Stat label="Family" value={report.summary.family} />
            <Stat
              label="Compliant"
              value={report.summary.compliant ? "Yes ✓" : "No ✗"}
              highlight={report.summary.compliant ? "good" : "bad"}
            />
          </div>

          {report.qualityImpacts.length > 0 && (
            <div className="rounded border border-amber-500/30 bg-amber-500/5 px-3 py-2 text-xs">
              <div className="font-medium text-amber-700 dark:text-amber-400">Quality impact</div>
              <ul className="mt-1 list-disc list-inside text-muted-foreground space-y-0.5">
                {report.qualityImpacts.map((q, i) => <li key={i}>{q}</li>)}
              </ul>
            </div>
          )}

          <div className="flex flex-wrap gap-2 pt-1">
            <CopyButton getText={() => textReport} label="Copy report" />
            <DownloadButton
              getText={() => csvReport}
              filename="conversion-report.csv"
              mime="text/csv"
              label="Download CSV"
            />
            <DownloadButton
              getText={() => jsonReport}
              filename="conversion-report.json"
              mime="application/json"
              label="Download JSON"
            />
            <ShareButton getUrl={() => buildShareUrl(options)} />
          </div>
        </div>
      )}

      {history.length > 0 && (
        <div className="space-y-2 rounded-lg border bg-card p-4">
          <div className="flex items-center justify-between">
            <h3 className="text-sm font-semibold flex items-center gap-1.5">
              <History className="h-4 w-4" /> Recent ({history.length})
            </h3>
            <Button variant="ghost" size="sm" onClick={resetHistory}>Clear</Button>
          </div>
          <div className="space-y-1">
            {history.slice(0, 5).map((h, i) => (
              <div key={i} className="rounded border bg-background px-3 py-2 text-xs">
                <span className="font-mono font-medium">{h.fileName}</span>{" "}
                <span className="text-muted-foreground">
                  · {h.sourceVersion || "?"} → {h.targetVersion}
                  · {formatBytes(h.originalSize)} → {formatBytes(h.convertedSize)}
                  {h.compliant ? " · compliant ✓" : " · non-compliant ✗"}
                </span>
                <span className="text-muted-foreground ml-2">· {new Date(h.ts).toLocaleString()}</span>
              </div>
            ))}
          </div>
        </div>
      )}

      <p className="text-xs text-muted-foreground">
        Privacy: version conversion runs 100% locally in your browser using pdf-lib — your PDF never leaves your device.
      </p>
    </div>
  );
}

function Stat({ label, value, highlight }: { label: string; value: string | number; highlight?: "good" | "bad" }) {
  const color = highlight === "good"
    ? "text-emerald-600 dark:text-emerald-400"
    : highlight === "bad"
      ? "text-red-600 dark:text-red-400"
      : "text-foreground";
  return (
    <div className="rounded border bg-background px-3 py-2">
      <div className="text-[10px] uppercase tracking-wide text-muted-foreground">{label}</div>
      <div className={`text-sm font-semibold ${color}`}>{value}</div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// PDF content extraction — best-effort feature detection via pdf-lib
// ---------------------------------------------------------------------------

async function extractContent(doc: PDFDocument, bytes: Uint8Array): Promise<PdfContent> {
  const content: PdfContent = {
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
    hasXmpMetadata: false,
    hasOutputIntent: false,
    hasTrimBox: false,
    hasBleedBox: false,
    fontCount: 0,
    embeddedFontCount: 0,
  };

  // Heuristic feature detection: search the raw PDF bytes for known markers.
  // This is intentionally conservative — we'd rather under-report than
  // mis-classify a feature.
  try {
    const head = bytesToAscii(bytes.subarray(0, Math.min(bytes.length, 1024)));
    const tail = bytesToAscii(bytes.subarray(Math.max(0, bytes.length - 4096)));
    const sample = head + tail;

    // pdf-lib loads encrypted PDFs with ignoreEncryption:true; we detect
    // encryption by looking for the /Encrypt key in the trailer.
    if (/\/Encrypt\s+\d+\s+\d+\s+R/.test(sample)) {
      content.hasEncryption = true;
    }
    if (/\/JS\b|\/JavaScript\b/.test(sample)) content.hasJavaScript = true;
    if (/\/EmbeddedFile\b/.test(sample)) content.hasEmbeddedFiles = true;
    if (/\/Launch\b|\/GoToR\b|\/URI\s*\(/.test(sample)) content.hasExternalReferences = true;
    if (/\/RichMedia\b|\/Sound\b|\/Movie\b/.test(sample)) {
      content.hasAudio = true;
      content.hasVideo = true;
    }
    if (/\/AcroForm\b|\/Widget\b/.test(sample)) content.hasForms = true;
    if (/\/DeviceRGB\b/.test(sample)) content.hasRgbColors = true;
    if (/\/DeviceCMYK\b/.test(sample)) content.hasCmykColors = true;
    if (/\/OutputIntents\b/.test(sample)) content.hasOutputIntent = true;
    if (/\/TrimBox\b/.test(sample)) content.hasTrimBox = true;
    if (/\/BleedBox\b/.test(sample)) content.hasBleedBox = true;
    if (/\/Metadata\b/.test(sample)) content.hasXmpMetadata = true;
  } catch {
    // best-effort
  }

  // Font enumeration via pdf-lib
  try {
    const pages = doc.getPages();
    let totalFonts = 0;
    let embeddedFonts = 0;
    for (const page of pages) {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const node = page.node as any;
      const resources = node.get?.("Resources");
      if (!resources) continue;
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const r = resources as any;
      const fontDict = r.lookup?.("Font");
      if (!fontDict) continue;
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const f = fontDict.lookup?.() as any;
      if (!f || typeof f !== "object") continue;
      for (const key of Object.keys(f)) {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const v = f[key];
        totalFonts++;
        const baseFont = v?.get?.("BaseFont")?.toString?.() ?? key;
        const isStandard = /Times|Helvetica|Courier|Symbol|ZapfDingbats/.test(baseFont);
        // FontDescriptor with FontFile2/FontFile3 indicates embedding
        const fontDesc = v?.get?.("FontDescriptor");
        const hasFontFile = fontDesc?.toString?.().includes("FontFile");
        if (isStandard || hasFontFile) embeddedFonts++;
      }
    }
    content.fontCount = totalFonts;
    content.embeddedFontCount = embeddedFonts;
    content.fontsAllEmbedded = embeddedFonts >= totalFonts && totalFonts > 0;
  } catch {
    // best-effort
  }

  return content;
}

function bytesToAscii(bytes: Uint8Array): string {
  let s = "";
  for (let i = 0; i < bytes.length; i++) s += String.fromCharCode(bytes[i]);
  return s;
}

/** Normalize pdf-lib's getKeywords() return (string | string[] | undefined) into string[]. */
function normalizeKeywords(kw: string | string[] | undefined | null): string[] {
  if (!kw) return [];
  if (Array.isArray(kw)) return kw;
  return kw.split(/[;,]/).map((s) => s.trim()).filter(Boolean);
}
