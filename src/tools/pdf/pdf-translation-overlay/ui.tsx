"use client";

import React, { useEffect, useMemo, useRef, useState } from "react";
import { PDFDocument, rgb, StandardFonts } from "pdf-lib";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import {
  Languages,
  Download,
  FileUp,
  Trash2,
  History,
  AlertTriangle,
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
import { downloadBytes, formatBytes } from "../_shared/download";
import {
  OVERLAY_POSITIONS,
  POSITION_LABELS,
  FONT_FAMILIES,
  FONT_LABELS,
  DEFAULT_FONT_SIZE,
  DEFAULT_FONT_FAMILY,
  DEFAULT_TEXT_COLOR,
  DEFAULT_POSITION,
  normalizePageRangeSpec,
  resolveAllRange,
  expandPageRange,
  parseTranslations,
  validateEntries,
  calculateOverlayPosition,
  parseHexColor,
  normalizeFontFamily,
  validateFontSize,
  computeBackgroundRect,
  detectCollisions,
  detectTextDirection,
  detectLanguage,
  applyRtlHandling,
  computeOverlays,
  computeStats,
  renderTextReport,
  renderCsv,
  loadHistory,
  saveHistory,
  clearHistory,
  buildShareUrl,
  parseShareUrl,
  validateOptions,
  type TranslationEntry,
  type OverlayOptions,
  type OverlayPosition,
  type FontFamily,
  type ComputedOverlay,
  type HistoryEntry,
} from "./logic";

export default function PdfTranslationOverlay() {
  const inputRef = useRef<HTMLInputElement>(null);
  const [file, setFile] = useState<{ name: string; bytes: Uint8Array; pageCount: number } | null>(null);
  const [translations, setTranslations] = useState(
    "1|72|700|Hello, World|12\n2|72|700|Bonjour le monde|12",
  );
  const [position, setPosition] = useState<OverlayPosition>(DEFAULT_POSITION);
  const [fontSizeInput, setFontSizeInput] = useState(String(DEFAULT_FONT_SIZE));
  const [textColor, setTextColor] = useState(DEFAULT_TEXT_COLOR);
  const [backgroundColor, setBackgroundColor] = useState("");
  const [fontFamily, setFontFamily] = useState<FontFamily>(DEFAULT_FONT_FAMILY);
  const [pageRange, setPageRange] = useState("all");
  const [result, setResult] = useState<Uint8Array | null>(null);
  const [error, setError] = useState("");
  const [working, setWorking] = useState(false);
  const [history, setHistory] = useState<HistoryEntry[]>([]);

  useEffect(() => {
    setHistory(loadHistory());
    if (typeof window !== "undefined" && window.location.hash) {
      const p = parseShareUrl(window.location.hash);
      if (p.translations) setTranslations(p.translations);
      if (p.position) setPosition(p.position);
      if (p.fontSize) setFontSizeInput(String(p.fontSize));
      if (p.fontFamily) setFontFamily(p.fontFamily);
      if (p.textColor) setTextColor(p.textColor);
      if (p.backgroundColor) setBackgroundColor(p.backgroundColor);
      if (p.pageRange) setPageRange(p.pageRange);
      if (Object.keys(p).length > 0) toast.info("Loaded settings from share link");
    }
  }, []);

  const fontSize = validateFontSize(Number(fontSizeInput)).value;

  const options: OverlayOptions = useMemo(
    () => ({
      position,
      fontSize,
      textColor,
      backgroundColor,
      fontFamily,
      pageRange,
    }),
    [position, fontSize, textColor, backgroundColor, fontFamily, pageRange],
  );

  const entries: TranslationEntry[] = useMemo(
    () => parseTranslations(translations, file?.pageCount ?? 1),
    [translations, file?.pageCount],
  );

  const validationError = useMemo(
    () => validateEntries(entries, file?.pageCount ?? 1),
    [entries, file?.pageCount],
  );

  const eligiblePages = useMemo(() => {
    const pageCount = file?.pageCount ?? 0;
    if (pageCount === 0) return new Set<number>();
    const expanded = expandPageRange(resolveAllRange(pageRange, pageCount), pageCount);
    return new Set(expanded ?? []);
  }, [pageRange, file?.pageCount]);

  const overlays: ComputedOverlay[] = useMemo(
    () => computeOverlays(entries, eligiblePages, options),
    [entries, eligiblePages, options],
  );

  const collisionRects = useMemo(
    () =>
      overlays.map((o) => ({
        x: o.x,
        y: o.y,
        width: o.width,
        height: o.height,
      })),
    [overlays],
  );
  const collisions = useMemo(() => detectCollisions(collisionRects), [collisionRects]);
  const stats = useMemo(
    () => computeStats(entries, overlays, options, collisions),
    [entries, overlays, options, collisions],
  );

  const textReport = useMemo(
    () => renderTextReport(entries, overlays, stats, options),
    [entries, overlays, stats, options],
  );
  const csvReport = useMemo(() => renderCsv(entries, overlays), [entries, overlays]);

  const shareUrl = useMemo(() => buildShareUrl(options, translations), [options, translations]);

  async function loadFile(f: File) {
    try {
      const bytes = new Uint8Array(await f.arrayBuffer());
      const doc = await PDFDocument.load(bytes);
      setFile({ name: f.name, bytes, pageCount: doc.getPageCount() });
      setResult(null);
      setError("");
    } catch {
      toast.error(`Could not read ${f.name} — it may be corrupted or password-protected.`);
    }
  }

  function reset() {
    setFile(null);
    setResult(null);
    setError("");
  }

  function handleClear() {
    setTranslations("");
    setResult(null);
    setError("");
  }

  function handleClearHistory() {
    clearHistory();
    setHistory([]);
    toast.success("History cleared");
  }

  async function run() {
    if (!file) return;
    if (validationError) {
      setError(validationError);
      return;
    }
    const optCheck = validateOptions(options, file.pageCount);
    if (!optCheck.ok) {
      setError(optCheck.error);
      return;
    }
    setWorking(true);
    setError("");
    setResult(null);
    try {
      const out = await stampOverlays(file.bytes, entries, eligiblePages, optCheck.output);
      setWorking(false);
      if (out.ok) {
        setResult(out.output);
        saveHistory({
          ts: Date.now(),
          fileName: file.name,
          pageCount: file.pageCount,
          overlayCount: stats.appliedOverlays,
          position: optCheck.output.position,
          fontFamily: optCheck.output.fontFamily,
        });
        setHistory(loadHistory());
        toast.success(
          `Applied ${stats.appliedOverlays} overlay${stats.appliedOverlays === 1 ? "" : "s"}!`,
        );
      } else {
        setError(out.error);
      }
    } catch (e) {
      setWorking(false);
      const msg = e instanceof Error ? e.message : String(e);
      setError(`Overlay failed: ${msg}`);
    }
  }

  return (
    <div className="space-y-4 unq-animate-fade-in-up">
      {file ? (
        <div className="flex flex-wrap items-center justify-between gap-3 rounded-lg border bg-card p-4">
          <div className="min-w-0 flex-1">
            <p className="truncate text-sm font-medium">{file.name}</p>
            <p className="text-xs text-muted-foreground">
              {file.pageCount} page{file.pageCount === 1 ? "" : "s"} • {formatBytes(file.bytes.length)}
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
          <p className="mt-1 text-xs text-muted-foreground">Overlay translated text on PDF pages.</p>
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

      <Card>
        <CardContent className="p-4 space-y-3">
          <div className="space-y-1.5">
            <Label htmlFor="tx-input">Translations — one entry per line</Label>
            <Textarea
              id="tx-input"
              value={translations}
              onChange={(e) => setTranslations(e.target.value)}
              placeholder={"page|x|y|translated_text|font_size\n1|72|700|Hello, World|12\n2|72|700|Bonjour le monde|12"}
              className="min-h-[140px] resize-y font-mono text-xs"
            />
            <p className="text-[11px] text-muted-foreground">
              Format: <code>page|x|y|translated_text|font_size</code>. Pipe or comma separator. Last field (font_size) optional. Lines starting with <code>#</code> are skipped. Quoted text allows embedded commas.
            </p>
          </div>

          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            <div className="space-y-1.5">
              <Label htmlFor="tx-position">Position</Label>
              <select
                id="tx-position"
                value={position}
                onChange={(e) => setPosition(e.target.value as OverlayPosition)}
                className="flex h-9 w-full rounded-md border border-input bg-background px-3 text-sm cursor-pointer"
              >
                {OVERLAY_POSITIONS.map((p) => (
                  <option key={p} value={p}>{POSITION_LABELS[p]}</option>
                ))}
              </select>
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="tx-font">Font family</Label>
              <select
                id="tx-font"
                value={fontFamily}
                onChange={(e) => setFontFamily(e.target.value as FontFamily)}
                className="flex h-9 w-full rounded-md border border-input bg-background px-3 text-sm cursor-pointer"
              >
                {FONT_FAMILIES.map((f) => (
                  <option key={f} value={f}>{FONT_LABELS[f]}</option>
                ))}
              </select>
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="tx-fs">Font size (pt)</Label>
              <Input
                id="tx-fs"
                type="number"
                min={4}
                max={72}
                value={fontSizeInput}
                onChange={(e) => setFontSizeInput(e.target.value)}
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="tx-color">Text color</Label>
              <input
                id="tx-color"
                type="color"
                value={textColor}
                onChange={(e) => setTextColor(e.target.value)}
                className="h-9 w-full cursor-pointer rounded-md border border-input bg-background p-1"
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="tx-bg">Background highlight (blank = transparent)</Label>
              <Input
                id="tx-bg"
                value={backgroundColor}
                onChange={(e) => setBackgroundColor(e.target.value)}
                placeholder="#FFFF00 or empty"
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="tx-range">Page range</Label>
              <Input
                id="tx-range"
                value={pageRange}
                onChange={(e) => setPageRange(e.target.value)}
                placeholder="all or e.g. 1-3, 5, 8-"
                className="font-mono text-sm"
              />
            </div>
          </div>
        </CardContent>
      </Card>

      {entries.length > 0 && (
        <Card>
          <CardContent className="p-4 space-y-2">
            <h3 className="text-sm font-semibold flex items-center gap-1.5">
              <Languages className="h-4 w-4" /> {stats.totalEntries} entr{stats.totalEntries === 1 ? "y" : "ies"} → {stats.appliedOverlays} overlay{stats.appliedOverlays === 1 ? "" : "s"}
            </h3>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-xs">
              <Stat label="Applied" value={stats.appliedOverlays} />
              <Stat label="Skipped (out of range)" value={stats.skippedOutOfRange} />
              <Stat label="RTL / LTR" value={`${stats.rtlCount} / ${stats.ltrCount}`} />
              <Stat label="Collisions" value={stats.collisionsDetected} />
            </div>
            {stats.collisionsDetected > 0 && (
              <div className="rounded border border-amber-400/40 bg-amber-50 dark:bg-amber-950/30 p-2 text-xs text-amber-700 dark:text-amber-300 flex items-start gap-2">
                <AlertTriangle className="h-3.5 w-3.5 mt-0.5 flex-shrink-0" />
                <span>
                  {stats.collisionsDetected} overlay pair{stats.collisionsDetected === 1 ? "" : "s"} overlap. Consider adjusting positions or font size.
                </span>
              </div>
            )}
            <div className="space-y-1 max-h-[260px] overflow-auto">
              {overlays.map((o, i) => (
                <div key={i} className="flex items-center gap-2 rounded border bg-background px-3 py-1.5 text-xs">
                  <Badge variant="outline" className="text-[10px]">p{o.entry.page}</Badge>
                  <Badge variant="secondary" className="text-[10px]">{o.direction.toUpperCase()}</Badge>
                  <Badge variant="outline" className="text-[10px]">{o.language}</Badge>
                  <span className="font-mono text-foreground truncate flex-1">{o.entry.text}</span>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      <ActionBar>
        <RunButton
          onClick={() => void run()}
          disabled={!file || !!validationError || entries.length === 0}
          loading={working}
          label="Apply Overlays"
        />
        <ClearButton onClick={handleClear} disabled={!translations && !result && !error} label="Clear" />
        <CopyButton getText={() => textReport} label="Copy report" disabled={entries.length === 0} />
        <DownloadButton
          getText={() => csvReport}
          filename="translation-overlay-report.csv"
          mime="text/csv"
          label="Download CSV"
          disabled={entries.length === 0}
        />
        <ShareButton getUrl={() => shareUrl} disabled={!translations} />
      </ActionBar>

      {error && <ErrorBanner message={error} />}

      {result && (
        <div className="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-primary/30 bg-primary/5 p-4">
          <div>
            <p className="text-sm font-medium">Translation-overlaid PDF ready</p>
            <p className="text-xs text-muted-foreground">
              {stats.appliedOverlays} overlay{stats.appliedOverlays === 1 ? "" : "s"} • {formatBytes(result.length)}
            </p>
          </div>
          <Button
            onClick={() => downloadBytes(result, `translated-${file?.name ?? "output.pdf"}`)}
            className="gap-1.5"
          >
            <Download className="h-4 w-4" /> Download
          </Button>
        </div>
      )}

      {history.length > 0 && (
        <Card>
          <CardContent className="p-4 space-y-2">
            <div className="flex items-center justify-between">
              <h3 className="text-sm font-semibold flex items-center gap-1.5">
                <History className="h-4 w-4" /> Recent ({history.length})
              </h3>
              <Button variant="ghost" size="sm" onClick={handleClearHistory}>Clear</Button>
            </div>
            <div className="space-y-1">
              {history.slice(0, 5).map((h, i) => (
                <div key={i} className="rounded border bg-background px-3 py-2 text-xs">
                  <Badge variant="outline" className="mr-2 text-[10px]">{h.position}</Badge>
                  <Badge variant="outline" className="mr-2 text-[10px]">{h.fontFamily}</Badge>
                  <span className="font-medium">{h.fileName}</span>
                  <span className="text-muted-foreground ml-2">
                    {h.pageCount}p • {h.overlayCount} overlays
                  </span>
                  <span className="text-muted-foreground ml-2">· {new Date(h.ts).toLocaleString()}</span>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      <p className="text-xs text-muted-foreground">
        Privacy: PDF loading, overlay rendering, and saving all run 100% locally in your browser via pdf-lib — your PDF never leaves your device. This tool does NOT translate text; it overlays translations you provide. Standard PDF fonts (Helvetica, Times-Roman, Courier) support Latin + Cyrillic + Greek; for full Unicode (e.g. CJK, Arabic), embed a custom font.
      </p>

      {entries.length === 0 && !file && (
        <EmptyState
          title="Load a PDF and add translations"
          hint="Each line is `page|x|y|translated_text|font_size`. The overlay is drawn at the specified position relative to the original (above / below / beside / replace)."
          icon={<Languages className="h-8 w-8" />}
        />
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// PDF stamping — pdf-lib
// ---------------------------------------------------------------------------

async function stampOverlays(
  bytes: Uint8Array,
  entries: TranslationEntry[],
  eligiblePages: Set<number>,
  options: OverlayOptions,
): Promise<{ ok: true; output: Uint8Array } | { ok: false; error: string }> {
  let doc: PDFDocument;
  try {
    doc = await PDFDocument.load(bytes);
  } catch {
    return { ok: false, error: "Could not read the PDF — it may be corrupted or password-protected." };
  }
  const pages = doc.getPages();
  const totalPages = pages.length;

  // Choose pdf-lib StandardFonts constant for the requested family.
  const fontKey = normalizeFontFamily(options.fontFamily);
  const font = await doc.embedFont(
    fontKey === "Times-Roman"
      ? StandardFonts.TimesRoman
      : fontKey === "Courier"
        ? StandardFonts.Courier
        : StandardFonts.Helvetica,
  );

  const textColor = parseHexColor(options.textColor) ?? { r: 1, g: 0, b: 0 };
  const textRgb = rgb(textColor.r, textColor.g, textColor.b);
  const bgParsed = options.backgroundColor.trim() ? parseHexColor(options.backgroundColor) : null;
  const bgRgb = bgParsed ? rgb(bgParsed.r, bgParsed.g, bgParsed.b) : null;

  try {
    for (const entry of entries) {
      if (!eligiblePages.has(entry.pageIndex)) continue;
      if (entry.pageIndex < 0 || entry.pageIndex >= totalPages) continue;
      const page = pages[entry.pageIndex];
      const fs = entry.fontSize > 0 ? validateFontSize(entry.fontSize).value : options.fontSize;
      const { x: ox, y: oy } = calculateOverlayPosition(
        options.position,
        entry.x,
        entry.y,
        fs,
        fs,
      );

      // RTL handling: reverse text + shift x left for right-alignment.
      const handled = applyRtlHandling(entry.text, ox, fs, options.fontFamily);
      const drawText = handled.text;
      const drawX = handled.x;

      // Optional background highlight
      if (bgRgb) {
        const rect = computeBackgroundRect(ox, oy, entry.text, fs, options.fontFamily);
        if (rect) {
          // For RTL, shift the background to cover the reversed text.
          const bgX = handled.direction === "rtl" ? drawX : rect.x;
          page.drawRectangle({
            x: bgX,
            y: rect.y,
            width: rect.width,
            height: rect.height,
            color: bgRgb,
          });
        }
      }

      // Draw the translated text. Use `maxWidth` so over-long text wraps.
      page.drawText(drawText, {
        x: drawX,
        y: oy,
        size: fs,
        font,
        color: textRgb,
        maxWidth: 800,
        lineHeight: fs * 1.2,
      });
    }
    const out = await doc.save();
    return { ok: true, output: out };
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    return { ok: false, error: `Overlay failed: ${msg}. The PDF may use features pdf-lib can't re-save, or the text contains glyphs not in the standard font.` };
  }
}

function Stat({
  label,
  value,
}: {
  label: string;
  value: string | number;
}) {
  return (
    <div className="rounded border bg-background px-3 py-2">
      <div className="text-[10px] uppercase tracking-wide text-muted-foreground">{label}</div>
      <div className="text-base font-semibold text-foreground">{value}</div>
    </div>
  );
}
