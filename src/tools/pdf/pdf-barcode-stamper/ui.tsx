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
  CopyButton,
  DownloadButton,
  EmptyState,
  ShareButton,
  ClearButton,
  ActionBar,
  ErrorBanner,
  RunButton,
} from "../../_shared";
import { downloadBytes, formatBytes } from "../_shared/download";
import { toast } from "sonner";
import {
  Barcode,
  Download,
  FileUp,
  Trash2,
  History,
} from "lucide-react";
import {
  BARCODE_TYPES,
  BARCODE_TYPE_LABELS,
  BARCODE_POSITIONS,
  POSITION_LABELS,
  MIN_BAR_WIDTH,
  MAX_BAR_WIDTH,
  DEFAULT_BAR_WIDTH,
  MIN_BAR_HEIGHT,
  MAX_BAR_HEIGHT,
  DEFAULT_BAR_HEIGHT,
  DEFAULT_MARGIN,
  DEFAULT_TEXT_SIZE,
  parseBarcodeData,
  computeStats,
  renderTextReport,
  renderCsv,
  loadHistory,
  saveHistory,
  clearHistory,
  buildShareUrl,
  parseShareUrl,
  suggestBarcodeType,
  validateBarcode,
  calculateBarcodeWidth,
  calculateBarcodePosition,
  calculateTextPosition,
  barsToRectangles,
  parseHexColor,
  type BarcodeType,
  type BarcodePosition,
  type BarcodeEntry,
  type HistoryEntry,
  type Bar,
} from "./logic";

