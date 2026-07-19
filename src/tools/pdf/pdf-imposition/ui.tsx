"use client";

import React, { useRef, useState, useMemo, useEffect, useCallback } from "react";
import { PDFDocument, rgb } from "pdf-lib";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Download, FileUp, Trash2, LayoutGrid, History, Scissors } from "lucide-react";
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
  PAPER_SIZES,
  PAPER_SIZE_LABELS,
  IMPOSITION_TYPE_LABELS,
  PAGE_ORDER_LABELS,
  DEFAULT_MARGIN,
  DEFAULT_COST_PER_SHEET,
  gridFor,
  computeLayout,
  pagePositions,
  cutMarksForSheet,
  marginCalculator,
  scalePage,
  validateImposition,
  computeSummary,
  renderText,
  renderCsv,
  type ImpositionType,
  type PageOrder,
  type PaperSizeId,
  type ImpositionLayout,
  type ImpositionSheet,
  type HistoryEntry,
  loadHistory,
  saveHistory,
  clearHistory,
  buildShareUrl,
  parseShareUrl,
} from "./logic";

const IMPOSITION_TYPES: ImpositionType[] = ["2-up", "4-up", "8-up", "16-up", "custom"];
const PAGE_ORDERS: PageOrder[] = ["sequential", "snake-fold", "booklet"];

interface LoadedFile {
  name: string;
  bytes: Uint8Array;
  pageCount: number;
}

interface ResultInfo {
  bytes: Uint8Array;
  layout: ImpositionLayout;
  paperSizeId: PaperSizeId;
  margin: number;
  includeCutMarks: boolean;
}

/**
 * Assemble an imposed PDF from source bytes.
 * For each sheet in the layout, create a paper-size page in the output and
 * embed the source pages (scaled to fit each grid cell). Optionally draw cut marks.
 */
async function assembleImposition(
  srcBytes: Uint8Array,
  layout: ImpositionLayout,
  paperSizeId: PaperSizeId,
  margin: number,
  includeCutMarks: boolean,
): Promise<Uint8Array> {
  const src = await PDFDocument.load(srcBytes);
  const out = await PDFDocument.create();
  const paperSize = PAPER_SIZES.find((p) => p.id === paperSizeId)!;
  const positions = pagePositions(paperSize, layout.grid, margin);
  const srcPages = src.getPages();

  // Pre-embed all source pages once
  const embedded: Awaited<ReturnType<typeof out.embedPage>>[] = [];
  for (let i = 0; i < srcPages.length; i++) {
    // eslint-disable-next-line no-await-in-loop
    const e = await out.embedPage(srcPages[i]!);
    embedded.push(e);
  }

  for (const sheet of layout.sheets) {
    const outPage = out.addPage([paperSize.width, paperSize.height]);

    // Draw cut marks first (so they sit behind pages)
    if (includeCutMarks) {
      const marks = cutMarksForSheet(positions, 8, 3);
      for (const m of marks) {
        outPage.drawLine({
          start: { x: m.x1, y: m.y1 },
          end: { x: m.x2, y: m.y2 },
          thickness: 0.5,
          color: rgb(0.6, 0.6, 0.6),
          opacity: 0.7,
        });
      }
    }

    sheet.pages.forEach((srcPageIdx, slotIdx) => {
      if (srcPageIdx === 0) return; // blank slot
      const emb = embedded[srcPageIdx - 1];
      if (!emb) return;
      const pos = positions[slotIdx]!;
      const { width: eW, height: eH } = emb.size();
      const scaled = scalePage(eW, eH, pos.width, pos.height);
      if (scaled.scale === 0) return;
      // Center within cell
      const x = pos.x + (pos.width - scaled.width) / 2;
      const y = pos.y + (pos.height - scaled.height) / 2;
      outPage.drawPage(emb, { x, y, width: scaled.width, height: scaled.height });
    });
  }

  out.setProducer("UnQTools — PDF Imposition");
  out.setCreator("UnQTools — PDF Imposition");
  out.setCreationDate(new Date());
  out.setModificationDate(new Date());
  return out.save();
}

