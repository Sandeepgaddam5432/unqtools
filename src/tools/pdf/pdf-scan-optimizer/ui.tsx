"use client";

import React, { useMemo, useState } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { ErrorBanner, CopyButton, DownloadButton } from "../../_shared";
import {
  planScanOptimize, planBatch, renderBatchCsv, renderReport, getScanPresets,
  aggregateInkCoverage, computeCompressionRatio, type ScanJob,
} from "./logic";

export default function PdfScanOptimizer() {
  const presets = useMemo(() => getScanPresets(), []);
  const [totalPages, setTotalPages] = useState(10);
  const [pageRange, setPageRange] = useState("1-10");
  const [binarization, setBinarization] = useState<ScanJob["binarization"]>("otsu");
  const [fixedThreshold, setFixedThreshold] = useState(128);
  const [deskew, setDeskew] = useState(true);
  const [maxDeskew, setMaxDeskew] = useState(10);
  const [removeBlank, setRemoveBlank] = useState(true);
  const [blankInkThreshold, setBlankInkThreshold] = useState(0.02);
  const [compression, setCompression] = useState<ScanJob["compression"]>("ccitt-g4");
  const [error, setError] = useState<string | null>(null);

  const job: ScanJob = useMemo(() => ({
    totalPageCount: totalPages, pageRange, binarization, fixedThreshold, deskew, maxDeskewDeg: maxDeskew,
    removeBlank, blankInkThreshold, compression,
  }), [totalPages, pageRange, binarization, fixedThreshold, deskew, maxDeskew, removeBlank, blankInkThreshold, compression]);

  const result = useMemo(() => planScanOptimize(job), [job]);
  const avgInk = useMemo(() => aggregateInkCoverage(result), [result]);
  const ratio = useMemo(() => computeCompressionRatio(result), [result]);

  const applyPreset = (id: string) => {
    const p = presets.find((x) => x.id === id);
    if (!p) return;
    setBinarization(p.binarization);
    setFixedThreshold(p.fixedThreshold);
    setDeskew(p.deskew);
    setMaxDeskew(p.maxDeskewDeg);
    setRemoveBlank(p.removeBlank);
    setBlankInkThreshold(p.blankInkThreshold);
    setCompression(p.compression);
  };

  const exportBatch = () => {
    setError(null);
    try { planBatch([job, { ...job, compression: "lzw" }, { ...job, compression: "rle" }]); } catch (e) { setError(String(e)); }
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
            <Field label="Binarization"><select value={binarization} onChange={(e) => setBinarization(e.target.value as ScanJob["binarization"])} className="w-full rounded-md border bg-background px-2 py-1.5 text-sm cursor-pointer"><option value="otsu">Otsu (auto)</option><option value="adaptive">Adaptive</option><option value="sauvola">Sauvola</option><option value="fixed">Fixed threshold</option></select></Field>
            <Field label={`Fixed threshold: ${fixedThreshold}`}><input type="range" min={0} max={255} value={fixedThreshold} onChange={(e) => setFixedThreshold(parseInt(e.target.value, 10))} className="w-full cursor-pointer" disabled={binarization !== "fixed"} /></Field>
            <Field label="Compression"><select value={compression} onChange={(e) => setCompression(e.target.value as ScanJob["compression"])} className="w-full rounded-md border bg-background px-2 py-1.5 text-sm cursor-pointer"><option value="ccitt-g4">CCITT Group 4 (best)</option><option value="ccitt-g3">CCITT Group 3</option><option value="rle">RLE</option><option value="lzw">LZW</option><option value="none">None (uncompressed)</option></select></Field>
            <Field label={`Max deskew (deg): ${maxDeskew}`}><input type="range" min={1} max={45} value={maxDeskew} onChange={(e) => setMaxDeskew(parseInt(e.target.value, 10))} className="w-full cursor-pointer" disabled={!deskew} /></Field>
            <Field label={`Blank ink threshold: ${(blankInkThreshold * 100).toFixed(1)}%`}><input type="range" min={0} max={0.2} step={0.005} value={blankInkThreshold} onChange={(e) => setBlankInkThreshold(parseFloat(e.target.value))} className="w-full cursor-pointer" disabled={!removeBlank} /></Field>
            <Field label="Options"><div className="flex flex-col gap-1 text-sm"><label className="flex items-center gap-2 cursor-pointer"><input type="checkbox" checked={deskew} onChange={(e) => setDeskew(e.target.checked)} /> Deskew pages</label><label className="flex items-center gap-2 cursor-pointer"><input type="checkbox" checked={removeBlank} onChange={(e) => setRemoveBlank(e.target.checked)} /> Remove blank pages</label></div></Field>
          </div>
          <div className="flex flex-wrap gap-2">
            <CopyButton getText={() => renderReport(result)} label="Copy report" />
            <DownloadButton getText={() => renderReport(result)} filename="scan-optimizer-plan.txt" label="Download report" />
            <DownloadButton getText={() => renderBatchCsv(planBatch([job]))} filename="scan-optimizer-batch.csv" mime="text/csv" label="Download CSV" />
            <button onClick={exportBatch} className="text-xs text-primary hover:underline cursor-pointer">Plan batch (3 compressions)</button>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardContent className="p-4 space-y-2">
          <Label className="text-sm font-semibold">Optimizer plan</Label>
          <Row label="Pages in range" value={String(result.pages.length)} />
          <Row label="Pages kept" value={String(result.pagesKept)} />
          <Row label="Pages removed" value={String(result.pagesRemoved)} />
          <Row label="Total estimated size" value={`${(result.totalEstimatedBytes / 1024).toFixed(1)} KB (${result.totalEstimatedBytes} B)`} />
          <Row label="Compression ratio" value={`${ratio.toFixed(1)}× vs uncompressed 8-bit`} />
          <Row label="Average ink coverage" value={`${(avgInk * 100).toFixed(2)}%`} />
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
              <thead><tr className="text-muted-foreground"><th className="text-left p-1">Page</th><th className="text-right p-1">Mean</th><th className="text-right p-1">Ink</th><th className="text-right p-1">Threshold</th><th className="text-right p-1">Skew</th><th className="text-right p-1">Size</th><th className="text-left p-1">Status</th></tr></thead>
              <tbody>
                {result.pages.map((p) => (
                  <tr key={p.pageIndex} className="border-t border-border/40">
                    <td className="p-1 font-medium">{p.pageIndex + 1}</td>
                    <td className="p-1 text-right font-mono">{p.meanIntensity.toFixed(0)}</td>
                    <td className="p-1 text-right font-mono">{(p.inkCoverage * 100).toFixed(1)}%</td>
                    <td className="p-1 text-right font-mono">{p.threshold}</td>
                    <td className="p-1 text-right font-mono">{p.detectedSkewDeg.toFixed(2)}°</td>
                    <td className="p-1 text-right font-mono">{(p.estimatedSizeBytes / 1024).toFixed(1)} KB</td>
                    <td className="p-1">{p.isBlank ? <Badge variant="outline" className="text-[10px] border-amber-500/30 text-amber-700 dark:text-amber-400">blank</Badge> : <Badge variant="outline" className="text-[10px] border-emerald-500/30 text-emerald-700 dark:text-emerald-400">content</Badge>}</td>
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
