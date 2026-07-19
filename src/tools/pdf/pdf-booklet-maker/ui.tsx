"use client";

import React, { useRef, useState, useMemo, useEffect, useCallback } from "react";
import { PDFDocument, rgb } from "pdf-lib";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Download, FileUp, Trash2, BookOpen, History, Crop as CropIcon } from "lucide-react";
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
  BOOKLET_TYPE_LABELS,
  PAPER_SIZES,
  PAPER_SIZE_LABELS,
  DEFAULT_SHEETS_PER_SIGNATURE,
  BINDING_MARGIN_PT,
  saddleStitchOrder,
  perfectBoundOrder,
  gateFoldOrder,
  computeLayout,
  sheetCount,
  signatureCount,
  validatePageCount,
  blankPadderCount,
  pagePositions,
  cropMarks,
  spineWidth,
  pointsToMm,
  computeSummary,
  renderText,
  renderCsv,
  renderHtml,
  loadHistory,
  saveHistory,
  clearHistory,
  buildShareUrl,
  parseShareUrl,
  type BookletType,
  type PaperSizeId,
  type BookletLayout,
  type BookletSide,
  type HistoryEntry,
} from "./logic";

const BOOKLET_TYPES: BookletType[] = ["saddle-stitch", "perfect-bound", "gate-fold"];

interface LoadedFile {
  name: string;
  bytes: Uint8Array;
  pageCount: number;
}

interface ResultInfo {
  bytes: Uint8Array;
  layout: BookletLayout;
  paperSizeId: PaperSizeId;
  duplex: boolean;
  cropMarksEnabled: boolean;
}

/**
 * Assemble a booklet PDF from source bytes.
 * For each side in the layout, create a paper-size page in the output and embed
 * the source pages (scaled to fit each slot). Optionally draw crop marks.
 */
async function assembleBooklet(
  srcBytes: Uint8Array,
  layout: BookletLayout,
  paperSizeId: PaperSizeId,
  cropMarksEnabled: boolean,
): Promise<Uint8Array> {
  const src = await PDFDocument.load(srcBytes);
  const out = await PDFDocument.create();
  const paperSize = PAPER_SIZES.find((p) => p.id === paperSizeId)!;
  const pagesPerSide = layout.sides[0]?.pages.length ?? 2;
  const positions = pagePositions(paperSize, pagesPerSide, BINDING_MARGIN_PT);
  const srcPages = src.getPages();

  // Pre-embed all source pages once for performance
  const embedded: Awaited<ReturnType<typeof out.embedPage>>[] = [];
  for (let i = 0; i < srcPages.length; i++) {
    // eslint-disable-next-line no-await-in-loop
    const e = await out.embedPage(srcPages[i]!);
    embedded.push(e);
  }

  for (const side of layout.sides) {
    const outPage = out.addPage([paperSize.width, paperSize.height]);

    side.pages.forEach((srcPageIdx, slotIdx) => {
      const pos = positions[slotIdx]!;
      // Draw crop marks for the slot if enabled
      if (cropMarksEnabled) {
        const marks = cropMarks(pos.x, pos.y, pos.width, pos.height, 8, 3);
        for (const m of marks) {
          outPage.drawLine({
            start: { x: m.x1, y: m.y1 },
            end: { x: m.x2, y: m.y2 },
            thickness: 0.5,
            color: rgb(0.5, 0.5, 0.5),
            opacity: 0.7,
          });
        }
      }
      if (srcPageIdx === 0) return; // blank slot
      const emb = embedded[srcPageIdx - 1];
      if (!emb) return;
      const { width: eW, height: eH } = emb.size();
      const scale = Math.min(pos.width / eW, pos.height / eH);
      const drawW = eW * scale;
      const drawH = eH * scale;
      // Center within slot
      const x = pos.x + (pos.width - drawW) / 2;
      const y = pos.y + (pos.height - drawH) / 2;
      outPage.drawPage(emb, { x, y, width: drawW, height: drawH });
    });
  }

  out.setProducer("UnQTools — PDF Booklet Maker");
  out.setCreator("UnQTools — PDF Booklet Maker");
  out.setCreationDate(new Date());
  out.setModificationDate(new Date());
  return out.save();
}

