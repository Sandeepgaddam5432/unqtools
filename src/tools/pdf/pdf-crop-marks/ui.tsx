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
  buildShareUrl,
  checkPrintStandard,
  clearHistory as clearMarksHistory,
  computeSummaryStats,
  DENSITY_BAR_COLORS,
  generateBleedMarks,
  generateCornerCropMarks,
  generateDensityBars,
  generateEdgeCropMarks,
  generateRegistrationCrosses,
  includesCornerMarks,
  includesEdgeMarks,
  includesRegistrationCross,
  loadHistory,
  lookupMarkColor,
  MARK_COLORS,
  MARK_COLOR_LABELS,
  MARK_TYPES,
  MARK_TYPE_LABELS,
  markLengthToPoints,
  markOffsetToPoints,
  markWeightToPoints,
  parseShareUrl,
  renderCsvReport,
  renderTextReport,
  saveHistory,
  verifyMarkVisibility,
  type HistoryEntry,
  type MarkColor,
  type MarkPageResult,
  type MarkType,
} from "./logic";

export default function PdfCropMarks() {
  const inputRef = useRef<HTMLInputElement>(null);
  const [file, setFile] = useState<{ name: string; bytes: Uint8Array; pageCount: number } | null>(null);
  const [markType, setMarkType] = useState<MarkType>("corner-crop");
  const [markLengthMm, setMarkLengthMm] = useState("10");
  const [markWeight, setMarkWeight] = useState("0.25");
  const [markColor, setMarkColor] = useState<MarkColor>("black");
  const [markOffsetMm, setMarkOffsetMm] = useState("3");
  const [includeBleedMarks, setIncludeBleedMarks] = useState(false);
  const [includeDensityBars, setIncludeDensityBars] = useState(false);
  const [result, setResult] = useState<Uint8Array | null>(null);
  const [report, setReport] = useState<MarkPageResult[] | null>(null);
  const [error, setError] = useState("");
  const [working, setWorking] = useState(false);
  const [history, setHistory] = useState<HistoryEntry[]>([]);

  useEffect(() => {
    setHistory(loadHistory());
    if (typeof window !== "undefined" && window.location.hash) {
      const p = parseShareUrl(window.location.hash);
      if (p.markType) setMarkType(p.markType);
      if (p.markLengthMm !== undefined) setMarkLengthMm(String(p.markLengthMm));
      if (p.markWeight !== undefined) setMarkWeight(String(p.markWeight));
      if (p.markColor) setMarkColor(p.markColor);
      if (p.markOffsetMm !== undefined) setMarkOffsetMm(String(p.markOffsetMm));
      if (p.includeBleedMarks !== undefined) setIncludeBleedMarks(p.includeBleedMarks);
      if (p.includeDensityBars !== undefined) setIncludeDensityBars(p.includeDensityBars);
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
    clearMarksHistory();
    setHistory([]);
    toast.success("History cleared");
  }

  async function run() {
    if (!file) return;
    const lenMm = Number(markLengthMm);
    const wt = Number(markWeight);
    const offMm = Number(markOffsetMm);
    if (!Number.isFinite(lenMm) || lenMm <= 0) {
      setError("Mark length must be a positive number.");
      return;
    }
    if (!Number.isFinite(offMm) || offMm < 0) {
      setError("Mark offset must be a non-negative number.");
      return;
    }

    const lengthPt = markLengthToPoints(lenMm);
    const weightPt = markWeightToPoints(wt);
    const offsetPt = markOffsetToPoints(offMm);
    const colorDef = lookupMarkColor(markColor);
    const stroke = rgb(colorDef.rgb.r, colorDef.rgb.g, colorDef.rgb.b);

    setWorking(true);
    setError("");
    setResult(null);
    setReport(null);

    try {
      const doc = await PDFDocument.load(file.bytes);
      const pages = doc.getPages();
      const pageResults: MarkPageResult[] = [];

      for (let i = 0; i < pages.length; i++) {
        const page = pages[i];
        const { width, height } = page.getSize();
        // Trim box is the full page (we draw marks OUTSIDE the trim — pdf-lib
        // pages have a MediaBox equal to the visible page; marks just outside
        // may be clipped by viewers, which is acceptable for proof prints).
        const trimW = width;
        const trimH = height;

        let cornerCount = 0;
        let edgeCount = 0;
        let regCount = 0;
        let bleedCount = 0;
        let densityCount = 0;

        if (includesCornerMarks(markType)) {
          const lines = generateCornerCropMarks(trimW, trimH, offsetPt, lengthPt);
          for (const ln of lines) {
            page.drawLine({
              start: { x: ln.x1, y: ln.y1 },
              end: { x: ln.x2, y: ln.y2 },
              thickness: weightPt,
              color: stroke,
            });
          }
          cornerCount = lines.length;
        }
        if (includesEdgeMarks(markType)) {
          const lines = generateEdgeCropMarks(trimW, trimH, offsetPt, lengthPt);
          for (const ln of lines) {
            page.drawLine({
              start: { x: ln.x1, y: ln.y1 },
              end: { x: ln.x2, y: ln.y2 },
              thickness: weightPt,
              color: stroke,
            });
          }
          edgeCount = lines.length;
        }
        if (includesRegistrationCross(markType)) {
          const lines = generateRegistrationCrosses(trimW, trimH, offsetPt, lengthPt);
          for (const ln of lines) {
            page.drawLine({
              start: { x: ln.x1, y: ln.y1 },
              end: { x: ln.x2, y: ln.y2 },
              thickness: weightPt,
              color: stroke,
            });
          }
          regCount = lines.length;
        }
        if (includeBleedMarks) {
          const lines = generateBleedMarks(trimW, trimH, lengthPt);
          for (const ln of lines) {
            page.drawLine({
              start: { x: ln.x1, y: ln.y1 },
              end: { x: ln.x2, y: ln.y2 },
              thickness: weightPt,
              color: stroke,
            });
          }
          bleedCount = lines.length;
        }
        if (includeDensityBars) {
          const bars = generateDensityBars(trimW, trimH, offsetPt, 10, 6);
          for (const b of bars) {
            const c = DENSITY_BAR_COLORS[b.color];
            page.drawRectangle({
              x: b.x,
              y: b.y,
              width: b.width,
              height: b.height,
              color: rgb(c.r, c.g, c.b),
            });
          }
          densityCount = bars.length;
        }

        pageResults.push({
          pageNum: i + 1,
          markType,
          markLengthPt: lengthPt,
          markWeightPt: weightPt,
          markOffsetPt: offsetPt,
          markColor,
          cornerMarks: cornerCount,
          edgeMarks: edgeCount,
          registrationCrosses: regCount,
          bleedMarks: bleedCount,
          densityBars: densityCount,
        });
      }

      doc.setProducer("UnQTools — PDF Crop Marks");
      doc.setCreator("UnQTools — PDF Crop Marks");
      doc.setModificationDate(new Date());

      const bytes = await doc.save();
      setResult(bytes);
      setReport(pageResults);
      toast.success(`Crop marks added to ${pageResults.length} page(s)`);

      const entry: HistoryEntry = {
        ts: Date.now(),
        fileName: file.name,
        pageCount: pages.length,
        markType,
        markLengthMm: lenMm,
        markWeight: wt,
        markColor,
        markOffsetMm: offMm,
      };
      saveHistory(entry);
      setHistory(loadHistory());
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      setError(`Could not add crop marks: ${msg}. The PDF may use features pdf-lib can't re-save — try the Flatten PDF tool first.`);
    } finally {
      setWorking(false);
    }
  }

  const stats = report ? computeSummaryStats(report) : null;
  const printCheck = checkPrintStandard(
    markLengthToPoints(Number(markLengthMm)),
    markOffsetToPoints(Number(markOffsetMm)),
    markWeightToPoints(Number(markWeight)),
    "iso",
  );
  const visibility = verifyMarkVisibility(markColor, "#FFFFFF");

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
            Adds crop marks, registration crosses, bleed marks, and density bars for professional print finishing.
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
            <Label htmlFor="mark-type">Mark type</Label>
            <select
              id="mark-type"
              value={markType}
              onChange={(e) => setMarkType(e.target.value as MarkType)}
              aria-label="Mark type"
              className="flex h-9 w-full rounded-md border border-input bg-background px-3 text-sm cursor-pointer"
            >
              {MARK_TYPES.map((t) => (
                <option key={t} value={t}>{MARK_TYPE_LABELS[t]}</option>
              ))}
            </select>
          </div>

          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            <div className="space-y-1.5">
              <Label htmlFor="mark-length">Mark length (mm)</Label>
              <Input
                id="mark-length"
                type="number"
                min={1}
                step={0.5}
                value={markLengthMm}
                onChange={(e) => setMarkLengthMm(e.target.value)}
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="mark-weight">Mark weight (pt)</Label>
              <Input
                id="mark-weight"
                type="number"
                min={0.1}
                max={5}
                step={0.05}
                value={markWeight}
                onChange={(e) => setMarkWeight(e.target.value)}
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="mark-offset">Mark offset (mm)</Label>
              <Input
                id="mark-offset"
                type="number"
                min={0}
                step={0.5}
                value={markOffsetMm}
                onChange={(e) => setMarkOffsetMm(e.target.value)}
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="mark-color">Mark color</Label>
              <select
                id="mark-color"
                value={markColor}
                onChange={(e) => setMarkColor(e.target.value as MarkColor)}
                aria-label="Mark color"
                className="flex h-9 w-full rounded-md border border-input bg-background px-3 text-sm cursor-pointer"
              >
                {MARK_COLORS.map((c) => (
                  <option key={c} value={c}>{MARK_COLOR_LABELS[c]}</option>
                ))}
              </select>
            </div>
          </div>

          <div className="space-y-2">
            <label className="flex items-center gap-2 text-sm cursor-pointer select-none">
              <input
                type="checkbox"
                checked={includeBleedMarks}
                onChange={(e) => setIncludeBleedMarks(e.target.checked)}
                className="h-4 w-4 rounded border-border"
              />
              <span>Add bleed marks (marks at trim edge for verification)</span>
            </label>
            <label className="flex items-center gap-2 text-sm cursor-pointer select-none">
              <input
                type="checkbox"
                checked={includeDensityBars}
                onChange={(e) => setIncludeDensityBars(e.target.checked)}
                className="h-4 w-4 rounded border-border"
              />
              <span>Add CMYK + RGB density bars (color bars at page bottom)</span>
            </label>
          </div>
        </>
      )}

      <ActionBar>
        <RunButton onClick={() => void run()} disabled={!file} loading={working} label="Add marks" />
        <ClearButton onClick={reset} disabled={!file && !result && !error} label="Clear" />
      </ActionBar>

      {error && <ErrorBanner message={error} />}

      {result && report && stats && (
        <div className="space-y-3 rounded-lg border border-primary/30 bg-primary/5 p-4">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <p className="text-sm font-medium">Marked PDF ready</p>
              <p className="text-xs text-muted-foreground">
                {stats.totalPages} page(s) • {stats.totalMarks} marks • {formatBytes(result.length)}
              </p>
            </div>
            <Button onClick={() => downloadBytes(result, `marks-${file?.name ?? "output.pdf"}`)} className="gap-1.5">
              <Download className="h-4 w-4" /> Download
            </Button>
          </div>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-xs">
            <Stat label="Total marks" value={stats.totalMarks} />
            <Stat label="Marks / page" value={stats.marksPerPage} />
            <Stat label="Density bars / page" value={stats.densityBarsPerPage} />
            <Stat label="Mark type" value={markType} />
          </div>
          <div className="text-xs space-y-1">
            <p className={printCheck.meets ? "text-emerald-600 dark:text-emerald-400" : "text-amber-600 dark:text-amber-400"}>
              {printCheck.meets
                ? "✓ Meets ISO 15930 (PDF/X) mark standard"
                : `⚠ ${printCheck.warnings[0]}`}
            </p>
            {visibility.ok && (
              <p className={visibility.output.meets ? "text-emerald-600 dark:text-emerald-400" : "text-amber-600 dark:text-amber-400"}>
                {visibility.output.meets
                  ? `✓ Mark color has good contrast on white (Δ ${visibility.output.contrast.toFixed(2)})`
                  : `⚠ Low contrast on white (Δ ${visibility.output.contrast.toFixed(2)}) — consider a different mark color`}
              </p>
            )}
          </div>
          <div className="flex flex-wrap gap-2 pt-1">
            <CopyButton getText={() => renderTextReport(report)} label="Copy report" />
            <DownloadButton
              getText={() => renderCsvReport(report)}
              filename="crop-marks-report.csv"
              mime="text/csv"
              label="Download CSV"
            />
            <ShareButton
              getUrl={() =>
                buildShareUrl({
                  markType,
                  markLengthMm: Number(markLengthMm),
                  markWeight: Number(markWeight),
                  markColor,
                  markOffsetMm: Number(markOffsetMm),
                  includeBleedMarks,
                  includeDensityBars,
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
                  · {h.pageCount}p · {h.markType} · {h.markLengthMm}mm · {h.markColor}
                </span>
                <span className="text-muted-foreground ml-2">· {new Date(h.ts).toLocaleString()}</span>
              </div>
            ))}
          </div>
        </div>
      )}

      <p className="text-xs text-muted-foreground">
        Privacy: crop-mark generation runs 100% locally in your browser using pdf-lib — your PDF never leaves your device.
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
