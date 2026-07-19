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
  QrCode,
  Download,
  FileUp,
  Trash2,
  History,
} from "lucide-react";
import {
  QR_POSITIONS,
  POSITION_LABELS,
  ERROR_CORRECTION_LEVELS,
  ECL_DETAILS,
  MIN_QR_SIZE,
  MAX_QR_SIZE,
  DEFAULT_QR_SIZE,
  DEFAULT_MARGIN,
  DEFAULT_LABEL_SIZE,
  DEFAULT_ECL,
  parseQrData,
  validateQrEntries,
  calculateQrPosition,
  calculateLabelPosition,
  validateQrSize,
  validateMargin,
  calculateEffectiveMargin,
  parseHexColor,
  calculateQrVersion,
  getQrCapacity,
  checkDataCapacity,
  generateQrMatrix,
  matrixToRectangles,
  formatLabelText,
  computeStats,
  renderTextReport,
  renderCsv,
  loadHistory,
  saveHistory,
  clearHistory,
  buildShareUrl,
  parseShareUrl,
  isStrictUrl,
  type QrPosition,
  type ErrorCorrectionLevel,
  type QrEntry,
  type HistoryEntry,
} from "./logic";

export default function PdfQrCodeStamper() {
  const inputRef = useRef<HTMLInputElement>(null);
  const [file, setFile] = useState<{ name: string; bytes: Uint8Array; pageCount: number } | null>(null);
  const [qrData, setQrData] = useState("1|https://example.com");
  const [position, setPosition] = useState<QrPosition>("top-right");
  const [sizeInput, setSizeInput] = useState(String(DEFAULT_QR_SIZE));
  const [ecl, setEcl] = useState<ErrorCorrectionLevel>(DEFAULT_ECL);
  const [color, setColor] = useState("#000000");
  const [bgColor, setBgColor] = useState("#FFFFFF");
  const [includeLabel, setIncludeLabel] = useState(false);
  const [labelSizeInput, setLabelSizeInput] = useState(String(DEFAULT_LABEL_SIZE));
  const [marginInput, setMarginInput] = useState(String(DEFAULT_MARGIN));
  const [result, setResult] = useState<Uint8Array | null>(null);
  const [error, setError] = useState("");
  const [working, setWorking] = useState(false);
  const [history, setHistory] = useState<HistoryEntry[]>([]);

  useEffect(() => {
    setHistory(loadHistory());
    if (typeof window !== "undefined" && window.location.hash) {
      const p = parseShareUrl(window.location.hash);
      if (p.qrData) setQrData(p.qrData);
      setPosition(p.position);
      setSizeInput(String(p.size));
      setEcl(p.ecl);
      setColor(p.color);
      setBgColor(p.bgColor);
      setIncludeLabel(p.includeLabel);
      setMarginInput(String(p.margin));
      if (p.qrData) toast.info("Loaded from share link");
    }
  }, []);

  const pageSize = validateQrSize(Number(sizeInput)).value;
  const labelSize = Math.max(4, Number(labelSizeInput) || DEFAULT_LABEL_SIZE);
  const margin = validateMargin(Number(marginInput)).value;

  const entries: QrEntry[] = useMemo(
    () => parseQrData(qrData, file?.pageCount ?? 0),
    [qrData, file?.pageCount],
  );
  const stats = useMemo(() => computeStats(entries), [entries]);
  const validationError = useMemo(
    () => validateQrEntries(entries, file?.pageCount ?? 0),
    [entries, file?.pageCount],
  );

  // Capacity warning per entry
  const capacityWarnings = useMemo(() => {
    const out: { idx: number; msg: string }[] = [];
    entries.forEach((e, i) => {
      const bytes = new TextEncoder().encode(e.data).length;
      const version = calculateQrVersion(bytes, ecl);
      const cap = checkDataCapacity(bytes, version, ecl);
      if (!cap.fits) {
        out.push({
          idx: i,
          msg: `Entry ${i + 1}: ${bytes} bytes exceed v${version} (${ecl}) capacity (${cap.capacity}).`,
        });
      }
    });
    return out;
  }, [entries, ecl]);

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

  async function run() {
    if (!file) return;
    if (validationError) {
      setError(validationError);
      return;
    }
    setWorking(true);
    setError("");
    setResult(null);
    try {
      const out = await stampQrCodes(file.bytes, entries, {
        position,
        size: pageSize,
        ecl,
        color,
        bgColor,
        includeLabel,
        labelSize,
        margin,
      });
      setWorking(false);
      if (out.ok) {
        setResult(out.output);
        saveHistory({ ts: Date.now(), entries, stats });
        setHistory(loadHistory());
        toast.success(`Stamped ${stats.totalStamps} QR code${stats.totalStamps === 1 ? "" : "s"}!`);
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
    () => buildShareUrl(qrData, position, pageSize, ecl, color, bgColor, includeLabel, margin),
    [qrData, position, pageSize, ecl, color, bgColor, includeLabel, margin],
  );

  function handleClear() {
    setQrData("");
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
          <p className="mt-1 text-xs text-muted-foreground">Stamp QR codes onto specific pages.</p>
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
            <Label htmlFor="qr-data">QR data — one entry per line</Label>
            <Textarea
              id="qr-data"
              value={qrData}
              onChange={(e) => setQrData(e.target.value)}
              placeholder={"1|https://example.com/intro\n2|DOC-2024-0001\nall|https://example.com"}
              className="min-h-[120px] resize-y font-mono text-xs"
            />
            <p className="text-[11px] text-muted-foreground">
              Format: <code>page,data</code> or <code>page|data</code>. Page can be a number, <code>all</code>, or a range like <code>2-4</code>. Lines starting with <code>#</code> are skipped.
            </p>
          </div>

          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            <div className="space-y-1.5">
              <Label htmlFor="qr-position">Position</Label>
              <select
                id="qr-position"
                value={position}
                onChange={(e) => setPosition(e.target.value as QrPosition)}
                className="flex h-9 w-full rounded-md border border-input bg-background px-3 text-sm cursor-pointer"
              >
                {QR_POSITIONS.map((p) => (
                  <option key={p} value={p}>{POSITION_LABELS[p]}</option>
                ))}
              </select>
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="qr-size">QR size (px, {MIN_QR_SIZE}–{MAX_QR_SIZE})</Label>
              <Input
                id="qr-size"
                type="number"
                min={MIN_QR_SIZE}
                max={MAX_QR_SIZE}
                value={sizeInput}
                onChange={(e) => setSizeInput(e.target.value)}
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="qr-ecl">Error correction</Label>
              <select
                id="qr-ecl"
                value={ecl}
                onChange={(e) => setEcl(e.target.value as ErrorCorrectionLevel)}
                className="flex h-9 w-full rounded-md border border-input bg-background px-3 text-sm cursor-pointer"
              >
                {ERROR_CORRECTION_LEVELS.map((l) => (
                  <option key={l} value={l}>{ECL_DETAILS[l].label}</option>
                ))}
              </select>
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="qr-color">QR color</Label>
              <input
                id="qr-color"
                type="color"
                value={color}
                onChange={(e) => setColor(e.target.value)}
                className="h-9 w-full cursor-pointer rounded-md border border-input bg-background p-1"
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="qr-bg">Background (blank = transparent)</Label>
              <Input
                id="qr-bg"
                value={bgColor}
                onChange={(e) => setBgColor(e.target.value)}
                placeholder="#FFFFFF or empty"
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="qr-margin">Margin from edge (pt)</Label>
              <Input
                id="qr-margin"
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
                checked={includeLabel}
                onChange={(e) => setIncludeLabel(e.target.checked)}
                className="h-4 w-4 rounded border-border"
              />
              <span>Include text label below QR</span>
            </label>
            {includeLabel && (
              <div className="space-y-1.5">
                <Label htmlFor="qr-label-size" className="text-xs">Label size (pt)</Label>
                <Input
                  id="qr-label-size"
                  type="number"
                  min={4}
                  max={72}
                  value={labelSizeInput}
                  onChange={(e) => setLabelSizeInput(e.target.value)}
                  className="w-20"
                />
              </div>
            )}
          </div>
        </CardContent>
      </Card>

      {entries.length > 0 && (
        <Card>
          <CardContent className="p-4 space-y-2">
            <h3 className="text-sm font-semibold flex items-center gap-1.5">
              <QrCode className="h-4 w-4" /> {stats.totalEntries} entr{stats.totalEntries === 1 ? "y" : "ies"} → {stats.totalStamps} stamp{stats.totalStamps === 1 ? "" : "s"}
            </h3>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-xs">
              <Stat label="Total stamps" value={stats.totalStamps} />
              <Stat label="URLs" value={stats.urlCount} />
              <Stat label="Text" value={stats.textCount} />
              <Stat label="Bytes encoded" value={stats.totalBytes} />
            </div>
            {capacityWarnings.length > 0 && (
              <div className="rounded border border-amber-400/40 bg-amber-50 dark:bg-amber-950/30 p-2 text-xs text-amber-700 dark:text-amber-300">
                <p className="font-medium mb-1">Capacity warnings:</p>
                <ul className="list-disc pl-5 space-y-0.5">
                  {capacityWarnings.map((w) => (
                    <li key={w.idx}>{w.msg}</li>
                  ))}
                </ul>
              </div>
            )}
            <div className="space-y-1 max-h-[260px] overflow-auto">
              {entries.map((e, i) => {
                const bytes = new TextEncoder().encode(e.data).length;
                const version = calculateQrVersion(bytes, ecl);
                const cap = getQrCapacity(version, ecl);
                const urlOk = e.kind === "url" ? isStrictUrl(e.data) : null;
                return (
                  <div key={i} className="flex items-center gap-2 rounded border bg-background px-3 py-1.5 text-xs">
                    <Badge variant="outline" className="text-[10px]">{e.pageToken}</Badge>
                    <Badge variant="secondary" className="text-[10px]">{e.kind.toUpperCase()}</Badge>
                    <Badge variant="outline" className="text-[10px]">v{version} {ecl} ({bytes}/{cap}B)</Badge>
                    {urlOk === false && (
                      <Badge variant="outline" className="text-[10px] text-amber-700 dark:text-amber-300">URL?</Badge>
                    )}
                    <span className="font-mono text-foreground truncate flex-1">{e.data}</span>
                  </div>
                );
              })}
            </div>
          </CardContent>
        </Card>
      )}

      <ActionBar>
        <RunButton
          onClick={() => void run()}
          disabled={!file || !!validationError || entries.length === 0}
          loading={working}
          label="Stamp QR codes"
        />
        <ClearButton onClick={handleClear} disabled={!qrData && !result && !error} label="Clear" />
        <CopyButton getText={() => textReport} label="Copy report" disabled={entries.length === 0} />
        <DownloadButton
          getText={() => csvReport}
          filename="qr-stamp-report.csv"
          mime="text/csv"
          label="Download CSV"
          disabled={entries.length === 0}
        />
        <ShareButton getUrl={() => shareUrl} disabled={!qrData} />
      </ActionBar>

      {error && <ErrorBanner message={error} />}

      {result && (
        <div className="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-primary/30 bg-primary/5 p-4">
          <div>
            <p className="text-sm font-medium">QR-stamped PDF ready</p>
            <p className="text-xs text-muted-foreground">
              {stats.totalStamps} stamp{stats.totalStamps === 1 ? "" : "s"} • {formatBytes(result.length)}
            </p>
          </div>
          <Button
            onClick={() => downloadBytes(result, `qr-stamped-${file?.name ?? "output.pdf"}`)}
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
        Privacy: QR generation, PDF loading, and stamping all run 100% locally in your browser — your PDF never leaves your device. The QR matrix uses a simplified encoder with real finder + timing patterns; for production scanning, replace with a spec-compliant QR library.
      </p>

      {entries.length === 0 && !file && (
        <EmptyState
          title="Load a PDF and add QR data"
          hint="Each line is `page,data` (or `page|data`). Use `all` to stamp every page, or a range like `2-4`. Supports URLs, document IDs, or any text."
          icon={<QrCode className="h-8 w-8" />}
        />
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// PDF stamping — pdf-lib
// ---------------------------------------------------------------------------

interface StampOptions {
  position: QrPosition;
  size: number;
  ecl: ErrorCorrectionLevel;
  color: string;
  bgColor: string;
  includeLabel: boolean;
  labelSize: number;
  margin: number;
}

async function stampQrCodes(
  bytes: Uint8Array,
  entries: QrEntry[],
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

  // Pre-encode each unique data → matrix
  const matrixCache = new Map<string, ReturnType<typeof generateQrMatrix>>();
  for (const e of entries) {
    if (!matrixCache.has(e.data)) {
      matrixCache.set(e.data, generateQrMatrix(e.data, opts.ecl));
    }
  }

  const font = await doc.embedFont(StandardFonts.Helvetica);
  const fgColor = parseHexColor(opts.color) ?? { r: 0, g: 0, b: 0 };
  const fg = rgb(fgColor.r, fgColor.g, fgColor.b);
  const bgParsed = opts.bgColor.trim() ? parseHexColor(opts.bgColor) : null;
  const bg = bgParsed ? rgb(bgParsed.r, bgParsed.g, bgParsed.b) : null;

  try {
    for (const e of entries) {
      const matrixResult = matrixCache.get(e.data)!;
      const { matrix, size: matrixSize } = matrixResult;
      const moduleSize = opts.size / matrixSize;

      for (const pageIdx of e.pageIndices) {
        if (pageIdx < 0 || pageIdx >= totalPages) continue;
        const page = pages[pageIdx];
        const { width: pw, height: ph } = page.getSize();
        const effMargin = calculateEffectiveMargin(opts.margin, opts.size, pw, ph);
        const { x: qrX, y: qrY } = calculateQrPosition(opts.position, pw, ph, opts.size, effMargin);

        // Optional background fill
        if (bg) {
          page.drawRectangle({
            x: qrX - moduleSize * 2,
            y: qrY - moduleSize * 2,
            width: opts.size + moduleSize * 4,
            height: opts.size + moduleSize * 4,
            color: bg,
          });
        }

        // Draw QR dark modules
        const rects = matrixToRectangles(matrix, qrX, qrY, moduleSize);
        for (const r of rects) {
          page.drawRectangle({ x: r.x, y: r.y, width: r.width, height: r.height, color: fg });
        }

        // Optional label
        if (opts.includeLabel) {
          const label = formatLabelText(e.data, 32);
          const labelW = font.widthOfTextAtSize(label, opts.labelSize);
          const placement = calculateLabelPosition(qrX, qrY, opts.size, labelW, opts.labelSize, ph);
          page.drawText(label, {
            x: placement.labelX,
            y: placement.labelY,
            size: opts.labelSize,
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
