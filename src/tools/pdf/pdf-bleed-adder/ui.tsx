"use client";

import React, { useRef, useState, useEffect } from "react";
import { PDFDocument, rgb } from "pdf-lib";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Download, FileUp, Trash2, History } from "lucide-react";
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
  applyBleedSides,
  BLEED_PRESETS,
  BLEED_SIDES_LIST,
  BLEED_SIDES_LABELS,
  buildShareUrl,
  calculateContentOffset,
  calculateNewSize,
  calculateTrimBox,
  clearHistory as clearBleedHistory,
  computeSummaryStats,
  generateBleedMarks,
  generateCropMarks,
  loadHistory,
  mmToPoints,
  parseBackgroundColor,
  parseShareUrl,
  renderCsvReport,
  renderTextReport,
  saveHistory,
  validatePageExtension,
  verifyPrintReady,
  type BleedPageResult,
  type BleedSides,
  type HistoryEntry,
} from "./logic";

const MARK_COLOR = rgb(0, 0, 0);

export default function PdfBleedAdder() {
  const inputRef = useRef<HTMLInputElement>(null);
  const [file, setFile] = useState<{ name: string; bytes: Uint8Array; pageCount: number } | null>(null);
  const [bleedMm, setBleedMm] = useState("3");
  const [sides, setSides] = useState<BleedSides>("all-sides");
  const [extendBackground, setExtendBackground] = useState(true);
  const [backgroundColor, setBackgroundColor] = useState("#FFFFFF");
  const [includeCropMarks, setIncludeCropMarks] = useState(true);
  const [includeBleedMarks, setIncludeBleedMarks] = useState(false);
  const [result, setResult] = useState<Uint8Array | null>(null);
  const [report, setReport] = useState<BleedPageResult[] | null>(null);
  const [error, setError] = useState("");
  const [working, setWorking] = useState(false);
  const [history, setHistory] = useState<HistoryEntry[]>([]);

  useEffect(() => {
    setHistory(loadHistory());
    if (typeof window !== "undefined" && window.location.hash) {
      const p = parseShareUrl(window.location.hash);
      if (p.bleedMm !== undefined) setBleedMm(String(p.bleedMm));
      if (p.sides) setSides(p.sides);
      if (p.extendBackground !== undefined) setExtendBackground(p.extendBackground);
      if (p.backgroundColor !== undefined) setBackgroundColor(p.backgroundColor);
      if (p.includeCropMarks !== undefined) setIncludeCropMarks(p.includeCropMarks);
      if (p.includeBleedMarks !== undefined) setIncludeBleedMarks(p.includeBleedMarks);
      if (Object.keys(p).length > 0) toast.info("Loaded settings from share link");
    }
  }, []);

  async function loadFile(f: File) {
    try {
      const bytes = new Uint8Array(await f.arrayBuffer());
      const doc = await PDFDocument.load(bytes);
      setFile({ name: f.name, bytes, pageCount: doc.getPageCount() });
      setResult(null);
      setReport(null);
      setError("");
    } catch {
      toast.error(`Could not read ${f.name} — it may be corrupted or password-protected.`);
    }
  }

  function reset() {
    setFile(null);
    setResult(null);
    setReport(null);
    setError("");
  }

  function resetHistory() {
    clearBleedHistory();
    setHistory([]);
    toast.success("History cleared");
  }

  async function run() {
    if (!file) return;
    const bleedMmNum = Number(bleedMm);
    if (!Number.isFinite(bleedMmNum) || bleedMmNum < 0) {
      setError("Bleed size must be a non-negative number.");
      return;
    }
    const bleedPt = mmToPoints(bleedMmNum);
    const bleed = applyBleedSides(bleedPt, sides);

    setWorking(true);
    setError("");
    setResult(null);
    setReport(null);

    try {
      const src = await PDFDocument.load(file.bytes);
      const out = await PDFDocument.create();
      const srcPages = src.getPages();
      const pageResults: BleedPageResult[] = [];

      // Optional: pre-parse the background color once
      let bgRgb: { r: number; g: number; b: number } | null = null;
      if (extendBackground && backgroundColor.trim()) {
        const parsed = parseBackgroundColor(backgroundColor);
        if (parsed.ok) bgRgb = parsed.output;
      }

      for (let i = 0; i < srcPages.length; i++) {
        const srcPage = srcPages[i];
        const { width: origW, height: origH } = srcPage.getSize();

        const v = validatePageExtension({ width: origW, height: origH }, bleed);
        if (!v.ok) {
          setError(v.error);
          setWorking(false);
          return;
        }

        const newSize = calculateNewSize({ width: origW, height: origH }, bleed);
        const offset = calculateContentOffset(bleed);

        const outPage = out.addPage([newSize.width, newSize.height]);

        // 1) Optionally fill the bleed area with the chosen background color
        if (extendBackground && bgRgb) {
          outPage.drawRectangle({
            x: 0,
            y: 0,
            width: newSize.width,
            height: newSize.height,
            color: rgb(bgRgb.r, bgRgb.g, bgRgb.b),
          });
        }

        // 2) Embed the original page and draw it at the correct offset.
        //    Some pages (e.g. fully-blank pages without a content stream)
        //    can't be embedded — pdf-lib throws MissingPageContentsEmbeddingError.
        //    We catch and skip the content for that page, but still produce the
        //    enlarged page with marks so the rest of the document works.
        try {
          const embedded = await out.embedPage(srcPage);
          outPage.drawPage(embedded, {
            x: offset.x,
            y: offset.y,
            width: origW,
            height: origH,
          });
        } catch {
          // blank page — skip embedding, keep the enlarged page + marks
        }

        // 3) Crop marks at the four trim corners
        if (includeCropMarks) {
          const cropLines = generateCropMarks(origW, origH, bleed, 3, 10);
          for (const ln of cropLines) {
            outPage.drawLine({
              start: { x: ln.x1, y: ln.y1 },
              end: { x: ln.x2, y: ln.y2 },
              thickness: 0.5,
              color: MARK_COLOR,
            });
          }
        }

        // 4) Bleed marks at the bleed edge for verification
        if (includeBleedMarks) {
          const bleedLines = generateBleedMarks(newSize, 10);
          for (const ln of bleedLines) {
            outPage.drawLine({
              start: { x: ln.x1, y: ln.y1 },
              end: { x: ln.x2, y: ln.y2 },
              thickness: 0.5,
              color: MARK_COLOR,
            });
          }
        }

        pageResults.push({
          pageNum: i + 1,
          originalWidth: origW,
          originalHeight: origH,
          newWidth: newSize.width,
          newHeight: newSize.height,
          bleedAmountPt: bleedPt,
          sides,
          cropMarksAdded: includeCropMarks,
          bleedMarksAdded: includeBleedMarks,
          backgroundFilled: extendBackground && !!bgRgb,
        });
      }

      out.setProducer("UnQTools — PDF Bleed Adder");
      out.setCreator("UnQTools — PDF Bleed Adder");
      out.setCreationDate(new Date());
      out.setModificationDate(new Date());

      const bytes = await out.save();
      setResult(bytes);
      setReport(pageResults);
      toast.success(`Bleed added to ${pageResults.length} page(s)`);

      // Save to history
      const entry: HistoryEntry = {
        ts: Date.now(),
        fileName: file.name,
        pageCount: srcPages.length,
        bleedMm: bleedMmNum,
        sides,
        cropMarks: includeCropMarks,
        bleedMarks: includeBleedMarks,
        extendBackground,
      };
      saveHistory(entry);
      setHistory(loadHistory());
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      setError(`Could not add bleed: ${msg}. The PDF may use features pdf-lib can't re-save — try the Flatten PDF tool first.`);
    } finally {
      setWorking(false);
    }
  }

  const stats = report ? computeSummaryStats(report) : null;
  const printReady = report && report.length > 0
    ? verifyPrintReady(applyBleedSides(mmToPoints(Number(bleedMm)), sides), "iso-3mm")
    : null;
  const trimBox = report && report.length > 0
    ? calculateTrimBox(
        { width: report[0].newWidth, height: report[0].newHeight },
        applyBleedSides(mmToPoints(Number(bleedMm)), sides),
      )
    : null;

  return (
    <div className="space-y-4">
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
          <p className="mt-1 text-xs text-muted-foreground">
            Enlarges each page by a bleed margin and adds crop + bleed marks for print finishing.
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
        <>
          <div className="space-y-1.5">
            <Label htmlFor="bleed-mm">Bleed size (mm)</Label>
            <Input
              id="bleed-mm"
              type="number"
              min={0}
              step={0.1}
              value={bleedMm}
              onChange={(e) => setBleedMm(e.target.value)}
              className="w-32"
            />
            <div className="flex flex-wrap gap-2 pt-1">
              {BLEED_PRESETS.map((p) => (
                <Button
                  key={p.id}
                  variant="outline"
                  size="sm"
                  onClick={() => {
                    if (p.unit === "mm") setBleedMm(String(p.value));
                    else setBleedMm(String((p.value * 25.4).toFixed(2))); // inch → mm
                  }}
                >
                  {p.label}
                </Button>
              ))}
            </div>
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="bleed-sides">Bleed on which sides</Label>
            <select
              id="bleed-sides"
              value={sides}
              onChange={(e) => setSides(e.target.value as BleedSides)}
              aria-label="Bleed sides"
              className="flex h-9 w-full rounded-md border border-input bg-background px-3 text-sm cursor-pointer"
            >
              {BLEED_SIDES_LIST.map((s) => (
                <option key={s} value={s}>{BLEED_SIDES_LABELS[s]}</option>
              ))}
            </select>
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="bg-color">Background color (hex, optional — used when "Extend background" is on)</Label>
            <Input
              id="bg-color"
              value={backgroundColor}
              onChange={(e) => setBackgroundColor(e.target.value)}
              placeholder="#FFFFFF"
              className="w-40"
            />
          </div>

          <div className="space-y-2">
            <label className="flex items-center gap-2 text-sm cursor-pointer select-none">
              <input
                type="checkbox"
                checked={extendBackground}
                onChange={(e) => setExtendBackground(e.target.checked)}
                className="h-4 w-4 rounded border-border"
              />
              <span>Extend background color into the bleed area</span>
            </label>
            <label className="flex items-center gap-2 text-sm cursor-pointer select-none">
              <input
                type="checkbox"
                checked={includeCropMarks}
                onChange={(e) => setIncludeCropMarks(e.target.checked)}
                className="h-4 w-4 rounded border-border"
              />
              <span>Add crop marks at trim corners (recommended)</span>
            </label>
            <label className="flex items-center gap-2 text-sm cursor-pointer select-none">
              <input
                type="checkbox"
                checked={includeBleedMarks}
                onChange={(e) => setIncludeBleedMarks(e.target.checked)}
                className="h-4 w-4 rounded border-border"
              />
              <span>Add bleed marks at the bleed edge (for proofing)</span>
            </label>
          </div>
        </>
      )}

      <ActionBar>
        <RunButton onClick={() => void run()} disabled={!file} loading={working} label="Add bleed" />
        <ClearButton onClick={reset} disabled={!file && !result && !error} label="Clear" />
      </ActionBar>

      {error && <ErrorBanner message={error} />}

      {result && report && stats && (
        <div className="space-y-3 rounded-lg border border-primary/30 bg-primary/5 p-4">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <p className="text-sm font-medium">Bleed-added PDF ready</p>
              <p className="text-xs text-muted-foreground">
                {stats.totalPages} page(s) • {formatBytes(result.length)}
              </p>
            </div>
            <Button onClick={() => downloadBytes(result, `bleed-${file?.name ?? "output.pdf"}`)} className="gap-1.5">
              <Download className="h-4 w-4" /> Download
            </Button>
          </div>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-xs">
            <Stat label="Original size" value={`${stats.originalSize.width.toFixed(0)}×${stats.originalSize.height.toFixed(0)}pt`} />
            <Stat label="New size" value={`${stats.newSize.width.toFixed(0)}×${stats.newSize.height.toFixed(0)}pt`} />
            <Stat label="Bleed area" value={`${stats.bleedAreaPercent}%`} />
            <Stat label="Marks drawn" value={stats.marksAdded} />
          </div>
          {trimBox && (
            <p className="text-xs text-muted-foreground">
              Trim box: x={trimBox.x.toFixed(1)}, y={trimBox.y.toFixed(1)}, {trimBox.width.toFixed(0)}×{trimBox.height.toFixed(0)}pt
            </p>
          )}
          {printReady && printReady.ok && (
            <p className={`text-xs ${printReady.output.meets ? "text-emerald-600 dark:text-emerald-400" : "text-amber-600 dark:text-amber-400"}`}>
              {printReady.output.meets
                ? "✓ Meets ISO 3 mm bleed standard (print-ready)"
                : `⚠ Below ISO 3 mm standard (min ${printReady.output.minBleedPt.toFixed(2)}pt; smallest side ${printReady.output.smallestSidePt.toFixed(2)}pt)`}
            </p>
          )}
          <div className="flex flex-wrap gap-2 pt-1">
            <CopyButton getText={() => renderTextReport(report)} label="Copy report" />
            <DownloadButton
              getText={() => renderCsvReport(report)}
              filename="bleed-report.csv"
              mime="text/csv"
              label="Download CSV"
            />
            <ShareButton
              getUrl={() =>
                buildShareUrl({
                  bleedMm: Number(bleedMm),
                  sides,
                  extendBackground,
                  backgroundColor,
                  includeCropMarks,
                  includeBleedMarks,
                })
              }
            />
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
                  · {h.pageCount}p · {h.bleedMm}mm · {h.sides}
                  {h.cropMarks ? " · crop" : ""}{h.bleedMarks ? " · bmk" : ""}
                </span>
                <span className="text-muted-foreground ml-2">· {new Date(h.ts).toLocaleString()}</span>
              </div>
            ))}
          </div>
        </div>
      )}

      <p className="text-xs text-muted-foreground">
        Privacy: bleed generation runs 100% locally in your browser using pdf-lib — your PDF never leaves your device.
      </p>
    </div>
  );
}

function Stat({ label, value }: { label: string; value: string | number }) {
  return (
    <div className="rounded border bg-background px-3 py-2">
      <div className="text-[10px] uppercase tracking-wide text-muted-foreground">{label}</div>
      <div className="text-sm font-semibold">{value}</div>
    </div>
  );
}