export default function PdfImposition() {
  const inputRef = useRef<HTMLInputElement>(null);
  const [file, setFile] = useState<LoadedFile | null>(null);
  const [impositionType, setImpositionType] = useState<ImpositionType>("4-up");
  const [pageOrder, setPageOrder] = useState<PageOrder>("sequential");
  const [customRows, setCustomRows] = useState<number>(2);
  const [customCols, setCustomCols] = useState<number>(2);
  const [paperSizeId, setPaperSizeId] = useState<PaperSizeId>("a4");
  const [margin, setMargin] = useState<number>(DEFAULT_MARGIN);
  const [includeCutMarks, setIncludeCutMarks] = useState(true);
  const [result, setResult] = useState<ResultInfo | null>(null);
  const [error, setError] = useState("");
  const [working, setWorking] = useState(false);
  const [history, setHistory] = useState<HistoryEntry[]>([]);

  useEffect(() => {
    setHistory(loadHistory());
    if (typeof window !== "undefined" && window.location.hash) {
      const p = parseShareUrl(window.location.hash);
      if (p) {
        setImpositionType(p.impositionType);
        setPageOrder(p.pageOrder);
        setPaperSizeId(p.paperSize);
        setCustomRows(p.customRows);
        setCustomCols(p.customCols);
        setMargin(p.margin);
        setIncludeCutMarks(p.includeCutMarks);
        toast.info("Loaded from share link");
      }
    }
  }, []);

  const loadFile = useCallback(async (f: File) => {
    try {
      const bytes = new Uint8Array(await f.arrayBuffer());
      const doc = await PDFDocument.load(bytes);
      setFile({ name: f.name, bytes, pageCount: doc.getPageCount() });
      setResult(null);
      setError("");
    } catch {
      toast.error(`Could not read ${f.name} — it may be corrupted or password-protected.`);
    }
  }, []);

  const reset = useCallback(() => {
    setFile(null);
    setResult(null);
    setError("");
  }, []);

  const layout: ImpositionLayout | null = useMemo(() => {
    if (!file) return null;
    return computeLayout(file.pageCount, {
      type: impositionType,
      pageOrder,
      customRows,
      customCols,
    });
  }, [file, impositionType, pageOrder, customRows, customCols]);

  const grid = useMemo(
    () => gridFor(impositionType, customRows, customCols),
    [impositionType, customRows, customCols],
  );

  const validation = useMemo(() => validateImposition(impositionType, grid), [impositionType, grid]);

  const summary = useMemo(() => {
    if (!layout) return null;
    return computeSummary(layout, paperSizeId, margin, includeCutMarks, DEFAULT_COST_PER_SHEET);
  }, [layout, paperSizeId, margin, includeCutMarks]);

  const marginInfo = useMemo(() => {
    if (!layout) return null;
    const paperSize = PAPER_SIZES.find((p) => p.id === paperSizeId)!;
    return marginCalculator(paperSize, grid, margin);
  }, [layout, paperSizeId, grid, margin]);

  const textPreview = useMemo(() => (layout ? renderText(layout) : ""), [layout]);
  const csvPreview = useMemo(() => (layout ? renderCsv(layout) : ""), [layout]);

  const run = useCallback(async () => {
    if (!file || !layout) return;
    setWorking(true);
    setError("");
    setResult(null);
    try {
      const bytes = await assembleImposition(file.bytes, layout, paperSizeId, margin, includeCutMarks);
      const info: ResultInfo = { bytes, layout, paperSizeId, margin, includeCutMarks };
      setResult(info);
      saveHistory({
        ts: Date.now(),
        fileName: file.name,
        impositionType,
        pageOrder,
        sourcePageCount: file.pageCount,
        sheetCount: layout.sheetCount,
        perSheet: layout.perSheet,
        paperSize: paperSizeId,
      });
      setHistory(loadHistory());
      toast.success(`Imposed! ${layout.sheetCount} sheet(s), ${layout.perSheet} pages per sheet`);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Something went wrong while imposing the PDF.");
    } finally {
      setWorking(false);
    }
  }, [file, layout, paperSizeId, margin, includeCutMarks, impositionType, pageOrder]);

  const handleClear = useCallback(() => {
    setFile(null);
    setResult(null);
    setError("");
    setImpositionType("4-up");
    setPageOrder("sequential");
    setCustomRows(2);
    setCustomCols(2);
    setPaperSizeId("a4");
    setMargin(DEFAULT_MARGIN);
    setIncludeCutMarks(true);
    toast.info("Cleared");
  }, []);

  const handleClearHistory = useCallback(() => {
    clearHistory();
    setHistory([]);
    toast.success("History cleared");
  }, []);

  return (
    <div className="space-y-4 unq-animate-fade-in-up">
      {file ? (
        <div className="flex flex-wrap items-center justify-between gap-3 rounded-lg border bg-card p-4">
          <div className="min-w-0 flex-1">
            <p className="truncate text-sm font-medium">{file.name}</p>
            <p className="text-xs text-muted-foreground">
              {file.pageCount} page(s) • {formatBytes(file.bytes.length)}
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
          <p className="mt-1 text-xs text-muted-foreground">Pages will be imposed onto a grid for print</p>
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
            <div>
              <Label className="text-xs">Imposition type</Label>
              <div className="grid gap-2 sm:grid-cols-5 pt-1">
                {IMPOSITION_TYPES.map((t) => (
                  <button
                    key={t}
                    type="button"
                    onClick={() => setImpositionType(t)}
                    className={
                      impositionType === t
                        ? "rounded-lg border border-primary bg-primary/10 p-2 text-left text-xs"
                        : "rounded-lg border border-border p-2 text-left text-xs hover:border-primary/40"
                    }
                  >
                    <span className="font-medium">{IMPOSITION_TYPE_LABELS[t]}</span>
                  </button>
                ))}
              </div>
            </div>

            {impositionType === "custom" && (
              <div className="grid gap-3 sm:grid-cols-2">
                <div>
                  <Label htmlFor="pi-rows" className="text-xs">Custom rows</Label>
                  <input
                    id="pi-rows"
                    type="number"
                    min={1}
                    max={16}
                    value={customRows}
                    onChange={(e) => setCustomRows(Math.max(1, parseInt(e.target.value, 10) || 1))}
                    className="mt-1 h-9 w-full rounded-md border bg-background px-2 text-sm"
                  />
                </div>
                <div>
                  <Label htmlFor="pi-cols" className="text-xs">Custom cols</Label>
                  <input
                    id="pi-cols"
                    type="number"
                    min={1}
                    max={16}
                    value={customCols}
                    onChange={(e) => setCustomCols(Math.max(1, parseInt(e.target.value, 10) || 1))}
                    className="mt-1 h-9 w-full rounded-md border bg-background px-2 text-sm"
                  />
                </div>
              </div>
            )}

            <div>
              <Label className="text-xs">Page order</Label>
              <div className="grid gap-2 sm:grid-cols-3 pt-1">
                {PAGE_ORDERS.map((o) => (
                  <button
                    key={o}
                    type="button"
                    onClick={() => setPageOrder(o)}
                    className={
                      pageOrder === o
                        ? "rounded-lg border border-primary bg-primary/10 p-2 text-left text-xs"
                        : "rounded-lg border border-border p-2 text-left text-xs hover:border-primary/40"
                    }
                  >
                    <span className="font-medium">{PAGE_ORDER_LABELS[o].split(" (")[0]}</span>
                  </button>
                ))}
              </div>
            </div>

            <div className="grid gap-3 sm:grid-cols-3">
              <div>
                <Label htmlFor="pi-paper" className="text-xs">Paper size</Label>
                <select
                  id="pi-paper"
                  value={paperSizeId}
                  onChange={(e) => setPaperSizeId(e.target.value as PaperSizeId)}
                  className="mt-1 h-9 w-full rounded-md border bg-background px-2 text-sm"
                >
                  {PAPER_SIZES.map((p) => (
                    <option key={p.id} value={p.id}>{p.label}</option>
                  ))}
                </select>
              </div>
              <div>
                <Label htmlFor="pi-margin" className="text-xs">Margin between pages (pt)</Label>
                <input
                  id="pi-margin"
                  type="number"
                  min={0}
                  max={100}
                  value={margin}
                  onChange={(e) => setMargin(Math.max(0, parseInt(e.target.value, 10) || 0))}
                  className="mt-1 h-9 w-full rounded-md border bg-background px-2 text-sm"
                />
              </div>
              <div className="flex items-end">
                <label className="flex items-center gap-2 text-xs cursor-pointer pb-2">
                  <input
                    type="checkbox"
                    checked={includeCutMarks}
                    onChange={(e) => setIncludeCutMarks(e.target.checked)}
                    className="h-4 w-4 rounded border-border"
                  />
                  <span className="flex items-center gap-1">
                    <Scissors className="h-3 w-3" /> Include cut marks
                  </span>
                </label>
              </div>
            </div>

            {!validation.valid && (
              <div className="rounded-md border border-amber-400/40 bg-amber-50 dark:bg-amber-950/30 px-3 py-2 text-xs text-amber-700 dark:text-amber-300">
                {validation.reason}
              </div>
            )}
          </CardContent>
        </Card>
      )}

      {layout && summary && marginInfo && (
        <Card>
          <CardContent className="p-4 space-y-2">
            <h3 className="text-sm font-semibold flex items-center gap-1.5">
              <LayoutGrid className="h-4 w-4" /> Layout preview
            </h3>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-xs">
              <Stat label="Source pages" value={summary.sourcePageCount} />
              <Stat label="Padded pages" value={summary.paddedPageCount} />
              <Stat label="Blank padding" value={summary.blankPages} />
              <Stat label="Pages per sheet" value={summary.perSheet} />
              <Stat label="Total sheets" value={summary.sheetCount} />
              <Stat label="Grid" value={`${summary.grid.rows}×${summary.grid.cols}`} />
              <Stat label="Paper waste" value={`${summary.paperWastePercent}%`} />
              <Stat label="Print time" value={`${summary.printTimeMinutes} min`} />
              <Stat label="Est. cost" value={`$${summary.estimatedCost.toFixed(2)}`} />
              <Stat label="Margin used" value={`${marginInfo.marginPercent}%`} />
              <Stat label="Printable area" value={`${Math.round(marginInfo.printableArea).toLocaleString()} pt²`} />
              <Stat label="Bleed area" value={`${Math.round(summary.bleedAreaPt2).toLocaleString()} pt²`} />
            </div>
          </CardContent>
        </Card>
      )}

      <ActionBar>
        <RunButton onClick={() => void run()} disabled={!file} loading={working} label="Impose PDF" />
        <CopyButton getText={() => textPreview} label="Copy layout" disabled={!layout} />
        <DownloadButton
          getText={() => csvPreview}
          filename="imposition-layout.csv"
          mime="text/csv"
          label="Download CSV"
          disabled={!layout}
        />
        <ShareButton
          getUrl={() => buildShareUrl(impositionType, pageOrder, paperSizeId, customRows, customCols, margin, includeCutMarks)}
          disabled={!file}
        />
        <ClearButton onClick={handleClear} disabled={!file && !result && !error} label="Clear" />
      </ActionBar>

      {error && <ErrorBanner message={error} />}

      {result && (
        <Card>
          <CardContent className="p-4 space-y-3">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div>
                <p className="text-sm font-medium">Imposed PDF ready</p>
                <p className="text-xs text-muted-foreground">
                  {result.layout.sheetCount} sheet(s) • {result.layout.perSheet} pages/sheet • {formatBytes(result.bytes.length)}
                </p>
              </div>
              <Button
                onClick={() => downloadBytes(result.bytes, `imposed-${file?.name ?? "output.pdf"}`)}
                className="gap-1.5"
              >
                <Download className="h-4 w-4" /> Download imposed PDF
              </Button>
            </div>
            <details className="text-xs">
              <summary className="cursor-pointer text-muted-foreground">Layout diagram</summary>
              <pre className="mt-2 max-h-[300px] overflow-auto rounded border bg-background p-2 font-mono text-[11px]">
                {textPreview}
              </pre>
            </details>
          </CardContent>
        </Card>
      )}

      {layout && layout.sheets.length > 0 && !result && (
        <Card>
          <CardContent className="p-4 space-y-2">
            <h3 className="text-sm font-semibold flex items-center gap-1.5">
              <LayoutGrid className="h-4 w-4" /> Sheet preview ({layout.sheets.length} sheets)
            </h3>
            <div className="space-y-2 max-h-[400px] overflow-auto">
              {layout.sheets.map((sheet) => (
                <SheetGrid key={sheet.sheetNum} sheet={sheet} rows={layout.grid.rows} cols={layout.grid.cols} />
              ))}
            </div>
          </CardContent>
        </Card>
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
                  <Badge variant="outline" className="mr-2">{h.impositionType}</Badge>
                  <Badge variant="outline" className="mr-2">{h.pageOrder}</Badge>
                  <Badge variant="outline" className="mr-2">{h.sheetCount} sheets</Badge>
                  <Badge variant="outline" className="mr-2">{h.perSheet}/sheet</Badge>
                  <span className="text-muted-foreground">{h.fileName}</span>
                  <span className="text-muted-foreground ml-2">· {new Date(h.ts).toLocaleString()}</span>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {!file && (
        <EmptyState
          title="Drop a PDF to impose for print"
          hint="Choose 2-up, 4-up, 8-up, 16-up or custom grid. Pick sequential, snake-fold, or booklet order. Cut marks and cost estimates included."
          icon={<LayoutGrid className="h-8 w-8" />}
        />
      )}

      <p className="text-xs text-muted-foreground">
        <strong className="text-foreground">Privacy:</strong> Imposition runs 100% locally in your browser using pdf-lib. Your PDF never leaves your device. History is stored in localStorage on this device only.
      </p>
    </div>
  );
}

function SheetGrid({ sheet, rows, cols }: { sheet: ImpositionSheet; rows: number; cols: number }) {
  return (
    <div className="rounded border bg-background p-2">
      <div className="flex items-center gap-2 mb-1">
        <Badge variant="secondary" className="text-[10px]">Sheet {sheet.sheetNum + 1}</Badge>
      </div>
      <div
        className="grid gap-1"
        style={{ gridTemplateColumns: `repeat(${cols}, minmax(0, 1fr))` }}
      >
        {Array.from({ length: rows * cols }).map((_, idx) => {
          const p = sheet.pages[idx] ?? 0;
          return (
            <div
              key={idx}
              className={
                p === 0
                  ? "rounded border border-dashed p-2 text-center text-[11px] text-muted-foreground"
                  : "rounded border p-2 text-center text-[11px] font-mono"
              }
            >
              {p === 0 ? "—" : p}
            </div>
          );
        })}
      </div>
    </div>
  );
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

// Re-export for type-only consumers
export type { ImpositionType, PageOrder, PaperSizeId };
