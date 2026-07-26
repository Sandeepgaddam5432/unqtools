"use client";

import React, { useMemo, useState } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { ErrorBanner, CopyButton, DownloadButton } from "../../_shared";
import {
  planCombine, planBatch, renderBatchCsv, renderReport, getCombinePresets,
  type CombineJob, type NUpMode, type Orientation, type PageOrder,
} from "./logic";

export default function PdfCombinePages() {
  const presets = useMemo(() => getCombinePresets(), []);
  const [totalPages, setTotalPages] = useState(8);
  const [pageRange, setPageRange] = useState("1-8");
  const [mode, setMode] = useState<NUpMode>("2-up");
  const [orientation, setOrientation] = useState<Orientation>("portrait");
  const [pageOrder, setPageOrder] = useState<PageOrder>("left-to-right");
  const [withinSheet, setWithinSheet] = useState<"row-major" | "column-major">("row-major");
  const [spacing, setSpacing] = useState(18);
  const [margin, setMargin] = useState(36);
  const [pageSize, setPageSize] = useState<"a4" | "letter">("letter");
  const [drawBorder, setDrawBorder] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const job: CombineJob = useMemo(() => ({
    totalPageCount: totalPages, pageRange, mode, orientation, pageOrder,
    spacingPt: spacing, outerMarginPt: margin, outputPageSize: pageSize,
    drawBorder, withinSheetOrder: withinSheet,
  }), [totalPages, pageRange, mode, orientation, pageOrder, withinSheet, spacing, margin, pageSize, drawBorder]);

  const result = useMemo(() => planCombine(job), [job]);

  const applyPreset = (id: string) => {
    const p = presets.find((x) => x.id === id);
    if (!p) return;
    setMode(p.mode);
    setOrientation(p.orientation);
    setPageSize(p.outputPageSize);
    setSpacing(p.spacingPt);
    setMargin(p.outerMarginPt);
  };

  const exportBatch = () => {
    setError(null);
    try {
      planBatch([job, { ...job, mode: "4-up" }, { ...job, mode: "9-up" }]);
    } catch (e) { setError(String(e)); }
  };

  return (
    <div className="space-y-4">
      {error && <ErrorBanner message={error} />}

      <Card>
        <CardContent className="p-4 space-y-3">
          <div className="flex flex-wrap gap-1">
            <span className="text-xs text-muted-foreground mr-1">Presets:</span>
            {presets.map((p) => (
              <button key={p.id} onClick={() => applyPreset(p.id)} className="text-xs text-primary hover:underline cursor-pointer">{p.label}</button>
            ))}
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <Field label="Total pages"><input type="number" min={1} value={totalPages} onChange={(e) => setTotalPages(parseInt(e.target.value, 10))} className="w-full rounded-md border bg-background px-2 py-1.5 text-sm font-mono" /></Field>
            <Field label="Page range"><input value={pageRange} onChange={(e) => setPageRange(e.target.value)} className="w-full rounded-md border bg-background px-2 py-1.5 text-sm font-mono" /></Field>
            <Field label="Mode"><select value={mode} onChange={(e) => setMode(e.target.value as NUpMode)} className="w-full rounded-md border bg-background px-2 py-1.5 text-sm cursor-pointer"><option value="2-up">2-up</option><option value="4-up">4-up</option><option value="6-up">6-up</option><option value="9-up">9-up</option></select></Field>
            <Field label="Orientation"><select value={orientation} onChange={(e) => setOrientation(e.target.value as Orientation)} className="w-full rounded-md border bg-background px-2 py-1.5 text-sm cursor-pointer"><option value="portrait">Portrait</option><option value="landscape">Landscape</option></select></Field>
            <Field label="Page order"><select value={pageOrder} onChange={(e) => setPageOrder(e.target.value as PageOrder)} className="w-full rounded-md border bg-background px-2 py-1.5 text-sm cursor-pointer"><option value="left-to-right">Left to right</option><option value="right-to-left">Right to left</option><option value="top-to-bottom">Top to bottom</option><option value="bottom-to-top">Bottom to top</option></select></Field>
            <Field label="Within-sheet order"><select value={withinSheet} onChange={(e) => setWithinSheet(e.target.value as "row-major" | "column-major")} className="w-full rounded-md border bg-background px-2 py-1.5 text-sm cursor-pointer"><option value="row-major">Row-major</option><option value="column-major">Column-major</option></select></Field>
            <Field label="Output page size"><select value={pageSize} onChange={(e) => setPageSize(e.target.value as "a4" | "letter")} className="w-full rounded-md border bg-background px-2 py-1.5 text-sm cursor-pointer"><option value="letter">US Letter</option><option value="a4">A4</option></select></Field>
            <Field label={`Spacing (pt): ${spacing}`}><input type="range" min={0} max={100} value={spacing} onChange={(e) => setSpacing(parseInt(e.target.value, 10))} className="w-full cursor-pointer" /></Field>
            <Field label={`Margin (pt): ${margin}`}><input type="range" min={0} max={200} value={margin} onChange={(e) => setMargin(parseInt(e.target.value, 10))} className="w-full cursor-pointer" /></Field>
            <Field label="Draw border"><label className="flex items-center gap-2 text-sm cursor-pointer"><input type="checkbox" checked={drawBorder} onChange={(e) => setDrawBorder(e.target.checked)} /> Draw border around each sub-page</label></Field>
          </div>
          <div className="flex flex-wrap gap-2">
            <CopyButton getText={() => renderReport(result)} label="Copy report" />
            <DownloadButton getText={() => renderReport(result)} filename="combine-pages-plan.txt" label="Download report" />
            <DownloadButton getText={() => renderBatchCsv(planBatch([job]))} filename="combine-pages-batch.csv" mime="text/csv" label="Download CSV" />
            <button onClick={exportBatch} className="text-xs text-primary hover:underline cursor-pointer">Plan batch (3 modes)</button>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardContent className="p-4 space-y-2">
          <Label className="text-sm font-semibold">Combine plan</Label>
          <Row label="Output sheets" value={String(result.outputSheetCount)} />
          <Row label="Output dimensions" value={`${result.outputWidthPt.toFixed(0)} × ${result.outputHeightPt.toFixed(0)} pt`} />
          <Row label="Sub-page size" value={`${result.subPageWidthPt.toFixed(1)} × ${result.subPageHeightPt.toFixed(1)} pt`} />
          {result.warnings.length > 0 && (
            <div className="space-y-1 pt-1">{result.warnings.map((w, i) => <div key={i} className="text-xs text-amber-700 dark:text-amber-400">! {w}</div>)}</div>
          )}
          {result.notes.length > 0 && (
            <div className="space-y-1 pt-1">{result.notes.map((n, i) => <div key={i} className="text-xs text-blue-700 dark:text-blue-400">• {n}</div>)}</div>
          )}
          <div className="pt-1">
            <Label className="text-xs text-muted-foreground">pdf-lib code (reference)</Label>
            <pre className="mt-1 rounded-md border bg-muted/40 p-2 text-xs overflow-x-auto font-mono whitespace-pre-wrap break-all">{result.pdfLibCode}</pre>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardContent className="p-4 space-y-2">
          <Label className="text-sm font-semibold">Sheet preview (positions in pt)</Label>
          <div className="space-y-3">
            {result.sheets.map((sheet, i) => (
              <div key={i} className="space-y-1">
                <div className="text-xs font-medium">Sheet {i + 1}</div>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-1">
                  {sheet.map((sp) => (
                    <div key={sp.slotIndex} className="grid grid-cols-[40px_120px_120px] gap-2 text-[10px] py-0.5">
                      <Badge variant="outline" className="text-[10px] w-fit">P{sp.sourcePageIndex + 1}</Badge>
                      <span className="font-mono text-muted-foreground">x={sp.x.toFixed(0)}, y={sp.y.toFixed(0)}</span>
                      <span className="font-mono text-muted-foreground">{sp.width.toFixed(0)}×{sp.height.toFixed(0)}</span>
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (<div className="space-y-1"><Label className="text-xs text-muted-foreground">{label}</Label>{children}</div>);
}

function Row({ label, value }: { label: string; value: string }) {
  return (<div className="grid grid-cols-[200px_1fr] gap-2 items-center text-xs py-1 border-b border-border/40 last:border-0"><span className="text-muted-foreground">{label}</span><span className="font-mono break-all">{value}</span></div>);
}