export default function PdfBarcodeStamper() {
  const inputRef = useRef<HTMLInputElement>(null);
  const [file, setFile] = useState<{ name: string; bytes: Uint8Array; pageCount: number } | null>(null);
  const [barcodeData, setBarcodeData] = useState(
    "1|CODE128|HELLO\n2|EAN13|123456789012\nall|CODE39|ABC-123",
  );
  const [position, setPosition] = useState<BarcodePosition>("bottom-center");
  const [widthInput, setWidthInput] = useState(String(DEFAULT_BAR_WIDTH));
  const [heightInput, setHeightInput] = useState(String(DEFAULT_BAR_HEIGHT));
  const [includeText, setIncludeText] = useState(true);
  const [textSizeInput, setTextSizeInput] = useState(String(DEFAULT_TEXT_SIZE));
  const [color, setColor] = useState("#000000");
  const [bgColor, setBgColor] = useState("#FFFFFF");
  const [marginInput, setMarginInput] = useState(String(DEFAULT_MARGIN));
  const [result, setResult] = useState<Uint8Array | null>(null);
  const [error, setError] = useState("");
  const [working, setWorking] = useState(false);
  const [history, setHistory] = useState<HistoryEntry[]>([]);
  const [suggestText, setSuggestText] = useState("");

  useEffect(() => {
    setHistory(loadHistory());
    if (typeof window !== "undefined" && window.location.hash) {
      const p = parseShareUrl(window.location.hash);
      if (p.data) setBarcodeData(p.data);
      setPosition(p.position);
      setWidthInput(String(p.width));
      setHeightInput(String(p.height));
      setIncludeText(p.includeText);
      setColor(p.color);
      setBgColor(p.bgColor);
      setMarginInput(String(p.margin));
      if (p.data) toast.info("Loaded from share link");
    }
  }, []);

  const barWidth = clampNum(Number(widthInput), MIN_BAR_WIDTH, MAX_BAR_WIDTH, DEFAULT_BAR_WIDTH);
  const barHeight = clampNum(Number(heightInput), MIN_BAR_HEIGHT, MAX_BAR_HEIGHT, DEFAULT_BAR_HEIGHT);
  const textSize = clampNum(Number(textSizeInput), 4, 72, DEFAULT_TEXT_SIZE);
  const margin = clampNum(Number(marginInput), 0, 200, DEFAULT_MARGIN);

  const entries: BarcodeEntry[] = useMemo(
    () => parseBarcodeData(barcodeData, file?.pageCount ?? 0),
    [barcodeData, file?.pageCount],
  );
  const stats = useMemo(() => computeStats(entries), [entries]);

  const suggestedType = useMemo(() => suggestBarcodeType(suggestText), [suggestText]);

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

  const invalidEntries = entries.filter((e) => !e.valid);

  async function run() {
    if (!file) return;
    if (entries.length === 0) {
      setError("Enter at least one barcode entry.");
      return;
    }
    if (invalidEntries.length > 0) {
      setError(`Fix ${invalidEntries.length} invalid entr${invalidEntries.length === 1 ? "y" : "ies"} before stamping.`);
      return;
    }
    setWorking(true);
    setError("");
    setResult(null);
    try {
      const out = await stampBarcodes(file.bytes, entries, {
        position,
        width: barWidth,
        height: barHeight,
        includeText,
        textSize,
        color,
        bgColor,
        margin,
      });
      setWorking(false);
      if (out.ok) {
        setResult(out.output);
        saveHistory({ ts: Date.now(), entries, stats });
        setHistory(loadHistory());
        toast.success(`Stamped ${stats.totalStamps} barcode${stats.totalStamps === 1 ? "" : "s"}!`);
      } else {
        setError(out.error);
      }
    } catch (e) {
      setWorking(false);
      const msg = e instanceof Error ? e.message : String(e);
      setError(`Stamping failed: ${msg}`);
    }
  }

  const textReport = useMemo(() => renderTextReport(entries, stats), [entries, stats]);
  const csvReport = useMemo(() => renderCsv(entries), [entries]);
  const shareUrl = useMemo(
    () => buildShareUrl(barcodeData, position, barWidth, barHeight, includeText, color, bgColor, margin),
    [barcodeData, position, barWidth, barHeight, includeText, color, bgColor, margin],
  );

  function handleClear() {
    setBarcodeData("");
    setResult(null);
    setError("");
  }

  function handleClearHistory() {
    clearHistory();
    setHistory([]);
    toast.success("History cleared");
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
          <p className="mt-1 text-xs text-muted-foreground">Stamp barcodes onto specific pages.</p>
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
            <Label htmlFor="bc-data">Barcode data — one entry per line</Label>
            <Textarea
              id="bc-data"
              value={barcodeData}
              onChange={(e) => setBarcodeData(e.target.value)}
              placeholder={"1|CODE128|HELLO\n2|EAN13|123456789012\nall|CODE39|ABC-123"}
              className="min-h-[120px] resize-y font-mono text-xs"
            />
            <p className="text-[11px] text-muted-foreground">
              Format: <code>page,TYPE,data</code> or <code>page|TYPE|data</code>. TYPE ∈ CODE128 / EAN13 / UPC / CODE39 / ITF. Page can be a number, <code>all</code>, or a range like <code>2-4</code>.
            </p>
          </div>

          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            <div className="space-y-1.5">
              <Label htmlFor="bc-position">Position</Label>
              <select
                id="bc-position"
                value={position}
                onChange={(e) => setPosition(e.target.value as BarcodePosition)}
                className="flex h-9 w-full rounded-md border border-input bg-background px-3 text-sm cursor-pointer"
              >
                {BARCODE_POSITIONS.map((p) => (
                  <option key={p} value={p}>{POSITION_LABELS[p]}</option>
                ))}
              </select>
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="bc-width">Width (px, {MIN_BAR_WIDTH}–{MAX_BAR_WIDTH})</Label>
              <Input
                id="bc-width"
                type="number"
                min={MIN_BAR_WIDTH}
                max={MAX_BAR_WIDTH}
                value={widthInput}
                onChange={(e) => setWidthInput(e.target.value)}
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="bc-height">Height (px, {MIN_BAR_HEIGHT}–{MAX_BAR_HEIGHT})</Label>
              <Input
                id="bc-height"
                type="number"
                min={MIN_BAR_HEIGHT}
                max={MAX_BAR_HEIGHT}
                value={heightInput}
                onChange={(e) => setHeightInput(e.target.value)}
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="bc-color">Bar / text color</Label>
              <input
                id="bc-color"
                type="color"
                value={color}
                onChange={(e) => setColor(e.target.value)}
                className="h-9 w-full cursor-pointer rounded-md border border-input bg-background p-1"
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="bc-bg">Background (blank = transparent)</Label>
              <Input
                id="bc-bg"
                value={bgColor}
                onChange={(e) => setBgColor(e.target.value)}
                placeholder="#FFFFFF or empty"
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="bc-margin">Margin from edge (pt)</Label>
              <Input
                id="bc-margin"
                type="number"
                min={0}
                value={marginInput}
                onChange={(e) => setMarginInput(e.target.value)}
              />
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-4">
            <label className="flex items-center gap-2 text-sm cursor-pointer select-none">
              <input
                type="checkbox"
                checked={includeText}
                onChange={(e) => setIncludeText(e.target.checked)}
                className="h-4 w-4 rounded border-border"
              />
              <span>Show data text below barcode</span>
            </label>
            {includeText && (
              <div className="space-y-1.5">
                <Label htmlFor="bc-text-size" className="text-xs">Text size (pt)</Label>
                <Input
                  id="bc-text-size"
                  type="number"
                  min={4}
                  max={72}
                  value={textSizeInput}
                  onChange={(e) => setTextSizeInput(e.target.value)}
                  className="w-20"
                />
              </div>
            )}
          </div>

          <div className="rounded-lg border bg-muted/30 p-3 space-y-2">
            <Label htmlFor="bc-suggest" className="text-xs">Type suggester</Label>
            <div className="flex gap-2">
              <Input
                id="bc-suggest"
                value={suggestText}
                onChange={(e) => setSuggestText(e.target.value)}
                placeholder="Paste data to detect best type"
                className="flex-1"
              />
              <Button
                variant="outline"
                size="sm"
                onClick={() => {
                  if (!suggestText) {
                    toast.info("Enter some data first");
                    return;
                  }
                  const line = `1|${suggestedType}|${suggestText}`;
                  setBarcodeData((prev) => (prev.trim() ? `${prev.trim()}\n${line}` : line));
                  setSuggestText("");
                  toast.success(`Added ${suggestedType} entry`);
                }}
              >
                Add as {suggestedType}
              </Button>
            </div>
            <p className="text-[11px] text-muted-foreground">
              Suggests CODE128 (any ASCII), EAN-13 (13 digits), UPC-A (12 digits), ITF (even digits ≥ 4), or Code39 (charset match).
            </p>
          </div>
        </CardContent>
      </Card>

      {entries.length > 0 && (
        <Card>
          <CardContent className="p-4 space-y-2">
            <h3 className="text-sm font-semibold flex items-center gap-1.5">
              <Barcode className="h-4 w-4" /> {stats.totalEntries} entr{stats.totalEntries === 1 ? "y" : "ies"} → {stats.totalStamps} stamp{stats.totalStamps === 1 ? "" : "s"}
            </h3>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-xs">
              <Stat label="Total stamps" value={stats.totalStamps} />
              <Stat label="Valid" value={stats.validCount} highlight={stats.invalidCount === 0 ? "good" : undefined} />
              <Stat label="Invalid" value={stats.invalidCount} highlight={stats.invalidCount > 0 ? "bad" : undefined} />
              <Stat label="Types used" value={BARCODE_TYPES.filter((t) => stats.byType[t] > 0).length} />
            </div>
            {invalidEntries.length > 0 && (
              <div className="rounded border border-destructive/40 bg-destructive/10 p-2 text-xs text-destructive">
                <p className="font-medium mb-1">Invalid entries:</p>
                <ul className="list-disc pl-5 space-y-0.5">
                  {invalidEntries.map((e, i) => (
                    <li key={i}>[{e.type}] {e.data}: {e.error}</li>
                  ))}
                </ul>
              </div>
            )}
            <div className="space-y-1 max-h-[260px] overflow-auto">
              {entries.map((e, i) => (
                <div key={i} className="flex items-center gap-2 rounded border bg-background px-3 py-1.5 text-xs">
                  <Badge variant="outline" className="text-[10px]">{e.pageToken}</Badge>
                  <Badge variant="secondary" className="text-[10px]">{e.type}</Badge>
                  <Badge
                    variant="outline"
                    className={`text-[10px] ${e.valid ? "text-emerald-700 dark:text-emerald-300" : "text-red-700 dark:text-red-300"}`}
                  >
                    {e.valid ? "OK" : "INVALID"}
                  </Badge>
                  <span className="font-mono text-foreground truncate flex-1">{e.data}</span>
                  {e.encodedData !== e.data && e.valid && (
                    <span className="font-mono text-[10px] text-muted-foreground">→ {e.encodedData}</span>
                  )}
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      <ActionBar>
        <RunButton
          onClick={() => void run()}
          disabled={!file || entries.length === 0 || invalidEntries.length > 0}
          loading={working}
          label="Stamp barcodes"
        />
        <ClearButton onClick={handleClear} disabled={!barcodeData && !result && !error} label="Clear" />
        <CopyButton getText={() => textReport} label="Copy report" disabled={entries.length === 0} />
        <DownloadButton
          getText={() => csvReport}
          filename="barcode-stamp-report.csv"
          mime="text/csv"
          label="Download CSV"
          disabled={entries.length === 0}
        />
        <ShareButton getUrl={() => shareUrl} disabled={!barcodeData} />
      </ActionBar>

      {error && <ErrorBanner message={error} />}

      {result && (
        <div className="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-primary/30 bg-primary/5 p-4">
          <div>
            <p className="text-sm font-medium">Barcode-stamped PDF ready</p>
            <p className="text-xs text-muted-foreground">
              {stats.totalStamps} stamp{stats.totalStamps === 1 ? "" : "s"} • {formatBytes(result.length)}
            </p>
          </div>
          <Button
            onClick={() => downloadBytes(result, `barcode-stamped-${file?.name ?? "output.pdf"}`)}
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
                  <Badge variant="outline" className="mr-2">{h.stats.totalStamps} stamps</Badge>
                  <Badge variant="outline" className="mr-2">{h.stats.totalEntries} entries</Badge>
                  <span className="text-muted-foreground ml-2">· {new Date(h.ts).toLocaleString()}</span>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      <p className="text-xs text-muted-foreground">
        Privacy: barcode encoding, PDF loading, and stamping all run 100% locally in your browser via pdf-lib. The CODE39/EAN-13/UPC-A/ITF encoders produce spec-compliant bar/space patterns; CODE128 uses Code Set B for printable ASCII. Test with your target reader before relying on the output for production.
      </p>

      {entries.length === 0 && !file && (
        <EmptyState
          title="Load a PDF and add barcode data"
          hint="Each line is `page,TYPE,data` (or `page|TYPE|data`). Use the type suggester to detect the best type for your data."
          icon={<Barcode className="h-8 w-8" />}
        />
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// PDF stamping — pdf-lib
// ---------------------------------------------------------------------------

interface StampOptions {
  position: BarcodePosition;
  width: number;
  height: number;
  includeText: boolean;
  textSize: number;
  color: string;
  bgColor: string;
  margin: number;
}

async function stampBarcodes(
  bytes: Uint8Array,
  entries: BarcodeEntry[],
  opts: StampOptions,
): Promise<{ ok: true; output: Uint8Array } | { ok: false; error: string }> {
  let doc: PDFDocument;
  try {
    doc = await PDFDocument.load(bytes);
  } catch {
    return { ok: false, error: "Could not read the PDF — it may be corrupted or password-protected." };
  }
  const pages = doc.getPages();
  const totalPages = pages.length;
  const font = await doc.embedFont(StandardFonts.Helvetica);

  const fgColor = parseHexColor(opts.color) ?? { r: 0, g: 0, b: 0 };
  const fg = rgb(fgColor.r, fgColor.g, fgColor.b);
  const bgParsed = opts.bgColor.trim() ? parseHexColor(opts.bgColor) : null;
  const bg = bgParsed ? rgb(bgParsed.r, bgParsed.g, bgParsed.b) : null;

  try {
    for (const e of entries) {
      if (!e.valid || e.pattern.length === 0) continue;
      // Compute module width so the full barcode fits in `opts.width`.
      const totalModules = e.pattern.reduce((sum, b) => sum + b.width, 0);
      const moduleSize = totalModules > 0 ? opts.width / totalModules : 1;
      const actualWidth = calculateBarcodeWidth(e.pattern, moduleSize);

      for (const pageIdx of e.pageIndices) {
        if (pageIdx < 0 || pageIdx >= totalPages) continue;
        const page = pages[pageIdx];
        const { width: pw, height: ph } = page.getSize();
        const effMargin = Math.max(0, Math.min(opts.margin, (pw - actualWidth) / 2));
        const { x: barX, y: barY } = calculateBarcodePosition(
          opts.position, pw, ph, actualWidth, opts.height, effMargin,
        );

        // Optional background fill (includes quiet zone padding)
        if (bg) {
          page.drawRectangle({
            x: barX - moduleSize * 4,
            y: barY - moduleSize * 4,
            width: actualWidth + moduleSize * 8,
            height: opts.height + moduleSize * 8,
            color: bg,
          });
        }

        // Draw bar rectangles
        const rects = barsToRectangles(e.pattern, barX, barY, moduleSize, opts.height);
        for (const r of rects) {
          page.drawRectangle({ x: r.x, y: r.y, width: r.width, height: r.height, color: fg });
        }

        // Optional text label below
        if (opts.includeText) {
          const label = e.encodedData;
          const labelW = font.widthOfTextAtSize(label, opts.textSize);
          const placement = calculateTextPosition(
            barX, barY, actualWidth, opts.height, labelW, opts.textSize, ph,
          );
          page.drawText(label, {
            x: placement.labelX,
            y: placement.labelY,
            size: opts.textSize,
            font,
            color: fg,
          });
        }
      }
    }
    const out = await doc.save();
    return { ok: true, output: out };
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    return { ok: false, error: `Stamping failed: ${msg}. The PDF may use features pdf-lib can't re-save.` };
  }
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function clampNum(v: number, lo: number, hi: number, fallback: number): number {
  if (!Number.isFinite(v)) return fallback;
  return Math.max(lo, Math.min(hi, v));
}

function Stat({
  label,
  value,
  highlight,
}: {
  label: string;
  value: string | number;
  highlight?: "bad" | "good";
}) {
  const color = highlight === "bad"
    ? "text-red-600 dark:text-red-400"
    : highlight === "good"
      ? "text-emerald-600 dark:text-emerald-400"
      : "text-foreground";
  return (
    <div className="rounded border bg-background px-3 py-2">
      <div className="text-[10px] uppercase tracking-wide text-muted-foreground">{label}</div>
      <div className={`text-base font-semibold ${color}`}>{value}</div>
    </div>
  );
}

// Suppress unused-import lint (Bar imported for type completeness)
export type _Unused = Bar;