export default function PdfBookletMaker() {
  const inputRef = useRef<HTMLInputElement>(null);
  const [file, setFile] = useState<LoadedFile | null>(null);
  const [bookletType, setBookletType] = useState<BookletType>("saddle-stitch");
  const [sheetsPerSignature, setSheetsPerSignature] = useState<number>(DEFAULT_SHEETS_PER_SIGNATURE);
  const [paperSizeId, setPaperSizeId] = useState<PaperSizeId>("a4-landscape");
  const [duplex, setDuplex] = useState(true);
  const [cropMarksEnabled, setCropMarksEnabled] = useState(false);
  const [result, setResult] = useState<ResultInfo | null>(null);
  const [error, setError] = useState("");
  const [working, setWorking] = useState(false);
  const [history, setHistory] = useState<HistoryEntry[]>([]);

  useEffect(() => {
    setHistory(loadHistory());
    if (typeof window !== "undefined" && window.location.hash) {
      const p = parseShareUrl(window.location.hash);
      if (p) {
        setBookletType(p.bookletType);
        setSheetsPerSignature(p.sheetsPerSignature);
        setPaperSizeId(p.paperSize);
        setDuplex(p.duplex);
        setCropMarksEnabled(p.cropMarks);
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

  // Compute layout preview from current options (no PDF assembly)
  const layout: BookletLayout | null = useMemo(() => {
    if (!file) return null;
    return computeLayout(file.pageCount, {
      type: bookletType,
      sheetsPerSignature,
    });
  }, [file, bookletType, sheetsPerSignature]);

  const summary = useMemo(() => {
    if (!layout) return null;
    return computeSummary(layout, paperSizeId, duplex, cropMarksEnabled, sheetsPerSignature);
  }, [layout, paperSizeId, duplex, cropMarksEnabled, sheetsPerSignature]);

  const validation = useMemo(() => {
    if (!file) return null;
    return validatePageCount(file.pageCount, bookletType);
  }, [file, bookletType]);

  const textPreview = useMemo(() => (layout ? renderText(layout) : ""), [layout]);
  const csvPreview = useMemo(() => (layout ? renderCsv(layout) : ""), [layout]);

  const run = useCallback(async () => {
    if (!file || !layout) return;
    setWorking(true);
    setError("");
    setResult(null);
    try {
      const bytes = await assembleBooklet(file.bytes, layout, paperSizeId, cropMarksEnabled);
      const info: ResultInfo = { bytes, layout, paperSizeId, duplex, cropMarksEnabled };
      setResult(info);
      saveHistory({
        ts: Date.now(),
        fileName: file.name,
        bookletType,
        sourcePageCount: file.pageCount,
        sheetCount: layout.sheetCount,
        signatureCount: layout.signatureCount,
        paperSize: paperSizeId,
      });
      setHistory(loadHistory());
      toast.success(`Booklet ready — ${layout.sheetCount} sheet(s), ${layout.signatureCount} signature(s)`);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Something went wrong while building the booklet.");
    } finally {
      setWorking(false);
    }
  }, [file, layout, paperSizeId, cropMarksEnabled, bookletType]);

  const handleClear = useCallback(() => {
    setFile(null);
    setResult(null);
    setError("");
    setBookletType("saddle-stitch");
    setSheetsPerSignature(DEFAULT_SHEETS_PER_SIGNATURE);
    setPaperSizeId("a4-landscape");
    setDuplex(true);
    setCropMarksEnabled(false);
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
          <p className="mt-1 text-xs text-muted-foreground">Pages will be rearranged for booklet printing</p>
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
              <Label className="text-xs">Booklet type</Label>
              <div className="grid gap-2 sm:grid-cols-3 pt-1">
                {BOOKLET_TYPES.map((t) => (
                  <button
                    key={t}
                    type="button"
                    onClick={() => setBookletType(t)}
                    className={
                      bookletType === t
                        ? "rounded-lg border border-primary bg-primary/10 p-2 text-left text-xs"
                        : "rounded-lg border border-border p-2 text-left text-xs hover:border-primary/40"
                    }
                  >
                    <span className="font-medium">{BOOKLET_TYPE_LABELS[t]}</span>
                  </button>
                ))}
              </div>
            </div>

            <div className="grid gap-3 sm:grid-cols-2">
              <div>
                <Label htmlFor="pbm-paper" className="text-xs">Paper size</Label>
                <select
                  id="pbm-paper"
                  value={paperSizeId}
                  onChange={(e) => setPaperSizeId(e.target.value as PaperSizeId)}
                  className="mt-1 h-9 w-full rounded-md border bg-background px-2 text-sm"
                >
                  {PAPER_SIZES.map((p) => (
                    <option key={p.id} value={p.id}>{p.label}</option>
                  ))}
                </select>
              </div>

              {bookletType === "perfect-bound" && (
                <div>
                  <Label htmlFor="pbm-sig" className="text-xs">Sheets per signature (4 sheets = 16 pages)</Label>
                  <input
                    id="pbm-sig"
                    type="number"
                    min={1}
                    max={32}
                    value={sheetsPerSignature}
                    onChange={(e) => setSheetsPerSignature(Math.max(1, parseInt(e.target.value, 10) || 1))}
                    className="mt-1 h-9 w-full rounded-md border bg-background px-2 text-sm"
                  />
                </div>
              )}
            </div>

            <div className="flex flex-wrap gap-4 pt-1">
              <label className="flex items-center gap-2 text-xs cursor-pointer">
                <input
                  type="checkbox"
                  checked={duplex}
                  onChange={(e) => setDuplex(e.target.checked)}
                  className="h-4 w-4 rounded border-border"
                />
                <span>Duplex printing (front + back arrangement)</span>
              </label>
              <label className="flex items-center gap-2 text-xs cursor-pointer">
                <input
                  type="checkbox"
                  checked={cropMarksEnabled}
                  onChange={(e) => setCropMarksEnabled(e.target.checked)}
                  className="h-4 w-4 rounded border-border"
                />
                <span className="flex items-center gap-1">
                  <CropIcon className="h-3 w-3" /> Include crop marks
                </span>
              </label>
            </div>
          </CardContent>
        </Card>
      )}

      {layout && validation && summary && (
        <Card>
          <CardContent className="p-4 space-y-2">
            <h3 className="text-sm font-semibold flex items-center gap-1.5">
              <BookOpen className="h-4 w-4" /> Layout preview
            </h3>
            {!validation.valid && (
              <div className="rounded-md border border-amber-400/40 bg-amber-50 dark:bg-amber-950/30 px-3 py-2 text-xs text-amber-700 dark:text-amber-300">
                Page count ({file?.pageCount}) is not a multiple of {validation.multiple}. {validation.blanks} blank page(s) will be padded.
              </div>
            )}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-xs">
              <Stat label="Source pages" value={summary.sourcePageCount} />
              <Stat label="Padded pages" value={summary.paddedPageCount} />
              <Stat label="Blank padding" value={summary.blankPages} />
              <Stat label="Sheets" value={summary.sheetCount} />
              <Stat label="Signatures" value={summary.signatureCount} />
              <Stat label="Spine width" value={`${summary.spineWidthMm} mm`} />
              <Stat label="Binding margin" value={`${pointsToMm(summary.bindingMarginPt)} mm`} />
              <Stat label="Paper" value={PAPER_SIZE_LABELS[paperSizeId].split(" ")[0]} />
            </div>
          </CardContent>
        </Card>
      )}

      <ActionBar>
        <RunButton onClick={() => void run()} disabled={!file} loading={working} label="Build Booklet PDF" />
        <CopyButton getText={() => textPreview} label="Copy layout" disabled={!layout} />
        <DownloadButton
          getText={() => csvPreview}
          filename="booklet-layout.csv"
          mime="text/csv"
          label="Download CSV"
          disabled={!layout}
        />
        <ShareButton
          getUrl={() => buildShareUrl(bookletType, sheetsPerSignature, paperSizeId, duplex, cropMarksEnabled)}
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
                <p className="text-sm font-medium">Booklet PDF ready</p>
                <p className="text-xs text-muted-foreground">
                  {result.layout.sheetCount} sheet(s) • {result.layout.signatureCount} signature(s) • {formatBytes(result.bytes.length)}
                </p>
              </div>
              <Button
                onClick={() => downloadBytes(result.bytes, `booklet-${file?.name ?? "output.pdf"}`)}
                className="gap-1.5"
              >
                <Download className="h-4 w-4" /> Download booklet PDF
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

      {layout && layout.sides.length > 0 && !result && (
        <Card>
          <CardContent className="p-4 space-y-2">
            <h3 className="text-sm font-semibold flex items-center gap-1.5">
              <BookOpen className="h-4 w-4" /> Sheet layout ({layout.sides.length} sides)
            </h3>
            <div className="space-y-1 max-h-[300px] overflow-auto">
              {layout.sides.map((side, i) => (
                <SideRow key={i} side={side} />
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
                  <Badge variant="outline" className="mr-2">{BOOKLET_TYPE_LABELS[h.bookletType].split("(")[0].trim()}</Badge>
                  <Badge variant="outline" className="mr-2">{h.sheetCount} sheets</Badge>
                  <Badge variant="outline" className="mr-2">{h.signatureCount} sigs</Badge>
                  <span className="text-muted-foreground">{h.fileName}</span>
                  <span className="text-muted-foreground ml-2">· {new Date(h.ts).toLocaleString()}</span>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      <p className="text-xs text-muted-foreground">
        <strong className="text-foreground">Privacy:</strong> Booklet assembly runs 100% locally in your browser using pdf-lib. Your PDF never leaves your device. History is stored in localStorage on this device only.
      </p>
    </div>
  );
}

function SideRow({ side }: { side: BookletSide }) {
  return (
    <div className="flex items-center gap-2 rounded border bg-background px-3 py-1.5 text-xs">
      <Badge variant="secondary" className="text-[10px]">Sheet {side.sheetNum + 1}</Badge>
      <Badge variant="outline" className="text-[10px]">{side.side}</Badge>
      <div className="flex gap-1">
        {side.pages.map((p, i) => (
          <span
            key={i}
            className={
              p === 0
                ? "rounded border border-dashed px-2 py-0.5 text-[10px] text-muted-foreground"
                : "rounded border px-2 py-0.5 text-[10px] font-mono"
            }
          >
            {p === 0 ? "—" : p}
          </span>
        ))}
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
export type { BookletType, PaperSizeId };
