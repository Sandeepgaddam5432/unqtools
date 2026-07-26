"use client";

import React, { useMemo, useState } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { ErrorBanner, CopyButton, DownloadButton } from "../../_shared";
import {
  planCrop, planBatch, renderBatchCsv, renderReport, getCropPresets, computeReductionPercent,
  detectBlankPages, type CropJob,
} from "./logic";

export default function PdfCropToContent() {
  const presets = useMemo(() => getCropPresets(), []);
  const [totalPages, setTotalPages] = useState(5);
  const [pageRange, setPageRange] = useState("1-5");
  const [marginThreshold, setMarginThreshold] = useState(10);
  const [minCrop, setMinCrop] = useState(5);
  const [keepMargin, setKeepMargin] = useState(10);
  const [error, setError] = useState<string | null>(null);

  const job: CropJob = useMemo(() => ({
    totalPageCount: totalPages, pageRange, marginThresholdPt: marginThreshold,
    minCropPt: minCrop, keepMarginPt: keepMargin,
  }), [totalPages, pageRange, marginThreshold, minCrop, keepMargin]);

  const result = useMemo(() => planCrop(job), [job]);
  const reductionPct = useMemo(() => computeReductionPercent(result), [result]);
  const blanks = useMemo(() => detectBlankPages(result), [result]);

  const applyPreset = (id: string) => {
    const p = presets.find((x) => x.id === id);
    if (!p) return;
    setMarginThreshold(p.marginThresholdPt);
    setMinCrop(p.minCropPt);
    setKeepMargin(p.keepMarginPt);
  };

  const exportBatch = () => {
    setError(null);
    try { planBatch([job, { ...job, keepMarginPt: 0 }, { ...job, keepMarginPt: 24 }]); } catch (e) { setError(String(e)); }
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
            <Field label={`Margin threshold (pt): ${marginThreshold}`}><input type="range" min={0} max={100} value={marginThreshold} onChange={(e) => setMarginThreshold(parseInt(e.target.value, 10))} className="w-full cursor-pointer" /></Field>
            <Field label={`Min crop (pt): ${minCrop}`}><input type="range" min={0} max={100} value={minCrop} onChange={(e) => setMinCrop(parseInt(e.target.value, 10))} className="w-full cursor-pointer" /></Field>
            <Field label={`Keep margin (pt): ${keepMargin}`}><input type="range" min={0} max={100} value={keepMargin} onChange={(e) => setKeepMargin(parseInt(e.target.value, 10))} className="w-full cursor-pointer" /></Field>
          </div>
          <div className="flex flex-wrap gap-2">
            <CopyButton getText={() => renderReport(result)} label="Copy report" />
            <DownloadButton getText={() => renderReport(result)} filename="crop-plan.txt" label="Download report" />
            <DownloadButton getText={() => renderBatchCsv(planBatch([job]))} filename="crop-batch.csv" mime="text/csv" label="Download CSV" />
            <button onClick={exportBatch} className="text-xs text-primary hover:underline cursor-pointer">Plan batch (3 keep-margins)</button>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardContent className="p-4 space-y-2">
          <Label className="text-sm font-semibold">Crop plan</Label>
          <Row label="Pages in range" value={String(result.pages.length)} />
          <Row label="Pages cropped" value={String(result.pagesCropped)} />
          <Row label="Pages unchanged" value={String(result.pagesUnchanged)} />
          <Row label="Area reduction" value={`${reductionPct.toFixed(2)}%`} />
          <Row label="Blank pages detected" value={String(blanks.length)} />
          {result.warnings.length > 0 && (
            <div className="space-y-1 pt-1">{result.warnings.map((w, i) => <div key={i} className="text-xs text-amber-700 dark:text-amber-400">! {w}</div>)}</div>
          )}
          {result.notes.length > 0 && (
            <div className="space-y-1 pt-1">{result.notes.map((n, i) => <div key={i} className="text-xs text-blue-700 dark:text-blue-400">• {n}</div>)}</div>
          )}
          <div className="pt-1">
            <Label className="text-xs text-muted-foreground">pdf-lib code</Label>
            <pre className="mt-1 rounded-md border bg-muted/40 p-2 text-xs overflow-x-auto font-mono whitespace-pre-wrap break-all">{result.pdfLibCode}</pre>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardContent className="p-4 space-y-2">
          <Label className="text-sm font-semibold">Per-page detail</Label>
          <div className="overflow-x-auto">
            <table className="text-xs w-full">
              <thead><tr className="text-muted-foreground"><th className="text-left p-1">Page</th><th className="text-right p-1">Orig size</th><th className="text-right p-1">New size</th><th className="text-right p-1">Crop L/B/R/T</th><th className="text-left p-1">Status</th></tr></thead>
              <tbody>
                {result.pages.map((p) => (
                  <tr key={p.pageIndex} className="border-t border-border/40">
                    <td className="p-1 font-medium">{p.pageIndex + 1}</td>
                    <td className="p-1 text-right font-mono">{p.origWidth.toFixed(0)}×{p.origHeight.toFixed(0)}</td>
                    <td className="p-1 text-right font-mono">{p.newWidth.toFixed(0)}×{p.newHeight.toFixed(0)}</td>
                    <td className="p-1 text-right font-mono text-muted-foreground">{p.cropOffset.left.toFixed(0)}/{p.cropOffset.bottom.toFixed(0)}/{p.cropOffset.right.toFixed(0)}/{p.cropOffset.top.toFixed(0)}</td>
                    <td className="p-1">{p.cropped ? <Badge variant="outline" className="text-[10px] border-emerald-500/30 text-emerald-700 dark:text-emerald-400">cropped</Badge> : <Badge variant="outline" className="text-[10px]">unchanged</Badge>}</td>
                  </tr>
                ))}
              </tbody>
            </table>
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
