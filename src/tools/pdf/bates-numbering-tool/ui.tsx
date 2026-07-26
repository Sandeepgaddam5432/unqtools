"use client";

import React, { useMemo, useState } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { ErrorBanner, CopyButton, DownloadButton } from "../../_shared";
import {
  getGridPositions, planBates, planBatch, renderBatchCsv, renderReport, getBatesPresets,
  nextStartNumber, type BatesJob, type GridPosition,
} from "./logic";

export default function BatesNumberingTool() {
  const positions = useMemo(() => getGridPositions(), []);
  const presets = useMemo(() => getBatesPresets(), []);

  const [prefix, setPrefix] = useState("DEF");
  const [startNumber, setStartNumber] = useState(1);
  const [digits, setDigits] = useState(6);
  const [suffix, setSuffix] = useState("");
  const [separator, setSeparator] = useState("-");
  const [position, setPosition] = useState<GridPosition>("bottom-right");
  const [fontSize, setFontSize] = useState(10);
  const [margin, setMargin] = useState(36);
  const [pageRange, setPageRange] = useState("1-10");
  const [totalPages, setTotalPages] = useState(20);
  const [error, setError] = useState<string | null>(null);

  const job: BatesJob = useMemo(() => ({
    format: { prefix, startNumber, digits, suffix, separator },
    position, fontSizePt: fontSize, marginPt: margin,
    color: { r: 0, g: 0, b: 0 }, pageRange, totalPageCount: totalPages,
  }), [prefix, startNumber, digits, suffix, separator, position, fontSize, margin, pageRange, totalPages]);

  const result = useMemo(() => planBates(job), [job]);

  const applyPreset = (id: string) => {
    const p = presets.find((x) => x.id === id);
    if (!p) return;
    setPrefix(p.format.prefix);
    setStartNumber(p.format.startNumber);
    setDigits(p.format.digits);
    setSuffix(p.format.suffix);
    setSeparator(p.format.separator);
  };

  const exportBatch = () => {
    setError(null);
    try {
      planBatch([job, { ...job, format: { ...job.format, startNumber: nextStartNumber(job) }, pageRange: "11-20" }]);
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
            <Field label="Prefix"><input value={prefix} onChange={(e) => setPrefix(e.target.value)} className="w-full rounded-md border bg-background px-2 py-1.5 text-sm font-mono" /></Field>
            <Field label="Suffix"><input value={suffix} onChange={(e) => setSuffix(e.target.value)} className="w-full rounded-md border bg-background px-2 py-1.5 text-sm font-mono" /></Field>
            <Field label="Start number"><input type="number" min={0} value={startNumber} onChange={(e) => setStartNumber(parseInt(e.target.value, 10))} className="w-full rounded-md border bg-background px-2 py-1.5 text-sm font-mono" /></Field>
            <Field label="Digits"><input type="number" min={1} max={12} value={digits} onChange={(e) => setDigits(parseInt(e.target.value, 10))} className="w-full rounded-md border bg-background px-2 py-1.5 text-sm font-mono" /></Field>
            <Field label="Separator"><input value={separator} onChange={(e) => setSeparator(e.target.value)} className="w-full rounded-md border bg-background px-2 py-1.5 text-sm font-mono" /></Field>
            <Field label="Position"><select value={position} onChange={(e) => setPosition(e.target.value as GridPosition)} className="w-full rounded-md border bg-background px-2 py-1.5 text-sm cursor-pointer">{positions.map((p) => <option key={p.id} value={p.id}>{p.label}</option>)}</select></Field>
            <Field label={`Font size (pt): ${fontSize}`}><input type="range" min={4} max={72} value={fontSize} onChange={(e) => setFontSize(parseInt(e.target.value, 10))} className="w-full cursor-pointer" /></Field>
            <Field label={`Margin (pt): ${margin}`}><input type="range" min={0} max={200} value={margin} onChange={(e) => setMargin(parseInt(e.target.value, 10))} className="w-full cursor-pointer" /></Field>
            <Field label="Page range (1-10, 15, 20-25)"><input value={pageRange} onChange={(e) => setPageRange(e.target.value)} className="w-full rounded-md border bg-background px-2 py-1.5 text-sm font-mono" /></Field>
            <Field label="Total pages"><input type="number" min={1} value={totalPages} onChange={(e) => setTotalPages(parseInt(e.target.value, 10))} className="w-full rounded-md border bg-background px-2 py-1.5 text-sm font-mono" /></Field>
          </div>
          <div className="flex flex-wrap gap-2">
            <CopyButton getText={() => renderReport(result)} label="Copy report" />
            <DownloadButton getText={() => renderReport(result)} filename="bates-plan.txt" label="Download report" />
            <DownloadButton getText={() => renderBatchCsv(planBatch([job]))} filename="bates-batch.csv" mime="text/csv" label="Download CSV" />
            <button onClick={exportBatch} className="text-xs text-primary hover:underline cursor-pointer">Plan batch (2 ranges)</button>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardContent className="p-4 space-y-2">
          <Label className="text-sm font-semibold">Bates plan</Label>
          <Row label="Pages stamped" value={String(result.stamps.length)} />
          <Row label="First stamp" value={result.stamps[0]?.label ?? "—"} />
          <Row label="Last stamp" value={result.stamps[result.stamps.length - 1]?.label ?? "—"} />
          <Row label="Next start (after batch)" value={String(nextStartNumber(job))} />
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
          <Label className="text-sm font-semibold">Position reference (9-grid)</Label>
          <div className="grid grid-cols-3 gap-2 max-w-sm">
            {positions.map((p) => (
              <button key={p.id} onClick={() => setPosition(p.id)} className={`rounded-md border p-2 text-xs cursor-pointer ${position === p.id ? "border-primary bg-primary/10" : "border-border hover:bg-muted/40"}`}>
                <div className="font-medium">{p.label}</div>
                <div className="text-[10px] text-muted-foreground">x={p.xAlign} y={p.yAlign}</div>
              </button>
            ))}
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardContent className="p-4 space-y-2">
          <Label className="text-sm font-semibold">Sample stamps</Label>
          <div className="space-y-1">
            {result.stamps.slice(0, 10).map((s) => (
              <div key={s.pageIndex} className="grid grid-cols-[60px_120px_80px_80px] gap-2 text-xs py-1 border-b border-border/40 last:border-0">
                <Badge variant="outline" className="text-[10px] w-fit">Page {s.pageIndex + 1}</Badge>
                <span className="font-mono">{s.label}</span>
                <span className="font-mono text-muted-foreground">x={s.x.toFixed(0)}</span>
                <span className="font-mono text-muted-foreground">y={s.y.toFixed(0)}</span>
              </div>
            ))}
            {result.stamps.length > 10 && <div className="text-xs text-muted-foreground">+ {result.stamps.length - 10} more…</div>}
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
