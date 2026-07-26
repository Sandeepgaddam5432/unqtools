"use client";

import React, { useState, useCallback, useMemo } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { ErrorBanner, CopyButton, DownloadButton } from "../../_shared";
import {
  changeDpi,
  statsToCsv,
  DPI_PRESETS,
  PRINT_SIZES,
  pixelsFromInches,
  printSizeInches,
  qualityFromDpi,
  type DpiChangeResult,
} from "./logic";
import { toast } from "sonner";

export default function ImageDpiChanger() {
  const [width, setWidth] = useState(3000);
  const [height, setHeight] = useState(2000);
  const [targetDpi, setTargetDpi] = useState(300);
  const [metadataOnly, setMetadataOnly] = useState(true);
  const [targetWidth, setTargetWidth] = useState<number | null>(null);
  const [targetHeight, setTargetHeight] = useState<number | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<DpiChangeResult | null>(null);
  const [history, setHistory] = useState<DpiChangeResult[]>([]);

  const apply = useCallback(() => {
    setError(null);
    const r = changeDpi({
      width, height, targetDpi, metadataOnly,
      targetWidth: targetWidth ?? undefined,
      targetHeight: targetHeight ?? undefined,
    });
    if ("error" in r) { setError(r.error); return; }
    setResult(r);
    setHistory((h) => [r, ...h].slice(0, 10));
    toast.success(`DPI changed to ${targetDpi}`);
  }, [width, height, targetDpi, metadataOnly, targetWidth, targetHeight]);

  const reset = useCallback(() => {
    setWidth(3000);
    setHeight(2000);
    setTargetDpi(300);
    setMetadataOnly(true);
    setTargetWidth(null);
    setTargetHeight(null);
    setResult(null);
    setError(null);
  }, []);

  const csv = useMemo(() => (result ? statsToCsv(result.stats) : ""), [result]);

  const qualityColor = (q: string) => q === "good" ? "text-emerald-600" : q === "fair" ? "text-amber-600" : "text-red-600";

  return (
    <div className="space-y-4">
      <Card>
        <CardContent className="p-4 space-y-3">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <Label className="text-xs text-muted-foreground">Pixel width</Label>
              <input type="number" min={1} value={width} onChange={(e) => setWidth(Number(e.target.value))} className="w-full h-9 rounded-md border bg-background px-3 text-sm" />
            </div>
            <div>
              <Label className="text-xs text-muted-foreground">Pixel height</Label>
              <input type="number" min={1} value={height} onChange={(e) => setHeight(Number(e.target.value))} className="w-full h-9 rounded-md border bg-background px-3 text-sm" />
            </div>
            <div>
              <Label className="text-xs text-muted-foreground">Target DPI</Label>
              <input type="number" min={1} max={4000} value={targetDpi} onChange={(e) => setTargetDpi(Number(e.target.value))} className="w-full h-9 rounded-md border bg-background px-3 text-sm" />
            </div>
            <div className="flex items-end">
              <label className="flex items-center gap-2 text-sm">
                <input type="checkbox" checked={metadataOnly} onChange={(e) => setMetadataOnly(e.target.checked)} />
                Metadata only (no resampling)
              </label>
            </div>
          </div>
          <div>
            <Label className="text-xs text-muted-foreground">DPI presets</Label>
            <div className="flex flex-wrap gap-2 mt-1">
              {DPI_PRESETS.map((p) => (
                <Button key={p.value} size="sm" variant={targetDpi === p.value ? "default" : "outline"} onClick={() => setTargetDpi(p.value)} title={p.use}>{p.label}</Button>
              ))}
            </div>
          </div>
          {!metadataOnly && (
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label className="text-xs text-muted-foreground">Override target width (optional)</Label>
                <input type="number" min={1} value={targetWidth ?? ""} onChange={(e) => setTargetWidth(e.target.value ? Number(e.target.value) : null)} className="w-full h-9 rounded-md border bg-background px-3 text-sm" />
              </div>
              <div>
                <Label className="text-xs text-muted-foreground">Override target height (optional)</Label>
                <input type="number" min={1} value={targetHeight ?? ""} onChange={(e) => setTargetHeight(e.target.value ? Number(e.target.value) : null)} className="w-full h-9 rounded-md border bg-background px-3 text-sm" />
              </div>
            </div>
          )}
          <div className="flex flex-wrap gap-2">
            <Button size="sm" onClick={apply}>Calculate</Button>
            <Button size="sm" variant="ghost" onClick={reset}>Reset</Button>
            <CopyButton getText={() => csv} label="Copy CSV" disabled={!csv} />
            <DownloadButton getText={() => csv} filename="dpi-stats.csv" mime="text/csv" label="Download CSV" disabled={!csv} />
          </div>
        </CardContent>
      </Card>

      {result && (
        <Card>
          <CardHeader className="pb-3"><CardTitle className="text-sm">Result</CardTitle></CardHeader>
          <CardContent className="p-3">
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-sm">
              <div><p className="text-xs text-muted-foreground">Final dimensions</p><p className="font-bold">{result.width}×{result.height}px</p></div>
              <div><p className="text-xs text-muted-foreground">DPI</p><p className="font-bold">{result.targetDpi}</p></div>
              <div><p className="text-xs text-muted-foreground">Quality</p><p className={`font-bold ${qualityColor(result.quality)}`}>{result.quality}</p></div>
              <div><p className="text-xs text-muted-foreground">Megapixels</p><p className="font-bold">{result.stats.megapixels}</p></div>
              <div><p className="text-xs text-muted-foreground">Print (in)</p><p className="font-bold">{result.printSizeInches.width.toFixed(2)}×{result.printSizeInches.height.toFixed(2)}</p></div>
              <div><p className="text-xs text-muted-foreground">Print (cm)</p><p className="font-bold">{result.printSizeCm.width.toFixed(2)}×{result.printSizeCm.height.toFixed(2)}</p></div>
              <div><p className="text-xs text-muted-foreground">Print (mm)</p><p className="font-bold">{result.printSizeMm.width.toFixed(2)}×{result.printSizeMm.height.toFixed(2)}</p></div>
              <div><p className="text-xs text-muted-foreground">Aspect ratio</p><p className="font-bold">{result.stats.aspectRatio.toFixed(3)}</p></div>
              <div><p className="text-xs text-muted-foreground">Resampled</p><p className="font-bold">{result.resampled ? "Yes" : "No"}</p></div>
            </div>
            {result.warnings.length > 0 && <div className="mt-3 text-xs text-amber-600">{result.warnings.join(" ")}</div>}
          </CardContent>
        </Card>
      )}

      <Card>
        <CardHeader className="pb-3"><CardTitle className="text-sm">Common print sizes @ {targetDpi} DPI</CardTitle></CardHeader>
        <CardContent className="p-3">
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-xs">
            {PRINT_SIZES.map((s) => {
              const px = pixelsFromInches(s.widthIn, s.heightIn, targetDpi);
              return (
                <div key={s.name} className="rounded-md border p-2">
                  <p className="font-medium">{s.name}</p>
                  <p className="text-muted-foreground">{px.width}×{px.height}px</p>
                </div>
              );
            })}
          </div>
        </CardContent>
      </Card>

      {history.length > 0 && (
        <Card>
          <CardHeader className="pb-3"><CardTitle className="text-sm">History ({history.length})</CardTitle></CardHeader>
          <CardContent className="p-3">
            <div className="space-y-2 text-xs">
              {history.map((h, i) => (
                <div key={i} className="flex gap-3">
                  <Badge variant="outline">{h.width}×{h.height}</Badge>
                  <Badge variant="outline">{h.targetDpi} DPI</Badge>
                  <Badge variant="outline" className={qualityColor(h.quality)}>{h.quality}</Badge>
                  <span className="text-muted-foreground">{h.printSizeInches.width.toFixed(2)}×{h.printSizeInches.height.toFixed(2)} in</span>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {error && <ErrorBanner message={error} />}
      <Card><CardContent className="p-4"><p className="text-xs text-muted-foreground"><strong className="text-foreground">Privacy:</strong> DPI calculations run locally in your browser. No data is uploaded.</p></CardContent></Card>
    </div>
  );
}
