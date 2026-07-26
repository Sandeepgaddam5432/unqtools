"use client";

import React, { useState, useCallback, useMemo } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { ErrorBanner, CopyButton, DownloadButton } from "../../_shared";
import {
  calculatePrintSize,
  statsToCsv,
  PAPER_SIZES,
  fitsOnPaper,
  type PrintCalcResult,
  type LengthUnit,
} from "./logic";
import { toast } from "sonner";

export default function ImagePrintSizeCalc() {
  const [width, setWidth] = useState(3000);
  const [height, setHeight] = useState(2000);
  const [dpi, setDpi] = useState(300);
  const [unit, setUnit] = useState<LengthUnit>("mm");
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<PrintCalcResult | null>(null);
  const [history, setHistory] = useState<PrintCalcResult[]>([]);

  const apply = useCallback(() => {
    setError(null);
    const r = calculatePrintSize({ width, height, dpi, unit });
    if ("error" in r) { setError(r.error); return; }
    setResult(r);
    setHistory((h) => [r, ...h].slice(0, 10));
    toast.success("Print size calculated");
  }, [width, height, dpi, unit]);

  const reset = useCallback(() => {
    setWidth(3000); setHeight(2000); setDpi(300); setUnit("mm");
    setResult(null); setError(null);
  }, []);

  const csv = useMemo(() => (result ? statsToCsv(result.stats) : ""), [result]);
  const qualityColor = (q: string) => q === "good" ? "text-emerald-600" : q === "fair" ? "text-amber-600" : "text-red-600";

  const paperFits = useMemo(() => {
    if (!result) return [];
    const wMm = result.printSize.width * (unit === "in" ? 25.4 : unit === "cm" ? 10 : 1);
    const hMm = result.printSize.height * (unit === "in" ? 25.4 : unit === "cm" ? 10 : 1);
    return PAPER_SIZES.map((p) => ({ name: p.name, fits: fitsOnPaper(wMm, hMm, p.name) }));
  }, [result, unit]);

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
              <Label className="text-xs text-muted-foreground">DPI</Label>
              <input type="number" min={1} max={4000} value={dpi} onChange={(e) => setDpi(Number(e.target.value))} className="w-full h-9 rounded-md border bg-background px-3 text-sm" />
            </div>
            <div>
              <Label className="text-xs text-muted-foreground">Output unit</Label>
              <div className="flex gap-2">
                {(["mm", "cm", "in"] as LengthUnit[]).map((u) => (
                  <Button key={u} size="sm" variant={unit === u ? "default" : "outline"} onClick={() => setUnit(u)}>{u}</Button>
                ))}
              </div>
            </div>
          </div>
          <div className="flex flex-wrap gap-2">
            <Button size="sm" onClick={apply}>Calculate</Button>
            <Button size="sm" variant="ghost" onClick={reset}>Reset</Button>
            <CopyButton getText={() => csv} label="Copy CSV" disabled={!csv} />
            <DownloadButton getText={() => csv} filename="print-size.csv" mime="text/csv" label="Download CSV" disabled={!csv} />
          </div>
        </CardContent>
      </Card>

      {result && (
        <Card>
          <CardHeader className="pb-3"><CardTitle className="text-sm">Print size at {result.dpi} DPI</CardTitle></CardHeader>
          <CardContent className="p-3">
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-sm">
              <div><p className="text-xs text-muted-foreground">Print size</p><p className="font-bold">{result.printSize.width.toFixed(2)}×{result.printSize.height.toFixed(2)} {result.printSize.unit}</p></div>
              <div><p className="text-xs text-muted-foreground">Quality</p><p className={`font-bold ${qualityColor(result.quality)}`}>{result.quality}</p></div>
              <div><p className="text-xs text-muted-foreground">Max @ 300 DPI</p><p className="font-bold">{result.maxPrintAtDpi.width.toFixed(2)}×{result.maxPrintAtDpi.height.toFixed(2)} {result.maxPrintAtDpi.unit}</p></div>
              <div><p className="text-xs text-muted-foreground">Min DPI (good)</p><p className="font-bold">{result.minDpiForGood}</p></div>
              <div><p className="text-xs text-muted-foreground">Megapixels</p><p className="font-bold">{result.stats.megapixels}</p></div>
              <div><p className="text-xs text-muted-foreground">Aspect ratio</p><p className="font-bold">{result.stats.aspectRatio.toFixed(3)}</p></div>
            </div>
            {result.warnings.length > 0 && <div className="mt-3 text-xs text-amber-600">{result.warnings.join(" ")}</div>}
            {result.recommendations.length > 0 && (
              <div className="mt-3 text-xs text-blue-600">
                <p className="font-medium">Recommendations:</p>
                <ul className="list-disc pl-5 mt-1">
                  {result.recommendations.map((r, i) => <li key={i}>{r}</li>)}
                </ul>
              </div>
            )}
          </CardContent>
        </Card>
      )}

      {paperFits.length > 0 && (
        <Card>
          <CardHeader className="pb-3"><CardTitle className="text-sm">Fits on standard paper sizes?</CardTitle></CardHeader>
          <CardContent className="p-3">
            <div className="flex flex-wrap gap-2">
              {paperFits.map((p) => (
                <Badge key={p.name} variant={p.fits ? "default" : "outline"}>{p.name}: {p.fits ? "✓" : "✗"}</Badge>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      <Card>
        <CardHeader className="pb-3"><CardTitle className="text-sm">Standard paper sizes</CardTitle></CardHeader>
        <CardContent className="p-3">
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-xs">
            {PAPER_SIZES.map((p) => (
              <div key={p.name} className="rounded-md border p-2">
                <p className="font-medium">{p.name}</p>
                <p className="text-muted-foreground">{p.widthMm}×{p.heightMm}mm</p>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      {history.length > 0 && (
        <Card>
          <CardHeader className="pb-3"><CardTitle className="text-sm">History</CardTitle></CardHeader>
          <CardContent className="p-3">
            <div className="space-y-2 text-xs">
              {history.map((h, i) => (
                <div key={i} className="flex gap-3 flex-wrap">
                  <Badge variant="outline">{h.width}×{h.height}px</Badge>
                  <Badge variant="outline">{h.dpi} DPI</Badge>
                  <Badge variant="outline" className={qualityColor(h.quality)}>{h.quality}</Badge>
                  <span className="text-muted-foreground">{h.printSize.width.toFixed(2)}×{h.printSize.height.toFixed(2)} {h.printSize.unit}</span>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {error && <ErrorBanner message={error} />}
      <Card><CardContent className="p-4"><p className="text-xs text-muted-foreground"><strong className="text-foreground">Privacy:</strong> all calculations run locally. No data is uploaded.</p></CardContent></Card>
    </div>
  );
}
