"use client";

import React, { useMemo, useState } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { ErrorBanner, CopyButton, DownloadButton } from "../../_shared";
import {
  planDeskew, planBatch, renderBatchCsv, renderReport, getDeskewPresets, normalizeAngle,
  type DeskewJob,
} from "./logic";

export default function PdfDeskewTool() {
  const presets = useMemo(() => getDeskewPresets(), []);

  const [totalPages, setTotalPages] = useState(10);
  const [pageRange, setPageRange] = useState("1-10");
  const [mode, setMode] = useState<DeskewJob["mode"]>("auto");
  const [manualAngle, setManualAngle] = useState(2);
  const [maxAutoAngle, setMaxAutoAngle] = useState(15);
  const [confidence, setConfidence] = useState(0.7);
  const [error, setError] = useState<string | null>(null);

  // Simulated detected angles for demo (alternating ±2 to ±5 degrees)
  const detectedAngles = useMemo(() => Array.from({ length: totalPages }, (_, i) => ((i * 7) % 11) - 5), [totalPages]);
  const detectedConfidences = useMemo(() => Array.from({ length: totalPages }, () => 0.85 + Math.random() * 0.1), [totalPages]);

  const job: DeskewJob = useMemo(() => ({
    totalPageCount: totalPages, pageRange, mode, manualAngleDeg: manualAngle,
    maxAutoAngleDeg: maxAutoAngle, confidenceThreshold: confidence,
    detectedAngles, detectedConfidences,
  }), [totalPages, pageRange, mode, manualAngle, maxAutoAngle, confidence, detectedAngles, detectedConfidences]);

  const result = useMemo(() => planDeskew(job), [job]);

  const applyPreset = (id: string) => {
    const p = presets.find((x) => x.id === id);
    if (!p) return;
    setMode(p.mode);
    setManualAngle(p.manualAngleDeg);
    setMaxAutoAngle(p.maxAutoAngleDeg);
    setConfidence(p.confidenceThreshold);
  };

  const exportBatch = () => {
    setError(null);
    try {
      planBatch([job, { ...job, mode: "manual" }]);
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
            <Field label="Mode"><select value={mode} onChange={(e) => setMode(e.target.value as DeskewJob["mode"])} className="w-full rounded-md border bg-background px-2 py-1.5 text-sm cursor-pointer"><option value="auto">Auto-detect</option><option value="manual">Manual</option><option value="auto-with-manual-fallback">Auto + manual fallback</option></select></Field>
            <Field label={`Manual angle (deg): ${manualAngle}`}><input type="range" min={-45} max={45} step={0.1} value={manualAngle} onChange={(e) => setManualAngle(parseFloat(e.target.value))} className="w-full cursor-pointer" /></Field>
            <Field label={`Max auto angle (deg): ${maxAutoAngle}`}><input type="range" min={1} max={45} value={maxAutoAngle} onChange={(e) => setMaxAutoAngle(parseInt(e.target.value, 10))} className="w-full cursor-pointer" /></Field>
            <Field label={`Confidence threshold: ${confidence.toFixed(2)}`}><input type="range" min={0} max={1} step={0.05} value={confidence} onChange={(e) => setConfidence(parseFloat(e.target.value))} className="w-full cursor-pointer" /></Field>
          </div>
          <div className="flex flex-wrap gap-2">
            <CopyButton getText={() => renderReport(result)} label="Copy report" />
            <DownloadButton getText={() => renderReport(result)} filename="deskew-plan.txt" label="Download report" />
            <DownloadButton getText={() => renderBatchCsv(planBatch([job]))} filename="deskew-batch.csv" mime="text/csv" label="Download CSV" />
            <button onClick={exportBatch} className="text-xs text-primary hover:underline cursor-pointer">Plan batch (auto + manual)</button>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardContent className="p-4 space-y-2">
          <Label className="text-sm font-semibold">Deskew plan</Label>
          <Row label="Pages in range" value={String(result.pages.length)} />
          <Row label="Pages straightened" value={String(result.pagesStraightened)} />
          <Row label="Pages skipped" value={String(result.pagesSkipped)} />
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
              <thead><tr className="text-muted-foreground"><th className="text-left p-1">Page</th><th className="text-right p-1">Detected</th><th className="text-right p-1">Confidence</th><th className="text-right p-1">Applied</th><th className="text-left p-1">Status</th></tr></thead>
              <tbody>
                {result.pages.map((p) => (
                  <tr key={p.pageIndex} className="border-t border-border/40">
                    <td className="p-1 font-medium">{p.pageIndex + 1}</td>
                    <td className="p-1 text-right font-mono">{normalizeAngle(p.detectedAngle).toFixed(2)}°</td>
                    <td className="p-1 text-right font-mono">{p.confidence.toFixed(2)}</td>
                    <td className={`p-1 text-right font-mono ${Math.abs(p.appliedAngle) > 0.01 ? "text-emerald-600 dark:text-emerald-400" : "text-muted-foreground"}`}>{p.appliedAngle.toFixed(2)}°</td>
                    <td className="p-1">{Math.abs(p.appliedAngle) > 0.01 ? <Badge variant="outline" className="text-[10px] border-emerald-500/30 text-emerald-700 dark:text-emerald-400">straightened</Badge> : <Badge variant="outline" className="text-[10px]">skipped</Badge>}</td>
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
